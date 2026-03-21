import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { createAdminNotification } from '@/lib/server/notifications';

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toLegacyStatus(status) {
    const value = String(status || '').toLowerCase();
    if (value === 'published') return 'active';
    if (value === 'archived') return 'archived';
    return 'inactive';
}

function toQuestionAnswers(q) {
    const answers = Array.isArray(q.correct_answer_ids) ? q.correct_answer_ids : [];
    if (answers.length === 0) return 0;
    const parsed = Number(answers[0]);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toLegacyQuestions(questions = []) {
    return questions.map((q) => ({
        id: q.id,
        question: q.questionText,
        options: Array.isArray(q.choicesJson) ? q.choicesJson : [],
        correctAnswer: toQuestionAnswers(q),
    }));
}

function toLegacyQuizSummary(quiz) {
    return {
        id: quiz.id,
        title: quiz.title,
        description: '',
        passingScore: toNumber(quiz.passingScore, 70),
        timeLimit: quiz.timeLimitMin || 0,
        status: toLegacyStatus(quiz.status),
    };
}

function toLegacyQuizDetail(quiz) {
    return {
        ...toLegacyQuizSummary(quiz),
        courseId: quiz.courseId,
        sectionId: quiz.sectionId,
        questions: toLegacyQuestions(quiz.questions || []),
        attempts: quiz.quiz_attempts || [],
    };
}

function resolveDisplayName(user) {
    const first = String(user?.profile?.firstName || '').trim();
    const last = String(user?.profile?.lastName || '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full || String(user?.username || '').trim() || String(user?.email || '').trim() || 'Learner';
}

/**
 * GET - Get quizzes for a course, or a specific quiz
 */
export async function GET(request) {
    try {
        const { response } = await requireSession(request);
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const courseId = searchParams.get('courseId');
        const quizId = searchParams.get('id');

        if (quizId) {
            const quiz = await prisma.quiz.findUnique({
                where: { id: parseInt(quizId, 10) },
                include: {
                    questions: { orderBy: { orderNo: 'asc' } },
                    quiz_attempts: true,
                },
            });
            if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
            return NextResponse.json(toLegacyQuizDetail(quiz));
        }

        if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

        const quizzes = await prisma.quiz.findMany({
            where: { courseId: parseInt(courseId, 10), status: 'published' },
            orderBy: { id: 'desc' },
        });

        return NextResponse.json(quizzes.map(toLegacyQuizSummary));
    } catch (err) {
        console.error('[quizzes/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST - Submit quiz answers OR create a new quiz
 */
export async function POST(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        // If it has `questions` array, it's a quiz creation
        if (body.questions) {
            if (!session.isAdmin) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const courseId = parseInt(body.courseId, 10);
            if (!courseId) {
                return NextResponse.json({ error: 'courseId required' }, { status: 400 });
            }

            const sectionId = body.sectionId ? parseInt(body.sectionId, 10) : null;
            const questions = Array.isArray(body.questions) ? body.questions : [];
            if (!questions.length) {
                return NextResponse.json({ error: 'questions required' }, { status: 400 });
            }

            const course = await prisma.course.findFirst({
                where: { id: courseId, organization_id: organizationId },
                select: { id: true },
            });
            if (!course) {
                return NextResponse.json({ error: 'Course not found' }, { status: 404 });
            }

            let resolvedSectionId = sectionId;
            if (!resolvedSectionId) {
                const firstSection = await prisma.section.findFirst({
                    where: { courseId },
                    orderBy: { orderNo: 'asc' },
                    select: { id: true },
                });
                resolvedSectionId = firstSection?.id || null;
            }
            if (!resolvedSectionId) {
                return NextResponse.json({ error: 'sectionId required (course has no sections)' }, { status: 400 });
            }

            const parsedTimeLimit = toNumber(body.timeLimit, 0);
            const quiz = await prisma.quiz.create({
                data: {
                    courseId,
                    sectionId: resolvedSectionId,
                    title: body.title || 'Quiz',
                    passingScore: toNumber(body.passingScore, 60),
                    timeLimitMin: parsedTimeLimit > 0 ? parsedTimeLimit : null,
                    status: 'published',
                    questions: {
                        create: questions.map((q, index) => ({
                            questionText: String(q.question || '').trim() || `Question ${index + 1}`,
                            question_type: 'single_choice',
                            choicesJson: Array.isArray(q.options) ? q.options : [],
                            correct_answer_ids: [String(toNumber(q.correctAnswer, 0))],
                            orderNo: index + 1,
                        })),
                    },
                },
                include: {
                    questions: { orderBy: { orderNo: 'asc' } },
                    quiz_attempts: true,
                },
            });
            return NextResponse.json({ success: true, quiz: toLegacyQuizDetail(quiz) });
        }

        // Otherwise, it's an answer submission
        const { quizId, answers } = body;
        if (!quizId || !answers) {
            return NextResponse.json({ error: 'quizId and answers required' }, { status: 400 });
        }

        const numericUserId = session.uid;

        const quiz = await prisma.quiz.findUnique({
            where: { id: parseInt(quizId, 10) },
            include: {
                questions: { orderBy: { orderNo: 'asc' } },
                course: { select: { id: true, hasCertificate: true, certificateMode: true, title: true, organization_id: true } },
            },
        });
        if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

        const enrollment = await prisma.enrollment.findFirst({
            where: {
                userId: numericUserId,
                courseId: quiz.courseId,
                organization_id: quiz.course.organization_id,
            },
            select: { id: true, status: true, completedAt: true },
        });
        if (!enrollment) {
            return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
        }

        const questions = quiz.questions || [];
        const answerMap = Array.isArray(answers) ? answers : answers || {};
        let correct = 0;

        questions.forEach((q, i) => {
            const provided = answerMap[i] ?? answerMap[String(i)];
            const accepted = Array.isArray(q.correct_answer_ids) ? q.correct_answer_ids.map((x) => Number(x)) : [];
            if (provided !== undefined && accepted.includes(Number(provided))) {
                correct += 1;
            }
        });

        const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
        const passed = score >= toNumber(quiz.passingScore, 70);
        const maxAttempt = await prisma.quizAttempt.aggregate({
            where: { quizId: quiz.id, enrollmentId: enrollment.id },
            _max: { attemptNo: true },
        });
        const nextAttemptNo = (maxAttempt?._max?.attemptNo || 0) + 1;

        const attempt = await prisma.quizAttempt.create({
            data: {
                quizId: quiz.id,
                enrollmentId: enrollment.id,
                course_id: quiz.courseId,
                attemptNo: nextAttemptNo,
                score,
                passed,
                answersJson: answers,
                submittedAt: new Date(),
            },
        });

        let certificateState = {
            required: Boolean(quiz.course?.hasCertificate),
            mode: String(quiz.course?.certificateMode || 'none').toLowerCase(),
            status: 'NONE',
        };

        if (passed) {
            const wasCompletedBefore = String(enrollment.status || '').toLowerCase() === 'completed' || Boolean(enrollment.completedAt);
            await prisma.enrollment.update({
                where: { id: enrollment.id },
                data: {
                    status: 'completed',
                    progressPercent: 100,
                    completedAt: new Date(),
                },
            });

            const certMode = String(quiz.course?.certificateMode || 'none').toLowerCase();
            if (quiz.course?.hasCertificate && certMode === 'auto') {
                const verifyCode = `CERT-${Date.now().toString(36).toUpperCase()}`;
                const user = await prisma.user.findUnique({
                    where: { id: numericUserId },
                    include: { profile: true },
                });
                const fullName = user?.profile?.firstName
                    ? [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ')
                    : null;
                await prisma.certificate.upsert({
                    where: { enrollmentId: enrollment.id },
                    update: {},
                    create: {
                        enrollmentId: enrollment.id,
                        verifyCode,
                        recipientName: fullName || user?.username || user?.email || String(numericUserId),
                        status: 'issued',
                    },
                });
                certificateState = {
                    required: true,
                    mode: certMode,
                    status: 'ISSUED',
                };
            } else if (quiz.course?.hasCertificate && certMode === 'manual') {
                if (!wasCompletedBefore) {
                    const user = await prisma.user.findUnique({
                        where: { id: numericUserId },
                        include: { profile: true },
                    });
                    const learnerName = resolveDisplayName(user);
                    await createAdminNotification({
                        organizationId: quiz.course.organization_id,
                        type: 'CERTIFICATE_APPROVAL_REQUESTED',
                        title: 'Certificate Approval Requested',
                        message: `${learnerName} requested certificate approval for "${String(quiz.course?.title || 'Course').trim()}".`,
                        payload: {
                            kind: 'certificate_approval_requested',
                            enrollmentId: Number(enrollment.id || 0),
                            courseId: Number(quiz.course?.id || 0),
                            userId: Number(numericUserId || 0),
                            actionUrl: '/admin-dashboard/report/certificate-report',
                        },
                        createdBy: numericUserId,
                    });
                }
                certificateState = {
                    required: true,
                    mode: certMode,
                    status: 'PENDING_APPROVAL',
                };
            }
        }

        return NextResponse.json({
            success: true,
            attempt: {
                id: attempt.id,
                score,
                passed,
                total: questions.length,
                correct,
                certificate: certificateState,
            },
        });
    } catch (err) {
        console.error('[quizzes/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
