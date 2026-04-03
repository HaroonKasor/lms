import prisma from '@/lib/prisma';
import { hasMailConfig, parseEmailList, sendCriticalNotificationEmail } from '@/lib/server/mailer';

const COURSE_TYPE_KEYWORDS = ['COURSE', 'ENROLLMENT', 'CERTIFICATE', 'QUIZ', 'SECTION'];
const VALID_SEVERITIES = new Set(['info', 'warning', 'critical']);
const VALID_CATEGORIES = new Set(['COURSE', 'SYSTEM']);
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 90;
const rawRetentionDays = Number(process.env.NOTIFICATION_RETENTION_DAYS || '');
const NOTIFICATION_RETENTION_DAYS = Number.isFinite(rawRetentionDays) && rawRetentionDays > 0
    ? Math.max(1, Math.floor(rawRetentionDays))
    : DEFAULT_RETENTION_DAYS;
const rawSweepIntervalMs = Number(process.env.NOTIFICATION_RETENTION_SWEEP_INTERVAL_MS || '');
const NOTIFICATION_RETENTION_SWEEP_INTERVAL_MS = Number.isFinite(rawSweepIntervalMs) && rawSweepIntervalMs > 0
    ? Math.max(60 * 1000, Math.floor(rawSweepIntervalMs))
    : 6 * 60 * 60 * 1000;
const rawDedupeWindowMs = Number(process.env.NOTIFICATION_DEDUPE_WINDOW_MS || '');
const NOTIFICATION_DEDUPE_WINDOW_MS = Number.isFinite(rawDedupeWindowMs) && rawDedupeWindowMs > 0
    ? Math.max(10 * 1000, Math.floor(rawDedupeWindowMs))
    : 2 * 60 * 1000;

let lastRetentionSweepAtMs = 0;
let retentionSweepInFlight = null;

function getCriticalEscalationEmails() {
    const candidates = [
        process.env.CRITICAL_NOTIFICATION_EMAILS,
        process.env.NOTIFICATION_ESCALATION_EMAILS,
        process.env.CRITICAL_EMAIL_REPEAT_TO,
    ];
    const output = [];
    for (const source of candidates) {
        for (const email of parseEmailList(source)) {
            output.push(email);
        }
    }
    return Array.from(new Set(output));
}

function resolveDisplayName(user) {
    const first = String(user?.profile?.firstName || '').trim();
    const last = String(user?.profile?.lastName || '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full || String(user?.username || '').trim() || String(user?.email || '').trim() || 'User';
}

async function sendCriticalNotificationFanout({
    recipientUserIds = [],
    title = '',
    message = '',
    type = '',
    category = 'SYSTEM',
    actionUrl = '',
    payload = null,
}) {
    if (!hasMailConfig()) return { sent: 0, skipped: true, reason: 'mail_not_configured' };
    const userIds = uniqueUserIds(recipientUserIds);
    const users = userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                username: true,
                email: true,
                profile: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        })
        : [];

    const userEmailMap = new Map(
        users
            .map((user) => [Number(user.id || 0), String(user.email || '').trim().toLowerCase()])
            .filter((item) => item[0] > 0 && item[1])
    );
    const escalationEmails = getCriticalEscalationEmails();
    const allTargets = new Set([...userEmailMap.values(), ...escalationEmails]);

    if (allTargets.size === 0) {
        return { sent: 0, skipped: true, reason: 'no_recipients' };
    }

    const userNameByEmail = new Map(
        users
            .map((user) => [String(user.email || '').trim().toLowerCase(), resolveDisplayName(user)])
            .filter((item) => item[0])
    );

    let sent = 0;
    await Promise.allSettled(
        Array.from(allTargets).map(async (email) => {
            try {
                await sendCriticalNotificationEmail({
                    to: email,
                    userName: userNameByEmail.get(email) || 'User',
                    title,
                    message,
                    type,
                    category,
                    actionUrl,
                    payload,
                });
                sent += 1;
            } catch (err) {
                console.error('[notifications] critical email failed', { email, err });
            }
        })
    );

    return {
        sent,
        skipped: false,
        reason: null,
    };
}

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

function buildCourseTypeWhere() {
    return {
        OR: COURSE_TYPE_KEYWORDS.map((keyword) => ({
            type: {
                contains: keyword,
            },
        })),
    };
}

