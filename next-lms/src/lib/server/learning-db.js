import prisma from '@/lib/prisma';
import { findCourseIdByContentId } from '@/lib/server/compat-db';
import { randomUUID } from 'crypto';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';

function createRegistrationUuid() {
    try {
        return randomUUID();
    } catch {
        const part = () => Math.random().toString(16).slice(2, 10);
        return `${part()}-${part().slice(0, 4)}-${part().slice(0, 4)}-${part().slice(0, 4)}-${part()}${part().slice(0, 4)}`;
    }
}

function clampPercent(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return Math.max(0, Math.min(100, Number(fallback) || 0));
    return Math.max(0, Math.min(100, Math.round(n)));
}

function clampNonNegative(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return Math.max(0, Number(fallback) || 0);
    return Math.max(0, n);
}

function normalizeUserKey(userKey = '') {
    return String(userKey || '').trim().replace(/^mailto:/i, '');
}

function mapIncomingStatusToProgressStatus(status = '') {
    const value = String(status || '').toUpperCase();
    if (value === 'COMPLETED') return 'completed';
    if (value === 'FAILED') return 'failed';
    if (value === 'LEARNING' || value === 'IN_PROGRESS') return 'in_progress';
    return 'not_started';
}

function mapProgressStatusToResponseStatus(status = '') {
    const value = String(status || '').toLowerCase();
    if (value === 'completed') return 'COMPLETED';
    if (value === 'failed') return 'FAILED';
    if (value === 'in_progress') return 'LEARNING';
    return 'NOT_STARTED';
}

function toProgressNumber(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return Number(fallback) || 0;
    return n;
}

function toIsoOrNull(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeProgressRow(row, contentIdOverride = null, userMap = new Map()) {
    const contentId = contentIdOverride || String(row.courseId || '');
    const userId = row?.enrollments?.userId;
    const user = userMap.get(String(userId)) || null;
    const lastAccessedAt = toIsoOrNull(row?.enrollments?.lastActivityAt);
    const completedAt = toIsoOrNull(row?.enrollments?.completedAt);
    const startedAt = toIsoOrNull(row?.enrollments?.startedAt);
    const enrolledAt = toIsoOrNull(row?.enrollments?.enrolledAt);
    const updatedAt = lastAccessedAt || completedAt || startedAt || enrolledAt;

    return {
        id: row.id,
        enrollmentId: row.enrollmentId,
        userId: user?.username || user?.email || String(userId || ''),
        courseId: row.courseId,
        sectionId: row.sectionId ?? null,
        contentId,
        status: mapProgressStatusToResponseStatus(row.status),
        progress: clampPercent(row.progressPercent),
        currentTime: clampNonNegative(row.currentTime),
        duration: clampNonNegative(row.duration),
        scoreRaw: row.scoreRaw !== null && row.scoreRaw !== undefined ? toProgressNumber(row.scoreRaw) : null,
        scoreScaled: row.scoreScaled !== null && row.scoreScaled !== undefined ? toProgressNumber(row.scoreScaled) : null,
        updatedAt,
        createdAt: enrolledAt,
        lastAccessedAt,
        completedAt,
        success: row.success ?? null,
        completion: row.completion ?? null,
    };
}

async function resolveUser(userKey = '') {
    const normalized = normalizeUserKey(userKey);
    if (!normalized || normalized.toLowerCase() === 'anonymous') return null;

    const numeric = Number(normalized);
    if (Number.isInteger(numeric) && numeric > 0) {
        const byId = await prisma.user.findUnique({
            where: { id: numeric },
            select: { id: true, username: true, email: true },
        });
        if (byId) return byId;
    }

    const exact = await prisma.user.findFirst({
        where: {
            OR: [
                { username: normalized },
                { email: normalized },
            ],
        },
        select: { id: true, username: true, email: true },
    });
    if (exact) return exact;

    const lower = normalized.toLowerCase();
    const contains = await prisma.user.findFirst({
        where: {
            OR: [
                { username: { contains: lower } },
                { email: { contains: lower } },
            ],
        },
        select: { id: true, username: true, email: true },
    });
    return contains || null;
}

async function resolveCourseId(contentId, sectionId = null) {
    const numericSectionId = Number(sectionId);
    if (Number.isInteger(numericSectionId) && numericSectionId > 0) {
        const section = await prisma.section.findUnique({
            where: { id: numericSectionId },
            select: { courseId: true },
        });
        const sectionCourseId = Number(section?.courseId || 0);
        if (Number.isInteger(sectionCourseId) && sectionCourseId > 0) {
            return sectionCourseId;
        }
    }

    const raw = String(contentId || '').trim();
    if (!raw) return null;

    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric > 0) {
        const byId = await prisma.course.findUnique({
            where: { id: numeric },
            select: { id: true },
        });
        if (byId) return byId.id;
    }

    const fromMap = await findCourseIdByContentId(raw);
    if (!fromMap) return null;

    const course = await prisma.course.findUnique({
        where: { id: fromMap },
        select: { id: true },
    });
    return course?.id || null;
}

