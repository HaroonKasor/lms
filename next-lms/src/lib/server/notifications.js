import prisma from '@/lib/prisma';

function uniqueUserIds(userIds = []) {
    const seen = new Set();
    const output = [];
    for (const value of userIds) {
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        output.push(n);
    }
    return output;
}

function parsePayload(payloadJson) {
    if (!payloadJson) return null;
    if (typeof payloadJson === 'object') return payloadJson;
    try {
        return JSON.parse(payloadJson);
    } catch {
        return null;
    }
}

export async function listAdminUserIds(organizationId) {
    const rows = await prisma.userRole.findMany({
        where: {
            organization_id: organizationId,
            roles: {
                code: 'ADMIN',
            },
        },
        select: {
            userId: true,
        },
    });

    return uniqueUserIds(rows.map((row) => row.userId));
}

export async function createNotification({
    organizationId,
    type,
    title,
    message,
    payload = null,
    createdBy = null,
    recipientUserIds = [],
}) {
    const recipients = uniqueUserIds(recipientUserIds);
    if (!organizationId || recipients.length === 0) return null;

    return prisma.notifications.create({
        data: {
            organization_id: organizationId,
            type: String(type || 'SYSTEM').slice(0, 50),
            title: String(title || '').slice(0, 255),
            message: String(message || ''),
            payload_json: payload && typeof payload === 'object' ? payload : null,
            created_by: createdBy ? Number(createdBy) : null,
            notification_recipients: {
                create: recipients.map((userId) => ({
                    user_id: userId,
                    delivered_at: new Date(),
                })),
            },
        },
        select: { id: true },
    });
}

export async function createAdminNotification({
    organizationId,
    type,
    title,
    message,
    payload = null,
    createdBy = null,
}) {
    const adminUserIds = await listAdminUserIds(organizationId);
    return createNotification({
        organizationId,
        type,
        title,
        message,
        payload,
        createdBy,
        recipientUserIds: adminUserIds,
    });
}

export async function listUserNotifications({ organizationId, userId, limit = 20 }) {
    const take = Math.max(1, Math.min(100, Number(limit) || 20));

    const [rows, unreadCount] = await Promise.all([
        prisma.notification_recipients.findMany({
            where: {
                user_id: Number(userId),
                notifications: {
                    organization_id: organizationId,
                },
            },
            include: {
                notifications: {
                    select: {
                        id: true,
                        type: true,
                        title: true,
                        message: true,
                        payload_json: true,
                        created_at: true,
                    },
                },
            },
            orderBy: {
                notifications: {
                    created_at: 'desc',
                },
            },
            take,
        }),
        prisma.notification_recipients.count({
            where: {
                user_id: Number(userId),
                read_at: null,
                notifications: {
                    organization_id: organizationId,
                },
            },
        }),
    ]);

    return {
        unreadCount,
        items: rows.map((row) => ({
            id: Number(row.notification_id || 0),
            type: String(row.notifications?.type || 'SYSTEM'),
            title: String(row.notifications?.title || ''),
            message: String(row.notifications?.message || ''),
            payload: parsePayload(row.notifications?.payload_json),
            createdAt: row.notifications?.created_at || null,
            readAt: row.read_at || null,
            deliveredAt: row.delivered_at || null,
        })),
    };
}

export async function markAllUserNotificationsRead({ organizationId, userId }) {
    const result = await prisma.notification_recipients.updateMany({
        where: {
            user_id: Number(userId),
            read_at: null,
            notifications: {
                organization_id: organizationId,
            },
        },
        data: {
            read_at: new Date(),
        },
    });
    return Number(result.count || 0);
}

export async function markUserNotificationRead({ organizationId, userId, notificationId }) {
    const targetId = Number(notificationId);
    if (!Number.isInteger(targetId) || targetId <= 0) return false;

    const recipient = await prisma.notification_recipients.findFirst({
        where: {
            notification_id: targetId,
            user_id: Number(userId),
            notifications: {
                organization_id: organizationId,
            },
        },
        select: {
            notification_id: true,
            user_id: true,
            read_at: true,
        },
    });

    if (!recipient) return false;
    if (recipient.read_at) return true;

    await prisma.notification_recipients.update({
        where: {
            notification_id_user_id: {
                notification_id: recipient.notification_id,
                user_id: recipient.user_id,
            },
        },
        data: {
            read_at: new Date(),
        },
    });

    return true;
}
