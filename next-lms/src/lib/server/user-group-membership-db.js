import prisma from '@/lib/prisma';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';

const USER_GROUP_MAP_PREFIX = '__map__/user-groups/';
const USER_GROUP_ASSET_TYPE = 'document';

function normalizeGroupCode(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeGroupCodes(values = []) {
    if (!Array.isArray(values)) return [];
    const unique = new Set();
    for (const value of values) {
        const code = normalizeGroupCode(value);
        if (code) unique.add(code);
    }
    return Array.from(unique);
}

function parseMetadata(metadataJson) {
    if (!metadataJson) return {};
    if (typeof metadataJson === 'object') return metadataJson;
    try {
        return JSON.parse(metadataJson);
    } catch {
        return {};
    }
}

function toStoragePath(userId) {
    return `${USER_GROUP_MAP_PREFIX}${Number(userId)}`;
}

async function findLatestMembershipAsset(tx, { organizationId, userId }) {
    return tx.learningAsset.findFirst({
        where: {
            organization_id: organizationId,
            assetType: USER_GROUP_ASSET_TYPE,
            storagePath: toStoragePath(userId),
        },
        orderBy: { id: 'desc' },
    });
}

export async function getUserGroupMapByUserIds(userIds = [], organizationIdInput = null) {
    const normalizedIds = Array.from(
        new Set(
            (userIds || [])
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    );
    if (normalizedIds.length === 0) return new Map();

    const organizationId = organizationIdInput || await ensureDefaultOrganization();
    const paths = normalizedIds.map((id) => toStoragePath(id));
    const rows = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: USER_GROUP_ASSET_TYPE,
            storagePath: { in: paths },
        },
        orderBy: { id: 'desc' },
    });

    const map = new Map();
    for (const row of rows) {
        const metadata = parseMetadata(row?.metadataJson);
        const userId = Number(metadata?.userId || String(row?.storagePath || '').replace(USER_GROUP_MAP_PREFIX, ''));
        if (!Number.isInteger(userId) || userId <= 0) continue;
        if (map.has(userId)) continue;
        map.set(userId, normalizeGroupCodes(metadata?.groups));
    }

    for (const id of normalizedIds) {
        if (!map.has(id)) map.set(id, []);
    }
    return map;
}

export async function setUserGroups(tx, { organizationId, userId, groups = [] }) {
    const normalizedUserId = Number(userId || 0);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return [];

    const normalizedGroups = normalizeGroupCodes(groups);
    const storagePath = toStoragePath(normalizedUserId);
    const payload = {
        userId: normalizedUserId,
        groups: normalizedGroups,
        updatedAt: new Date().toISOString(),
    };

    const existing = await findLatestMembershipAsset(tx, {
        organizationId,
        userId: normalizedUserId,
    });

    if (existing?.id) {
        await tx.learningAsset.update({
            where: { id: existing.id },
            data: {
                title: `User ${normalizedUserId} groups`,
                metadataJson: payload,
            },
        });

        await tx.learningAsset.deleteMany({
            where: {
                organization_id: organizationId,
                assetType: USER_GROUP_ASSET_TYPE,
                storagePath,
                id: { not: existing.id },
            },
        });
    } else {
        await tx.learningAsset.create({
            data: {
                organization_id: organizationId,
                assetType: USER_GROUP_ASSET_TYPE,
                title: `User ${normalizedUserId} groups`,
                storagePath,
                metadataJson: payload,
            },
        });
    }

    return normalizedGroups;
}

export async function deleteUserGroups(tx, { organizationId, userId }) {
    const normalizedUserId = Number(userId || 0);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return;
    await tx.learningAsset.deleteMany({
        where: {
            organization_id: organizationId,
            assetType: USER_GROUP_ASSET_TYPE,
            storagePath: toStoragePath(normalizedUserId),
        },
    });
}