async function resolveEnrollment(userId, courseId) {
    if (!userId || !courseId) return null;
    const organizationId = await ensureDefaultOrganization();
    return prisma.enrollment.findFirst({
        where: { userId, courseId, organization_id: organizationId },
        orderBy: { enrolledAt: 'desc' },
        select: {
            id: true,
            userId: true,
            courseId: true,
            status: true,
            progressPercent: true,
            completedAt: true,
            enrolledAt: true,
            startedAt: true,
            lastActivityAt: true,
        },
    });
}

async function resolveSectionIdForCourse(courseId, requestedSectionId = null) {
    if (!courseId) return null;
    const numericSectionId = Number(requestedSectionId);
    if (Number.isInteger(numericSectionId) && numericSectionId > 0) {
        const matchedSection = await prisma.section.findFirst({
            where: { id: numericSectionId, courseId },
            select: { id: true },
        });
        if (matchedSection?.id) return matchedSection.id;
    }
    const firstSection = await prisma.section.findFirst({
        where: { courseId },
        orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
        select: { id: true },
    });
    return firstSection?.id || null;
}

async function ensureSectionIdForCourse(courseId, requestedSectionId = null) {
    const resolved = await resolveSectionIdForCourse(courseId, requestedSectionId);
    if (resolved) return resolved;
    if (!courseId) return null;

    // Legacy mapped content can exist without a persisted section row.
    // Create a minimal section once so progress can be keyed by sectionId.
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true },
    });
    if (!course) return null;

    const existing = await prisma.section.findFirst({
        where: { courseId },
        orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
        select: { id: true },
    });
    if (existing?.id) return existing.id;

    const maxOrder = await prisma.section.findFirst({
        where: { courseId },
        orderBy: [{ orderNo: 'desc' }, { id: 'desc' }],
        select: { orderNo: true },
    });
    const nextOrderNo = Math.max(1, Number(maxOrder?.orderNo || 0) + 1);
    const title = String(course.title || 'Learning Content').trim() || 'Learning Content';

    try {
        const created = await prisma.section.create({
            data: {
                courseId,
                title,
                orderNo: nextOrderNo,
                sectionType: 'lesson',
                isActive: true,
                isPublic: false,
            },
            select: { id: true },
        });
        return created?.id || null;
    } catch {
        // In case of concurrent create, read again and continue.
        const fallback = await prisma.section.findFirst({
            where: { courseId },
            orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
            select: { id: true },
        });
        return fallback?.id || null;
    }
}

async function loadUsersMapByIds(userIds = []) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    if (ids.length === 0) return new Map();
    const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, username: true, email: true },
    });
    return new Map(users.map((row) => [String(row.id), row]));
}

