import { getRequestIp } from '@/lib/server/auth';
import { writeAdminAudit } from '@/lib/server/admin-audit';
import { maskEmail, maskIp, maskUsername } from '@/lib/server/pii';

function normalizeString(value, fallback = '') {
    const text = String(value || '').trim();
    return text || fallback;
}

function normalizeCourseQuery(value) {
    return normalizeString(value).slice(0, 160);
}

function normalizeSource(value) {
    const source = normalizeString(value).toLowerCase();
    if (source === 'api') return 'api';
    return 'chat';
}

function normalizeStatus(value) {
    const status = normalizeString(value).toLowerCase();
    if (status === 'ok') return 'ok';
    if (status === 'no_course') return 'no_course';
    if (status === 'course_not_found') return 'course_not_found';
    if (status === 'unauthorized') return 'unauthorized';
    return 'unknown';
}

function toSafeInt(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.floor(n);
    return int >= 0 ? int : fallback;
}

export async function logMyLearningSummaryAccess({
    request,
    session,
    source = 'chat',
    courseQuery = '',
    totalCourses = 0,
    cacheHit = null,
    status = 'ok',
} = {}) {
    const organizationId = Number(session?.organizationId || 0);
    if (!Number.isInteger(organizationId) || organizationId <= 0) return;

    const actorUserId = Number(session?.uid || 0);
    const safeSource = normalizeSource(source);
    const safeStatus = normalizeStatus(status);
    const safeQuery = normalizeCourseQuery(courseQuery);
    const safeTotalCourses = toSafeInt(totalCourses, 0);
    const path = safeSource === 'api' ? '/api/my-learning-summary' : '/api/chat';

    try {
        await writeAdminAudit({
            organizationId,
            actorUserId: Number.isInteger(actorUserId) && actorUserId > 0 ? actorUserId : null,
            actorUsername: maskUsername(session?.user?.username) || normalizeString(session?.user?.username),
            actorEmail: maskEmail(session?.user?.email) || normalizeString(session?.user?.email),
            action: 'READ_MY_LEARNING_SUMMARY',
            entity: 'LEARNING_SUMMARY',
            message: `User requested learning summary via ${safeSource}`,
            severity: 'info',
            request: {
                method: normalizeString(request?.method, 'GET'),
                path,
                ip: maskIp(getRequestIp(request)) || normalizeString(getRequestIp(request)),
                userAgent: normalizeString(request?.headers?.get('user-agent')).slice(0, 255),
            },
            details: {
                source: safeSource,
                status: safeStatus,
                courseQuery: safeQuery || null,
                totalCourses: safeTotalCourses,
                cacheHit: typeof cacheHit === 'boolean' ? cacheHit : null,
            },
        });
    } catch (err) {
        console.warn('[my-learning-summary/audit] write failed', err);
    }
}
