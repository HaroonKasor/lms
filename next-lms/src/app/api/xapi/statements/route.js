import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    createXapiStatement,
    listXapiStatements,
    normalizeUserKey,
    upsertLearningProgress,
} from '@/lib/server/learning-db';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { getSectionCompatMaps } from '@/lib/server/compat-db';
import { resolveEffectiveCertificateConfig } from '@/lib/server/section-runtime';
import { createNotification } from '@/lib/server/notifications';

const VERB_ID_MAP = {
    initialized: 'http://adlnet.gov/expapi/verbs/initialized',
    played: 'https://w3id.org/xapi/video/verbs/played',
    paused: 'https://w3id.org/xapi/video/verbs/paused',
    seeked: 'https://w3id.org/xapi/video/verbs/seeked',
    progressed: 'http://adlnet.gov/expapi/verbs/progressed',
    completed: 'http://adlnet.gov/expapi/verbs/completed',
    terminated: 'http://adlnet.gov/expapi/verbs/terminated',
    experienced: 'http://adlnet.gov/expapi/verbs/experienced',
};

function resolveAppOrigin() {
    const candidates = [
        process.env.NEXT_PUBLIC_XAPI_OBJECT_BASE_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.APP_URL,
    ];
    for (const candidate of candidates) {
        const raw = String(candidate || '').trim();
        if (!raw) continue;
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
            return new URL(withProtocol).origin;
        } catch {
            // Try next candidate.
        }
    }
    return 'https://example.invalid';
}

const APP_ORIGIN = resolveAppOrigin();
const APP_HOSTNAME = (() => {
    try {
        return new URL(APP_ORIGIN).hostname || 'example.invalid';
    } catch {
        return 'example.invalid';
    }
})();
const XAPI_EXTENSION_NAMESPACE = `${APP_ORIGIN}/extensions`;
const XAPI_SKIP_PROGRESS_SYNC_KEY = `${XAPI_EXTENSION_NAMESPACE}/skip-progress-sync`;
const LEGACY_SKIP_PROGRESS_SYNC_KEY = 'https://lms.local/extensions/skip-progress-sync';

function inferVerbKey(verbIdOrLabel = '') {
    const value = String(verbIdOrLabel).toLowerCase();
    if (value.includes('initial')) return 'initialized';
    if (value.includes('play')) return 'played';
    if (value.includes('pause')) return 'paused';
    if (value.includes('seek')) return 'seeked';
    if (value.includes('progress')) return 'progressed';
    if (value.includes('complete')) return 'completed';
    if (value.includes('terminate')) return 'terminated';
    if (value.includes('experience')) return 'experienced';
    return null;
}

function normalizeVerb(verb = {}) {
    if (typeof verb === 'string') {
        const key = inferVerbKey(verb);
        return {
            id: key ? VERB_ID_MAP[key] : verb,
            display: { 'en-US': key || verb },
        };
    }

    const rawId = verb.id || '';
    const rawLabel = verb.display?.['en-US'] || verb.display?.en || verb.display?.th || '';
    const key = inferVerbKey(rawId || rawLabel);

    return {
        id: key ? VERB_ID_MAP[key] : rawId,
        display: {
            'en-US': key || rawLabel || rawId || 'unknown',
        },
    };
}

function normalizeStatement(statement) {
    const actorMbox = statement?.actor?.mbox || `mailto:anonymous@${APP_HOSTNAME}`;
    const actorName = statement?.actor?.name || 'Anonymous Learner';
    const verb = normalizeVerb(statement?.verb || {});

    return {
        id: statement?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: statement?.timestamp || new Date().toISOString(),
        actor: {
            mbox: actorMbox,
            name: actorName,
            objectType: 'Agent',
        },
        verb,
        object: {
            id: statement?.object?.id || '',
            objectType: statement?.object?.objectType || 'Activity',
            definition: {
                name: {
                    'en-US': statement?.object?.definition?.name?.['en-US'] || 'Unknown Activity',
                },
            },
        },
        result: statement?.result || undefined,
        context: statement?.context || undefined,
    };
}

