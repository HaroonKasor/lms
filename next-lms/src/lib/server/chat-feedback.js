import prisma from '@/lib/prisma';
import { getRequestIp } from '@/lib/server/auth';
import {
    hashPiiValue,
    maskEmail,
    maskIp,
    maskUsername,
    redactPiiText,
} from '@/lib/server/pii';

const CHAT_FEEDBACK_STORAGE_PREFIX = '__chat-feedback__/';
const CHAT_FEEDBACK_ASSET_TYPE = 'document';
const MAX_TEXT_LENGTH = 4000;
const MAX_REASON_LENGTH = 500;
const MAX_MESSAGE_ID_LENGTH = 120;
const MAX_CONVERSATION_ITEMS = 8;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const DEFAULT_WEEKLY_WINDOW = 8;
const MAX_WEEKLY_WINDOW = 24;
const PROMPT_TUNING_CACHE_TTL_MS = 1000 * 60 * 15;
const MAX_PROMPT_HINT_REASONS = 6;

function sanitizeText(value, maxLength = MAX_TEXT_LENGTH) {
    return String(value || '').trim().slice(0, maxLength);
}

function sanitizeRating(value) {
    const rating = String(value || '').trim().toLowerCase();
    if (rating === 'up' || rating === 'down') return rating;
    return '';
}

function toPositiveInt(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.floor(n);
    return int > 0 ? int : fallback;
}

function toNonNegativeInt(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.floor(n);
    return int >= 0 ? int : fallback;
}

function normalizeDateString(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    return `${match[1]}-${match[2]}-${match[3]}`;
}

