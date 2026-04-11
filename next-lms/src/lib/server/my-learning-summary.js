import prisma from '@/lib/prisma';

const ENROLLMENT_STATUS_RANK = {
    COMPLETED: 5,
    LEARNING: 4,
    APPROVED: 3,
    PENDING: 2,
    FAILED: 1,
    CANCELLED: 0,
};
const MAX_CACHE_TTL_MS = 60 * 1000;

function toCacheTtlMs(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const int = Math.floor(n);
    if (int <= 0) return 0;
    return Math.min(MAX_CACHE_TTL_MS, int);
}

function getMyLearningSummaryCacheStore() {
    if (!globalThis.__myLearningSummaryCacheStore) {
        globalThis.__myLearningSummaryCacheStore = new Map();
    }
    return globalThis.__myLearningSummaryCacheStore;
}

function buildMyLearningSummaryCacheKey(userId, organizationId, courseQuery) {
    return `${userId}:${organizationId}:${normalizeQuery(courseQuery)}`;
}

function readCachedSummary(cacheKey, cacheTtlMs) {
    const ttl = toCacheTtlMs(cacheTtlMs);
    if (!cacheKey || ttl <= 0) return null;
    const cache = getMyLearningSummaryCacheStore();
    const cached = cache.get(cacheKey);
    if (!cached) return null;
    if (Date.now() - Number(cached.cachedAtMs || 0) > ttl) {
        cache.delete(cacheKey);
        return null;
    }
    return cached.value || null;
}

function writeCachedSummary(cacheKey, value, cacheTtlMs) {
    const ttl = toCacheTtlMs(cacheTtlMs);
    if (!cacheKey || ttl <= 0 || !value || typeof value !== 'object') return;
    const cache = getMyLearningSummaryCacheStore();
    cache.set(cacheKey, { value, cachedAtMs: Date.now() });
}

export function toProgressPercent(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
}

export function normalizeEnrollmentStatus(rawStatus, progressPercent) {
    const status = String(rawStatus || '').trim().toLowerCase();
    const progress = toProgressPercent(progressPercent);
    if (status === 'completed') return 'COMPLETED';
    if (status === 'in_progress') return progress > 0 ? 'LEARNING' : 'APPROVED';
    if (status === 'enrolled') return 'PENDING';
    if (status === 'dropped') return 'FAILED';
    if (status === 'cancelled') return 'CANCELLED';
    if (progress >= 100) return 'COMPLETED';
    if (progress > 0) return 'LEARNING';
    return 'PENDING';
}

function selectPreferredCourseEnrollment(current, incoming) {
    if (!current) return incoming;
    if (!incoming) return current;
    const currentRank = ENROLLMENT_STATUS_RANK[current.status] ?? 0;
    const incomingRank = ENROLLMENT_STATUS_RANK[incoming.status] ?? 0;
    if (incomingRank !== currentRank) return incomingRank > currentRank ? incoming : current;
    if (incoming.progressPercent !== current.progressPercent) {
        return incoming.progressPercent > current.progressPercent ? incoming : current;
    }
    const currentTime = Date.parse(current.lastActivityAt || current.enrolledAt || '') || 0;
    const incomingTime = Date.parse(incoming.lastActivityAt || incoming.enrolledAt || '') || 0;
    return incomingTime > currentTime ? incoming : current;
}

function normalizeCourseName(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
}

function normalizeQuery(value) {
    return String(value || '').trim().toLowerCase();
}

function computeLastUpdatedAt(courses = [], fallbackIso = null) {
    let maxTime = 0;
    for (const item of courses) {
        const t = Date.parse(item?.lastActivityAt || item?.completedAt || item?.enrolledAt || '') || 0;
        if (t > maxTime) maxTime = t;
    }
    if (maxTime > 0) return new Date(maxTime).toISOString();
    return fallbackIso || new Date().toISOString();
}

function buildTotals(courses = []) {
    return {
        totalCourses: courses.length,
        completedCourses: courses.filter((item) => item.status === 'COMPLETED').length,
        learningCourses: courses.filter((item) => item.status === 'LEARNING' || item.status === 'APPROVED').length,
        pendingCourses: courses.filter((item) => item.status === 'PENDING').length,
        averageProgressPercent: courses.length > 0
            ? Math.round(courses.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / courses.length)
            : 0,
    };
}

export async function buildMyLearningSummary({ session, courseQuery = '', cacheTtlMs = 0 } = {}) {
    const userId = Number(session?.uid || 0);
    const organizationId = Number(session?.organizationId || 0);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(organizationId) || organizationId <= 0) {
        return {
            totals: buildTotals([]),
            totalsAll: buildTotals([]),
            courses: [],
            lastUpdatedAt: new Date().toISOString(),
            generatedAt: new Date().toISOString(),
            courseQuery: String(courseQuery || '').trim(),
        };
    }
    const cacheKey = buildMyLearningSummaryCacheKey(userId, organizationId, courseQuery);
    const cached = readCachedSummary(cacheKey, cacheTtlMs);
    if (cached) return cached;

    const rows = await prisma.enrollment.findMany({
        where: {
            userId,
            organization_id: organizationId,
        },
        select: {
            id: true,
            courseId: true,
            status: true,
            progressPercent: true,
            enrolledAt: true,
            lastActivityAt: true,
            completedAt: true,
            courses: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
        orderBy: [{ id: 'desc' }],
    });

    const byCourse = new Map();
    for (const row of rows) {
        const courseId = Number(row?.courses?.id || row?.courseId || 0);
        if (!Number.isInteger(courseId) || courseId <= 0) continue;
        const normalized = {
            courseId,
            courseName: normalizeCourseName(row?.courses?.title, `Course ${courseId}`),
            status: normalizeEnrollmentStatus(row?.status, row?.progressPercent),
            progressPercent: toProgressPercent(row?.progressPercent),
            enrolledAt: row?.enrolledAt || null,
            lastActivityAt: row?.lastActivityAt || null,
            completedAt: row?.completedAt || null,
        };
        const current = byCourse.get(courseId);
        byCourse.set(courseId, selectPreferredCourseEnrollment(current, normalized));
    }

    const allCourses = Array.from(byCourse.values());
    const q = normalizeQuery(courseQuery);
    const courses = q
        ? allCourses.filter((item) => normalizeQuery(item?.courseName).includes(q))
        : allCourses;

    const generatedAt = new Date().toISOString();
    const result = {
        totals: buildTotals(courses),
        totalsAll: buildTotals(allCourses),
        courses,
        lastUpdatedAt: computeLastUpdatedAt(courses, computeLastUpdatedAt(allCourses, generatedAt)),
        generatedAt,
        courseQuery: String(courseQuery || '').trim(),
    };
    writeCachedSummary(cacheKey, result, cacheTtlMs);
    return result;
}
