import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { ensureDefaultOrganization, resolveUserId } from '@/lib/server/enterprise-context';
import { getCourseCompatMaps } from '@/lib/server/compat-db';

const DB_ACTIVE_STATUSES = new Set(['enrolled', 'in_progress', 'completed']);

function isTruthyFlag(value) {
    if (value === true) return true;
    if (value === false || value == null) return false;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return false;
        if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    return Boolean(value);
}

function normalizeBatchStatus(value) {
    const key = String(value || 'APPROVED').trim().toUpperCase();
    if (key === 'LEARNING') return 'LEARNING';
    if (key === 'COMPLETED') return 'COMPLETED';
    if (key === 'FAILED') return 'FAILED';
    if (key === 'CANCELLED') return 'CANCELLED';
    return 'APPROVED';
}

function toEnrollmentUpdatePayload(targetStatus) {
    const now = new Date();

    if (targetStatus === 'LEARNING') {
        return {
            status: 'in_progress',
            startedAt: now,
            lastActivityAt: now,
            progressPercent: 1,
            completedAt: null,
        };
    }

    if (targetStatus === 'COMPLETED') {
        return {
            status: 'completed',
            startedAt: now,
            completedAt: now,
            lastActivityAt: now,
            progressPercent: 100,
        };
    }

    if (targetStatus === 'FAILED') {
        return {
            status: 'dropped',
            lastActivityAt: now,
        };
    }

    if (targetStatus === 'CANCELLED') {
        return {
            status: 'cancelled',
            lastActivityAt: now,
        };
    }

    return {
        status: 'enrolled',
        progressPercent: 0,
    };
}

