import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { listContents } from '@/lib/server/compat-db';
import { requireSession } from '@/lib/server/auth';
import {
    ensureDefaultOrganization,
    getUserDisplayName,
    mapRoleCodesToSessionRole,
} from '@/lib/server/enterprise-context';

function monthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
    const d = new Date(date);
    return d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
}

function parsePayload(payloadJson) {
    if (!payloadJson) return null;
    if (typeof payloadJson === 'object') return payloadJson;
    try {
        return JSON.parse(payloadJson);
    } catch {
        return null;
    }
}

function normalizeAvatarUrl(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;
    if (raw.startsWith('/')) return raw;
    return `/${raw}`;
}

async function getRoleMapByUserIds(userIds, organizationId) {
    const ids = (userIds || []).filter(Boolean);
    if (ids.length === 0) return new Map();

    const rows = await prisma.userRole.findMany({
        where: {
            organization_id: organizationId,
            userId: { in: ids },
        },
        include: { roles: true },
    });

    const map = new Map();
    for (const row of rows) {
        const key = String(row.userId);
        const list = map.get(key) || [];
        const code = String(row?.roles?.code || '').toUpperCase();
        if (code) list.push(code);
        map.set(key, list);
    }
    return map;
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const contentsCount = (await listContents()).length;

        const [
            usersCount,
            activeUsersCount,
            coursesCount,
            publicCoursesCount,
            sectionsCount,
            enrollmentsCount,
            learningEnrollmentsCount,
            completedEnrollmentsCount,
            certificatesCount,
            pendingEnrollmentApprovalsCount,
            pendingCertificateApprovalsCount,
            usersInRange,
            certsInRange,
            recentUsers,
            recentEnrollments,
            recentStatements,
        ] = await Promise.all([
            prisma.user.count({
                where: { organization_users: { some: { organization_id: organizationId } } },
            }),
            prisma.user.count({
                where: {
                    status: 'active',
                    organization_users: { some: { organization_id: organizationId } },
                },
            }),
            prisma.course.count({ where: { organization_id: organizationId } }),
            prisma.course.count({
                where: {
                    organization_id: organizationId,
                    visibility: 'public',
                    publishStatus: 'published',
                },
            }),
            prisma.section.count({
                where: { course: { organization_id: organizationId } },
            }),
            prisma.enrollment.count({ where: { organization_id: organizationId } }),
            prisma.enrollment.count({
                where: { organization_id: organizationId, status: 'in_progress' },
            }),
            prisma.enrollment.count({
                where: { organization_id: organizationId, status: 'completed' },
            }),
            prisma.certificate.count({ where: { status: 'issued' } }),
            prisma.enrollment.count({
                where: { organization_id: organizationId, status: 'enrolled' },
            }),
            prisma.enrollment.count({
                where: {
                    organization_id: organizationId,
                    status: 'completed',
                    courses: {
                        hasCertificate: true,
                        certificateMode: 'manual',
                    },
                    OR: [
                        { certificates: { is: null } },
                        {
                            certificates: {
                                is: {
                                    status: { not: 'issued' },
                                },
                            },
                        },
                    ],
                },
            }),
            prisma.user.findMany({
                where: {
                    organization_users: { some: { organization_id: organizationId } },
                    lastLoginAt: { gte: start },
                },
                select: { lastLoginAt: true },
            }),
            prisma.certificate.findMany({
                where: { issuedAt: { gte: start } },
                select: { issuedAt: true },
            }),
            prisma.user.findMany({
                where: { organization_users: { some: { organization_id: organizationId } } },
                orderBy: { id: 'desc' },
                take: 5,
                include: { profile: true },
            }),
            prisma.enrollment.findMany({
                where: { organization_id: organizationId },
                orderBy: { enrolledAt: 'desc' },
                take: 5,
                include: { courses: { select: { title: true } } },
            }),
            prisma.xapiStatement.findMany({
                where: {
                    enrollment: {
                        organization_id: organizationId,
                    },
                },
                orderBy: { receivedAt: 'desc' },
                take: 5,
                select: {
                    statement_json: true,
                    receivedAt: true,
                    actor: {
                        select: {
                            username: true,
                            email: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    avatarUrl: true,
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        const roleMap = await getRoleMapByUserIds(
            recentUsers.map((row) => row.id),
            organizationId
        );

        const months = [];
        for (let i = 5; i >= 0; i -= 1) {
            months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
        }

        const userMap = new Map(months.map((m) => [monthKey(m), 0]));
        const certMap = new Map(months.map((m) => [monthKey(m), 0]));

        usersInRange.forEach((u) => {
            if (!u?.lastLoginAt) return;
            const key = monthKey(u.lastLoginAt);
            if (userMap.has(key)) userMap.set(key, userMap.get(key) + 1);
        });
        certsInRange.forEach((c) => {
            if (!c?.issuedAt) return;
            const key = monthKey(c.issuedAt);
            if (certMap.has(key)) certMap.set(key, certMap.get(key) + 1);
        });

        const userTrend = months.map((m) => ({ name: monthLabel(m), value: userMap.get(monthKey(m)) || 0 }));
        const graduateTrend = months.map((m) => ({ name: monthLabel(m), value: certMap.get(monthKey(m)) || 0 }));

        return NextResponse.json({
            totals: {
                users: usersCount,
                activeUsers: activeUsersCount,
                courses: coursesCount,
                publicCourses: publicCoursesCount,
                sections: sectionsCount,
                contents: contentsCount,
                enrollments: enrollmentsCount,
                learningEnrollments: learningEnrollmentsCount,
                completedEnrollments: completedEnrollmentsCount,
                certificates: certificatesCount,
                pendingEnrollmentApprovals: pendingEnrollmentApprovalsCount,
                pendingCertificateApprovals: pendingCertificateApprovalsCount,
            },
            trend: {
                users: userTrend,
                graduates: graduateTrend,
            },
            recentUsers: recentUsers.map((u) => ({
                id: u.id,
                username: u.username,
                fullName: getUserDisplayName(u) || u.username,
                role: mapRoleCodesToSessionRole(roleMap.get(String(u.id)) || []),
                isActive: String(u.status || '').toLowerCase() === 'active',
                createdAt: null,
            })),
            recentEnrollments: recentEnrollments.map((e) => ({
                id: e.id,
                userId: e.userId,
                status: e.status,
                progress: Number(e.progressPercent || 0),
                enrolledAt: e.enrolledAt,
                courseName: e.courses?.title || '-',
                sectionName: '-',
            })),
            recentStatements: recentStatements.map((s) => {
                const payload = parsePayload(s.statement_json) || {};
                const actorFromDb = s?.actor || null;
                const actorNameFromDb = actorFromDb ? (getUserDisplayName(actorFromDb) || actorFromDb.username || actorFromDb.email || '') : '';
                return {
                    actorName: actorNameFromDb || payload?.actor?.name || '-',
                    actorUsername: actorFromDb?.username || null,
                    avatar: normalizeAvatarUrl(actorFromDb?.profile?.avatarUrl || ''),
                    verbDisplay:
                        payload?.verb?.display?.['en-US'] ||
                        payload?.verb?.display?.en ||
                        payload?.verb?.id ||
                        '-',
                    objectName:
                        payload?.object?.definition?.name?.['en-US'] ||
                        payload?.object?.definition?.name?.en ||
                        payload?.object?.id ||
                        '-',
                    timestamp: s.receivedAt,
                };
            }),
        });
    } catch (err) {
        console.error('[admin/stats] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
