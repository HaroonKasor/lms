import prisma from '@/lib/prisma';

const CHAT_KB_STORAGE_PREFIX = '__chat-kb__/';
const CHAT_KB_ASSET_TYPE = 'document';
const CACHE_TTL_MS = 1000 * 60 * 5;
const MAX_ITEMS = 300;

const DEFAULT_KB_ENTRIES = [
    {
        title: 'About SkillUp Project',
        content: 'SkillUp is a web-based LMS developed as a graduation project at Ramkhamhaeng University, Faculty of Engineering, Department of Computer and Electronics Engineering. Team: Suppansa Nakprasert, Ekthaphong Lonhin, Haroon Kasor.',
        tags: ['about', 'skillup', 'project', 'team', 'ramkhamhaeng'],
        intents: ['about_skillup'],
    },
    {
        title: 'Learning Assistant Scope',
        content: 'SkillBot helps summarize lessons, explain concepts, and guide learning. In quiz mode, it provides hints only and does not reveal direct final answers.',
        tags: ['assistant', 'quiz', 'hint', 'policy'],
        intents: ['quiz_hint_only', 'course_detail'],
    },
    {
        title: 'My Learning Progress',
        content: 'Users can ask SkillBot to summarize their own learning progress, course completion status, and progress percentage from backend data tied to their own account.',
        tags: ['progress', 'my-learning', 'status', 'completion'],
        intents: ['my_learning'],
    },
];

function sanitizeText(value, max = 2000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeTags(tags = []) {
    if (!Array.isArray(tags)) return [];
    return Array.from(
        new Set(
            tags
                .map((tag) => sanitizeText(tag, 40).toLowerCase())
                .filter(Boolean)
        )
    ).slice(0, 12);
}

function normalizeIntents(intents = []) {
    if (!Array.isArray(intents)) return [];
    return Array.from(
        new Set(
            intents
                .map((value) => sanitizeText(value, 40).toLowerCase())
                .filter(Boolean)
        )
    ).slice(0, 8);
}

function buildStoragePath(organizationId, now = new Date()) {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).slice(2, 10);
    return `${CHAT_KB_STORAGE_PREFIX}${organizationId}/${year}/${month}/${stamp}-${random}.json`;
}

function parseKbMetadata(row) {
    const meta = row?.metadataJson && typeof row.metadataJson === 'object' ? row.metadataJson : {};
    const title = sanitizeText(meta?.title || row?.title || '', 180);
    const content = sanitizeText(meta?.content || '', 4000);
    if (!title || !content) return null;
    return {
        id: Number(row?.id || 0),
        title,
        content,
        tags: normalizeTags(meta?.tags),
        intents: normalizeIntents(meta?.intents),
        isActive: meta?.isActive !== false,
        updatedAt: row?.uploadedAt ? new Date(row.uploadedAt).toISOString() : null,
    };
}

function tokenizeQuery(query = '') {
    return sanitizeText(query, 280)
        .toLowerCase()
        .split(/[\s,.;:!?/\\|()[\]{}"'`~+_=<>-]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
        .slice(0, 20);
}

function scoreKbItem(item, query, intent = '') {
    const q = sanitizeText(query, 280).toLowerCase();
    if (!q) return 0;
    const title = String(item?.title || '').toLowerCase();
    const content = String(item?.content || '').toLowerCase();
    const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag).toLowerCase()) : [];
    const intents = Array.isArray(item?.intents) ? item.intents.map((row) => String(row).toLowerCase()) : [];
    const tokens = tokenizeQuery(q);

    let score = 0;
    if (title.includes(q)) score += 12;
    if (content.includes(q)) score += 8;
    if (tags.some((tag) => tag.includes(q))) score += 10;
    for (const token of tokens) {
        if (title.includes(token)) score += 3;
        if (content.includes(token)) score += 1.2;
        if (tags.some((tag) => tag.includes(token))) score += 2.5;
    }
    if (intent && intents.includes(String(intent).toLowerCase())) score += 4;
    return score;
}

