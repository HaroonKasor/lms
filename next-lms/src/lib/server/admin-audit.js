import prisma from '@/lib/prisma';

const AUDIT_STORAGE_PREFIX = '__audit__/';
const AUDIT_ASSET_TYPE = 'document';
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AUDIT_RETENTION_DAYS = 180;
const rawRetentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS || '');
const AUDIT_RETENTION_DAYS = Number.isFinite(rawRetentionDays) && rawRetentionDays > 0
    ? Math.max(1, Math.floor(rawRetentionDays))
    : DEFAULT_AUDIT_RETENTION_DAYS;
const rawSweepIntervalMs = Number(process.env.AUDIT_LOG_RETENTION_SWEEP_INTERVAL_MS || '');
const AUDIT_RETENTION_SWEEP_INTERVAL_MS = Number.isFinite(rawSweepIntervalMs) && rawSweepIntervalMs > 0
    ? Math.max(60 * 1000, Math.floor(rawSweepIntervalMs))
    : 6 * 60 * 60 * 1000;

let lastAuditSweepAtMs = 0;
let auditSweepInFlight = null;

function toPositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.floor(n);
    return int > 0 ? int : fallback;
}

function normalizeSeverity(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'critical') return 'critical';
    if (normalized === 'warning') return 'warning';
    return 'info';
}

function normalizeAction(value) {
    return String(value || '').trim().toUpperCase().slice(0, 80) || 'UNKNOWN';
}

function normalizeEntity(value) {
    return String(value || '').trim().toUpperCase().slice(0, 80) || 'SYSTEM';
}

function safeTitleFromAudit({ action, entity, message }) {
    const parts = [normalizeAction(action), normalizeEntity(entity)];
    const base = `[AUDIT] ${parts.filter(Boolean).join(' ')}`;
    const suffix = String(message || '').trim();
    return suffix ? `${base} - ${suffix}`.slice(0, 255) : base.slice(0, 255);
}