async function upsertLearningProgress({
    contentId,
    userKey,
    sectionId,
    status,
    progress,
    currentTime,
    duration,
    scoreRaw,
    scoreScaled,
    success,
    completion,
}) {
    const user = await resolveUser(userKey);
    const courseId = await resolveCourseId(contentId, sectionId);
    if (!user || !courseId) {
        return { row: null, reason: !user ? 'USER_NOT_FOUND' : 'COURSE_NOT_FOUND' };
    }

    const enrollment = await resolveEnrollment(user.id, courseId);
    if (!enrollment?.id) {
        return { row: null, reason: 'ENROLLMENT_REQUIRED' };
    }

    const resolvedSectionId = await ensureSectionIdForCourse(courseId, sectionId);
    if (!resolvedSectionId) {
        return { row: null, reason: 'SECTION_NOT_FOUND' };
    }

    const existing = await prisma.learningProgress.findFirst({
        where: {
            enrollmentId: enrollment.id,
            sectionId: resolvedSectionId,
        },
    });

    const prevStatus = String(existing?.status || '').toLowerCase();
    const prevProgress = clampPercent(existing?.progressPercent);
    const incomingStatus = mapIncomingStatusToProgressStatus(status || existing?.status);
    const safeProgress = clampPercent(progress, prevProgress);
    
    // Only update currentTime/duration if explicitly provided (not undefined/null)
    // This prevents TinCan resume from being reset to 0 when partial updates are sent
    const safeCurrentTime = (currentTime !== undefined && currentTime !== null)
        ? clampNonNegative(currentTime, 0)
        : (existing?.currentTime ?? 0);
    const safeDuration = (duration !== undefined && duration !== null)
        ? clampNonNegative(duration, 0)
        : (existing?.duration ?? 0);
    
    const prevScoreRaw = Number(existing?.scoreRaw);
    const incomingScoreRaw = Number(scoreRaw);
    const safeScoreRaw = Number.isFinite(incomingScoreRaw)
        ? Math.max(Number.isFinite(prevScoreRaw) ? prevScoreRaw : 0, incomingScoreRaw)
        : (existing?.scoreRaw ?? null);
    const safeScoreScaled = Number.isFinite(Number(scoreScaled)) ? Number(scoreScaled) : (existing?.scoreScaled ?? null);
    const explicitSuccess = typeof success === 'boolean' ? success : null;
    const explicitCompletion = typeof completion === 'boolean' ? completion : null;
    const resolvedSuccess = explicitSuccess ?? (typeof existing?.success === 'boolean' ? existing.success : null);

    const hasExplicitFailureSignal =
        incomingStatus === 'failed'
        || explicitSuccess === false
        || explicitCompletion === false;
    const hasExplicitCompletionSignal =
        incomingStatus === 'completed'
        || explicitCompletion === true;
    const shouldCompleteByInput = !hasExplicitFailureSignal && hasExplicitCompletionSignal;
    const isAlreadyCompleted = prevStatus === 'completed';
    const shouldKeepCompleted = isAlreadyCompleted && !hasExplicitFailureSignal;
    const nextStatus = shouldKeepCompleted
        ? 'completed'
        : hasExplicitFailureSignal
            ? 'failed'
            : shouldCompleteByInput
                ? 'completed'
                : incomingStatus;
    const nextProgress = nextStatus === 'completed'
        ? 100
        : Math.min(99, Math.max(prevProgress, safeProgress));
    const nextCurrentTime = Math.max(clampNonNegative(existing?.currentTime), safeCurrentTime);
    const nextDuration = Math.max(clampNonNegative(existing?.duration), safeDuration);
    const resolvedCompletion = nextStatus === 'completed'
        ? true
        : explicitCompletion === false
            ? false
            : explicitCompletion === true
                ? true
                : (typeof existing?.completion === 'boolean' ? existing.completion : null);

    const baseData = {
        enrollmentId: enrollment.id,
        courseId,
        sectionId: resolvedSectionId,
        status: nextStatus,
        progressPercent: nextProgress,
        currentTime: nextCurrentTime,
        duration: nextDuration,
        scoreRaw: safeScoreRaw,
        scoreScaled: safeScoreScaled,
        success: resolvedSuccess,
        completion: resolvedCompletion,
    };

    const row = existing
        ? await prisma.learningProgress.update({
            where: { id: existing.id },
            data: baseData,
            include: {
                enrollments: {
                    select: {
                        userId: true,
                        enrolledAt: true,
                        startedAt: true,
                        completedAt: true,
                        lastActivityAt: true,
                    },
                },
            },
        })
        : await (async () => {
            try {
                return await prisma.learningProgress.create({
                    data: baseData,
                    include: {
                        enrollments: {
                            select: {
                                userId: true,
                                enrolledAt: true,
                                startedAt: true,
                                completedAt: true,
                                lastActivityAt: true,
                            },
                        },
                    },
                });
            } catch (createErr) {
                // Handle race condition: another request already created the row
                if (createErr?.code === 'P2002') {
                    await prisma.learningProgress.updateMany({
                        where: {
                            enrollmentId: enrollment.id,
                            sectionId: resolvedSectionId,
                        },
                        data: baseData,
                    });
                    
                    const conflicting = await prisma.learningProgress.findFirst({
                        where: {
                            enrollmentId: enrollment.id,
                            sectionId: resolvedSectionId,
                        },
                        include: {
                            enrollments: {
                                select: {
                                    userId: true,
                                    enrolledAt: true,
                                    startedAt: true,
                                    completedAt: true,
                                    lastActivityAt: true,
                                },
                            },
                        },
                    });
                    
                    if (conflicting) {
                        return conflicting;
                    }
                }
                throw createErr;
            }
        })();

    const enrollmentProgress = clampPercent(enrollment.progressPercent);
    const enrollmentUpdate = {};
    const now = new Date();
    enrollmentUpdate.lastActivityAt = now;

    const wasEnrollmentCompleted = String(enrollment.status || '').toLowerCase() === 'completed';

    if (nextStatus === 'completed' || (wasEnrollmentCompleted && !hasExplicitFailureSignal)) {
        enrollmentUpdate.status = 'completed';
        enrollmentUpdate.progressPercent = 100;
        if (!enrollment.completedAt) enrollmentUpdate.completedAt = now;
    } else {
        if (wasEnrollmentCompleted && hasExplicitFailureSignal) {
            enrollmentUpdate.completedAt = null;
            enrollmentUpdate.progressPercent = Math.min(99, Math.max(0, nextProgress));
        }
        if (nextProgress > 0) {
            if (enrollmentUpdate.progressPercent === undefined) {
                enrollmentUpdate.progressPercent = Math.max(enrollmentProgress, nextProgress);
            }
        }
        if (nextProgress > 0) {
            enrollmentUpdate.status = 'in_progress';
            if (!enrollment.startedAt) {
                enrollmentUpdate.startedAt = now;
            }
        }
    }

    if (Object.keys(enrollmentUpdate).length > 0) {
        await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: enrollmentUpdate,
        });
    }

    const userMap = new Map([[String(user.id), user]]);
    return { row: serializeProgressRow(row, String(contentId || ''), userMap), reason: null };
}