function getKbCacheStore() {
    if (!globalThis.__chatKbCacheStore) {
        globalThis.__chatKbCacheStore = new Map();
    }
    return globalThis.__chatKbCacheStore;
}

function readKbCache(cacheKey) {
    if (!cacheKey) return null;
    const store = getKbCacheStore();
    const cached = store.get(cacheKey);
    if (!cached) return null;
    if (Date.now() - Number(cached.cachedAtMs || 0) > CACHE_TTL_MS) {
        store.delete(cacheKey);
        return null;
    }
    return Array.isArray(cached.items) ? cached.items : null;
}

function writeKbCache(cacheKey, items = []) {
    if (!cacheKey) return;
    const store = getKbCacheStore();
    store.set(cacheKey, {
        cachedAtMs: Date.now(),
        items: Array.isArray(items) ? items : [],
    });
}

function invalidateKbCache(organizationId) {
    const key = Number(organizationId || 0);
    if (!Number.isInteger(key) || key <= 0) return;
    getKbCacheStore().delete(`org:${key}`);
}

async function seedDefaultKbIfMissing(organizationId, actorUserId = null) {
    const count = await prisma.learningAsset.count({
        where: {
            organization_id: organizationId,
            assetType: CHAT_KB_ASSET_TYPE,
            storagePath: { startsWith: CHAT_KB_STORAGE_PREFIX },
        },
    });
    if (count > 0) return;
    const now = new Date();
    for (const entry of DEFAULT_KB_ENTRIES) {
        await prisma.learningAsset.create({
            data: {
                organization_id: organizationId,
                assetType: CHAT_KB_ASSET_TYPE,
                title: `[CHAT_KB] ${sanitizeText(entry.title, 180)}`.slice(0, 255),
                storagePath: buildStoragePath(organizationId, now),
                metadataJson: {
                    kind: 'chat_kb',
                    title: sanitizeText(entry.title, 180),
                    content: sanitizeText(entry.content, 4000),
                    tags: normalizeTags(entry.tags),
                    intents: normalizeIntents(entry.intents),
                    isActive: true,
                    createdAt: now.toISOString(),
                },
                uploadedById: Number(actorUserId || 0) > 0 ? Number(actorUserId) : undefined,
                uploadedAt: now,
            },
        });
    }
}

async function loadKbItems(organizationId) {
    const cacheKey = `org:${organizationId}`;
    const cached = readKbCache(cacheKey);
    if (cached) return cached;

    const rows = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: CHAT_KB_ASSET_TYPE,
            storagePath: { startsWith: CHAT_KB_STORAGE_PREFIX },
        },
        orderBy: { uploadedAt: 'desc' },
        take: MAX_ITEMS,
        select: {
            id: true,
            title: true,
            uploadedAt: true,
            metadataJson: true,
        },
    });
    const items = rows.map(parseKbMetadata).filter(Boolean);
    writeKbCache(cacheKey, items);
    return items;
}

export async function retrieveKnowledgeContext({
    organizationId,
    query = '',
    intent = '',
    limit = 3,
} = {}) {
    const orgId = Number(organizationId || 0);
    if (!Number.isInteger(orgId) || orgId <= 0) return [];
    const q = sanitizeText(query, 280);
    if (!q) return [];

    await seedDefaultKbIfMissing(orgId);
    const items = await loadKbItems(orgId);
    const scored = items
        .filter((item) => item.isActive !== false)
        .map((item) => ({
            ...item,
            score: scoreKbItem(item, q, intent),
        }))
        .filter((item) => item.score >= 4)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Math.min(8, Number(limit || 3))));
    return scored;
}