function normalizeNotificationSeverity(value, type = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (VALID_SEVERITIES.has(normalized)) return normalized;

    const typeKey = String(type || '').toUpperCase();
    if (typeKey.includes('CRITICAL')) return 'critical';
    if (
        typeKey.includes('REJECTED') ||
        typeKey.includes('NOT_APPROVED') ||
        typeKey.includes('FAILED') ||
        typeKey.includes('EXPIRY') ||
        typeKey.includes('EXPIR')
    ) {
        return 'warning';
    }
    return 'info';
}

function normalizeNotificationCategory(value, type = '') {
    const normalized = String(value || '').trim().toUpperCase();
    if (VALID_CATEGORIES.has(normalized)) return normalized;

    const typeKey = String(type || '').toUpperCase();
    if (COURSE_TYPE_KEYWORDS.some((keyword) => typeKey.includes(keyword))) {
        return 'COURSE';
    }
    return 'SYSTEM';
}

function buildPayloadWithMeta(payload, { type, severity, category } = {}) {
    const basePayload = payload && typeof payload === 'object' ? { ...payload } : {};
    const normalizedSeverity = normalizeNotificationSeverity(severity ?? basePayload?.severity, type);
    const normalizedCategory = normalizeNotificationCategory(category ?? basePayload?.category, type);

    basePayload.severity = normalizedSeverity;
    basePayload.category = normalizedCategory;
    return basePayload;
}

function normalizeStatusFilter(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'UNREAD') return 'UNREAD';
    if (normalized === 'READ') return 'READ';
    return 'ALL';
}

function normalizeCategoryFilter(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'COURSE') return 'COURSE';
    if (normalized === 'SYSTEM') return 'SYSTEM';
    return 'ALL';
}

function buildRecipientWhere({ organizationId, userId, statusFilter = 'ALL', categoryFilter = 'ALL' }) {
    const where = {
        user_id: Number(userId),
        notifications: {
            organization_id: organizationId,
        },
    };

    if (statusFilter === 'UNREAD') {
        where.read_at = null;
    } else if (statusFilter === 'READ') {
        where.NOT = { read_at: null };
    }

    if (categoryFilter === 'COURSE') {
        where.notifications = {
            ...where.notifications,
            ...buildCourseTypeWhere(),
        };
    } else if (categoryFilter === 'SYSTEM') {
        where.notifications = {
            ...where.notifications,
            NOT: buildCourseTypeWhere(),
        };
    }

    return where;
}