async function listLearningProgress({ contentId, userKey, sectionId = null }) {
    const where = {};
    const numericSectionId = Number(sectionId);
    const hasSectionFilter = Number.isInteger(numericSectionId) && numericSectionId > 0;
    const user = await resolveUser(userKey);
    if (userKey && !user) return [];

    if (user) {
        const courseId = await resolveCourseId(contentId, sectionId);
        if (contentId && !courseId) return [];
        if (courseId) {
            const enrollment = await resolveEnrollment(user.id, courseId);
            if (!enrollment?.id) return [];
            where.enrollmentId = enrollment.id;
        } else {
            const organizationId = await ensureDefaultOrganization();
            const enrollments = await prisma.enrollment.findMany({
                where: { organization_id: organizationId, userId: user.id },
                select: { id: true },
            });
            const ids = enrollments.map((row) => row.id);
            if (ids.length === 0) return [];
            where.enrollmentId = { in: ids };
        }
    }

    if (contentId) {
        const courseId = await resolveCourseId(contentId, sectionId);
        if (!courseId) return [];
        where.courseId = courseId;
        if (hasSectionFilter) {
            const matchedSection = await prisma.section.findFirst({
                where: { id: numericSectionId, courseId },
                select: { id: true },
            });
            if (!matchedSection?.id) return [];
            where.sectionId = matchedSection.id;
        }
    } else if (hasSectionFilter) {
        where.sectionId = numericSectionId;
    }

    const rows = await prisma.learningProgress.findMany({
        where,
        include: {
            enrollments: {
                select: {
                    userId: true,
                    enrolledAt: true,
                    startedAt: true,
                    completedAt: true,
                    lastActivityAt: true,
                },
            },
        },
        orderBy: { id: 'desc' },
    });

    const userIds = rows.map((row) => row?.enrollments?.userId).filter(Boolean);
    const userMap = await loadUsersMapByIds(userIds);
    return rows.map((row) => serializeProgressRow(row, contentId || null, userMap));
}

