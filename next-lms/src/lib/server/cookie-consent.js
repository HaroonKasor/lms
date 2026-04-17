import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma-v2/client';
import {
    COOKIE_CONSENT_SCHEMA_VERSION,
    normalizeConsentCategories,
    normalizeConsentChoice,
    resolveCookiePolicyVersion,
} from '@/lib/cookie-consent';

export async function ensureCookieConsentTable() {
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS cookie_consent_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            consent_id VARCHAR(64) NULL,
            user_id BIGINT UNSIGNED NULL,
            choice ENUM('all', 'essential', 'custom') NOT NULL DEFAULT 'essential',
            categories_json LONGTEXT NOT NULL,
            consent_version INT UNSIGNED NOT NULL DEFAULT 1,
            policy_version VARCHAR(64) NOT NULL,
            source VARCHAR(32) NULL,
            requested_ip VARCHAR(64) NULL,
            user_agent VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cookie_consent_logs_user_id (user_id),
            INDEX idx_cookie_consent_logs_consent_id (consent_id),
            INDEX idx_cookie_consent_logs_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
}

export function normalizeConsentPayload(input) {
    const value = input && typeof input === 'object' ? input : {};
    const categories = normalizeConsentCategories(value.categories);
    const choice = normalizeConsentChoice(value.choice);

    return {
        consentId: String(value.consentId || '').trim().slice(0, 64) || null,
        choice,
        categories,
        consentVersion: Number.isInteger(Number(value.version)) && Number(value.version) > 0
            ? Number(value.version)
            : COOKIE_CONSENT_SCHEMA_VERSION,
        policyVersion: String(value.policyVersion || resolveCookiePolicyVersion()).trim().slice(0, 64) || resolveCookiePolicyVersion(),
        source: String(value.source || 'banner').trim().slice(0, 32) || 'banner',
        timestamp: String(value.timestamp || '').trim() || new Date().toISOString(),
    };
}

export async function logCookieConsent({
    consent,
    userId = null,
    requestedIp = null,
    userAgent = null,
} = {}) {
    const payload = normalizeConsentPayload(consent);
    await ensureCookieConsentTable();
    await prisma.$executeRaw`
        INSERT INTO cookie_consent_logs (
            consent_id,
            user_id,
            choice,
            categories_json,
            consent_version,
            policy_version,
            source,
            requested_ip,
            user_agent
        ) VALUES (
            ${payload.consentId},
            ${Number.isInteger(Number(userId)) && Number(userId) > 0 ? Number(userId) : null},
            ${payload.choice},
            ${JSON.stringify(payload.categories)},
            ${payload.consentVersion},
            ${payload.policyVersion},
            ${payload.source},
            ${String(requestedIp || '').trim().slice(0, 64) || null},
            ${String(userAgent || '').trim().slice(0, 255) || null}
        )
    `;
    return payload;
}

function toPositiveInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.floor(parsed);
    return normalized > 0 ? normalized : fallback;
}

function normalizeSource(value) {
    return String(value || '').trim().slice(0, 32);
}

function normalizePolicyVersion(value) {
    return String(value || '').trim().slice(0, 64);
}

