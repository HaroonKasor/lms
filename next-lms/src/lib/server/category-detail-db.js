import prisma from '@/lib/prisma';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';

const CATEGORY_DETAIL_MAP_PREFIX = '__map__/category-detail/';
const CATEGORY_DETAIL_ASSET_TYPE = 'document';

function parseMetadata(metadataJson) {
    if (!metadataJson) return {};
    if (typeof metadataJson === 'object') return metadataJson;
    try {
        return JSON.parse(metadataJson);
    } catch {
        return {};
    }
}

function toStoragePath(categoryId) {
    return `${CATEGORY_DETAIL_MAP_PREFIX}${Number(categoryId)}`;
}

function normalizeDetail(value) {
    return String(value || '').trim();
}

async function findLatestDetailAsset(tx, { organizationId, categoryId }) {
    return tx.learningAsset.findFirst({
        where: {
            organization_id: organizationId,
            assetType: CATEGORY_DETAIL_ASSET_TYPE,
            storagePath: toStoragePath(categoryId),
        },
        orderBy: { id: 'desc' },
    });
}

export async function getCategoryDetailMapByIds(categoryIds = [], organizationIdInput = null) {
    const normalizedIds = Array.from(
        new Set(
            (categoryIds || [])
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    );
    if (normalizedIds.length === 0) return new Map();

    const organizationId = organizationIdInput || await ensureDefaultOrganization();
    const rows = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: CATEGORY_DETAIL_ASSET_TYPE,
            storagePath: { in: normalizedIds.map((id) => toStoragePath(id)) },
        },
        orderBy: { id: 'desc' },
    });

    const map = new Map();
    for (const row of rows) {
        const metadata = parseMetadata(row?.metadataJson);
        const categoryId = Number(
            metadata?.categoryId || String(row?.storagePath || '').replace(CATEGORY_DETAIL_MAP_PREFIX, '')
        );
        if (!Number.isInteger(categoryId) || categoryId <= 0) continue;
        if (map.has(categoryId)) continue;
        map.set(categoryId, normalizeDetail(metadata?.detail));
    }

    for (const id of normalizedIds) {
        if (!map.has(id)) map.set(id, '');
    }
    return map;
}

export async function setCategoryDetail(tx, { organizationId, categoryId, detail = '' }) {
    const normalizedCategoryId = Number(categoryId || 0);
    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) return;

    const normalizedDetail = normalizeDetail(detail);
    const storagePath = toStoragePath(normalizedCategoryId);

    const existing = await findLatestDetailAsset(tx, {
        organizationId,
        categoryId: normalizedCategoryId,
    });

    if (!normalizedDetail) {
        if (existing?.id) {
            await tx.learningAsset.deleteMany({
                where: {
                    organization_id: organizationId,
                    assetType: CATEGORY_DETAIL_ASSET_TYPE,
                    storagePath,
                },
            });
        }
        return;
    }

    const payload = {
        categoryId: normalizedCategoryId,
        detail: normalizedDetail,
        updatedAt: new Date().toISOString(),
    };

    if (existing?.id) {
        await tx.learningAsset.update({
            where: { id: existing.id },
            data: {
                title: `Category ${normalizedCategoryId} detail`,
                metadataJson: payload,
            },
        });
        await tx.learningAsset.deleteMany({
            where: {
                organization_id: organizationId,
                assetType: CATEGORY_DETAIL_ASSET_TYPE,
                storagePath,
                id: { not: existing.id },
            },
        });
    } else {
        await tx.learningAsset.create({
            data: {
                organization_id: organizationId,
                assetType: CATEGORY_DETAIL_ASSET_TYPE,
                title: `Category ${normalizedCategoryId} detail`,
                storagePath,
                metadataJson: payload,
            },
        });
    }
}

export async function deleteCategoryDetail(tx, { organizationId, categoryId }) {
    const normalizedCategoryId = Number(categoryId || 0);
    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) return;
    await tx.learningAsset.deleteMany({
        where: {
            organization_id: organizationId,
            assetType: CATEGORY_DETAIL_ASSET_TYPE,
            storagePath: toStoragePath(normalizedCategoryId),
        },
    });
}
