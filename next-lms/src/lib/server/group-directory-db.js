import prisma from '@/lib/prisma';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import {
    defaultGroupCodeFromEnterpriseRoleCode,
    getRoleOptionByEnterpriseRoleCode,
    GROUP_ROLE_OPTIONS,
    inferEnterpriseRoleCodeFromGroup,
    normalizeEnterpriseRoleCode,
    roleLabelFromEnterpriseRoleCode,
} from '@/lib/shared/role-directory';

const GROUP_STORAGE_PREFIX = '__map__/admin-group/';
const GROUP_ASSET_TYPE = 'document';

function parseMetadata(metadataJson) {
    if (!metadataJson) return {};
    if (typeof metadataJson === 'object') return metadataJson;
    try {
        return JSON.parse(metadataJson);
    } catch {
        return {};
    }
}

function normalizeCode(value, fallbackName = '') {
    const raw = String(value || '').trim();
    const seed = raw || String(fallbackName || '').trim();
    if (!seed) return '';
    return seed.toUpperCase().replace(/\s+/g, '_').slice(0, 64);
}

function normalizeRoles(roles) {
    if (!Array.isArray(roles)) return [];
    const unique = new Set();
    for (const role of roles) {
        const normalized = String(role || '').trim();
        if (normalized) unique.add(normalized);
    }
    return Array.from(unique);
}

function normalizeRoleCode(value, fallback = 'LEARNER') {
    return normalizeEnterpriseRoleCode(value || fallback);
}

function toGroupShape(input, fallback = {}) {
    const name = String(input?.name || fallback?.name || '').trim();
    const description = String(input?.description || fallback?.description || '').trim();
    const code = normalizeCode(input?.code || fallback?.code, name);
    const roleCode = normalizeRoleCode(
        input?.roleCode
            || fallback?.roleCode
            || inferEnterpriseRoleCodeFromGroup(input)
            || inferEnterpriseRoleCodeFromGroup(fallback)
    );
    const roles = normalizeRoles(
        input?.roles
        ?? fallback?.roles
        ?? [roleLabelFromEnterpriseRoleCode(roleCode)]
    );
    const isActive = input?.isActive ?? fallback?.isActive ?? true;
    const memberCount = Number(input?.memberCount ?? fallback?.memberCount ?? 0);
    const isSystemDefault = input?.isSystemDefault ?? fallback?.isSystemDefault ?? false;

    return {
        id: Number(input?.id || fallback?.id || 0),
        code,
        name,
        description,
        roleCode,
        isActive: Boolean(isActive),
        isSystemDefault: Boolean(isSystemDefault),
        roles,
        memberCount: Number.isFinite(memberCount) && memberCount > 0 ? Math.floor(memberCount) : 0,
        lastUpdatedAt: new Date().toISOString(),
    };
}

function parseGroupIdFromStoragePath(storagePath = '') {
    const raw = String(storagePath || '').trim();
    if (!raw.startsWith(GROUP_STORAGE_PREFIX)) return 0;
    const id = Number(raw.slice(GROUP_STORAGE_PREFIX.length));
    return Number.isInteger(id) && id > 0 ? id : 0;
}

function mapGroupAsset(asset) {
    const metadata = parseMetadata(asset?.metadataJson);
    const fallbackId = parseGroupIdFromStoragePath(asset?.storagePath);
    const normalized = toGroupShape(metadata, {
        id: fallbackId || asset?.id || 0,
        name: asset?.title || '',
    });
    if (!normalized.id) {
        normalized.id = Number(asset?.id || Date.now());
    }
    return normalized;
}

function markSystemDefaultGroups(groups = []) {
    const normalized = (groups || [])
        .map((group) => ({ ...group, roleCode: normalizeRoleCode(group?.roleCode) }))
        .sort((a, b) => a.id - b.id);

    const defaultIdsByRole = new Map();
    for (const option of GROUP_ROLE_OPTIONS) {
        const candidates = normalized.filter((group) => group.roleCode === option.code);
        if (candidates.length === 0) continue;
        const explicit = candidates.find((group) => group.isSystemDefault);
        defaultIdsByRole.set(option.code, Number((explicit || candidates[0]).id));
    }

    return normalized.map((group) => ({
        ...group,
        isSystemDefault: defaultIdsByRole.get(group.roleCode) === Number(group.id),
    }));
}

async function listGroupAssets(organizationId) {
    return prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: GROUP_ASSET_TYPE,
            storagePath: {
                startsWith: GROUP_STORAGE_PREFIX,
            },
        },
        orderBy: { id: 'asc' },
    });
}

