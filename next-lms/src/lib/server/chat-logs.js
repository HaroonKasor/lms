import prisma from '@/lib/prisma';
import { getRequestIp } from '@/lib/server/auth';
import {
    hashPiiValue,
    maskEmail,
    maskIp,
    maskUsername,
    redactPiiText,
} from '@/lib/server/pii';

const CHAT_LOG_STORAGE_PREFIX = '__chat-log__/';
const CHAT_LOG_ASSET_TYPE = 'document';
const MAX_LOG_MESSAGE_ITEMS = 12;
const MAX_LOG_CONTEXT_TEXT = 220;

function sanitizeText(value, maxLength = MAX_LOG_CONTEXT_TEXT) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function buildStoragePath(organizationId, now = new Date()) {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const date = String(now.getUTCDate()).padStart(2, '0');
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).slice(2, 10);
    return `${CHAT_LOG_STORAGE_PREFIX}${organizationId}/${year}/${month}/${date}/${stamp}-${random}.json`;
}

function normalizeRole(role = '') {
    return String(role || '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user';
}

function sanitizeMessages(messages = []) {
    if (!Array.isArray(messages)) return [];
    return messages
        .slice(-MAX_LOG_MESSAGE_ITEMS)
        .map((item) => ({
            role: normalizeRole(item?.role),
            content: redactPiiText(item?.content, 1400),
        }))
        .filter((item) => item.content.length > 0);
}

function sanitizeContext(context = {}) {
    if (!context || typeof context !== 'object') return {};
    return {
        intent: sanitizeText(context?.intent, 80) || 'general',
        pagePath: sanitizeText(context?.pagePath, 220) || null,
        courseTitle: redactPiiText(context?.courseTitle, 180) || null,
        sectionTitle: redactPiiText(context?.sectionTitle, 180) || null,
        lessonTitle: redactPiiText(context?.lessonTitle, 180) || null,
        activeLessonIndex: Number(context?.activeLessonIndex || 0) || null,
        totalLessons: Number(context?.totalLessons || 0) || null,
    };
}

export async function createStructuredChatLog({
    request,
    session,
    messages = [],
    context = {},
    intent = 'general',
    provider = 'rule',
    status = 'ok',
    assistantReply = '',
    errorMessage = '',
} = {}) {
    const organizationId = Number(session?.organizationId || 0);
    const actorUserId = Number(session?.uid || 0);
    if (!Number.isInteger(organizationId) || organizationId <= 0) return null;
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) return null;

    const now = new Date();
    const redactedMessages = sanitizeMessages(messages);
    const redactedReply = redactPiiText(assistantReply, 2400);
    const redactedError = redactPiiText(errorMessage, 400);
    const requestIp = getRequestIp(request);

    const metadata = {
        kind: 'chat_log',
        source: 'chat_api',
        intent: sanitizeText(intent, 80) || 'general',
        provider: sanitizeText(provider, 60) || 'rule',
        status: sanitizeText(status, 40) || 'ok',
        assistantReply: redactedReply || null,
        errorMessage: redactedError || null,
        messages: redactedMessages,
        context: sanitizeContext(context),
        actor: {
            userId: actorUserId,
            userRef: `usr_${hashPiiValue(actorUserId)}`,
            usernameMasked: maskUsername(session?.user?.username),
            emailMasked: maskEmail(session?.user?.email),
            role: sanitizeText(session?.role, 30) || 'learner',
            organizationId,
        },
        request: {
            method: sanitizeText(request?.method, 8) || 'POST',
            path: '/api/chat',
            ipMasked: maskIp(requestIp),
            userAgent: sanitizeText(request?.headers?.get('user-agent'), 255),
        },
        createdAt: now.toISOString(),
    };

    try {
        await prisma.learningAsset.create({
            data: {
                organization_id: organizationId,
                assetType: CHAT_LOG_ASSET_TYPE,
                title: `[CHAT_LOG] ${metadata.intent}`.slice(0, 255),
                storagePath: buildStoragePath(organizationId, now),
                publicUrl: null,
                metadataJson: metadata,
                uploadedById: actorUserId,
                uploadedAt: now,
            },
            select: { id: true },
        });
    } catch (err) {
        console.warn('[chat-log] write failed', err?.message || err);
    }
    return null;
}