async function createXapiStatement({
    statementId,
    actorKey,
    verbId,
    objectId,
    payloadJson,
    contentId,
    timestamp,
}) {
    const user = await resolveUser(actorKey);
    const courseId = await resolveCourseId(contentId);
    const enrollment = user && courseId ? await resolveEnrollment(user.id, courseId) : null;
    if (!user || !courseId || !enrollment?.id) {
        return null;
    }

    if (contentId) {
        const existingRegistration = await prisma.xapiRegistration.findUnique({
            where: { enrollmentId: enrollment.id },
            select: { id: true },
        });
        if (!existingRegistration) {
            await prisma.xapiRegistration.create({
                data: {
                    enrollmentId: enrollment.id,
                    registrationUuid: createRegistrationUuid(),
                    content_id: String(contentId),
                },
            });
        }
    }

    const resolvedStatementId = String(statementId || '').trim() || createRegistrationUuid();
    const row = await prisma.xapiStatement.create({
        data: {
            enrollmentId: enrollment.id,
            statementId: resolvedStatementId,
            actorId: user.id,
            verbId: String(verbId || ''),
            objectId: String(objectId || ''),
            statement_json: payloadJson || {},
            receivedAt: timestamp ? new Date(timestamp) : new Date(),
        },
        include: {
            actor: { select: { username: true, email: true } },
        },
    });

    return row;
}

function normalizeStatementFromRow(row) {
    const payload = row?.statement_json && typeof row.statement_json === 'object' ? row.statement_json : {};
    const actorEmail = row?.actor?.email ? `mailto:${row.actor.email}` : 'mailto:anonymous@lms.local';
    const actorName = row?.actor?.username || row?.actor?.email || 'Anonymous Learner';

    const fallbackVerbId = row?.verbId || '';
    const fallbackVerbLabel = fallbackVerbId ? fallbackVerbId.split('/').pop() : 'unknown';
    const fallbackObjectId = row?.objectId || '';

    return {
        id: payload.id || row.statementId || `db-${row.id}`,
        timestamp: payload.timestamp || (row.receivedAt ? new Date(row.receivedAt).toISOString() : new Date().toISOString()),
        actor: payload.actor || {
            mbox: actorEmail,
            name: actorName,
            objectType: 'Agent',
        },
        verb: payload.verb || {
            id: fallbackVerbId,
            display: { 'en-US': fallbackVerbLabel },
        },
        object: payload.object || {
            id: fallbackObjectId,
            objectType: 'Activity',
            definition: {
                name: {
                    'en-US': 'Unknown Activity',
                },
            },
        },
        result: payload.result,
        context: payload.context,
        contentId: payload.contentId || '',
        storedAt: row.receivedAt ? new Date(row.receivedAt).toISOString() : undefined,
    };
}

function matchesActor(statement, actorFilter = '') {
    const filter = normalizeUserKey(actorFilter).toLowerCase();
    if (!filter) return true;

    const mbox = String(statement?.actor?.mbox || '').toLowerCase();
    const name = String(statement?.actor?.name || '').toLowerCase();
    return mbox.includes(filter) || name.includes(filter);
}

async function listXapiStatements({ contentId, actor, verb, limit = 100 }) {
    const safeLimit = Math.max(1, Number(limit) || 100);
    const where = {};

    if (contentId) {
        where.objectId = { contains: String(contentId) };
    }
    if (verb) {
        where.verbId = { contains: String(verb) };
    }

    const rows = await prisma.xapiStatement.findMany({
        where,
        include: {
            actor: { select: { username: true, email: true } },
        },
        orderBy: { receivedAt: 'desc' },
        take: Math.min(1000, safeLimit * 5),
    });

    const statements = rows.map((row) => normalizeStatementFromRow(row));
    const filtered = statements.filter((statement) => matchesActor(statement, actor));
    return filtered.slice(0, safeLimit);
}

export {
    listLearningProgress,
    upsertLearningProgress,
    createXapiStatement,
    listXapiStatements,
    normalizeUserKey,
};