async function ensureDefaultRoleGroupsInDb(organizationId) {
    const assets = await listGroupAssets(organizationId);
    let groups = markSystemDefaultGroups(assets.map(mapGroupAsset));
    const missingOptions = GROUP_ROLE_OPTIONS.filter((option) => (
        !groups.some((group) => group.roleCode === option.code)
    ));

    if (missingOptions.length === 0) return groups;

    let nextId = nextGroupId(groups);
    for (const option of missingOptions) {
        const payload = toGroupShape({
            id: nextId,
            code: option.groupCode,
            name: option.label,
            description: `${option.label} role group`,
            roleCode: option.code,
            roles: [option.label],
            isActive: true,
            isSystemDefault: true,
        });
        await prisma.learningAsset.create({
            data: {
                organization_id: organizationId,
                assetType: GROUP_ASSET_TYPE,
                title: payload.name,
                storagePath: `${GROUP_STORAGE_PREFIX}${payload.id}`,
                metadataJson: payload,
            },
        });
        nextId += 1;
    }

    const refreshedAssets = await listGroupAssets(organizationId);
    groups = markSystemDefaultGroups(refreshedAssets.map(mapGroupAsset));
    return groups;
}

function ensureUniqueRoleOrThrow(groups, roleCode, excludeId = null) {
    const normalizedRoleCode = normalizeRoleCode(roleCode);
    const duplicated = groups.find((group) => (
        normalizeRoleCode(group?.roleCode) === normalizedRoleCode
        && String(group?.id || '') !== String(excludeId || '')
    ));
    if (duplicated) {
        const option = getRoleOptionByEnterpriseRoleCode(normalizedRoleCode);
        const err = new Error(`${option.label} default group already exists`);
        err.status = 409;
        throw err;
    }
}

function ensureUniqueCodeOrThrow(groups, code, excludeId = null) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return;
    const duplicated = groups.find((group) => (
        String(group?.code || '').trim().toUpperCase() === normalized
        && String(group?.id || '') !== String(excludeId || '')
    ));
    if (duplicated) {
        const err = new Error('Group code already exists');
        err.status = 409;
        throw err;
    }
}

function nextGroupId(groups) {
    const used = new Set(
        (groups || [])
            .map((group) => Number(group?.id || 0))
            .filter((id) => Number.isInteger(id) && id > 0)
    );
    let candidate = Date.now();
    while (used.has(candidate)) candidate += 1;
    return candidate;
}

function normalizeRoleLabel(value) {
    const normalized = String(value || '').trim();
    return normalized;
}

function uniqueRoleList(values = []) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        const normalized = normalizeRoleLabel(value);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }
    return result;
}

export async function listGroupsFromDb() {
    const organizationId = await ensureDefaultOrganization();
    const groups = await ensureDefaultRoleGroupsInDb(organizationId);
    return { organizationId, groups };
}

export async function listGroupRoleOptionsFromDb() {
    const organizationId = await ensureDefaultOrganization();
    await ensureDefaultRoleGroupsInDb(organizationId);
    const categories = [
        {
            id: 'role_groups',
            label: 'Role Groups',
            roles: GROUP_ROLE_OPTIONS.map((item) => item.label),
        },
    ];
    return {
        organizationId,
        categories,
        roles: uniqueRoleList(categories.flatMap((category) => category.roles)),
    };
}

export async function getGroupMapByCodesFromDb(codes = []) {
    const normalizedCodes = uniqueRoleList(
        (Array.isArray(codes) ? codes : [])
            .map((item) => String(item || '').trim().toUpperCase())
            .filter(Boolean)
    );
    if (normalizedCodes.length === 0) return new Map();

    const { groups } = await listGroupsFromDb();
    const map = new Map();
    for (const group of groups) {
        const key = String(group?.code || '').trim().toUpperCase();
        if (!key || !normalizedCodes.includes(key)) continue;
        map.set(key, group);
    }
    return map;
}

export async function getGroupByIdFromDb(id) {
    const targetId = Number(id || 0);
    if (!Number.isInteger(targetId) || targetId <= 0) return null;
    const { groups, organizationId } = await listGroupsFromDb();
    const group = groups.find((item) => item.id === targetId) || null;
    return { organizationId, group };
}