function getDisplayName(user) {
    const first = String(user?.profile?.firstName || '').trim();
    const last = String(user?.profile?.lastName || '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full || String(user?.username || user?.email || '').trim() || `User ${user?.id || ''}`;
}

export async function POST(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const courseId = Number(body?.courseId || 0);
        const rawKeys = Array.isArray(body?.userKeys) ? body.userKeys : [];
        const targetStatus = normalizeBatchStatus(body?.status);

        if (!Number.isInteger(courseId) || courseId <= 0) {
            return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
        }
        if (rawKeys.length === 0) {
            return NextResponse.json({ error: 'userKeys is required' }, { status: 400 });
        }
        if (rawKeys.length > 5000) {
            return NextResponse.json({ error: 'Maximum 5000 rows per batch' }, { status: 400 });
        }

        const course = await prisma.course.findFirst({
            where: {
                id: courseId,
                organization_id: organizationId,
            },
            select: {
                id: true,
                title: true,
                maxEnrollment: true,
            },
        });
        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const rows = rawKeys.map((raw, index) => ({
            rowNo: index + 1,
            input: String(raw || '').trim(),
        }));

        const uniqueKeyMap = new Map();
        for (const row of rows) {
            if (!row.input || uniqueKeyMap.has(row.input)) continue;
            uniqueKeyMap.set(row.input, null);
        }

        for (const userKey of uniqueKeyMap.keys()) {
            const userId = await resolveUserId(userKey);
            uniqueKeyMap.set(userKey, userId || null);
        }

        const resolvedUserIds = Array.from(
            new Set(Array.from(uniqueKeyMap.values()).filter((id) => Number.isInteger(id) && id > 0))
        );

        const orgUsers = resolvedUserIds.length > 0
            ? await prisma.organization_users.findMany({
                where: {
                    organization_id: organizationId,
                    user_id: { in: resolvedUserIds },
                },
                select: { user_id: true },
            })
            : [];
        const orgUserIdSet = new Set(orgUsers.map((row) => Number(row.user_id)));

        const users = resolvedUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: resolvedUserIds } },
                include: {
                    profile: {
                        select: {
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            })
            : [];
        const userMap = new Map(users.map((user) => [Number(user.id), user]));

        const existingEnrollments = resolvedUserIds.length > 0
            ? await prisma.enrollment.findMany({
                where: {
                    organization_id: organizationId,
                    courseId: course.id,
                    userId: { in: resolvedUserIds },
                },
                select: {
                    id: true,
                    userId: true,
                    status: true,
                },
            })
            : [];
        const existingMap = new Map(existingEnrollments.map((enrollment) => [Number(enrollment.userId), enrollment]));

        let activeCount = await prisma.enrollment.count({
            where: {
                organization_id: organizationId,
                courseId: course.id,
                status: { in: Array.from(DB_ACTIVE_STATUSES) },
            },
        });

        const courseCompatMaps = await getCourseCompatMaps([course.id]);
        const courseSettings = courseCompatMaps?.courseSettingsByCourseId?.[String(course.id)] || {};
        const maxEnrollment = Number(course.maxEnrollment || 0);
        const hasCourseCapacity = Number.isInteger(maxEnrollment) && maxEnrollment > 0;
        const limitEnabled = hasCourseCapacity
            && !isTruthyFlag(courseSettings?.registerUnlimit)
            && !isTruthyFlag(courseSettings?.maxLearnerUnlimit);

        const processedUserIds = new Set();
        const updatePayload = toEnrollmentUpdatePayload(targetStatus);
        const results = [];

        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        for (const row of rows) {
            if (!row.input) {
                failedCount += 1;
                results.push({
                    rowNo: row.rowNo,
                    input: row.input,
                    success: false,
                    message: 'Empty value',
                });
                continue;
            }

            const userId = uniqueKeyMap.get(row.input);
            if (!userId) {
                failedCount += 1;
                results.push({
                    rowNo: row.rowNo,
                    input: row.input,
                    success: false,
                    message: 'User not found',
                });
                continue;
            }

            if (!orgUserIdSet.has(Number(userId))) {
                failedCount += 1;
                results.push({
                    rowNo: row.rowNo,
                    input: row.input,
                    userId: Number(userId),
                    success: false,
                    message: 'User is not in this organization',
                });
                continue;
            }

            if (processedUserIds.has(Number(userId))) {
                skippedCount += 1;
                const user = userMap.get(Number(userId));
                results.push({
                    rowNo: row.rowNo,
                    input: row.input,
                    userId: Number(userId),
                    username: user?.username || '',
                    fullName: getDisplayName(user),
                    success: true,
                    skipped: true,
                    message: 'Duplicate row in file (already processed)',
                });
                continue;
            }

            const existing = existingMap.get(Number(userId)) || null;
            const consumesSeat = limitEnabled && (!existing || !DB_ACTIVE_STATUSES.has(String(existing.status || '').toLowerCase()));
            if (consumesSeat && activeCount >= maxEnrollment) {
                failedCount += 1;
                const user = userMap.get(Number(userId));
                results.push({
                    rowNo: row.rowNo,
                    input: row.input,
                    userId: Number(userId),
                    username: user?.username || '',
                    fullName: getDisplayName(user),
                    success: false,
                    message: `Course is full (${maxEnrollment} seats)`,
                });
                continue;
            }

            try {
                let enrollment;
                if (existing) {
                    enrollment = await prisma.enrollment.update({
                        where: { id: Number(existing.id) },
                        data: updatePayload,
                        select: { id: true, status: true },
                    });
                } else {
                    enrollment = await prisma.enrollment.create({
                        data: {
                            userId: Number(userId),
                            courseId: Number(course.id),
                            organization_id: Number(organizationId),
                            ...updatePayload,
                        },
                        select: { id: true, status: true },
                    });
                    existingMap.set(Number(userId), {
                        id: enrollment.id,
                        userId: Number(userId),
                        status: enrollment.status,
                    });
                }

                if (consumesSeat) {
                    activeCount += 1;
                }

                processedUserIds.add(Number(userId));
                successCount += 1;
                const user = userMap.get(Number(userId));
                results.push({
                    rowNo: row.rowNo,
                    input: row.input,
                    userId: Number(userId),
                    username: user?.username || '',
                    fullName: getDisplayName(user),
                    success: true,
                    message: existing ? 'Enrollment updated' : 'Enrolled successfully',
                });
            } catch (err) {
                failedCount += 1;
                const user = userMap.get(Number(userId));
                results.push({
                    rowNo: row.rowNo,
                    input: row.input,
                    userId: Number(userId),
                    username: user?.username || '',
                    fullName: getDisplayName(user),
                    success: false,
                    message: err?.message || 'Enrollment failed',
                });
            }
        }

        return NextResponse.json({
            success: true,
            course: {
                id: Number(course.id),
                name: String(course.title || ''),
            },
            summary: {
                totalRows: rows.length,
                successCount,
                failedCount,
                skippedCount,
            },
            results,
        });
    } catch (err) {
        console.error('[enrollments/batch/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
