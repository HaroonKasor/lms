/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        quiz: { findUnique: jest.fn() },
        enrollment: { findFirst: jest.fn() },
    },
}));
jest.mock('@/lib/server/auth', () => ({ requireSession: jest.fn() }));
jest.mock('@/lib/server/request-validation', () => ({ readJsonBody: jest.fn() }));
jest.mock('@/lib/server/enterprise-context', () => ({ ensureDefaultOrganization: jest.fn() }));
jest.mock('@/lib/server/notifications', () => ({ createAdminNotification: jest.fn(), createNotification: jest.fn() }));
jest.mock('@/lib/server/compat-db', () => ({ getSectionCompatMaps: jest.fn() }));
jest.mock('@/lib/server/section-runtime', () => ({ resolveEffectiveCertificateConfig: jest.fn() }));

import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { GET } from './route';

const quiz = {
    id: 5, title: 'Q', passingScore: 70, timeLimitMin: 0, status: 'published', courseId: 9, sectionId: 1,
    questions: [{ id: 1, questionText: 'a?', choicesJson: ['x', 'y'], correct_answer_ids: ['1'] }],
    quiz_attempts: [
        { id: 1, enrollmentId: 100, attemptNo: 1, score: 50, passed: false, submittedAt: null, answersJson: { 0: 1 } },
        { id: 2, enrollmentId: 200, attemptNo: 1, score: 100, passed: true, submittedAt: null, answersJson: { 0: 0 } },
    ],
};
const req = { url: 'http://x/api/quizzes?id=5' };

beforeEach(() => {
    prisma.quiz.findUnique.mockResolvedValue(quiz);
});

test('learner not enrolled gets 403', async () => {
    requireSession.mockResolvedValue({ session: { uid: 1, role: 'learner' }, response: null });
    prisma.enrollment.findFirst.mockResolvedValue(null);
    expect((await GET(req)).status).toBe(403);
});

test('enrolled learner gets no answers and only own attempts', async () => {
    requireSession.mockResolvedValue({ session: { uid: 1, role: 'learner' }, response: null });
    prisma.enrollment.findFirst.mockResolvedValue({ id: 100 });
    const body = await (await GET(req)).json();
    expect(JSON.stringify(body)).not.toMatch(/correctAnswer|answersJson/);
    expect(body.attempts.map((a) => a.id)).toEqual([1]);
});

test('admin keeps full data', async () => {
    requireSession.mockResolvedValue({ session: { uid: 2, role: 'admin', isAdmin: true }, response: null });
    const body = await (await GET(req)).json();
    expect(body.questions[0].correctAnswer).toBe(1);
    expect(body.attempts).toHaveLength(2);
});