export async function createGroupInDb(payload) {
    const organizationId = await ensureDefaultOrganization();
    const existingGroups = await ensureDefaultRoleGroupsInDb(organizationId);

    const group = toGroupShape(payload);
    if (!group.name) {
        const err = new Error('Group name is required');
        err.status = 400;
        throw err;
    }
    if (!group.description) {
        const err = new Error('Description is required');
        err.status = 400;
        throw err;
    }
    if (!group.roleCode) {
        const err = new Error('Role is required');
        err.status = 400;
        throw err;
    }

    ensureUniqueCodeOrThrow(existingGroups, group.code);
    ensureUniqueRoleOrThrow(existingGroups, group.roleCode);
    group.id = nextGroupId(existingGroups);
    group.isSystemDefault = false;

    await prisma.learningAsset.create({
        data: {
            organization_id: organizationId,
            assetType: GROUP_ASSET_TYPE,
            title: group.name,
            storagePath: `${GROUP_STORAGE_PREFIX}${group.id}`,
            metadataJson: group,
        },
    });

    return group;
}

export async function updateGroupInDb(id, payload) {
    const targetId = Number(id || 0);
    if (!Number.isInteger(targetId) || targetId <= 0) {
        const err = new Error('Missing id');
        err.status = 400;
        throw err;
    }

    const organizationId = await ensureDefaultOrganization();
    const assets = await listGroupAssets(organizationId);
    const groups = markSystemDefaultGroups(assets.map(mapGroupAsset));
    const current = groups.find((item) => item.id === targetId);
    if (!current) {
        const err = new Error('Group not found');
        err.status = 404;
        throw err;
    }

    const nextGroup = toGroupShape(payload, current);
    nextGroup.id = targetId;

    if (!nextGroup.name) {
        const err = new Error('Group name is required');
        err.status = 400;
        throw err;
    }
    if (!nextGroup.description) {
        const err = new Error('Description is required');
        err.status = 400;
        throw err;
    }
    if (!nextGroup.roleCode) {
        const err = new Error('Role is required');
        err.status = 400;
        throw err;
    }
    if (current.isSystemDefault && normalizeRoleCode(nextGroup.roleCode) !== normalizeRoleCode(current.roleCode)) {
        const err = new Error('Cannot change role of default system group');
        err.status = 400;
        throw err;
    }
    if (current.isSystemDefault && String(nextGroup.code || '').trim().toUpperCase() !== String(current.code || '').trim().toUpperCase()) {
        const err = new Error('Cannot change code of default system group');
        err.status = 400;
        throw err;
    }

    ensureUniqueCodeOrThrow(groups, nextGroup.code, targetId);
    ensureUniqueRoleOrThrow(groups, nextGroup.roleCode, targetId);
    nextGroup.isSystemDefault = Boolean(current.isSystemDefault);

    const storagePath = `${GROUP_STORAGE_PREFIX}${targetId}`;
    const existingAsset = assets.find((asset) => String(asset?.storagePath || '') === storagePath);
    if (!existingAsset?.id) {
        const err = new Error('Group not found');
        err.status = 404;
        throw err;
    }

    await prisma.learningAsset.update({
        where: { id: existingAsset.id },
        data: {
            title: nextGroup.name,
            metadataJson: nextGroup,
        },
    });

    return nextGroup;
}

export async function deleteGroupFromDb(id) {
    const targetId = Number(id || 0);
    if (!Number.isInteger(targetId) || targetId <= 0) {
        const err = new Error('Missing id');
        err.status = 400;
        throw err;
    }

    const organizationId = await ensureDefaultOrganization();
    const groups = await ensureDefaultRoleGroupsInDb(organizationId);
    const targetGroup = groups.find((group) => group.id === targetId);
    if (!targetGroup) {
        const err = new Error('Group not found');
        err.status = 404;
        throw err;
    }
    if (targetGroup.isSystemDefault) {
        const err = new Error('Default role groups cannot be deleted');
        err.status = 400;
        throw err;
    }

    const storagePath = `${GROUP_STORAGE_PREFIX}${targetId}`;
    const existing = await prisma.learningAsset.findFirst({
        where: {
            organization_id: organizationId,
            assetType: GROUP_ASSET_TYPE,
            storagePath,
        },
        orderBy: { id: 'desc' },
        select: { id: true },
    });

    if (!existing?.id) {
        const err = new Error('Group not found');
        err.status = 404;
        throw err;
    }

    await prisma.learningAsset.delete({ where: { id: existing.id } });
    return true;
}

export async function getDefaultGroupCodeByRoleFromDb(roleCode) {
    const normalizedRoleCode = normalizeRoleCode(roleCode);
    const { groups } = await listGroupsFromDb();
    const defaultGroup = groups.find((group) => (
        normalizeRoleCode(group?.roleCode) === normalizedRoleCode
        && group.isSystemDefault
    )) || groups.find((group) => normalizeRoleCode(group?.roleCode) === normalizedRoleCode);

    if (defaultGroup?.code) return String(defaultGroup.code).trim().toUpperCase();
    return defaultGroupCodeFromEnterpriseRoleCode(normalizedRoleCode);
}
