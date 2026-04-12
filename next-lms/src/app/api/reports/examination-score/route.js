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
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function scorePercentFromLearningProgress(row = null) {
    if (!row || typeof row !== 'object') return null;
    const raw = toOptionalNumber(row?.scoreRaw);
    const scaled = toOptionalNumber(row?.scoreScaled);
    if (scaled !== null && (raw === null || raw > 100)) return clampPercent(scaled <= 1 ? scaled * 100 : scaled);

    if (raw !== null) {
        // Some legacy progress rows stored tracked seconds in scoreRaw before scoreScaled existed.
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
                where: {
                    organization_id: organizationId,
                    ...(categoryId > 0 ? { categoryId } : {}),
                },
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
                sectionId: Number(quiz.sectionId || 0),
                questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
                passingScore: Number(quiz.passingScore || 0),
            })),
        }));

        const selectedCourse = courseIdParam > 0
            ? courses.find((course) => Number(course.id) === courseIdParam)
            : courses.find((course) => course.quizzes.length > 0) || courses[0];
        const selectedCourseId = Number(selectedCourse?.id || 0);
        const quizzes = selectedCourse?.quizzes || [];
        const selectedQuiz = quizIdParam > 0
            ? quizzes.find((quiz) => Number(quiz.id) === quizIdParam)
            : quizzes[0];
        const selectedQuizId = Number(selectedQuiz?.id || 0);

        let rows = [];
        let users = [];

        if (selectedCourseId > 0) {
            if (selectedQuizId > 0) {
                const attempts = await prisma.quizAttempt.findMany({
                    where: {
                        course_id: selectedCourseId,
                        quizId: selectedQuizId,
                    },
                    include: {
                        enrollments: {
                            include: {
                                organization_users: {
                                    include: {
                                        users: {
                                            include: { profile: true },
                                        },
                                    },
                                },
                                learning_progress: selectedQuiz?.sectionId
                                    ? {
                                        where: { sectionId: selectedQuiz.sectionId },
                                        select: { currentTime: true, duration: true },
                                    }
                                    : {
                                        select: { currentTime: true, duration: true },
                                    },
                            },
                        },
                    },
                    orderBy: [{ enrollmentId: 'asc' }, { attemptNo: 'desc' }, { submittedAt: 'desc' }],
                });

                const usersById = new Map();
                for (const attempt of attempts) {
                    const key = Number(attempt?.enrollments?.userId || 0);
                    if (!key || usersById.has(key)) continue;
                    const user = attempt?.enrollments?.organization_users?.users;
                    const profile = user?.profile;
                    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
                        || user?.username
                        || user?.email
                        || `User ${attempt?.enrollments?.userId}`;
                    usersById.set(key, {
                        id: Number(attempt?.enrollments?.userId || 0),
                        username: String(user?.username || user?.email || '-'),
                        name,
                    });
                }

                users = Array.from(usersById.values());

                rows = attempts.map((attempt) => {
                    const enrollment = attempt?.enrollments;
                    const user = enrollment?.organization_users?.users;
                    const profile = user?.profile;

                    const username = String(user?.username || user?.email || '-');
                    const firstName = String(profile?.firstName || '');
                    const lastName = String(profile?.lastName || '');
                    const fullName = `${firstName} ${lastName}`.trim();
                    const attemptScore = toOptionalNumber(attempt?.score);
                    const scorePercent = attemptScore === null ? 0 : clampPercent(attemptScore);
                    const totalQuestions = Number(selectedQuiz?.questionCount || 0);
                    const rawScore = totalQuestions > 0
                        ? Math.round((scorePercent / 100) * totalQuestions)
                        : Math.round(scorePercent);
                    const timeSpentMinutes = resolveTimeSpentMinutes(enrollment?.learning_progress || []);

                    return {
                        no: 0,
                        enrollmentId: Number(enrollment?.id || 0),
                        userId: Number(enrollment?.userId || 0),
                        username,
                        firstName: firstName || '-',
                        lastName: lastName || '-',
                        scorePercent: Number(scorePercent.toFixed(2)),
                        scoreText: totalQuestions > 0 ? `${rawScore}/${totalQuestions}` : `${Math.round(scorePercent)}/100`,
                        result: resolveAssessmentResult({
                            percent: attemptScore === null ? null : scorePercent,
                            success: typeof attempt?.passed === 'boolean' ? attempt.passed : null,
                        }),
                        attempt: Number(attempt?.attemptNo || 1),
                        timeSpent: timeSpentMinutes === null ? '-' : timeSpentMinutes.toFixed(2),
                        searchText: `${username} ${fullName}`.toLowerCase(),
                    };
                });

                // Fallback for iSpring/xAPI-only scoring flows:
                // Some deployments persist score in learning_progress without quiz_attempt rows.
                if (rows.length === 0) {
                    const progressRows = await prisma.learningProgress.findMany({
                        where: {
                            courseId: selectedCourseId,
                            ...(selectedQuiz?.sectionId ? { sectionId: Number(selectedQuiz.sectionId) } : {}),
                            enrollments: { organization_id: organizationId },
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
                                            users: {
                                                include: { profile: true },
                                            },
                                        },
                                    },
                                    learning_progress: selectedQuiz?.sectionId
                                        ? {
                                            where: { sectionId: Number(selectedQuiz.sectionId) },
                                            select: { currentTime: true, duration: true },
                                        }
                                        : {
                                            select: { currentTime: true, duration: true },
                                        },
                                },
                            },
                        },
                        orderBy: [{ enrollmentId: 'asc' }, { id: 'desc' }],
                    });

                    const latestByEnrollment = new Map();
                    for (const progressRow of progressRows) {
                        const key = Number(progressRow.enrollmentId);
                        if (!latestByEnrollment.has(key) && scorePercentFromLearningProgress(progressRow) !== null) {
                            latestByEnrollment.set(key, progressRow);
                        }
                    }

                    const latestProgressRows = Array.from(latestByEnrollment.values());
                    users = latestProgressRows.map((progressRow) => {
                        const user = progressRow?.enrollments?.organization_users?.users;
                        const profile = user?.profile;
                        const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
                            || user?.username
                            || user?.email
                            || `User ${progressRow?.enrollments?.userId}`;
                        return {
                            id: Number(progressRow?.enrollments?.userId || 0),
                            username: String(user?.username || user?.email || '-'),
                            name,
                        };
                    });

                    rows = latestProgressRows.map((progressRow) => {
                        const enrollment = progressRow?.enrollments;
                        const user = enrollment?.organization_users?.users;
                        const profile = user?.profile;
                        const username = String(user?.username || user?.email || '-');
                        const firstName = String(profile?.firstName || '');
                        const lastName = String(profile?.lastName || '');
                        const fullName = `${firstName} ${lastName}`.trim();
                        const scorePercent = scorePercentFromLearningProgress(progressRow);
                        const safeScorePercent = Number.isFinite(Number(scorePercent)) ? Number(scorePercent) : 0;
                        const timeSpentMinutes = resolveTimeSpentMinutes(enrollment?.learning_progress || []);

                        return {
                            no: 0,
                            enrollmentId: Number(enrollment?.id || 0),
                            userId: Number(enrollment?.userId || 0),
                            username,
                            firstName: firstName || '-',
                            lastName: lastName || '-',
                            scorePercent: Number(safeScorePercent.toFixed(2)),
                            scoreText: `${Math.round(safeScorePercent)}/100`,
                            result: resolveLearningProgressResult(progressRow),
                            attempt: 1,
                            timeSpent: timeSpentMinutes === null ? '-' : timeSpentMinutes.toFixed(2),
                            searchText: `${username} ${fullName}`.toLowerCase(),
                        };
                    });
                }
            } else {
                const progressRows = await prisma.learningProgress.findMany({
                    where: {
                        courseId: selectedCourseId,
                        enrollments: { organization_id: organizationId },
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
                                        users: {
                                            include: { profile: true },
                                        },
                                    },
                                },
                                learning_progress: {
                                    select: { currentTime: true, duration: true },
                                },
                            },
                        },
                    },
                    orderBy: [{ enrollmentId: 'asc' }, { id: 'desc' }],
                });

                const latestByEnrollment = new Map();
                for (const progressRow of progressRows) {
                    const key = Number(progressRow.enrollmentId);
                    if (!latestByEnrollment.has(key) && scorePercentFromLearningProgress(progressRow) !== null) {
                        latestByEnrollment.set(key, progressRow);
                    }
                }

                const latestProgressRows = Array.from(latestByEnrollment.values());
                users = latestProgressRows.map((progressRow) => {
                    const user = progressRow?.enrollments?.organization_users?.users;
                    const profile = user?.profile;
                    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
                        || user?.username
                        || user?.email
                        || `User ${progressRow?.enrollments?.userId}`;
                    return {
                        id: Number(progressRow?.enrollments?.userId || 0),
                        username: String(user?.username || user?.email || '-'),
                        name,
                    };
                });

                rows = latestProgressRows.map((progressRow) => {
                    const enrollment = progressRow?.enrollments;
                    const user = enrollment?.organization_users?.users;
                    const profile = user?.profile;
                    const username = String(user?.username || user?.email || '-');
                    const firstName = String(profile?.firstName || '');
                    const lastName = String(profile?.lastName || '');
                    const fullName = `${firstName} ${lastName}`.trim();
                    const scorePercent = scorePercentFromLearningProgress(progressRow);
                    const safeScorePercent = Number.isFinite(Number(scorePercent)) ? Number(scorePercent) : 0;
                    const timeSpentMinutes = resolveTimeSpentMinutes(enrollment?.learning_progress || []);

                    return {
                        no: 0,
                        enrollmentId: Number(enrollment?.id || 0),
                        userId: Number(enrollment?.userId || 0),
                        username,
                        firstName: firstName || '-',
                        lastName: lastName || '-',
                        scorePercent: Number(safeScorePercent.toFixed(2)),
                        scoreText: `${Math.round(safeScorePercent)}/100`,
                        result: resolveLearningProgressResult(progressRow),
                        attempt: 1,
                        timeSpent: timeSpentMinutes === null ? '-' : timeSpentMinutes.toFixed(2),
                        searchText: `${username} ${fullName}`.toLowerCase(),
                    };
                });
            }

            rows = rows
                .filter((row) => {
                    if (userIdParam > 0 && Number(row.userId) !== userIdParam) return false;
                    if (!matchesScoreRange(row.scorePercent, scoreRange)) return false;
                    if (q && !row.searchText.includes(q)) return false;
                    return true;
                })
                .sort((a, b) => b.scorePercent - a.scorePercent)
                .map((row, index) => ({
                    ...row,
                    no: index + 1,
                }));
        }

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

        return NextResponse.json({
            chartData,
            rows: rows.map((row) => ({
                no: row.no,
                username: row.username,
                firstName: row.firstName,
                lastName: row.lastName,
                score: row.scoreText,
                percent: `${Math.round(row.scorePercent)}%`,
                result: row.result,
                attempt: row.attempt,
                timeSpent: row.timeSpent,
            })),
            selected: {
                categoryId: selectedCourse?.categoryId || null,
                categoryName: selectedCourse?.category || '-',
                courseId: selectedCourseId || null,
                courseName: selectedCourse?.name || '-',
                quizId: selectedQuizId || null,
                quizName: selectedQuiz?.name || '-',
                userId: userIdParam > 0 ? userIdParam : null,
                scoreRange: searchParams.get('scoreRange') || 'ALL',
                q: String(searchParams.get('q') || ''),
            },
            filters: {
                categories: categories.map((item) => ({ id: Number(item.id), name: item.name })),
                courses: courses.map((course) => ({ id: Number(course.id), name: course.name })),
                quizzes: quizzes.map((quiz) => ({ id: Number(quiz.id), name: quiz.name })),
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