function buildAuditStoragePath(organizationId, now = new Date()) {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${AUDIT_STORAGE_PREFIX}${organizationId}/${year}/${month}/${timestamp}-${randomPart}.json`;
}

function getAuditStoragePathPrefix(organizationId) {
    return `${AUDIT_STORAGE_PREFIX}${organizationId}/`;
}

function mapAuditRow(row) {
    const meta = row?.metadataJson && typeof row.metadataJson === 'object'
        ? row.metadataJson
        : {};
    return {
        id: Number(row?.id || 0),
        action: String(meta?.action || 'UNKNOWN'),
        entity: String(meta?.entity || 'SYSTEM'),
        entityId: meta?.entityId ?? null,
        message: String(meta?.message || ''),
        severity: normalizeSeverity(meta?.severity),
        actorUserId: Number(meta?.actorUserId || row?.uploadedById || 0) || null,
        actorUsername: String(meta?.actorUsername || ''),
        actorEmail: String(meta?.actorEmail || ''),
        request: meta?.request && typeof meta.request === 'object' ? meta.request : null,
        details: meta?.details && typeof meta.details === 'object' ? meta.details : null,
        createdAt: row?.uploadedAt ? new Date(row.uploadedAt).toISOString() : String(meta?.createdAt || ''),
    };
}

export async function sweepAdminAuditRetention({ organizationId, force = false } = {}) {
    if (!organizationId) {
        return { success: false, skipped: true, reason: 'missing_organization_id' };
    }

    const now = Date.now();
    if (!force && (now - lastAuditSweepAtMs) < AUDIT_RETENTION_SWEEP_INTERVAL_MS) {
        return {
            success: true,
            skipped: true,
            reason: 'throttled',
            retentionDays: AUDIT_RETENTION_DAYS,
        };
    }
    if (auditSweepInFlight) return auditSweepInFlight;

    lastAuditSweepAtMs = now;
    const cutoffDate = new Date(now - (AUDIT_RETENTION_DAYS * DAY_MS));
    const storagePrefix = getAuditStoragePathPrefix(organizationId);

    auditSweepInFlight = prisma.learningAsset.deleteMany({
        where: {
            organization_id: organizationId,
            assetType: AUDIT_ASSET_TYPE,
            storagePath: {
                startsWith: storagePrefix,
            },
            uploadedAt: {
                lt: cutoffDate,
            },
        },
    })
        .then((result) => ({
            success: true,
            skipped: false,
            retentionDays: AUDIT_RETENTION_DAYS,
            deletedCount: Number(result?.count || 0),
            cutoffDate: cutoffDate.toISOString(),
        }))
        .catch((err) => {
            console.error('[audit] retention sweep failed', err);
            return {
                success: false,
                skipped: false,
                retentionDays: AUDIT_RETENTION_DAYS,
                error: String(err?.message || err || 'Unknown error'),
            };
        })
        .finally(() => {
            auditSweepInFlight = null;
        });

    return auditSweepInFlight;
}

export async function writeAdminAudit({
    organizationId,
    actorUserId = null,
    actorUsername = '',
    actorEmail = '',
    action = 'UNKNOWN',
    entity = 'SYSTEM',
    entityId = null,
    message = '',
    severity = 'info',
    request = null,
    details = null,
} = {}) {
    if (!organizationId) return null;

    const now = new Date();
    const storagePath = buildAuditStoragePath(organizationId, now);
    const payload = {
        kind: 'admin_audit',
        action: normalizeAction(action),
        entity: normalizeEntity(entity),
        entityId: entityId ?? null,
        message: String(message || '').trim().slice(0, 500),
        severity: normalizeSeverity(severity),
        actorUserId: actorUserId ? Number(actorUserId) : null,
        actorUsername: String(actorUsername || '').trim().slice(0, 120),
        actorEmail: String(actorEmail || '').trim().slice(0, 255),
        request: request && typeof request === 'object' ? request : null,
        details: details && typeof details === 'object' ? details : null,
        createdAt: now.toISOString(),
    };

    const row = await prisma.learningAsset.create({
        data: {
            organization_id: organizationId,
            assetType: AUDIT_ASSET_TYPE,
            title: safeTitleFromAudit(payload),
            storagePath,
            publicUrl: null,
            metadataJson: payload,
            uploadedById: actorUserId ? Number(actorUserId) : null,
            uploadedAt: now,
        },
    });

    return mapAuditRow(row);
}

export async function listAdminAuditLogs({
    organizationId,
    limit = 50,
    page = 1,
    action = '',
    entity = '',
    search = '',
} = {}) {
    const safeLimit = Math.max(1, Math.min(200, toPositiveInt(limit, 50)));
    const safePage = Math.max(1, toPositiveInt(page, 1));
    const skip = (safePage - 1) * safeLimit;
    const storagePrefix = getAuditStoragePathPrefix(organizationId);
    const normalizedAction = String(action || '').trim().toUpperCase();
    const normalizedEntity = String(entity || '').trim().toUpperCase();
    const normalizedSearch = String(search || '').trim().toLowerCase();
    const hasFilter = Boolean(normalizedAction || normalizedEntity || normalizedSearch);

    sweepAdminAuditRetention({ organizationId }).catch(() => {
        // do not fail request when retention sweep fails
    });

    const baseWhere = {
        organization_id: organizationId,
        assetType: AUDIT_ASSET_TYPE,
        storagePath: {
            startsWith: storagePrefix,
        },
    };

    if (!hasFilter) {
        const [rows, totalCount] = await Promise.all([
            prisma.learningAsset.findMany({
                where: baseWhere,
                orderBy: { uploadedAt: 'desc' },
                skip,
                take: safeLimit,
            }),
            prisma.learningAsset.count({ where: baseWhere }),
        ]);
        return {
            page: safePage,
            limit: safeLimit,
            totalCount,
            items: rows.map(mapAuditRow),
        };
    }

    // Filtered mode: fetch recent rows and filter in memory because Prisma JSON-path filter
    // support is limited for this generated client shape.
    const candidateSize = Math.max(safeLimit * 8, 400);
    const candidates = await prisma.learningAsset.findMany({
        where: baseWhere,
        orderBy: { uploadedAt: 'desc' },
        take: candidateSize,
    });
    const filtered = candidates
        .map(mapAuditRow)
        .filter((row) => {
            if (normalizedAction && String(row.action || '').toUpperCase() !== normalizedAction) return false;
            if (normalizedEntity && String(row.entity || '').toUpperCase() !== normalizedEntity) return false;
            if (!normalizedSearch) return true;
            const haystack = [
                row.action,
                row.entity,
                row.message,
                row.actorUsername,
                row.actorEmail,
                String(row.entityId ?? ''),
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalizedSearch);
        });

    return {
        page: safePage,
        limit: safeLimit,
        totalCount: filtered.length,
        items: filtered.slice(skip, skip + safeLimit),
    };
}