export function buildKnowledgePromptBlock(items = []) {
    const rows = Array.isArray(items) ? items : [];
    if (rows.length === 0) return '';
    const lines = rows.map((item, index) => {
        const tags = Array.isArray(item?.tags) && item.tags.length > 0 ? ` | tags: ${item.tags.join(', ')}` : '';
        return `${index + 1}) ${sanitizeText(item?.title, 160)}${tags}\n${sanitizeText(item?.content, 800)}`;
    });
    return `\n\nKnowledge base context (prioritize these facts when relevant):\n${lines.join('\n\n')}\n`;
}

export async function listChatKnowledgeBase({ organizationId, q = '' } = {}) {
    const orgId = Number(organizationId || 0);
    if (!Number.isInteger(orgId) || orgId <= 0) return [];
    await seedDefaultKbIfMissing(orgId);
    const query = sanitizeText(q, 180).toLowerCase();
    const items = await loadKbItems(orgId);
    return items
        .filter((item) => {
            if (!query) return true;
            const merged = `${item.title} ${item.content} ${(item.tags || []).join(' ')}`.toLowerCase();
            return merged.includes(query);
        })
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

export async function upsertChatKnowledgeItem({
    organizationId,
    actorUserId = null,
    itemId = null,
    title = '',
    content = '',
    tags = [],
    intents = [],
    isActive = true,
} = {}) {
    const orgId = Number(organizationId || 0);
    if (!Number.isInteger(orgId) || orgId <= 0) {
        throw new Error('Missing organization context');
    }
    const safeTitle = sanitizeText(title, 180);
    const safeContent = sanitizeText(content, 5000);
    if (!safeTitle || !safeContent) {
        throw new Error('title and content are required');
    }

    const payload = {
        kind: 'chat_kb',
        title: safeTitle,
        content: safeContent,
        tags: normalizeTags(tags),
        intents: normalizeIntents(intents),
        isActive: isActive !== false,
        updatedAt: new Date().toISOString(),
    };

    const id = Number(itemId || 0);
    let row;
    if (Number.isInteger(id) && id > 0) {
        const existing = await prisma.learningAsset.findFirst({
            where: {
                id,
                organization_id: orgId,
                assetType: CHAT_KB_ASSET_TYPE,
                storagePath: { startsWith: CHAT_KB_STORAGE_PREFIX },
            },
            select: { id: true },
        });
        if (!existing?.id) {
            throw new Error('KB item not found');
        }
        row = await prisma.learningAsset.update({
            where: { id: existing.id },
            data: {
                metadataJson: payload,
                title: `[CHAT_KB] ${safeTitle}`.slice(0, 255),
                uploadedById: Number(actorUserId || 0) > 0 ? Number(actorUserId) : undefined,
                uploadedAt: new Date(),
            },
            select: { id: true },
        });
    } else {
        row = await prisma.learningAsset.create({
            data: {
                organization_id: orgId,
                assetType: CHAT_KB_ASSET_TYPE,
                title: `[CHAT_KB] ${safeTitle}`.slice(0, 255),
                storagePath: buildStoragePath(orgId, new Date()),
                metadataJson: payload,
                uploadedById: Number(actorUserId || 0) > 0 ? Number(actorUserId) : undefined,
                uploadedAt: new Date(),
            },
            select: { id: true },
        });
    }
    invalidateKbCache(orgId);
    return { id: Number(row?.id || 0) };
}

export async function removeChatKnowledgeItem({ organizationId, itemId } = {}) {
    const orgId = Number(organizationId || 0);
    const id = Number(itemId || 0);
    if (!Number.isInteger(orgId) || orgId <= 0 || !Number.isInteger(id) || id <= 0) {
        return false;
    }
    await prisma.learningAsset.deleteMany({
        where: {
            id,
            organization_id: orgId,
            assetType: CHAT_KB_ASSET_TYPE,
            storagePath: { startsWith: CHAT_KB_STORAGE_PREFIX },
        },
    });
    invalidateKbCache(orgId);
    return true;
}