export async function sweepNotificationRetention({ organizationId, force = false } = {}) {
    if (!organizationId) {
        return { success: false, skipped: true, reason: 'missing_organization_id' };
    }

    const now = Date.now();
    if (!force && (now - lastRetentionSweepAtMs) < NOTIFICATION_RETENTION_SWEEP_INTERVAL_MS) {
        return {
            success: true,
            skipped: true,
            reason: 'throttled',
            retentionDays: NOTIFICATION_RETENTION_DAYS,
        };
    }
    if (retentionSweepInFlight) return retentionSweepInFlight;

    lastRetentionSweepAtMs = now;
    const cutoffDate = new Date(now - (NOTIFICATION_RETENTION_DAYS * DAY_MS));

    retentionSweepInFlight = (async () => {
        const recipientsResult = await prisma.notification_recipients.deleteMany({
            where: {
                notifications: {
                    organization_id: organizationId,
                    created_at: { lt: cutoffDate },
                },
            },
        });
        const notificationsResult = await prisma.notifications.deleteMany({
            where: {
                organization_id: organizationId,
                created_at: { lt: cutoffDate },
            },
        });
        return {
            success: true,
            skipped: false,
            retentionDays: NOTIFICATION_RETENTION_DAYS,
            cutoffDate: cutoffDate.toISOString(),
            deletedRecipients: Number(recipientsResult?.count || 0),
            deletedNotifications: Number(notificationsResult?.count || 0),
        };
    })()
        .catch((err) => {
            console.error('[notifications][retention] sweep failed', err);
            return {
                success: false,
                skipped: false,
                retentionDays: NOTIFICATION_RETENTION_DAYS,
                error: String(err?.message || err || 'Unknown error'),
            };
        })
        .finally(() => {
            retentionSweepInFlight = null;
        });

    return retentionSweepInFlight;
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
    severity = null,
    category = null,
    createdBy = null,
    recipientUserIds = [],
}) {
    const recipients = uniqueUserIds(recipientUserIds);
    if (!organizationId || recipients.length === 0) return null;
    const safeType = String(type || 'SYSTEM').slice(0, 50);
    const safeTitle = String(title || '').slice(0, 255);
    const safeMessage = String(message || '');
    const payloadWithMeta = buildPayloadWithMeta(payload, {
        type: safeType,
        severity,
        category,
    });
    const dedupeDisabled = Boolean(
        payloadWithMeta?.disableDedupe === true
        || payloadWithMeta?.allowDuplicate === true
    );

    let dedupedRecipients = recipients;
    if (!dedupeDisabled && NOTIFICATION_DEDUPE_WINDOW_MS > 0) {
        const cutoffDate = new Date(Date.now() - NOTIFICATION_DEDUPE_WINDOW_MS);
        const existingRecipients = await prisma.notification_recipients.findMany({
            where: {
                user_id: { in: recipients },
                notifications: {
                    organization_id: organizationId,
                    type: safeType,
                    title: safeTitle,
                    message: safeMessage,
                    created_at: { gte: cutoffDate },
                },
            },
            select: {
                user_id: true,
            },
        });
        const recentlyDeliveredUserIds = new Set(
            existingRecipients
                .map((row) => Number(row?.user_id || 0))
                .filter((id) => Number.isInteger(id) && id > 0)
        );
        dedupedRecipients = recipients.filter((id) => !recentlyDeliveredUserIds.has(id));
    }
    if (dedupedRecipients.length === 0) return null;

    const created = await prisma.notifications.create({
        data: {
            organization_id: organizationId,
            type: safeType,
            title: safeTitle,
            message: safeMessage,
            payload_json: payloadWithMeta,
            created_by: createdBy ? Number(createdBy) : null,
            notification_recipients: {
                create: dedupedRecipients.map((userId) => ({
                    user_id: userId,
                    delivered_at: new Date(),
                })),
            },
        },
        select: { id: true },
    });

    const normalizedSeverity = normalizeNotificationSeverity(payloadWithMeta?.severity, safeType);
    if (normalizedSeverity === 'critical') {
        const actionUrl = String(payloadWithMeta?.actionUrl || '').trim();
        sendCriticalNotificationFanout({
            recipientUserIds: dedupedRecipients,
            title: safeTitle,
            message: safeMessage,
            type: safeType,
            category: normalizeNotificationCategory(payloadWithMeta?.category, safeType),
            actionUrl,
            payload: payloadWithMeta,
        }).catch((err) => {
            console.error('[notifications] critical fanout failed', err);
        });
    }

    return created;
}

export async function createAdminNotification({
    organizationId,
    type,
    title,
    message,
    payload = null,
    severity = null,
    category = null,
    createdBy = null,
}) {
    const adminUserIds = await listAdminUserIds(organizationId);
    return createNotification({
        organizationId,
        type,
        title,
        message,
        payload,
        severity,
        category,
        createdBy,
        recipientUserIds: adminUserIds,
    });
}

export async function listUserNotifications({
    organizationId,
    userId,
    limit = 20,
    page = 1,
    status = 'ALL',
    category = 'ALL',
}) {
    const take = Math.max(1, Math.min(100, Number(limit) || 20));
    const currentPage = Math.max(1, Number(page) || 1);
    const skip = (currentPage - 1) * take;
    const statusFilter = normalizeStatusFilter(status);
    const categoryFilter = normalizeCategoryFilter(category);

    sweepNotificationRetention({ organizationId }).catch(() => {
        // ignore retention sweep failures on request path
    });

    const listWhere = buildRecipientWhere({
        organizationId,
        userId,
        statusFilter,
        categoryFilter,
    });

    const [rows, totalCount, unreadCount] = await Promise.all([
        prisma.notification_recipients.findMany({
            where: listWhere,
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
            skip,
            take,
        }),
        prisma.notification_recipients.count({
            where: listWhere,
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
        page: currentPage,
        limit: take,
        totalCount,
        unreadCount,
        status: statusFilter,
        category: categoryFilter,
        items: rows.map((row) => {
            const payload = parsePayload(row.notifications?.payload_json);
            return {
                id: Number(row.notification_id || 0),
                type: String(row.notifications?.type || 'SYSTEM'),
                title: String(row.notifications?.title || ''),
                message: String(row.notifications?.message || ''),
                payload,
                severity: normalizeNotificationSeverity(payload?.severity, row.notifications?.type),
                category: normalizeNotificationCategory(payload?.category, row.notifications?.type),
                actionUrl: String(payload?.actionUrl || '').trim(),
                createdAt: row.notifications?.created_at || null,
                readAt: row.read_at || null,
                deliveredAt: row.delivered_at || null,
            };
        }),
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