function extractContentId(objectId = '') {
    const match = String(objectId).match(/content\/([^/?#]+)/);
    return match ? match[1] : '';
}

function readProgressExtensions(result = {}) {
    const extensions = result?.extensions || {};
    const progressRaw =
        extensions['https://w3id.org/xapi/video/extensions/progress'] ??
        extensions.progress ??
        result.progress;
    const currentTime =
        extensions['https://w3id.org/xapi/video/extensions/time'] ??
        extensions.time ??
        result.currentTime;
    const duration =
        extensions['https://w3id.org/xapi/video/extensions/length'] ??
        extensions.length ??
        result.duration;

    const p = Number(progressRaw);
    const scoreRaw = Number(result?.score?.raw);
    const scoreScaled = Number(result?.score?.scaled);
    return {
        progress: Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : undefined,
        currentTime: Number.isFinite(Number(currentTime)) ? Number(currentTime) : undefined,
        duration: Number.isFinite(Number(duration)) ? Number(duration) : undefined,
        scoreRaw: Number.isFinite(scoreRaw) ? scoreRaw : undefined,
        scoreScaled: Number.isFinite(scoreScaled) ? scoreScaled : undefined,
        success: typeof result?.success === 'boolean' ? result.success : undefined,
        completion: typeof result?.completion === 'boolean' ? result.completion : undefined,
    };
}

function shouldSkipProgressSync(statement = {}) {
    const extensions = statement?.context?.extensions || {};
    const marker = extensions[XAPI_SKIP_PROGRESS_SYNC_KEY] ?? extensions[LEGACY_SKIP_PROGRESS_SYNC_KEY];
    if (marker === true) return true;
    if (typeof marker === 'number') return marker === 1;
    if (typeof marker === 'string') {
        const value = marker.trim().toLowerCase();
        return value === 'true' || value === '1' || value === 'yes';
    }
    return false;
}

function parseIsoDurationToSeconds(value) {
    const raw = String(value || '').trim();
    if (!raw) return undefined;
    if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);

    const match = raw.match(/^P(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)$/i);
    if (!match) return undefined;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    if (![hours, minutes, seconds].every(Number.isFinite)) return undefined;
    return hours * 3600 + minutes * 60 + seconds;
}

function hasPassingAssessmentScore({ scoreRaw, scoreScaled, scoreMax }) {
    const raw = Number(scoreRaw);
    const scaled = Number(scoreScaled);
    const max = Number(scoreMax);
    const normalizedFromRawMax =
        Number.isFinite(raw) && Number.isFinite(max) && max > 0
            ? (raw / max)
            : undefined;
    return (
        (Number.isFinite(scaled) && scaled >= 0.8) ||
        (Number.isFinite(raw) && raw >= 80) ||
        (Number.isFinite(normalizedFromRawMax) && normalizedFromRawMax >= 0.8)
    );
}

function isAssessmentStatement(statement = {}) {
    const objectId = String(statement?.object?.id || '').toLowerCase();
    const objectName = String(
        statement?.object?.definition?.name?.['en-US']
        || statement?.object?.definition?.name?.en
        || statement?.object?.definition?.name?.th
        || ''
    ).toLowerCase();
    const contextExtensions = statement?.context?.extensions || {};
    const activityName = Object.entries(contextExtensions).reduce((best, [key, value]) => {
        if (!String(key || '').toLowerCase().endsWith('/activity-name')) return best;
        const next = String(value || '').trim().toLowerCase();
        return next || best;
    }, '');
    const activityId = Object.entries(contextExtensions).reduce((best, [key, value]) => {
        if (!String(key || '').toLowerCase().endsWith('/activity-id')) return best;
        const next = String(value || '').trim().toLowerCase();
        return next || best;
    }, '');
    const raw = `${objectId} ${objectName} ${activityName} ${activityId}`;
    return /quiz|test|exam|assessment|post[\s-_]?test|pre[\s-_]?test|แบบทดสอบ|ทดสอบ/i.test(raw);
}

async function updateProgressFromStatement(statement, contentId) {
    const verbId = String(statement?.verb?.id || '').toLowerCase();
    const userKey = normalizeUserKey(statement?.actor?.mbox || '');

    if (!contentId || !userKey) return;
    if (shouldSkipProgressSync(statement)) return;

    if (verbId.includes('completed')) {
        const durationSeconds = parseIsoDurationToSeconds(statement?.result?.duration);
        const result = statement?.result || {};
        const explicitSuccess = typeof result?.success === 'boolean' ? result.success : undefined;
        const explicitCompletion = typeof result?.completion === 'boolean' ? result.completion : undefined;
        const hasExplicitFailure = explicitSuccess === false || explicitCompletion === false;
        const scoreRaw = Number(result?.score?.raw);
        const scoreScaled = Number(result?.score?.scaled);
        const scoreMax = Number(result?.score?.max);
        const hasPassingScore = hasPassingAssessmentScore({ scoreRaw, scoreScaled, scoreMax });
        const hasAssessmentEvidence =
            typeof explicitSuccess === 'boolean'
            || Number.isFinite(scoreRaw)
            || Number.isFinite(scoreScaled)
            || Number.isFinite(scoreMax);
        const assessmentLikeStatement = isAssessmentStatement(statement);
        const hasCompletionSignal = explicitCompletion === true || verbId.includes('completed');
        const shouldRequirePass = hasAssessmentEvidence || assessmentLikeStatement;
        const shouldMarkCompleted = !hasExplicitFailure
            && hasCompletionSignal
            && (!shouldRequirePass || explicitSuccess === true || hasPassingScore);
        return upsertLearningProgress({
            contentId,
            userKey,
            status: hasExplicitFailure ? 'FAILED' : (shouldMarkCompleted ? 'COMPLETED' : 'LEARNING'),
            progress: hasExplicitFailure ? 99 : (shouldMarkCompleted ? 100 : 99),
            currentTime: durationSeconds,
            duration: durationSeconds,
            scoreRaw: Number.isFinite(scoreRaw) ? scoreRaw : undefined,
            scoreScaled: Number.isFinite(scoreScaled) ? scoreScaled : undefined,
            success: explicitSuccess,
            completion: hasExplicitFailure ? false : (shouldMarkCompleted ? true : explicitCompletion),
        });
    }

    if (verbId.includes('progressed') || verbId.includes('play') || verbId.includes('pause') || verbId.includes('seek')) {
        const { progress, currentTime, duration, scoreRaw, scoreScaled, success, completion } = readProgressExtensions(statement?.result);
        const hasExplicitFailure = success === false || completion === false;
        const normalizedProgress = Number.isFinite(Number(progress))
            ? Number(progress)
            : 0;
        const hasAssessmentEvidence =
            typeof success === 'boolean'
            || Number.isFinite(scoreRaw)
            || Number.isFinite(scoreScaled);
        const hasPassingScore = hasPassingAssessmentScore({ scoreRaw, scoreScaled });
        const assessmentLikeStatement = isAssessmentStatement(statement);
        const hasVerifiedCompletionSignal =
            completion === true &&
            (!(hasAssessmentEvidence || assessmentLikeStatement) || success === true || hasPassingScore);
        return upsertLearningProgress({
            contentId,
            userKey,
            status: hasExplicitFailure ? 'FAILED' : (hasVerifiedCompletionSignal ? 'COMPLETED' : 'LEARNING'),
            progress: hasExplicitFailure ? Math.min(99, normalizedProgress) : normalizedProgress,
            currentTime,
            duration,
            scoreRaw,
            scoreScaled,
            success,
            completion,
        });
    }
    return null;
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const { data: statement, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const actorEmail = session.user.email || `${session.user.username || 'user'}@${APP_HOSTNAME}`;
        const actorName = session.user.username || 'Learner';
        statement.actor = {
            mbox: `mailto:${actorEmail}`,
            name: actorName,
            objectType: 'Agent',
        };
        const normalized = normalizeStatement(statement);

        if (!normalized?.verb?.id || !normalized?.object?.id) {
            return NextResponse.json({ error: 'Invalid xAPI statement' }, { status: 400 });
        }

        const contentId = extractContentId(normalized.object.id);
        const payload = {
            ...normalized,
            contentId,
            storedAt: new Date().toISOString(),
        };

        const savedStatementResult = await createXapiStatement({
            statementId: normalized.id,
            actorKey: normalizeUserKey(normalized.actor?.mbox || ''),
            verbId: normalized.verb?.id,
            objectId: normalized.object?.id,
            payloadJson: payload,
            contentId,
            timestamp: normalized.timestamp,
        });
        if (!savedStatementResult?.row) {
            const reason = String(savedStatementResult?.reason || '');
            const mapped = {
                ENROLLMENT_REQUIRED: 'Enrollment required',
                COURSE_INACTIVE: 'Course is inactive',
                SECTION_INACTIVE: 'Section is inactive',
                LEARN_WINDOW_EXPIRED: 'Learning period expired',
            };
            return NextResponse.json(
                { error: mapped[reason] || 'Learning access denied', reason },
                { status: 403 }
            );
        }

        const progressResult = await updateProgressFromStatement(normalized, contentId);

        if (progressResult?.meta?.transitionedToCompleted) {
            const enrollmentId = Number(progressResult?.meta?.enrollmentId || 0);
            const organizationId = Number(progressResult?.meta?.organizationId || 0);
            if (enrollmentId > 0 && organizationId > 0) {
                const enrollment = await prisma.enrollment.findUnique({
                    where: { id: enrollmentId },
                    include: {
                        courses: {
                            select: {
                                id: true,
                                title: true,
                                hasCertificate: true,
                                certificateMode: true,
                            },
                        },
                        learning_progress: {
                            select: {
                                sectionId: true,
                            },
                            orderBy: { id: 'desc' },
                            take: 10,
                        },
                    },
                });

                if (enrollment && Number(enrollment.userId || 0) === Number(session.uid || 0)) {
                    await createNotification({
                        organizationId,
                        type: 'COURSE_COMPLETED',
                        title: 'Course Completed',
                        message: `You completed "${String(enrollment?.courses?.title || 'Course').trim()}". Great job!`,
                        payload: {
                            kind: 'course_completed',
                            enrollmentId: Number(enrollment.id || 0),
                            courseId: Number(enrollment.courseId || 0),
                            actionUrl: '/training-results',
                        },
                        severity: 'info',
                        category: 'COURSE',
                        createdBy: Number(session.uid || 0),
                        recipientUserIds: [Number(session.uid || 0)],
                    });

                    const selectedSectionId = Number(enrollment?.learning_progress?.[0]?.sectionId || 0);
                    const sectionCompatMaps = await getSectionCompatMaps(
                        Number.isInteger(selectedSectionId) && selectedSectionId > 0 ? [selectedSectionId] : []
                    );
                    const effectiveCertificate = resolveEffectiveCertificateConfig({
                        courseHasCertificate: enrollment?.courses?.hasCertificate,
                        courseCertificateMode: enrollment?.courses?.certificateMode,
                        sectionId: Number.isInteger(selectedSectionId) && selectedSectionId > 0 ? selectedSectionId : null,
                        sectionSettingsBySectionId: sectionCompatMaps?.sectionSettingsBySectionId || {},
                    });

                    if (effectiveCertificate.required && effectiveCertificate.mode === 'auto') {
                        const verifyCode = `CERT-${Date.now().toString(36).toUpperCase()}`;
                        await prisma.certificate.upsert({
                            where: { enrollmentId: enrollment.id },
                            update: {},
                            create: {
                                enrollmentId: enrollment.id,
                                verifyCode,
                                recipientName: String(session.user?.username || session.user?.email || `User ${session.uid}`),
                                status: 'issued',
                            },
                        });

                        await createNotification({
                            organizationId,
                            type: 'CERTIFICATE_ISSUED',
                            title: 'Certificate Issued',
                            message: `Your certificate for "${String(enrollment?.courses?.title || 'Course').trim()}" is ready.`,
                            payload: {
                                kind: 'certificate_issued',
                                enrollmentId: Number(enrollment.id || 0),
                                courseId: Number(enrollment.courseId || 0),
                                actionUrl: '/training-results',
                            },
                            severity: 'info',
                            category: 'COURSE',
                            createdBy: Number(session.uid || 0),
                            recipientUserIds: [Number(session.uid || 0)],
                        });
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            statementId: normalized.id,
        });
    } catch (err) {
        console.error('[xapi/statements][POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const contentId = searchParams.get('contentId') || '';
        const actor = session.isAdmin
            ? (searchParams.get('actor') || '')
            : (session.user.email || session.user.username || '');
        const verb = searchParams.get('verb') || '';
        const limit = parseInt(searchParams.get('limit') || '100', 10);

        const statements = await listXapiStatements({ contentId, actor, verb, limit });
        return NextResponse.json(statements);
    } catch (err) {
        console.error('[xapi/statements][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
