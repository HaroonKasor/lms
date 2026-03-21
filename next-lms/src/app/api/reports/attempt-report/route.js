import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';

function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function parseIsoDurationToSeconds(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);

    const match = raw.match(/^P(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)$/i);
    if (!match) return null;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    if (![hours, minutes, seconds].every(Number.isFinite)) return null;
    return (hours * 3600) + (minutes * 60) + seconds;
}

function extractDurationSeconds(payload = {}) {
    const result = payload?.result || {};
    const ext = result?.extensions || {};
    const byIso = parseIsoDurationToSeconds(result?.duration);
    if (Number.isFinite(byIso) && byIso > 0) return byIso;

    const candidates = [
        ext['https://w3id.org/xapi/video/extensions/time'],
        ext.time,
        result.currentTime,
        ext['https://w3id.org/xapi/video/extensions/length'],
        ext.length,
        result.length,
    ];
    for (const value of candidates) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) return n;
    }
    return 0;
}

function extractActivityTitle(payload = {}, fallback = 'Activity') {
    return String(
        payload?.object?.definition?.name?.['en-US']
        || payload?.object?.definition?.name?.th
        || payload?.object?.definition?.name?.en
        || payload?.object?.id
        || fallback
    ).trim() || fallback;
}

function toDisplayDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).replace(',', ' at');
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { searchParams } = new URL(request.url);

        const categoryId = toSafeNumber(searchParams.get('categoryId'), 0);
        const courseIdParam = toSafeNumber(searchParams.get('courseId'), 0);
        const userIdParam = toSafeNumber(searchParams.get('userId'), 0);

        const [categories, coursesRaw, enrollmentsRaw] = await Promise.all([
            prisma.category.findMany({
                where: { organization_id: organizationId },
                orderBy: { name: 'asc' },
                select: { id: true, name: true },
            }),
            prisma.course.findMany({
                where: {
                    organization_id: organizationId,
                    ...(categoryId > 0 ? { categoryId } : {}),
                },
                orderBy: { title: 'asc' },
                select: {
                    id: true,
                    title: true,
                    categoryId: true,
                    categories: { select: { name: true } },
                    sections: {
                        orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                        select: { id: true, title: true, isActive: true },
                    },
                },
            }),
            prisma.enrollment.findMany({
                where: { organization_id: organizationId },
                include: {
                    courses: { include: { categories: true } },
                    organization_users: {
                        include: {
                            users: { include: { profile: true } },
                        },
                    },
                },
                orderBy: { enrolledAt: 'desc' },
            }),
        ]);

        const courses = coursesRaw.map((course) => ({
            id: Number(course.id),
            name: String(course.title || '-'),
            categoryId: Number(course.categoryId || 0) || null,
            category: String(course?.categories?.name || '-'),
            sections: course.sections.map((section) => ({ id: Number(section.id), name: String(section.title || '-') })),
        }));

        const selectedCourseId = courseIdParam > 0
            ? courseIdParam
            : (courses[0]?.id || 0);

        const users = Array.from(
            new Map(
                enrollmentsRaw.map((enrollment) => {
                    const user = enrollment?.organization_users?.users;
                    const profile = user?.profile;
                    const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
                        || user?.username
                        || user?.email
                        || `User ${enrollment.userId}`;
                    return [
                        Number(enrollment.userId),
                        {
                            id: Number(enrollment.userId),
                            username: String(user?.username || user?.email || `user-${enrollment.userId}`),
                            name: fullName,
                        },
                    ];
                })
            ).values()
        ).sort((a, b) => a.name.localeCompare(b.name));

        const selectedUserId = userIdParam > 0
            ? userIdParam
            : (users[0]?.id || 0);

        const selectedEnrollment = enrollmentsRaw.find((enrollment) =>
            Number(enrollment.courseId) === Number(selectedCourseId)
            && Number(enrollment.userId) === Number(selectedUserId)
        ) || null;

        let sections = [];
        if (selectedEnrollment?.id) {
            const statements = await prisma.xapiStatement.findMany({
                where: { enrollmentId: Number(selectedEnrollment.id) },
                orderBy: { receivedAt: 'asc' },
                select: {
                    id: true,
                    receivedAt: true,
                    statement_json: true,
                },
                take: 1000,
            });

            const grouped = new Map();
            for (const row of statements) {
                const payload = row?.statement_json && typeof row.statement_json === 'object'
                    ? row.statement_json
                    : {};
                const activityTitle = extractActivityTitle(payload);
                const seconds = extractDurationSeconds(payload);
                const minutes = Number((seconds / 60).toFixed(2));

                if (!grouped.has(activityTitle)) {
                    grouped.set(activityTitle, []);
                }
                grouped.get(activityTitle).push({
                    id: Number(row.id),
                    date: toDisplayDate(payload?.timestamp || row.receivedAt),
                    duration: Number.isFinite(minutes) ? minutes.toFixed(2) : '0.00',
                });
            }

            sections = Array.from(grouped.entries()).map(([title, records]) => ({
                title,
                records: records.map((record, index) => ({
                    id: index + 1,
                    date: record.date,
                    duration: record.duration,
                })),
            }));
        }

        const selectedCourse = courses.find((course) => Number(course.id) === Number(selectedCourseId)) || null;
        const selectedUser = users.find((user) => Number(user.id) === Number(selectedUserId)) || null;
        const selectedCategory = categories.find((item) => Number(item.id) === Number(selectedCourse?.categoryId || 0)) || null;

        return NextResponse.json({
            selected: {
                categoryId: selectedCategory ? Number(selectedCategory.id) : null,
                categoryName: selectedCourse?.category || '-',
                courseId: selectedCourse ? Number(selectedCourse.id) : null,
                courseName: selectedCourse?.name || '-',
                userId: selectedUser ? Number(selectedUser.id) : null,
                userName: selectedUser?.name || '-',
                username: selectedUser?.username || '-',
                sessionName: selectedCourse?.sections?.[0]?.name || '-',
            },
            sections,
            filters: {
                categories: categories.map((item) => ({ id: Number(item.id), name: item.name })),
                courses: courses.map((course) => ({
                    id: Number(course.id),
                    name: course.name,
                    categoryId: course.categoryId,
                })),
                users,
            },
        });
    } catch (err) {
        console.error('[reports/attempt-report][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
