import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';

const DEFAULT_PASSING_PERCENT = 80;

function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

function parseScoreRange(range = '') {
    const raw = String(range || '').trim();
    if (!raw || raw.toUpperCase() === 'ALL') return null;
    const [minRaw, maxRaw] = raw.split('-');
    const min = Number(minRaw);
    const max = Number(maxRaw);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return {
        min: Math.max(0, Math.min(100, min)),
        max: Math.max(0, Math.min(100, max)),
    };
}

function matchesScoreRange(score, range) {
    if (!range) return true;
    return score >= range.min && score <= range.max;
}

function toRangeLabel(score) {
    if (score <= 20) return '0-20';
    if (score <= 40) return '21-40';
    if (score <= 60) return '41-60';
    if (score <= 80) return '61-80';
    return '81-100';
}

function toOptionalNumber(value) {
    if (value == null || value === '') return null;
    let raw = value;
    if (raw && typeof raw === 'object') {
        if (typeof raw.toNumber === 'function') {
            try { raw = raw.toNumber(); } catch { raw = raw.toString?.() ?? raw; }
        } else if (typeof raw.toString === 'function') {
            raw = raw.toString();
        }
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function scorePercentFromLearningProgress(row = null) {
    if (!row || typeof row !== 'object') return null;
    const raw = toOptionalNumber(row?.scoreRaw);
    const scaled = toOptionalNumber(row?.scoreScaled);
    if (scaled !== null && (raw === null || raw > 100)) return clampPercent(scaled <= 1 ? scaled * 100 : scaled);

    if (raw !== null) {
        if (raw > 100 && scaled === null) return null;
        return clampPercent(raw <= 1 ? raw * 100 : raw);
    }

    if (scaled !== null) return clampPercent(scaled <= 1 ? scaled * 100 : scaled);

    return null;
}

function resolveAssessmentResult({ percent = null, success = null, completion = null, status = '' } = {}) {
    const normalizedPercent = toOptionalNumber(percent);
    if (normalizedPercent !== null) {
        return normalizedPercent >= DEFAULT_PASSING_PERCENT ? 'Passed' : 'Failed';
    }
    if (success === true) return 'Passed';
    if (success === false) return 'Failed';
    if (completion === true || String(status || '').toLowerCase() === 'completed') return 'Passed';
    return '-';
}

function resolveLearningProgressResult(row = null) {
    if (!row || typeof row !== 'object') return '-';
    return resolveAssessmentResult({
        percent: scorePercentFromLearningProgress(row),
        success: typeof row?.success === 'boolean' ? row.success : null,
        completion: typeof row?.completion === 'boolean' ? row.completion : null,
        status: row?.status,
    });
}

function resolveTimeSpentMinutes(progressRows = []) {
    if (!Array.isArray(progressRows) || progressRows.length === 0) return null;
    let seconds = 0;
    for (const row of progressRows) {
        const currentTime = Number(row?.currentTime || 0);
        const duration = Number(row?.duration || 0);
        const candidate = Math.max(
            Number.isFinite(currentTime) ? currentTime : 0,
            Number.isFinite(duration) ? duration : 0
        );
        if (candidate > seconds) seconds = candidate;
    }
    if (seconds <= 0) return null;
    return Number((seconds / 60).toFixed(2));
}

function buildPersonInfo(enrollment) {
    const user = enrollment?.organization_users?.users;
    const profile = user?.profile;
    const username = String(user?.username || user?.email || '-');
    const firstName = String(profile?.firstName || '');
    const lastName = String(profile?.lastName || '');
    const fullName = `${firstName} ${lastName}`.trim() || username;
    return { username, firstName, lastName, fullName };
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { searchParams } = new URL(request.url);

        const categoryId = toSafeNumber(searchParams.get('categoryId'), 0);
        const courseIdParam = toSafeNumber(searchParams.get('courseId'), 0);
        const quizIdParam = toSafeNumber(searchParams.get('quizId'), 0);
        const userIdParam = toSafeNumber(searchParams.get('userId'), 0);
        const q = String(searchParams.get('q') || '').trim().toLowerCase();
        const scoreRange = parseScoreRange(searchParams.get('scoreRange'));

        const [categories, coursesRaw] = await Promise.all([
            prisma.category.findMany({
                where: { organization_id: organizationId },
                orderBy: { name: 'asc' },
                select: { id: true, name: true },
            }),
            prisma.course.findMany({
                where: { organization_id: organizationId },
                orderBy: { title: 'asc' },
                include: {
                    categories: { select: { name: true } },
                    quizzes: {
                        where: { status: 'published' },
                        select: {
                            id: true,
                            title: true,
                            sectionId: true,
                            passingScore: true,
                            questions: { select: { id: true } },
                        },
                        orderBy: { id: 'asc' },
                    },
                },
            }),
        ]);

        const courses = coursesRaw.map((course) => ({
            id: Number(course.id),
            name: String(course.title || '-'),
            categoryId: Number(course.categoryId || 0) || null,
            category: String(course?.categories?.name || '-'),
            quizzes: (course.quizzes || []).map((quiz) => ({
                id: Number(quiz.id),
                name: String(quiz.title || '-'),
                courseId: Number(course.id),
                courseName: String(course.title || '-'),
                categoryId: Number(course.categoryId || 0) || null,
                categoryName: String(course?.categories?.name || '-'),
                sectionId: Number(quiz.sectionId || 0),
                questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
                passingScore: Number(quiz.passingScore || 0),
            })),
        }));

        const allQuizzes = courses.flatMap((course) => course.quizzes);
        const quizById = new Map(allQuizzes.map((quiz) => [Number(quiz.id), quiz]));

        const quizzesForFilter = (() => {
            if (courseIdParam > 0) {
                const course = courses.find((c) => Number(c.id) === courseIdParam);
                return course?.quizzes || [];
            }
            if (categoryId > 0) {
                return allQuizzes.filter((quiz) => Number(quiz.categoryId) === categoryId);
            }
            return allQuizzes;
        })();

        const courseIdsInScope = (() => {
            if (courseIdParam > 0) return [courseIdParam];
            if (categoryId > 0) {
                return courses
                    .filter((c) => Number(c.categoryId) === categoryId)
                    .map((c) => Number(c.id));
            }
            return courses.map((c) => Number(c.id));
        })();

        const quizIdsInScope = (() => {
            if (quizIdParam > 0) return [quizIdParam];
            return quizzesForFilter.map((q) => Number(q.id));
        })();

        let attemptRows = [];
        let progressRowsList = [];

        if (courseIdsInScope.length > 0) {
            const attemptWhere = {
                course_id: { in: courseIdsInScope },
                ...(quizIdsInScope.length > 0 ? { quizId: { in: quizIdsInScope } } : {}),
                ...(userIdParam > 0 ? { enrollments: { userId: userIdParam } } : {}),
            };
            const attempts = await prisma.quizAttempt.findMany({
                where: attemptWhere,
                include: {
                    enrollments: {
                        include: {
                            organization_users: {
                                include: {
                                    users: { include: { profile: true } },
                                },
                            },
                            learning_progress: {
                                select: { sectionId: true, currentTime: true, duration: true },
                            },
                        },
                    },
                },
                orderBy: [{ course_id: 'asc' }, { quizId: 'asc' }, { enrollmentId: 'asc' }, { attemptNo: 'desc' }, { submittedAt: 'desc' }],
            });

            attemptRows = attempts.map((attempt) => {
                const enrollment = attempt?.enrollments;
                const quiz = quizById.get(Number(attempt?.quizId || 0));
                const { username, firstName, lastName, fullName } = buildPersonInfo(enrollment);
                const attemptScore = toOptionalNumber(attempt?.score);
                const scorePercent = attemptScore === null ? 0 : clampPercent(attemptScore);
                const totalQuestions = Number(quiz?.questionCount || 0);
                const rawScore = totalQuestions > 0
                    ? Math.round((scorePercent / 100) * totalQuestions)
                    : Math.round(scorePercent);
                const sectionScopedProgress = (enrollment?.learning_progress || []).filter((p) => {
                    if (!quiz?.sectionId) return true;
                    return Number(p.sectionId) === Number(quiz.sectionId);
                });
                const timeSpentMinutes = resolveTimeSpentMinutes(
                    sectionScopedProgress.length > 0 ? sectionScopedProgress : (enrollment?.learning_progress || []),
                );

                return {
                    no: 0,
                    enrollmentId: Number(enrollment?.id || 0),
                    userId: Number(enrollment?.userId || 0),
                    username,
                    firstName: firstName || '-',
                    lastName: lastName || '-',
                    courseId: Number(attempt?.course_id || 0),
                    courseName: quiz?.courseName || '-',
                    categoryName: quiz?.categoryName || '-',
                    quizId: Number(attempt?.quizId || 0),
                    quizName: quiz?.name || '-',
                    scorePercent: Number(scorePercent.toFixed(2)),
                    scoreText: totalQuestions > 0 ? `${rawScore}/${totalQuestions}` : `${Math.round(scorePercent)}/100`,
                    result: resolveAssessmentResult({
                        percent: attemptScore === null ? null : scorePercent,
                        success: typeof attempt?.passed === 'boolean' ? attempt.passed : null,
                    }),
                    attempt: Number(attempt?.attemptNo || 1),
                    timeSpent: timeSpentMinutes === null ? '-' : timeSpentMinutes.toFixed(2),
                    searchText: `${username} ${fullName} ${quiz?.name || ''} ${quiz?.courseName || ''}`.toLowerCase(),
                };
            });

            // Fallback: course-level scores stored in learningProgress for courses without quizAttempt rows
            const progressRows = await prisma.learningProgress.findMany({
                where: {
                    courseId: { in: courseIdsInScope },
                    enrollments: {
                        organization_id: organizationId,
                        ...(userIdParam > 0 ? { userId: userIdParam } : {}),
                    },
                    OR: [
                        { scoreRaw: { not: null } },
                        { scoreScaled: { not: null } },
                    ],
                },
                include: {
                    enrollments: {
                        include: {
                            organization_users: {
                                include: {
                                    users: { include: { profile: true } },
                                },
                            },
                            learning_progress: {
                                select: { currentTime: true, duration: true },
                            },
                            courses: {
                                include: { categories: true },
                            },
                        },
                    },
                },
                orderBy: [{ enrollmentId: 'asc' }, { id: 'desc' }],
            });

            const latestByEnrollment = new Map();
            for (const progressRow of progressRows) {
                const key = Number(progressRow.enrollmentId);
                if (latestByEnrollment.has(key)) continue;
                const percent = scorePercentFromLearningProgress(progressRow);
                const isRealScore = percent !== null && (percent > 0 || progressRow?.success === true);
                if (isRealScore) {
                    latestByEnrollment.set(key, progressRow);
                }
            }

            // Skip enrollments that already have a quizAttempt row for the scoped quiz
            const enrollmentIdsWithAttempt = new Set(attemptRows.map((row) => Number(row.enrollmentId)));

            progressRowsList = Array.from(latestByEnrollment.values())
                .filter((progressRow) => !enrollmentIdsWithAttempt.has(Number(progressRow?.enrollmentId)))
                .map((progressRow) => {
                    const enrollment = progressRow?.enrollments;
                    const { username, firstName, lastName, fullName } = buildPersonInfo(enrollment);
                    const scorePercent = scorePercentFromLearningProgress(progressRow);
                    const safeScorePercent = Number.isFinite(Number(scorePercent)) ? Number(scorePercent) : 0;
                    const timeSpentMinutes = resolveTimeSpentMinutes(enrollment?.learning_progress || []);
                    const courseName = String(enrollment?.courses?.title || '-');
                    const categoryName = String(enrollment?.courses?.categories?.name || '-');

                    return {
                        no: 0,
                        enrollmentId: Number(enrollment?.id || 0),
                        userId: Number(enrollment?.userId || 0),
                        username,
                        firstName: firstName || '-',
                        lastName: lastName || '-',
                        courseId: Number(enrollment?.courseId || 0),
                        courseName,
                        categoryName,
                        quizId: 0,
                        quizName: '-',
                        scorePercent: Number(safeScorePercent.toFixed(2)),
                        scoreText: `${Math.round(safeScorePercent)}/100`,
                        result: resolveLearningProgressResult(progressRow),
                        attempt: 1,
                        timeSpent: timeSpentMinutes === null ? '-' : timeSpentMinutes.toFixed(2),
                        searchText: `${username} ${fullName} ${courseName}`.toLowerCase(),
                    };
                });
        }

        let rows = [...attemptRows, ...progressRowsList];

        const usersMap = new Map();
        for (const row of rows) {
            const id = Number(row.userId);
            if (!id || usersMap.has(id)) continue;
            usersMap.set(id, {
                id,
                username: row.username,
                name: `${row.firstName !== '-' ? row.firstName : ''} ${row.lastName !== '-' ? row.lastName : ''}`.trim() || row.username,
            });
        }
        const users = Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        rows = rows
            .filter((row) => {
                if (userIdParam > 0 && Number(row.userId) !== userIdParam) return false;
                if (!matchesScoreRange(row.scorePercent, scoreRange)) return false;
                if (q && !row.searchText.includes(q)) return false;
                return true;
            })
            .sort((a, b) => {
                if (a.courseName !== b.courseName) return a.courseName.localeCompare(b.courseName);
                if (a.quizName !== b.quizName) return a.quizName.localeCompare(b.quizName);
                return b.scorePercent - a.scorePercent;
            })
            .map((row, index) => ({ ...row, no: index + 1 }));

        const bins = {
            '0-20': 0,
            '21-40': 0,
            '41-60': 0,
            '61-80': 0,
            '81-100': 0,
        };
        for (const row of rows) {
            bins[toRangeLabel(row.scorePercent)] += 1;
        }

        const chartData = [
            { name: '0-20', uv: bins['0-20'], fill: '#FF5A5F' },
            { name: '21-40', uv: bins['21-40'], fill: '#FF8A00' },
            { name: '41-60', uv: bins['41-60'], fill: '#FFC107' },
            { name: '61-80', uv: bins['61-80'], fill: '#00BCD4' },
            { name: '81-100', uv: bins['81-100'], fill: '#687EFF' },
        ];

        const selectedCategory = categoryId > 0
            ? categories.find((item) => Number(item.id) === categoryId) || null
            : null;
        const selectedCourse = courseIdParam > 0
            ? courses.find((course) => Number(course.id) === courseIdParam) || null
            : null;
        const selectedQuiz = quizIdParam > 0
            ? quizById.get(quizIdParam) || null
            : null;
        const selectedUser = userIdParam > 0
            ? users.find((u) => Number(u.id) === userIdParam) || null
            : null;

        return NextResponse.json({
            chartData,
            rows: rows.map((row) => ({
                no: row.no,
                username: row.username,
                firstName: row.firstName,
                lastName: row.lastName,
                courseName: row.courseName,
                categoryName: row.categoryName,
                quizName: row.quizName,
                score: row.scoreText,
                percent: `${Math.round(row.scorePercent)}%`,
                result: row.result,
                attempt: row.attempt,
                timeSpent: row.timeSpent,
            })),
            selected: {
                categoryId: selectedCategory ? Number(selectedCategory.id) : null,
                categoryName: selectedCategory ? selectedCategory.name : 'All',
                courseId: selectedCourse ? Number(selectedCourse.id) : null,
                courseName: selectedCourse ? selectedCourse.name : 'All',
                quizId: selectedQuiz ? Number(selectedQuiz.id) : null,
                quizName: selectedQuiz ? selectedQuiz.name : 'All',
                userId: selectedUser ? Number(selectedUser.id) : null,
                userName: selectedUser ? selectedUser.name : 'All',
                scoreRange: searchParams.get('scoreRange') || 'ALL',
                q: String(searchParams.get('q') || ''),
            },
            filters: {
                categories: categories.map((item) => ({ id: Number(item.id), name: item.name })),
                courses: courses.map((course) => ({
                    id: Number(course.id),
                    name: course.name,
                    categoryId: course.categoryId,
                })),
                quizzes: quizzesForFilter.map((quiz) => ({
                    id: Number(quiz.id),
                    name: quiz.name,
                    courseId: Number(quiz.courseId),
                    courseName: quiz.courseName,
                })),
                users,
                scoreRanges: [
                    { id: 'ALL', name: 'All' },
                    { id: '0-20', name: '0-20' },
                    { id: '21-40', name: '21-40' },
                    { id: '41-60', name: '41-60' },
                    { id: '61-80', name: '61-80' },
                    { id: '81-100', name: '81-100' },
                ],
            },
        });
    } catch (err) {
        console.error('[reports/examination-score][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