function toDayStartIso(value) {
    const normalized = normalizeDateString(value);
    if (!normalized) return null;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function toDayEndIso(value) {
    const normalized = normalizeDateString(value);
    if (!normalized) return null;
    const date = new Date(`${normalized}T23:59:59.999Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function normalizeDate(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function toRatingLabel(rating) {
    return rating === 'up' ? 'Helpful' : 'Not helpful';
}

function trimReason(reason) {
    return sanitizeText(reason, MAX_REASON_LENGTH);
}

function mapCourseIndex(courses = []) {
    return (Array.isArray(courses) ? courses : [])
        .map((course) => {
            const id = Number(course?.id || 0);
            const title = sanitizeText(course?.title, 180);
            if (!Number.isInteger(id) || id <= 0 || !title) return null;
            return {
                id,
                title,
                titleLower: title.toLowerCase(),
            };
        })
        .filter(Boolean);
}

function extractCourseIdFromPath(path) {
    const raw = String(path || '').trim();
    if (!raw) return 0;
    const match = raw.match(/\/courses\/(\d+)(?:\/|$)/i);
    if (!match) return 0;
    const id = Number(match[1]);
    return Number.isInteger(id) && id > 0 ? id : 0;
}

function resolveFeedbackCourseHint(meta = {}, courseIndex = []) {
    const fromPathCourseId = extractCourseIdFromPath(
        meta?.pagePath
        || meta?.context?.pagePath
        || meta?.request?.pagePath
        || ''
    );
    if (fromPathCourseId > 0) {
        const found = courseIndex.find((course) => Number(course?.id) === fromPathCourseId);
        if (found?.title) return found.title;
    }

    const fromMeta = sanitizeText(
        meta?.courseTitle
        || meta?.context?.courseTitle
        || meta?.details?.courseTitle
        || '',
        180
    );
    if (fromMeta) return fromMeta;

    const mergedText = [
        sanitizeText(meta?.assistantMessage, 1000),
        sanitizeText(meta?.reason, 300),
        ...(Array.isArray(meta?.conversation) ? meta.conversation.map((row) => sanitizeText(row?.content, 500)) : []),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    if (!mergedText) return '';

    for (const course of courseIndex) {
        if (!course?.titleLower) continue;
        if (mergedText.includes(course.titleLower)) return course.title;
    }
    return '';
}

function mapFeedbackRow(row, courseIndex = []) {
    const meta = row?.metadataJson && typeof row.metadataJson === 'object'
        ? row.metadataJson
        : {};
    const rating = sanitizeRating(meta?.rating || '');
    if (!rating) return null;

    const reason = trimReason(meta?.reason || '');
    const courseTitle = resolveFeedbackCourseHint(meta, courseIndex);
    const actor = meta?.actor && typeof meta.actor === 'object' ? meta.actor : {};
    const request = meta?.request && typeof meta.request === 'object' ? meta.request : {};
    const createdAt = normalizeDate(meta?.createdAt || row?.uploadedAt) || new Date().toISOString();
    const assistantMessage = sanitizeText(meta?.assistantMessage || '', MAX_TEXT_LENGTH);
    const intent = sanitizeText(meta?.intent, 60).toLowerCase() || 'unknown';
    const provider = sanitizeText(meta?.provider, 80).toLowerCase() || '-';
    const actorUsername = sanitizeText(actor?.usernameMasked || actor?.username, 120) || '-';
    const actorEmail = sanitizeText(actor?.emailMasked || actor?.email, 255) || '-';

    return {
        id: Number(row?.id || 0),
        rating,
        ratingLabel: toRatingLabel(rating),
        reason: reason || '-',
        hasReason: Boolean(reason),
        courseTitle: courseTitle || '-',
        assistantMessage: assistantMessage || '-',
        actorUserId: Number(actor?.userId || row?.uploadedById || 0) || null,
        actorUsername,
        actorEmail,
        actorRole: sanitizeText(actor?.role, 30) || 'learner',
        messageId: sanitizeText(meta?.messageId, MAX_MESSAGE_ID_LENGTH) || null,
        intent,
        provider,
        requestPath: sanitizeText(request?.path, 120) || '-',
        createdAt,
        date: createdAt.slice(0, 10),
    };
}

function normalizeQueryText(value) {
    return sanitizeText(value, 160).toLowerCase();
}

function matchesQuery(row, query) {
    const q = normalizeQueryText(query);
    if (!q) return true;
    const haystack = [
        row?.reason,
        row?.assistantMessage,
        row?.courseTitle,
        row?.intent,
        row?.provider,
        row?.actorUsername,
        row?.actorEmail,
    ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
    return haystack.includes(q);
}

function getWeekStartUtc(dateValue = null) {
    const date = new Date(dateValue || Date.now());
    if (Number.isNaN(date.getTime())) return null;
    const day = date.getUTCDay();
    const diff = (day + 6) % 7; // Monday-based week
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - diff);
    return start;
}

function weekLabelFromStart(startDate) {
    if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return '-';
    const endDate = new Date(startDate.getTime());
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const pad = (n) => String(n).padStart(2, '0');
    return `${startDate.getUTCFullYear()}-${pad(startDate.getUTCMonth() + 1)}-${pad(startDate.getUTCDate())} to ${endDate.getUTCFullYear()}-${pad(endDate.getUTCMonth() + 1)}-${pad(endDate.getUTCDate())}`;
}

async function listCourseIndex(organizationId) {
    const rows = await prisma.course.findMany({
        where: { organization_id: organizationId },
        orderBy: { title: 'asc' },
        select: { id: true, title: true },
    });
    return mapCourseIndex(rows);
}

function buildBaseWhere({ organizationId, fromDate = '', toDate = '' } = {}) {
    const where = {
        organization_id: organizationId,
        assetType: CHAT_FEEDBACK_ASSET_TYPE,
        storagePath: { startsWith: CHAT_FEEDBACK_STORAGE_PREFIX },
    };
    const fromIso = toDayStartIso(fromDate);
    const toIso = toDayEndIso(toDate);
    if (fromIso || toIso) {
        where.uploadedAt = {};
        if (fromIso) where.uploadedAt.gte = new Date(fromIso);
        if (toIso) where.uploadedAt.lte = new Date(toIso);
    }
    return where;
}

function sanitizeConversation(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .slice(-MAX_CONVERSATION_ITEMS)
        .map((item) => ({
            role: String(item?.role || '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user',
            content: redactPiiText(item?.content, 1200),
        }))
        .filter((item) => item.content.length > 0);
}

function buildStoragePath(organizationId, now = new Date()) {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${CHAT_FEEDBACK_STORAGE_PREFIX}${organizationId}/${year}/${month}/${timestamp}-${randomPart}.json`;
}

function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'admin') return 'admin';
    if (value === 'instructor') return 'instructor';
    return 'learner';
}

