import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { buildAttemptSectionsFromStatements } from '@/lib/server/attempt-report-time';

const STATEMENT_QUERY_LIMIT = 5000;

function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function buildUserDisplay(enrollment) {
    const user = enrollment?.organization_users?.users;
    const profile = user?.profile;
    const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
        || user?.username
        || user?.email
        || `User ${enrollment?.userId}`;
    return {
        id: Number(enrollment?.userId || 0),
        username: String(user?.username || user?.email || `user-${enrollment?.userId}`),
        name: fullName,
        email: String(user?.email || ''),
    };
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
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
                where: { organization_id: organizationId },
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
                where: {
                    organization_id: organizationId,
                    ...(courseIdParam > 0 ? { courseId: courseIdParam } : {}),
                    ...(userIdParam > 0 ? { userId: userIdParam } : {}),
                    ...(categoryId > 0 ? { courses: { categoryId } } : {}),
                },
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
        }));

        const usersMap = new Map();
        for (const enrollment of enrollmentsRaw) {
            const userInfo = buildUserDisplay(enrollment);
            if (userInfo.id && !usersMap.has(userInfo.id)) {
                usersMap.set(userInfo.id, userInfo);
            }
        }
        const users = Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        const enrollmentIds = enrollmentsRaw.map((e) => Number(e.id)).filter(Boolean);
        const statementsByEnrollment = new Map();
        if (enrollmentIds.length > 0) {
            const statements = await prisma.xapiStatement.findMany({
                where: { enrollmentId: { in: enrollmentIds } },
                orderBy: [{ enrollmentId: 'asc' }, { receivedAt: 'asc' }],
                select: {
                    id: true,
                    enrollmentId: true,
                    receivedAt: true,
                    statement_json: true,
                },
                take: STATEMENT_QUERY_LIMIT,
            });
            for (const stmt of statements) {
                const key = Number(stmt.enrollmentId);
                if (!statementsByEnrollment.has(key)) statementsByEnrollment.set(key, []);
                statementsByEnrollment.get(key).push(stmt);
            }
        }

        const rows = [];
        for (const enrollment of enrollmentsRaw) {
            const enrollmentId = Number(enrollment.id);
            const statements = statementsByEnrollment.get(enrollmentId) || [];
            if (statements.length === 0) continue;
            const sections = buildAttemptSectionsFromStatements(statements);
            const userInfo = buildUserDisplay(enrollment);
            const courseName = String(enrollment?.courses?.title || '-');
            const categoryName = String(enrollment?.courses?.categories?.name || '-');
            for (const section of sections) {
                const records = Array.isArray(section.records) ? section.records : [];
                for (const record of records) {
                    rows.push({
                        enrollmentId,
                        userId: userInfo.id,
                        userName: userInfo.name,
                        userEmail: userInfo.email,
                        username: userInfo.username,
                        courseId: Number(enrollment?.courseId || 0),
                        courseName,
                        categoryId: Number(enrollment?.courses?.categoryId || 0) || null,
                        categoryName,
                        sectionTitle: String(section.title || 'Activity'),
                        date: record.date,
                        duration: record.duration,
                    });
                }
            }
        }

        rows.sort((a, b) => {
            if (a.courseName !== b.courseName) return a.courseName.localeCompare(b.courseName);
            if (a.userName !== b.userName) return a.userName.localeCompare(b.userName);
            if (a.sectionTitle !== b.sectionTitle) return a.sectionTitle.localeCompare(b.sectionTitle);
            return String(a.date || '').localeCompare(String(b.date || ''));
        });
        const numbered = rows.map((row, index) => ({ ...row, no: index + 1 }));

        const selectedCategory = categoryId > 0
            ? categories.find((item) => Number(item.id) === categoryId) || null
            : null;
        const selectedCourse = courseIdParam > 0
            ? courses.find((course) => Number(course.id) === courseIdParam) || null
            : null;
        const selectedUser = userIdParam > 0
            ? users.find((user) => Number(user.id) === userIdParam) || null
            : null;

        return NextResponse.json({
            rows: numbered,
            totalCount: numbered.length,
            enrollmentCount: enrollmentsRaw.length,
            selected: {
                categoryId: selectedCategory ? Number(selectedCategory.id) : null,
                categoryName: selectedCategory ? selectedCategory.name : 'All',
                courseId: selectedCourse ? Number(selectedCourse.id) : null,
                courseName: selectedCourse ? selectedCourse.name : 'All',
                userId: selectedUser ? Number(selectedUser.id) : null,
                userName: selectedUser ? selectedUser.name : 'All',
                username: selectedUser ? selectedUser.username : 'All',
            },
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
