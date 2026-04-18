import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma-v2/client';

export const AUTH_PROVIDER_GOOGLE = 'google';

export async function ensureUserAuthIdentitiesTable() {
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS user_auth_identities (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            provider VARCHAR(32) NOT NULL,
            provider_user_id VARCHAR(191) NOT NULL,
            email_at_link VARCHAR(255) NULL,
            linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME NULL,
            UNIQUE KEY uq_user_auth_provider_user (provider, provider_user_id),
            UNIQUE KEY uq_user_auth_user_provider (user_id, provider),
            INDEX idx_user_auth_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
}

function normalizeProvider(value) {
    return String(value || '').trim().toLowerCase().slice(0, 32);
}

function normalizeProviderUserId(value) {
    return String(value || '').trim().slice(0, 191);
}

export async function upsertUserAuthIdentity({
    userId,
    provider,
    providerUserId,
    emailAtLink = null,
    lastLoginAt = null,
} = {}) {
    const uid = Number(userId);
    const normalizedProvider = normalizeProvider(provider);
    const normalizedProviderUserId = normalizeProviderUserId(providerUserId);

    if (!Number.isInteger(uid) || uid <= 0) throw new Error('Invalid userId for auth identity');
    if (!normalizedProvider) throw new Error('Missing provider for auth identity');
    if (!normalizedProviderUserId) throw new Error('Missing providerUserId for auth identity');

    await ensureUserAuthIdentitiesTable();

    const existingRows = await prisma.$queryRaw`
        SELECT user_id AS userId
        FROM user_auth_identities
        WHERE provider = ${normalizedProvider}
          AND provider_user_id = ${normalizedProviderUserId}
        LIMIT 1
    `;

    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    if (existing?.userId && Number(existing.userId) !== uid) {
        throw new Error('This identity is already linked to another account');
    }

    const safeEmail = String(emailAtLink || '').trim().slice(0, 255) || null;
    const loginAt = lastLoginAt instanceof Date ? lastLoginAt : (lastLoginAt ? new Date(lastLoginAt) : new Date());

    await prisma.$executeRaw`
        INSERT INTO user_auth_identities (
            user_id,
            provider,
            provider_user_id,
            email_at_link,
            last_login_at
        ) VALUES (
            ${uid},
            ${normalizedProvider},
            ${normalizedProviderUserId},
            ${safeEmail},
            ${loginAt}
        )
        ON DUPLICATE KEY UPDATE
            email_at_link = VALUES(email_at_link),
            last_login_at = VALUES(last_login_at)
    `;

    return {
        userId: uid,
        provider: normalizedProvider,
        providerUserId: normalizedProviderUserId,
    };
}

export async function getUserAuthProviderMapByUserIds(userIds = []) {
    const ids = Array.from(new Set(
        (Array.isArray(userIds) ? userIds : [])
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
    ));

    const map = new Map();
    if (ids.length === 0) return map;

    await ensureUserAuthIdentitiesTable();

    const rows = await prisma.$queryRaw`
        SELECT user_id AS userId, provider
        FROM user_auth_identities
        WHERE user_id IN (${Prisma.join(ids)})
        ORDER BY user_id ASC, provider ASC
    `;

    for (const row of Array.isArray(rows) ? rows : []) {
        const uid = Number(row?.userId || 0);
        if (!Number.isInteger(uid) || uid <= 0) continue;
        const providerValue = normalizeProvider(row?.provider);
        if (!providerValue) continue;
        const list = map.get(uid) || [];
        if (!list.includes(providerValue)) list.push(providerValue);
        map.set(uid, list);
    }

    return map;
}