export async function createChatFeedback({
    request,
    session,
    messageId = '',
    assistantMessage = '',
    rating = '',
    reason = '',
    conversation = [],
    pagePath = '',
    intent = '',
    provider = '',
    intentConfidence = 0,
} = {}) {
    const organizationId = Number(session?.organizationId || 0);
    const actorUserId = Number(session?.uid || 0);
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
        throw new Error('Missing organization context');
    }
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
        throw new Error('Missing user context');
    }

    const safeRating = sanitizeRating(rating);
    if (!safeRating) {
        throw new Error('Invalid rating');
    }

    const now = new Date();
    const safeMessageId = sanitizeText(messageId, MAX_MESSAGE_ID_LENGTH);
    const safeAssistantMessage = sanitizeText(assistantMessage, MAX_TEXT_LENGTH);
    if (!safeAssistantMessage) {
        throw new Error('assistantMessage is required');
    }

    const payload = {
        kind: 'chat_feedback',
        source: 'chat_panel',
        rating: safeRating,
        reason: redactPiiText(reason, MAX_REASON_LENGTH) || null,
        messageId: safeMessageId || null,
        assistantMessage: redactPiiText(safeAssistantMessage, MAX_TEXT_LENGTH),
        conversation: sanitizeConversation(conversation),
        actor: {
            userId: actorUserId,
            userRef: `usr_${hashPiiValue(actorUserId)}`,
            usernameMasked: maskUsername(session?.user?.username),
            emailMasked: maskEmail(session?.user?.email),
            role: normalizeRole(session?.role),
            organizationId,
        },
        request: {
            method: sanitizeText(request?.method, 8) || 'POST',
            path: '/api/chat-feedback',
            ipMasked: maskIp(getRequestIp(request)),
            userAgent: sanitizeText(request?.headers?.get('user-agent'), 255),
            pagePath: sanitizeText(pagePath, 220) || null,
        },
        pagePath: sanitizeText(pagePath, 220) || null,
        intent: sanitizeText(intent, 60).toLowerCase() || null,
        provider: sanitizeText(provider, 80).toLowerCase() || null,
        intentConfidence: Number.isFinite(Number(intentConfidence))
            ? Math.max(0, Math.min(1, Number(intentConfidence)))
            : null,
        createdAt: now.toISOString(),
    };

    const row = await prisma.learningAsset.create({
        data: {
            organization_id: organizationId,
            assetType: CHAT_FEEDBACK_ASSET_TYPE,
            title: `[CHAT_FEEDBACK] ${safeRating.toUpperCase()}`.slice(0, 255),
            storagePath: buildStoragePath(organizationId, now),
            publicUrl: null,
            metadataJson: payload,
            uploadedById: actorUserId,
            uploadedAt: now,
        },
        select: {
            id: true,
            uploadedAt: true,
        },
    });

    return {
        feedbackId: String(row?.id || ''),
        submittedAt: row?.uploadedAt ? new Date(row.uploadedAt).toISOString() : now.toISOString(),
    };
}

export async function listChatFeedback({
    organizationId,
    page = 1,
    limit = DEFAULT_LIST_LIMIT,
    rating = 'all',
    fromDate = '',
    toDate = '',
    course = '',
    q = '',
} = {}) {
    const safePage = toPositiveInt(page, 1);
    const safeLimit = Math.max(1, Math.min(MAX_LIST_LIMIT, toPositiveInt(limit, DEFAULT_LIST_LIMIT)));
    const safeRating = String(rating || 'all').trim().toLowerCase();
    const safeCourse = sanitizeText(course, 180);
    const where = buildBaseWhere({ organizationId, fromDate, toDate });

    const [rows, courseIndex] = await Promise.all([
        prisma.learningAsset.findMany({
            where,
            orderBy: { uploadedAt: 'desc' },
            take: 3000,
            select: {
                id: true,
                metadataJson: true,
                uploadedById: true,
                uploadedAt: true,
            },
        }),
        listCourseIndex(organizationId),
    ]);

    let normalized = rows
        .map((row) => mapFeedbackRow(row, courseIndex))
        .filter(Boolean);

    if (safeRating === 'up' || safeRating === 'down') {
        normalized = normalized.filter((row) => row.rating === safeRating);
    }
    if (safeCourse) {
        const needle = safeCourse.toLowerCase();
        normalized = normalized.filter((row) => String(row?.courseTitle || '').toLowerCase().includes(needle));
    }
    if (q) {
        normalized = normalized.filter((row) => matchesQuery(row, q));
    }

    const totalCount = normalized.length;
    const start = (safePage - 1) * safeLimit;
    const items = normalized.slice(start, start + safeLimit);
    const helpfulCount = normalized.filter((row) => row.rating === 'up').length;
    const notHelpfulCount = normalized.filter((row) => row.rating === 'down').length;
    const reasonCount = normalized.filter((row) => row.hasReason).length;

    return {
        page: safePage,
        limit: safeLimit,
        totalCount,
        items,
        summary: {
            helpfulCount,
            notHelpfulCount,
            reasonCount,
            notHelpfulRatePercent: totalCount > 0 ? Math.round((notHelpfulCount / totalCount) * 100) : 0,
        },
        filters: {
            courses: courseIndex.map((row) => ({ id: row.id, name: row.title })),
        },
        selected: {
            rating: safeRating,
            fromDate: normalizeDateString(fromDate),
            toDate: normalizeDateString(toDate),
            course: safeCourse,
            q: sanitizeText(q, 160),
        },
    };
}