function normalizeDateFilter(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function safeParseCategories(rawValue) {
    if (rawValue && typeof rawValue === 'object') {
        return normalizeConsentCategories(rawValue);
    }
    if (!rawValue) return normalizeConsentCategories();
    try {
        const parsed = JSON.parse(String(rawValue));
        return normalizeConsentCategories(parsed);
    } catch {
        return normalizeConsentCategories();
    }
}

function mapRow(row, userMap) {
    const userId = Number(row?.userId || 0) || null;
    const profile = userId ? userMap.get(userId) : null;
    return {
        id: Number(row?.id || 0),
        consentId: String(row?.consentId || ''),
        userId,
        username: String(profile?.username || ''),
        email: String(profile?.email || ''),
        choice: normalizeConsentChoice(row?.choice),
        categories: safeParseCategories(row?.categoriesJson),
        policyVersion: String(row?.policyVersion || ''),
        source: String(row?.source || ''),
        requestedIp: String(row?.requestedIp || ''),
        userAgent: String(row?.userAgent || ''),
        createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    };
}

export async function listCookieConsentLogs({
    page = 1,
    limit = 20,
    choice = '',
    source = '',
    policyVersion = '',
    search = '',
    dateFrom = '',
    dateTo = '',
    exportAll = false,
} = {}) {
    await ensureCookieConsentTable();

    const safePage = Math.max(1, toPositiveInt(page, 1));
    const maxLimit = exportAll ? 10000 : 200;
    const safeLimit = Math.max(1, Math.min(maxLimit, toPositiveInt(limit, 20)));
    const skip = (safePage - 1) * safeLimit;

    const normalizedChoice = String(choice || '').trim();
    const normalizedSource = normalizeSource(source);
    const normalizedPolicyVersion = normalizePolicyVersion(policyVersion);
    const normalizedSearch = String(search || '').trim();
    const fromDate = normalizeDateFilter(dateFrom);
    const toDate = normalizeDateFilter(dateTo);

    const whereFilters = [];
    if (normalizedChoice) {
        whereFilters.push(Prisma.sql`choice = ${normalizeConsentChoice(normalizedChoice)}`);
    }
    if (normalizedSource) {
        whereFilters.push(Prisma.sql`source = ${normalizedSource}`);
    }
    if (normalizedPolicyVersion) {
        whereFilters.push(Prisma.sql`policy_version = ${normalizedPolicyVersion}`);
    }
    if (normalizedSearch) {
        const likeSearch = `%${normalizedSearch}%`;
        whereFilters.push(Prisma.sql`(
            consent_id LIKE ${likeSearch}
            OR CAST(user_id AS CHAR) LIKE ${likeSearch}
            OR requested_ip LIKE ${likeSearch}
            OR user_agent LIKE ${likeSearch}
        )`);
    }
    if (fromDate) {
        whereFilters.push(Prisma.sql`created_at >= ${fromDate}`);
    }
    if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        whereFilters.push(Prisma.sql`created_at <= ${endDate}`);
    }

    const whereClause = whereFilters.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereFilters, Prisma.sql` AND `)}`
        : Prisma.empty;

    const [rows, countRows] = await Promise.all([
        prisma.$queryRaw`
            SELECT
                id,
                consent_id AS consentId,
                user_id AS userId,
                choice,
                categories_json AS categoriesJson,
                policy_version AS policyVersion,
                source,
                requested_ip AS requestedIp,
                user_agent AS userAgent,
                created_at AS createdAt
            FROM cookie_consent_logs
            ${whereClause}
            ORDER BY created_at DESC, id DESC
            LIMIT ${safeLimit}
            OFFSET ${skip}
        `,
        prisma.$queryRaw`
            SELECT COUNT(*) AS totalCount
            FROM cookie_consent_logs
            ${whereClause}
        `,
    ]);

    const userIds = Array.from(new Set(
        (Array.isArray(rows) ? rows : [])
            .map((row) => Number(row?.userId || 0))
            .filter((id) => Number.isInteger(id) && id > 0)
    ));

    const userMap = new Map();
    if (userIds.length > 0) {
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, email: true },
        });
        for (const user of users) {
            userMap.set(Number(user.id), {
                username: String(user.username || ''),
                email: String(user.email || ''),
            });
        }
    }

    const items = (Array.isArray(rows) ? rows : []).map((row) => mapRow(row, userMap));
    const totalCount = Number(Array.isArray(countRows) ? countRows[0]?.totalCount || 0 : 0);

    return {
        page: safePage,
        limit: safeLimit,
        totalCount,
        items,
        filters: {
            choices: ['all', 'essential', 'custom'],
            sources: [
                'banner_accept_all',
                'banner_reject',
                'settings_accept_all',
                'settings_reject',
                'settings_save',
            ],
        },
    };
}
