import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';

function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeLearnerStatus(enrollment) {
    const dbStatus = String(enrollment?.status || '').toLowerCase();
    const progress = toSafeNumber(enrollment?.progressPercent, 0);
    const hasStartedAt = Boolean(enrollment?.startedAt);
    const hasCompletedAt = Boolean(enrollment?.completedAt);
    const progressRows = Array.isArray(enrollment?.learning_progress) ? enrollment.learning_progress : [];
    const progressSaysCompleted = progressRows.some((row) => {
        const rowStatus = String(row?.status || '').toLowerCase();
        const rowProgress = toSafeNumber(row?.progressPercent, 0);
        return rowStatus === 'completed'
            || row?.completion === true
            || (row?.success === true && rowProgress >= 100)
            || rowProgress >= 100;
    });

    if (dbStatus === 'dropped' || dbStatus === 'cancelled') return 'SUSPENDED';
    if (dbStatus === 'completed' || hasCompletedAt || progressSaysCompleted) return 'COMPLETED';
    if (dbStatus === 'in_progress' || hasStartedAt || progress > 0) return 'LEARNING';
    return 'NOT_STARTED';
}

function toChartBucket(status) {
    if (status === 'COMPLETED') return 'Passed';
    if (status === 'LEARNING') return 'Learning';
    if (status === 'SUSPENDED') return 'Failed';
    return 'Not attempted';
}

function matchesSearch(text, query) {
    if (!query) return true;
    return String(text || '').toLowerCase().includes(query);
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { searchParams } = new URL(request.url);

        const categoryId = toSafeNumber(searchParams.get('categoryId'), 0);
        const courseId = toSafeNumber(searchParams.get('courseId'), 0);
        const sectionId = toSafeNumber(searchParams.get('sectionId'), 0);
        const userStatus = String(searchParams.get('userStatus') || 'ALL').toUpperCase();
        const q = String(searchParams.get('q') || '').trim().toLowerCase();

        const [categories, allCourses, allSections, enrollments] = await Promise.all([
            prisma.category.findMany({
                where: { organization_id: organizationId },
                orderBy: { name: 'asc' },
                select: { id: true, name: true },
            }),
            prisma.course.findMany({
                where: { organization_id: organizationId },
                orderBy: { title: 'asc' },
                select: { id: true, title: true, categoryId: true },
            }),
            prisma.section.findMany({
                where: courseId > 0 ? { courseId } : {},
                orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                select: { id: true, courseId: true, title: true, isActive: true },
            }),
            prisma.enrollment.findMany({
                where: { organization_id: organizationId },
                include: {
                    courses: {
                        include: { categories: true },
                    },
                    organization_users: {
                        include: {
                            users: {
                                include: { profile: true },
                            },
                        },
                    },
                    learning_progress: {
                        select: {
                            sectionId: true,
                            status: true,
                            progressPercent: true,
                            success: true,
                            completion: true,
                        },
                    },
                },
                orderBy: { enrolledAt: 'desc' },
            }),
        ]);

        const rows = enrollments
            .map((enrollment) => {
                const user = enrollment?.organization_users?.users;
                const profile = user?.profile;
                const status = normalizeLearnerStatus(enrollment);

                const row = {
                    id: Number(enrollment.id || 0),
                    categoryId: Number(enrollment?.courses?.categoryId || 0) || null,
                    category: String(enrollment?.courses?.categories?.name || '-'),
                    courseId: Number(enrollment?.courseId || enrollment?.courses?.id || 0),
                    course: String(enrollment?.courses?.title || '-'),
                    username: String(user?.username || user?.email || '-'),
                    firstName: String(profile?.firstName || ''),
                    lastName: String(profile?.lastName || ''),
                    status,
                };
                return row;
            })
            .filter((row, _, list) => {
                // Keep one row per user/course (latest enrollment already first by enrolledAt)
                const key = `${row.courseId}:${row.username}`;
                const firstIndex = list.findIndex((item) => `${item.courseId}:${item.username}` === key);
                return firstIndex === list.indexOf(row);
            })
            .filter((row) => {
                if (categoryId > 0 && row.categoryId !== categoryId) return false;
                if (courseId > 0 && row.courseId !== courseId) return false;
                if (userStatus !== 'ALL' && row.status !== userStatus) return false;

                if (sectionId > 0) {
                    const rowEnrollment = enrollments.find((e) => Number(e.id) === row.id);
                    const hasSection = Array.isArray(rowEnrollment?.learning_progress)
                        && rowEnrollment.learning_progress.some((lp) => Number(lp.sectionId) === sectionId);
                    if (!hasSection) return false;
                }

                const fullName = `${row.firstName} ${row.lastName}`.trim();
                return matchesSearch(row.username, q)
                    || matchesSearch(fullName, q)
                    || matchesSearch(row.course, q)
                    || matchesSearch(row.category, q);
            });

        const summaryBase = {
            Passed: 0,
            Learning: 0,
            Failed: 0,
            'Not attempted': 0,
        };
        for (const row of rows) {
            const bucket = toChartBucket(row.status);
            summaryBase[bucket] = Number(summaryBase[bucket] || 0) + 1;
        }

        const total = rows.length;
        const summary = Object.entries(summaryBase).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? `${Math.round((value / total) * 100)}%` : '0%',
        }));

        const courses = allCourses
            .filter((course) => (categoryId > 0 ? Number(course.categoryId || 0) === categoryId : true))
            .map((course) => ({ id: Number(course.id), name: String(course.title || '-') }));

        const sections = allSections
            .filter((section) => (courseId > 0 ? Number(section.courseId) === courseId : true))
            .map((section) => ({ id: Number(section.id), name: String(section.title || '-') }));

        return NextResponse.json({
            summary,
            totalLearners: total,
            rows: rows.map((row, index) => ({
                id: row.id,
                no: index + 1,
                category: row.category,
                course: row.course,
                username: row.username,
                firstName: row.firstName || '-',
                lastName: row.lastName || '-',
                status: row.status,
            })),
            filters: {
                categories: categories.map((item) => ({ id: Number(item.id), name: item.name })),
                courses,
                sections,
                statuses: [
                    { id: 'ALL', name: 'All' },
                    { id: 'NOT_STARTED', name: 'Not attempted' },
                    { id: 'LEARNING', name: 'Learning' },
                    { id: 'COMPLETED', name: 'Passed' },
                    { id: 'SUSPENDED', name: 'Failed' },
                ],
            },
            selected: {
                categoryId: categoryId > 0 ? categoryId : null,
                courseId: courseId > 0 ? courseId : null,
                sectionId: sectionId > 0 ? sectionId : null,
                userStatus,
                q: String(searchParams.get('q') || ''),
            },
        });
    } catch (err) {
        console.error('[reports/learner-status][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