export async function buildWeeklyChatFeedbackInsights({
    organizationId,
    weeks = DEFAULT_WEEKLY_WINDOW,
} = {}) {
    const safeWeeks = Math.max(1, Math.min(MAX_WEEKLY_WINDOW, toPositiveInt(weeks, DEFAULT_WEEKLY_WINDOW)));
    const now = new Date();
    const currentWeekStart = getWeekStartUtc(now);
    const earliest = new Date(currentWeekStart.getTime());
    earliest.setUTCDate(earliest.getUTCDate() - ((safeWeeks - 1) * 7));

    const [rows, courseIndex] = await Promise.all([
        prisma.learningAsset.findMany({
            where: {
                ...buildBaseWhere({ organizationId }),
                uploadedAt: { gte: earliest },
            },
            orderBy: { uploadedAt: 'desc' },
            take: 5000,
            select: {
                id: true,
                metadataJson: true,
                uploadedById: true,
                uploadedAt: true,
            },
        }),
        listCourseIndex(organizationId),
    ]);

    const feedbackRows = rows
        .map((row) => mapFeedbackRow(row, courseIndex))
        .filter(Boolean);

    const weekBuckets = new Map();
    for (let i = 0; i < safeWeeks; i += 1) {
        const start = new Date(currentWeekStart.getTime());
        start.setUTCDate(start.getUTCDate() - (i * 7));
        const key = start.toISOString().slice(0, 10);
        weekBuckets.set(key, {
            weekStart: key,
            weekLabel: weekLabelFromStart(start),
            total: 0,
            helpful: 0,
            notHelpful: 0,
            withReason: 0,
        });
    }

    const reasonCounter = new Map();
    const courseIssueCounter = new Map();

    for (const row of feedbackRows) {
        const start = getWeekStartUtc(row.createdAt);
        if (!start) continue;
        const weekKey = start.toISOString().slice(0, 10);
        if (!weekBuckets.has(weekKey)) continue;
        const bucket = weekBuckets.get(weekKey);
        bucket.total += 1;
        if (row.rating === 'up') bucket.helpful += 1;
        if (row.rating === 'down') {
            bucket.notHelpful += 1;
            const reasonKey = String(row.reason || '').trim();
            if (reasonKey && reasonKey !== '-') {
                reasonCounter.set(reasonKey, toNonNegativeInt(reasonCounter.get(reasonKey), 0) + 1);
            }
            const courseKey = String(row.courseTitle || '').trim();
            if (courseKey && courseKey !== '-') {
                courseIssueCounter.set(courseKey, toNonNegativeInt(courseIssueCounter.get(courseKey), 0) + 1);
            }
        }
        if (row.hasReason) bucket.withReason += 1;
    }

    const weekly = Array.from(weekBuckets.values())
        .sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart)))
        .map((row) => ({
            ...row,
            notHelpfulRatePercent: row.total > 0 ? Math.round((row.notHelpful / row.total) * 100) : 0,
        }));

    const topNegativeReasons = Array.from(reasonCounter.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const topCourseIssues = Array.from(courseIssueCounter.entries())
        .map(([courseTitle, count]) => ({ courseTitle, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const totals = weekly.reduce((acc, row) => {
        acc.total += row.total;
        acc.helpful += row.helpful;
        acc.notHelpful += row.notHelpful;
        acc.withReason += row.withReason;
        return acc;
    }, { total: 0, helpful: 0, notHelpful: 0, withReason: 0 });

    return {
        weeks: safeWeeks,
        generatedAt: new Date().toISOString(),
        totals: {
            ...totals,
            notHelpfulRatePercent: totals.total > 0 ? Math.round((totals.notHelpful / totals.total) * 100) : 0,
            reasonCoveragePercent: totals.total > 0 ? Math.round((totals.withReason / totals.total) * 100) : 0,
        },
        weekly,
        topNegativeReasons,
        topCourseIssues,
    };
}

function getPromptTuningCacheStore() {
    if (!globalThis.__chatPromptTuningCacheStore) {
        globalThis.__chatPromptTuningCacheStore = new Map();
    }
    return globalThis.__chatPromptTuningCacheStore;
}

function readPromptTuningCache(cacheKey) {
    if (!cacheKey) return '';
    const cache = getPromptTuningCacheStore();
    const cached = cache.get(cacheKey);
    if (!cached) return '';
    if (Date.now() - Number(cached.cachedAtMs || 0) > PROMPT_TUNING_CACHE_TTL_MS) {
        cache.delete(cacheKey);
        return '';
    }
    return String(cached.value || '');
}

function writePromptTuningCache(cacheKey, value) {
    if (!cacheKey) return;
    const cache = getPromptTuningCacheStore();
    cache.set(cacheKey, {
        value: String(value || ''),
        cachedAtMs: Date.now(),
    });
}

export async function buildPromptTuningHints({
    organizationId,
    weeks = DEFAULT_WEEKLY_WINDOW,
    maxReasons = MAX_PROMPT_HINT_REASONS,
} = {}) {
    const orgId = Number(organizationId || 0);
    if (!Number.isInteger(orgId) || orgId <= 0) return '';
    const safeWeeks = Math.max(1, Math.min(MAX_WEEKLY_WINDOW, toPositiveInt(weeks, DEFAULT_WEEKLY_WINDOW)));
    const safeMaxReasons = Math.max(1, Math.min(MAX_PROMPT_HINT_REASONS, toPositiveInt(maxReasons, 4)));
    const cacheKey = `${orgId}:${safeWeeks}:${safeMaxReasons}`;
    const cached = readPromptTuningCache(cacheKey);
    if (cached) return cached;

    const insights = await buildWeeklyChatFeedbackInsights({
        organizationId: orgId,
        weeks: safeWeeks,
    });
    const reasons = Array.isArray(insights?.topNegativeReasons) ? insights.topNegativeReasons : [];
    const negativeRate = Number(insights?.totals?.notHelpfulRatePercent || 0);
    if (reasons.length === 0 || negativeRate <= 0) {
        writePromptTuningCache(cacheKey, '');
        return '';
    }

    const reasonLines = reasons
        .slice(0, safeMaxReasons)
        .map((item, index) => {
            const reasonText = redactPiiText(item?.reason, 180);
            const count = toNonNegativeInt(item?.count, 0);
            if (!reasonText) return null;
            return `${index + 1}) ${reasonText} (พบ ${count} ครั้ง)`;
        })
        .filter(Boolean);

    if (reasonLines.length === 0) {
        writePromptTuningCache(cacheKey, '');
        return '';
    }

    const hintText = `แนวทางปรับคำตอบจาก feedback เชิงลบล่าสุด (${safeWeeks} สัปดาห์):
- อัตรา Not Helpful ปัจจุบัน: ${negativeRate}%
- ประเด็นที่พบบ่อย:
${reasonLines.join('\n')}

ข้อกำหนดการตอบ:
- ตอบให้ตรงคำถามก่อน แล้วค่อยเสริมรายละเอียดที่จำเป็น
- ใช้ภาษาสั้น ชัดเจน และหลีกเลี่ยงความกำกวม
- หากข้อมูลไม่พอ ให้บอกข้อจำกัดอย่างตรงไปตรงมา และเสนอขั้นตอนถัดไป`;

    writePromptTuningCache(cacheKey, hintText);
    return hintText;
}
