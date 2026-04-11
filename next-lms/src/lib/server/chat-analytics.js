import prisma from '@/lib/prisma';

const CHAT_LOG_STORAGE_PREFIX = '__chat-log__/';
const CHAT_FEEDBACK_STORAGE_PREFIX = '__chat-feedback__/';
const CHAT_ASSET_TYPE = 'document';
const MAX_ROWS = 8000;

function sanitizeText(value, max = 180) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function toPositiveInt(value, fallback = 4) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.floor(n);
    return int > 0 ? int : fallback;
}

function getSinceDate(weeks = 4) {
    const safeWeeks = Math.max(1, Math.min(24, toPositiveInt(weeks, 4)));
    const now = new Date();
    now.setUTCDate(now.getUTCDate() - (safeWeeks * 7));
    return now;
}

function parseChatLog(row) {
    const meta = row?.metadataJson && typeof row.metadataJson === 'object' ? row.metadataJson : {};
    const context = meta?.context && typeof meta.context === 'object' ? meta.context : {};
    const provider = sanitizeText(meta?.provider, 80) || 'unknown';
    const intent = sanitizeText(meta?.intent || context?.intent, 60) || 'general';
    const pagePath = sanitizeText(context?.pagePath || meta?.pagePath, 220) || '-';
    const responseMs = Number(meta?.responseMs || 0);
    return {
        provider,
        intent,
        pagePath,
        responseMs: Number.isFinite(responseMs) && responseMs >= 0 ? Math.round(responseMs) : null,
    };
}

function parseFeedback(row) {
    const meta = row?.metadataJson && typeof row.metadataJson === 'object' ? row.metadataJson : {};
    const rating = String(meta?.rating || '').toLowerCase();
    if (rating !== 'up' && rating !== 'down') return null;
    const intent = sanitizeText(meta?.intent, 60) || 'unknown';
    const pagePath = sanitizeText(meta?.pagePath || meta?.request?.pagePath, 220) || '-';
    return { rating, intent, pagePath };
}

function ensureBucket(map, key) {
    if (!map.has(key)) {
        map.set(key, { total: 0, helpful: 0, notHelpful: 0 });
    }
    return map.get(key);
}

function withRate(bucket) {
    const total = Number(bucket?.total || 0);
    const helpful = Number(bucket?.helpful || 0);
    const notHelpful = Number(bucket?.notHelpful || 0);
    const helpfulRatePercent = total > 0 ? Math.round((helpful / total) * 100) : 0;
    return { total, helpful, notHelpful, helpfulRatePercent };
}

export async function buildChatAnalytics({
    organizationId,
    weeks = 4,
} = {}) {
    const orgId = Number(organizationId || 0);
    if (!Number.isInteger(orgId) || orgId <= 0) {
        return {
            generatedAt: new Date().toISOString(),
            totals: {
                conversations: 0,
                feedback: withRate({ total: 0, helpful: 0, notHelpful: 0 }),
                fallbackRatePercent: 0,
                averageFirstResponseMs: 0,
            },
            byIntent: [],
            byPage: [],
        };
    }

    const since = getSinceDate(weeks);
    const [logRows, feedbackRows] = await Promise.all([
        prisma.learningAsset.findMany({
            where: {
                organization_id: orgId,
                assetType: CHAT_ASSET_TYPE,
                storagePath: { startsWith: CHAT_LOG_STORAGE_PREFIX },
                uploadedAt: { gte: since },
            },
            orderBy: { uploadedAt: 'desc' },
            take: MAX_ROWS,
            select: { metadataJson: true, uploadedAt: true },
        }),
        prisma.learningAsset.findMany({
            where: {
                organization_id: orgId,
                assetType: CHAT_ASSET_TYPE,
                storagePath: { startsWith: CHAT_FEEDBACK_STORAGE_PREFIX },
                uploadedAt: { gte: since },
            },
            orderBy: { uploadedAt: 'desc' },
            take: MAX_ROWS,
            select: { metadataJson: true, uploadedAt: true },
        }),
    ]);

    const logs = logRows.map(parseChatLog);
    const feedback = feedbackRows.map(parseFeedback).filter(Boolean);

    const feedbackTotals = withRate({
        total: feedback.length,
        helpful: feedback.filter((row) => row.rating === 'up').length,
        notHelpful: feedback.filter((row) => row.rating === 'down').length,
    });

    const fallbackCount = logs.filter((row) => {
        const provider = String(row.provider || '').toLowerCase();
        return provider.startsWith('openrouter:') || provider.startsWith('groq:');
    }).length;
    const responseTimes = logs
        .map((row) => Number(row.responseMs || 0))
        .filter((value) => Number.isFinite(value) && value > 0);
    const averageFirstResponseMs = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : 0;

    const byIntentMap = new Map();
    const byPageMap = new Map();

    for (const item of feedback) {
        const intentBucket = ensureBucket(byIntentMap, item.intent || 'unknown');
        const pageBucket = ensureBucket(byPageMap, item.pagePath || '-');
        intentBucket.total += 1;
        pageBucket.total += 1;
        if (item.rating === 'up') {
            intentBucket.helpful += 1;
            pageBucket.helpful += 1;
        } else {
            intentBucket.notHelpful += 1;
            pageBucket.notHelpful += 1;
        }
    }

    const byIntent = Array.from(byIntentMap.entries())
        .map(([intent, bucket]) => ({ intent, ...withRate(bucket) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20);
    const byPage = Array.from(byPageMap.entries())
        .map(([pagePath, bucket]) => ({ pagePath, ...withRate(bucket) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20);

    return {
        generatedAt: new Date().toISOString(),
        totals: {
            conversations: logs.length,
            feedback: feedbackTotals,
            fallbackRatePercent: logs.length > 0 ? Math.round((fallbackCount / logs.length) * 100) : 0,
            averageFirstResponseMs,
        },
        byIntent,
        byPage,
    };
}

