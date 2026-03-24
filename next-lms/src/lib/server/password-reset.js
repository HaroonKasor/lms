import crypto from 'node:crypto';
import prisma from '@/lib/prisma';

const DEFAULT_TTL_MINUTES = 30;

export async function ensurePasswordResetTable() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            requested_ip VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_password_reset_tokens_user_id (user_id),
            INDEX idx_password_reset_tokens_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

function hashToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken || ''), 'utf8').digest('hex');
}

export async function createPasswordResetToken({ userId, requestedIp, ttlMinutes = DEFAULT_TTL_MINUTES } = {}) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
        throw new Error('Invalid userId for reset token');
    }

    await ensurePasswordResetTable();

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + Math.max(1, Number(ttlMinutes || DEFAULT_TTL_MINUTES)) * 60 * 1000);

    await prisma.$executeRawUnsafe(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip)
         VALUES (?, ?, ?, ?)`,
        safeUserId,
        tokenHash,
        expiresAt,
        String(requestedIp || '').slice(0, 64) || null
    );

    return { token, expiresAt };
}

export async function consumePasswordResetToken(rawToken) {
    const tokenHash = hashToken(rawToken);
    await ensurePasswordResetTable();

    const rows = await prisma.$queryRawUnsafe(
        `SELECT id, user_id AS userId, expires_at AS expiresAt, used_at AS usedAt
         FROM password_reset_tokens
         WHERE token_hash = ?
         LIMIT 1`,
        tokenHash
    );

    const record = Array.isArray(rows) ? rows[0] : null;
    if (!record) return null;

    const now = Date.now();
    const expiresMs = record.expiresAt ? new Date(record.expiresAt).getTime() : 0;
    if (record.usedAt || !expiresMs || expiresMs < now) {
        return null;
    }

    await prisma.$executeRawUnsafe(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE id = ?`,
        Number(record.id)
    );

    return {
        id: Number(record.id),
        userId: Number(record.userId),
    };
}

export async function cleanupPasswordResetTokens(userId) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) return;

    await ensurePasswordResetTable();
    await prisma.$executeRawUnsafe(
        `DELETE FROM password_reset_tokens
         WHERE user_id = ? OR expires_at < NOW()`,
        safeUserId
    );
}

