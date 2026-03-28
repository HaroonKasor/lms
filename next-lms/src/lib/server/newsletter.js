import prisma from '@/lib/prisma';

export async function ensureNewsletterTable() {
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(320) NOT NULL,
            status ENUM('active', 'unsubscribed') NOT NULL DEFAULT 'active',
            source VARCHAR(64) NULL,
            requested_ip VARCHAR(64) NULL,
            user_agent VARCHAR(255) NULL,
            subscribed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            unsubscribed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_newsletter_email (email),
            INDEX idx_newsletter_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
}

export async function subscribeNewsletter({
    email,
    source = 'footer',
    requestedIp = null,
    userAgent = null,
} = {}) {
    const safeEmail = String(email || '').trim().toLowerCase();
    if (!safeEmail) {
        throw new Error('Missing email');
    }

    await ensureNewsletterTable();

    const existingRows = await prisma.$queryRaw`
        SELECT id, email, status, subscribed_at AS subscribedAt
        FROM newsletter_subscribers
        WHERE email = ${safeEmail}
        LIMIT 1
    `;
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;

    if (!existing) {
        await prisma.$executeRaw`
            INSERT INTO newsletter_subscribers (email, status, source, requested_ip, user_agent, subscribed_at)
            VALUES (
                ${safeEmail},
                'active',
                ${String(source || '').slice(0, 64) || null},
                ${String(requestedIp || '').slice(0, 64) || null},
                ${String(userAgent || '').slice(0, 255) || null},
                NOW()
            )
        `;
        return { state: 'subscribed' };
    }

    const currentStatus = String(existing.status || '').toLowerCase();
    if (currentStatus === 'active') {
        return { state: 'already_subscribed' };
    }

    await prisma.$executeRaw`
        UPDATE newsletter_subscribers
        SET
            status = 'active',
            source = ${String(source || '').slice(0, 64) || null},
            requested_ip = ${String(requestedIp || '').slice(0, 64) || null},
            user_agent = ${String(userAgent || '').slice(0, 255) || null},
            subscribed_at = NOW(),
            unsubscribed_at = NULL
        WHERE id = ${Number(existing.id)}
    `;

    return { state: 'reactivated' };
}

