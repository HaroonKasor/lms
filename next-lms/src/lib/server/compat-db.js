import prisma from '@/lib/prisma';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { hydrateContentWithConfig } from '@/lib/server/tincan-package-config';

const CONTENT_PREFIX = 'content/';
const COURSE_CONTENT_MAP_PREFIX = '__map__/course-content/';
const COURSE_THUMBNAIL_MAP_PREFIX = '__map__/course-thumbnail/';
const COURSE_AUTO_APPROVE_MAP_PREFIX = '__map__/course-auto-approve/';
const COURSE_SETTINGS_MAP_PREFIX = '__map__/course-settings/';
const SECTION_SETTINGS_MAP_PREFIX = '__map__/section-settings/';
const CONTENT_ASSET_TYPE = 'xapi';
const MAP_ASSET_TYPE = 'document';
const DEFAULT_SECTION_ROLE_CODES = ['LEARNER'];

function parseMetadata(metadataJson) {
    if (!metadataJson) return {};
    if (typeof metadataJson === 'object') return metadataJson;
    try {
        return JSON.parse(metadataJson);
    } catch {
        return {};
    }
}

function isTruthyFlag(value) {
    if (value === true) return true;
    if (value === false || value == null) return false;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return false;
        if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    return Boolean(value);
}

function normalizeInteger(value, fallback = 0, min = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.floor(n);
    return rounded < min ? min : rounded;
}

function normalizeStringValue(value, fallback = '') {
    const text = String(value ?? '').trim();
    if (text) return text;
    return String(fallback ?? '').trim();
}

function normalizeOptionalBoolean(value, fallback = null) {
    if (value === undefined) return fallback;
    if (value === null || value === '') return null;
    return isTruthyFlag(value);
}

function normalizeTinCanCondition(value, fallback = 'all_completed') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'all_completed') return 'all_completed';
    if (normalized === 'all_completed_by_content_success') return 'all_completed_by_content_success';
    if (normalized === 'all_completed_by_content_completion_success') return 'all_completed_by_content_completion_success';
    return String(fallback || 'all_completed').trim().toLowerCase() || 'all_completed';
}

function normalizeDeliveryMode(value, input = {}) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'self_learning' || normalized === 'online_classroom' || normalized === 'offline_classroom') {
        return normalized;
    }

    if (isTruthyFlag(input?.onlineClassroom)) return 'online_classroom';
    if (isTruthyFlag(input?.offlineClassroom)) return 'offline_classroom';
    return 'self_learning';
}

function normalizeStringArray(value, fallback = []) {
    const source = Array.isArray(value)
        ? value
        : String(value || '')
            .split(/[|,]/g)
            .map((item) => item.trim())
            .filter(Boolean);
    const normalized = Array.from(new Set(source.map((item) => String(item || '').trim()).filter(Boolean)));
    return normalized.length > 0 ? normalized : (Array.isArray(fallback) ? fallback : []);
}

function normalizeDateOnly(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return '';
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

function normalizeCourseSettings(input = {}) {
    const hasMaxUnlimitFlag = Object.prototype.hasOwnProperty.call(input, 'maxLearnerUnlimit')
        || Object.prototype.hasOwnProperty.call(input, 'maxLearnerUnlimited')
        || Object.prototype.hasOwnProperty.call(input, 'maxEnrollmentUnlimit')
        || Object.prototype.hasOwnProperty.call(input, 'enrollmentUnlimit');
    const rawMaxUnlimitFlag = input?.maxLearnerUnlimit
        ?? input?.maxLearnerUnlimited
        ?? input?.maxEnrollmentUnlimit
        ?? input?.enrollmentUnlimit;
    const rawMaxCapacity = input?.maxEnrollment ?? input?.maxLearner;
    const parsedMaxCapacity = Number(rawMaxCapacity);
    const inferredUnlimitedFromCapacity = Object.prototype.hasOwnProperty.call(input, 'maxEnrollment')
        || Object.prototype.hasOwnProperty.call(input, 'maxLearner')
        ? (!Number.isFinite(parsedMaxCapacity) || parsedMaxCapacity <= 0)
        : false;

    const existingPrerequisites = Array.isArray(input?.prerequisites) ? input.prerequisites : [];
    const deliveryMode = normalizeDeliveryMode(input?.deliveryMode, input);
    const isOnlineClassroom = deliveryMode === 'online_classroom';
    const isOfflineClassroom = deliveryMode === 'offline_classroom';
    const isSelfLearning = deliveryMode === 'self_learning';
    const liveChat = isOnlineClassroom ? isTruthyFlag(input?.liveChat) : false;
    const collaborate = isTruthyFlag(input?.collaborate);

    return {
        registerDateFrom: normalizeDateOnly(input?.registerDateFrom),
        registerDateTo: normalizeDateOnly(input?.registerDateTo),
        registerUnlimit: isTruthyFlag(input?.registerUnlimit),
        maxLearnerUnlimit: hasMaxUnlimitFlag
            ? isTruthyFlag(rawMaxUnlimitFlag)
            : inferredUnlimitedFromCapacity,
        detail: normalizeStringValue(input?.detail),
        lessons: normalizeInteger(input?.lessons, 0, 0),
        durationHours: normalizeInteger(input?.durationHours, 0, 0),
        durationMinutes: normalizeInteger(input?.durationMinutes, 0, 0),
        instructor: normalizeStringValue(input?.instructor),
        instructorExperience: normalizeStringValue(input?.instructorExperience),
        prerequisites: normalizeStringArray(input?.prerequisites, existingPrerequisites),
        tincanCondition: normalizeTinCanCondition(input?.tincanCondition, 'all_completed'),
        webboard: normalizeOptionalBoolean(input?.webboard, null),
        deliveryMode,
        selfLearning: isSelfLearning,
        onlineClassroom: isOnlineClassroom,
        offlineClassroom: isOfflineClassroom,
        liveChat,
        collaborate,
    };
}

function normalizeSectionSettings(input = {}) {
    const hasMaxUnlimitFlag = Object.prototype.hasOwnProperty.call(input, 'maxLearnerUnlimit')
        || Object.prototype.hasOwnProperty.call(input, 'maxLearnerUnlimited')
        || Object.prototype.hasOwnProperty.call(input, 'maxEnrollmentUnlimit')
        || Object.prototype.hasOwnProperty.call(input, 'enrollmentUnlimit');
    const rawMaxUnlimitFlag = input?.maxLearnerUnlimit
        ?? input?.maxLearnerUnlimited
        ?? input?.maxEnrollmentUnlimit
        ?? input?.enrollmentUnlimit;
    const rawMaxCapacity = input?.maxEnrollment ?? input?.maxLearner;
    const parsedMaxCapacity = Number(rawMaxCapacity);
    const inferredUnlimitedFromCapacity = Object.prototype.hasOwnProperty.call(input, 'maxEnrollment')
        || Object.prototype.hasOwnProperty.call(input, 'maxLearner')
        ? (!Number.isFinite(parsedMaxCapacity) || parsedMaxCapacity <= 0)
        : false;

    const rawGroups = input?.groups ?? input?.groupCodes ?? input?.allowedRoles ?? input?.roles;
    const normalizedGroups = normalizeSectionRoleCodes(rawGroups);

    return {
        registerDateFrom: normalizeDateOnly(input?.registerDateFrom),
        registerDateTo: normalizeDateOnly(input?.registerDateTo),
        registerUnlimit: isTruthyFlag(input?.registerUnlimit),
        learnDateTo: normalizeDateOnly(input?.learnDateTo),
        learnDateUnlimit: isTruthyFlag(input?.learnDateUnlimit ?? true),
        maxLearnerUnlimit: hasMaxUnlimitFlag
            ? isTruthyFlag(rawMaxUnlimitFlag)
            : inferredUnlimitedFromCapacity,
        sessionCode: normalizeStringValue(input?.sessionCode),
        detail: normalizeStringValue(input?.detail),
        autoApprove: normalizeOptionalBoolean(input?.autoApprove, true),
        certificate: Boolean(input?.certificate),
        autoCert: Boolean(input?.autoCert),
        cohortModule: Boolean(input?.cohortModule),
        groups: normalizedGroups,
    };
}

function normalizeSectionRoleCode(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return '';
    if (normalized === 'ADMIN' || normalized === 'ADMINISTRATOR') return 'ADMIN';
    if (normalized === 'INSTRUCTOR' || normalized === 'INSTRUCTURE' || normalized === 'TEACHER') return 'INSTRUCTOR';
    if (normalized === 'LEARNER' || normalized === 'USER' || normalized === 'STUDENT') return 'LEARNER';
    return '';
}

function normalizeSectionRoleCodes(input) {
    const rawList = Array.isArray(input)
        ? input
        : String(input || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

    const normalized = Array.from(
        new Set(
            rawList
                .map(normalizeSectionRoleCode)
                .filter(Boolean)
        )
    );
    if (normalized.length > 0) return normalized;
    return [...DEFAULT_SECTION_ROLE_CODES];
}

function toDateOnlyTime(value) {
    const normalized = normalizeDateOnly(value);
    if (!normalized) return null;
    const [year, month, day] = normalized.split('-').map((x) => Number(x));
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function getTodayDateOnlyTime() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
}

function evaluateRegisterWindow({
    registerDateFrom = '',
    registerDateTo = '',
    registerUnlimit = false,
} = {}) {
    if (registerUnlimit) return { allowed: true, reason: null };
    const fromTime = toDateOnlyTime(registerDateFrom);
    const toTime = toDateOnlyTime(registerDateTo);
    if (!Number.isFinite(fromTime) && !Number.isFinite(toTime)) {
        return { allowed: true, reason: null };
    }

    const today = getTodayDateOnlyTime();
    if (Number.isFinite(fromTime) && today < fromTime) {
        return { allowed: false, reason: 'not_open_yet' };
    }
    if (Number.isFinite(toTime) && today > toTime) {
        return { allowed: false, reason: 'closed' };
    }
    return { allowed: true, reason: null };
}

function evaluateLearnWindow({
    learnDateTo = '',
    learnDateUnlimit = true,
} = {}) {
    if (learnDateUnlimit) return { allowed: true, reason: null };
    const toTime = toDateOnlyTime(learnDateTo);
    if (!Number.isFinite(toTime)) return { allowed: true, reason: null };
    const today = getTodayDateOnlyTime();
    if (today > toTime) {
        return { allowed: false, reason: 'expired' };
    }
    return { allowed: true, reason: null };
}

function toContentShape(asset) {
    const meta = parseMetadata(asset.metadataJson);
    return {
        id: String(meta.contentId || '').trim(),
        title: String(meta.title || asset.title || '').trim(),
        type: String(meta.type || '').trim() || 'tincan',
        fileName: String(meta.fileName || '').trim(),
        entryPoint: String(meta.entryPoint || '').trim(),
        status: String(meta.status || 'active').trim(),
        activities: Array.isArray(meta.activities) ? meta.activities : [],
        completionPolicy: meta.completionPolicy ?? null,
        packageConfig: meta.packageConfig ?? null,
        uploadedAt:
            meta.uploadedAt ||
            (asset.uploadedAt ? new Date(asset.uploadedAt).toISOString() : new Date().toISOString()),
    };
}

async function findContentAssetByContentId(contentId) {
    const target = String(contentId || '').trim();
    if (!target) return null;
    const organizationId = await ensureDefaultOrganization();

    const candidates = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: CONTENT_ASSET_TYPE,
            storagePath: {
                startsWith: CONTENT_PREFIX,
            },
        },
        orderBy: { id: 'desc' },
    });
    return (
        candidates.find((asset) => {
            const meta = parseMetadata(asset.metadataJson);
            const metaId = String(meta.contentId || '').trim();
            if (metaId && metaId === target) return true;
            const storagePath = String(asset.storagePath || '').trim();
            return storagePath === `${CONTENT_PREFIX}${target}`;
        }) || null
    );
}

async function upsertMapAsset({ storagePath, title, metadataJson }) {
    const organizationId = await ensureDefaultOrganization();
    const existing = await prisma.learningAsset.findFirst({
        where: {
            organization_id: organizationId,
            assetType: MAP_ASSET_TYPE,
            storagePath,
        },
        orderBy: { id: 'desc' },
        select: { id: true },
    });

    if (existing?.id) {
        return prisma.learningAsset.update({
            where: { id: existing.id },
            data: {
                organization_id: organizationId,
                title: title || 'Mapping',
                publicUrl: null,
                metadataJson,
            },
        });
    }

    return prisma.learningAsset.create({
        data: {
            organization_id: organizationId,
            assetType: MAP_ASSET_TYPE,
            title: title || 'Mapping',
            storagePath,
            publicUrl: null,
            metadataJson,
        },
    });
}

async function getMapAsset(storagePath) {
    const organizationId = await ensureDefaultOrganization();
    return prisma.learningAsset.findFirst({
        where: {
            organization_id: organizationId,
            assetType: MAP_ASSET_TYPE,
            storagePath,
        },
        orderBy: { id: 'desc' },
    });
}

async function listContents() {
    const organizationId = await ensureDefaultOrganization();
    const rows = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: CONTENT_ASSET_TYPE,
            storagePath: {
                startsWith: CONTENT_PREFIX,
            },
        },
        orderBy: { uploadedAt: 'desc' },
    });

    return rows
        .map((asset) => toContentShape(asset))
        .map((content) => hydrateContentWithConfig(content).content)
        .filter((content) => content.id);
}

async function saveContent(content) {
    const normalized = {
        id: String(content?.id || '').trim(),
        title: String(content?.title || '').trim(),
        type: String(content?.type || 'tincan').trim(),
        fileName: String(content?.fileName || '').trim(),
        entryPoint: String(content?.entryPoint || '').trim(),
        status: String(content?.status || 'active').trim(),
        activities: Array.isArray(content?.activities) ? content.activities : [],
        completionPolicy: content?.completionPolicy ?? null,
        packageConfig: content?.packageConfig ?? null,
        uploadedAt:
            content?.uploadedAt ||
            new Date().toISOString(),
    };
    if (!normalized.id) {
        throw new Error('Content id is required');
    }

    const existing = await findContentAssetByContentId(normalized.id);
    const data = {
        organization_id: await ensureDefaultOrganization(),
        assetType: CONTENT_ASSET_TYPE,
        title: normalized.title || `Content ${normalized.id}`,
        storagePath: `${CONTENT_PREFIX}${normalized.id}`,
        publicUrl: normalized.entryPoint ? `/${normalized.entryPoint.replace(/^\/+/, '')}` : null,
        metadataJson: {
            kind: 'content',
            contentId: normalized.id,
            ...normalized,
        },
    };

    const row = existing
        ? await prisma.learningAsset.update({
            where: { id: existing.id },
            data,
        })
        : await prisma.learningAsset.create({ data });

    return toContentShape(row);
}

async function deleteContent(contentId) {
    const existing = await findContentAssetByContentId(contentId);
    if (existing?.id) {
        await prisma.learningAsset.delete({ where: { id: existing.id } });
    }
    const organizationId = await ensureDefaultOrganization();

    // also clear course mappings pointing to deleted content
    const mappingRows = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: MAP_ASSET_TYPE,
            storagePath: {
                startsWith: COURSE_CONTENT_MAP_PREFIX,
            },
        },
    });

    const target = String(contentId || '').trim();
    for (const row of mappingRows) {
        const meta = parseMetadata(row.metadataJson);
        if (String(meta.contentId || '').trim() === target) {
            await prisma.learningAsset.update({
                where: { id: row.id },
                data: {
                    metadataJson: {
                        ...meta,
                        contentId: null,
                    },
                },
            });
        }
    }
}

async function getCourseContentId(courseId) {
    const id = String(courseId || '').trim();
    if (!id) return null;

    const row = await getMapAsset(`${COURSE_CONTENT_MAP_PREFIX}${id}`);
    if (!row) return null;
    const meta = parseMetadata(row.metadataJson);
    const value = String(meta.contentId || '').trim();
    return value || null;
}

async function findCourseIdByContentId(contentId) {
    const target = String(contentId || '').trim();
    if (!target) return null;
    const organizationId = await ensureDefaultOrganization();

    const rows = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: MAP_ASSET_TYPE,
            storagePath: {
                startsWith: COURSE_CONTENT_MAP_PREFIX,
            },
        },
        orderBy: { id: 'desc' },
    });

    const matched = rows.find((row) => {
        const meta = parseMetadata(row.metadataJson);
        return String(meta.contentId || '').trim() === target;
    });

    if (matched) {
        const courseId = Number(String(matched.storagePath || '').replace(COURSE_CONTENT_MAP_PREFIX, ''));
        return Number.isInteger(courseId) && courseId > 0 ? courseId : null;
    }

    return null;
}

async function setCourseContentId(courseId, contentId) {
    const id = String(courseId || '').trim();
    if (!id) return;

    const storagePath = `${COURSE_CONTENT_MAP_PREFIX}${id}`;
    const normalizedContentId = String(contentId || '').trim();

    if (!normalizedContentId) {
        const existing = await getMapAsset(storagePath);
        if (existing?.id) {
            await prisma.learningAsset.delete({ where: { id: existing.id } });
        }
        return;
    }

    await upsertMapAsset({
        storagePath,
        title: `Course ${id} Content Mapping`,
        metadataJson: {
            kind: 'course-content-map',
            courseId: Number(id),
            contentId: normalizedContentId,
        },
    });

}

async function getCourseThumbnail(courseId) {
    const id = String(courseId || '').trim();
    if (!id) return null;

    const row = await getMapAsset(`${COURSE_THUMBNAIL_MAP_PREFIX}${id}`);
    if (!row) return null;
    const meta = parseMetadata(row.metadataJson);
    const value = String(meta.thumbnail || '').trim();
    return value || null;
}

async function setCourseThumbnail(courseId, thumbnail) {
    const id = String(courseId || '').trim();
    if (!id) return;

    const storagePath = `${COURSE_THUMBNAIL_MAP_PREFIX}${id}`;
    const normalized = String(thumbnail || '').trim();

    if (!normalized) {
        const existing = await getMapAsset(storagePath);
        if (existing?.id) {
            await prisma.learningAsset.delete({ where: { id: existing.id } });
        }
        return;
    }

    await upsertMapAsset({
        storagePath,
        title: `Course ${id} Thumbnail Mapping`,
        metadataJson: {
            kind: 'course-thumbnail-map',
            courseId: Number(id),
            thumbnail: normalized,
        },
    });

}

async function getCourseAutoApprove(courseId) {
    const id = String(courseId || '').trim();
    if (!id) return null;

    const row = await getMapAsset(`${COURSE_AUTO_APPROVE_MAP_PREFIX}${id}`);
    if (!row) return null;
    const meta = parseMetadata(row.metadataJson);
    if (typeof meta.autoApprove !== 'boolean') return null;
    return meta.autoApprove;
}

async function setCourseAutoApprove(courseId, autoApprove) {
    const id = String(courseId || '').trim();
    if (!id) return;

    const storagePath = `${COURSE_AUTO_APPROVE_MAP_PREFIX}${id}`;
    if (autoApprove === undefined || autoApprove === null) {
        const existing = await getMapAsset(storagePath);
        if (existing?.id) {
            await prisma.learningAsset.delete({ where: { id: existing.id } });
        }
        return;
    }

    await upsertMapAsset({
        storagePath,
        title: `Course ${id} Auto Approve Mapping`,
        metadataJson: {
            kind: 'course-auto-approve-map',
            courseId: Number(id),
            autoApprove: Boolean(autoApprove),
        },
    });
}

async function getCourseSettings(courseId) {
    const id = String(courseId || '').trim();
    if (!id) return null;

    const row = await getMapAsset(`${COURSE_SETTINGS_MAP_PREFIX}${id}`);
    if (!row) return null;
    return normalizeCourseSettings(parseMetadata(row.metadataJson));
}

async function setCourseSettings(courseId, settings) {
    const id = String(courseId || '').trim();
    if (!id) return;

    const storagePath = `${COURSE_SETTINGS_MAP_PREFIX}${id}`;
    if (settings === undefined || settings === null) {
        const existing = await getMapAsset(storagePath);
        if (existing?.id) {
            await prisma.learningAsset.delete({ where: { id: existing.id } });
        }
        return;
    }

    const existing = await getMapAsset(storagePath);
    const current = existing ? normalizeCourseSettings(parseMetadata(existing.metadataJson)) : {};
    const normalized = normalizeCourseSettings({
        ...current,
        ...(settings && typeof settings === 'object' ? settings : {}),
    });
    await upsertMapAsset({
        storagePath,
        title: `Course ${id} Settings Mapping`,
        metadataJson: {
            kind: 'course-settings-map',
            courseId: Number(id),
            ...normalized,
        },
    });
}

async function getSectionSettings(sectionId) {
    const id = String(sectionId || '').trim();
    if (!id) return null;

    const row = await getMapAsset(`${SECTION_SETTINGS_MAP_PREFIX}${id}`);
    if (!row) return null;
    return normalizeSectionSettings(parseMetadata(row.metadataJson));
}

async function setSectionSettings(sectionId, settings) {
    const id = String(sectionId || '').trim();
    if (!id) return;

    const storagePath = `${SECTION_SETTINGS_MAP_PREFIX}${id}`;
    if (settings === undefined || settings === null) {
        const existing = await getMapAsset(storagePath);
        if (existing?.id) {
            await prisma.learningAsset.delete({ where: { id: existing.id } });
        }
        return;
    }

    const existing = await getMapAsset(storagePath);
    const current = existing ? normalizeSectionSettings(parseMetadata(existing.metadataJson)) : {};
    const normalized = normalizeSectionSettings({
        ...current,
        ...(settings && typeof settings === 'object' ? settings : {}),
    });
    await upsertMapAsset({
        storagePath,
        title: `Section ${id} Settings Mapping`,
        metadataJson: {
            kind: 'section-settings-map',
            sectionId: Number(id),
            ...normalized,
        },
    });
}

async function getCourseCompatMaps(courseIds = []) {
    const targetIds = Array.from(
        new Set(
            courseIds
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );

    if (targetIds.length === 0) {
        return {
            contentByCourseId: {},
            thumbnailByCourseId: {},
            autoApproveByCourseId: {},
            courseSettingsByCourseId: {},
        };
    }

    const organizationId = await ensureDefaultOrganization();
    const rows = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: MAP_ASSET_TYPE,
            OR: targetIds.flatMap((id) => [
                { storagePath: `${COURSE_CONTENT_MAP_PREFIX}${id}` },
                { storagePath: `${COURSE_THUMBNAIL_MAP_PREFIX}${id}` },
                { storagePath: `${COURSE_AUTO_APPROVE_MAP_PREFIX}${id}` },
                { storagePath: `${COURSE_SETTINGS_MAP_PREFIX}${id}` },
            ]),
        },
        orderBy: { id: 'desc' },
    });

    const contentByCourseId = {};
    const thumbnailByCourseId = {};
    const autoApproveByCourseId = {};
    const courseSettingsByCourseId = {};

    for (const row of rows) {
        const storagePath = String(row.storagePath || '');
        const meta = parseMetadata(row.metadataJson);
        if (storagePath.startsWith(COURSE_CONTENT_MAP_PREFIX)) {
            const id = String(storagePath.replace(COURSE_CONTENT_MAP_PREFIX, ''));
            if (contentByCourseId[id] !== undefined) continue;
            const contentId = String(meta.contentId || '').trim();
            contentByCourseId[id] = contentId || null;
            continue;
        }
        if (storagePath.startsWith(COURSE_THUMBNAIL_MAP_PREFIX)) {
            const id = String(storagePath.replace(COURSE_THUMBNAIL_MAP_PREFIX, ''));
            if (thumbnailByCourseId[id] !== undefined) continue;
            const thumbnail = String(meta.thumbnail || '').trim();
            thumbnailByCourseId[id] = thumbnail || null;
            continue;
        }
        if (storagePath.startsWith(COURSE_AUTO_APPROVE_MAP_PREFIX)) {
            const id = String(storagePath.replace(COURSE_AUTO_APPROVE_MAP_PREFIX, ''));
            if (autoApproveByCourseId[id] !== undefined) continue;
            if (typeof meta.autoApprove === 'boolean') {
                autoApproveByCourseId[id] = meta.autoApprove;
            }
            continue;
        }
        if (storagePath.startsWith(COURSE_SETTINGS_MAP_PREFIX)) {
            const id = String(storagePath.replace(COURSE_SETTINGS_MAP_PREFIX, ''));
            if (courseSettingsByCourseId[id] !== undefined) continue;
            courseSettingsByCourseId[id] = normalizeCourseSettings(meta);
        }
    }

    return { contentByCourseId, thumbnailByCourseId, autoApproveByCourseId, courseSettingsByCourseId };
}

async function getSectionCompatMaps(sectionIds = []) {
    const targetIds = Array.from(
        new Set(
            sectionIds
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );

    if (targetIds.length === 0) {
        return { sectionSettingsBySectionId: {} };
    }

    const organizationId = await ensureDefaultOrganization();
    const rows = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: MAP_ASSET_TYPE,
            OR: targetIds.map((id) => ({ storagePath: `${SECTION_SETTINGS_MAP_PREFIX}${id}` })),
        },
        orderBy: { id: 'desc' },
    });

    const sectionSettingsBySectionId = {};
    for (const row of rows) {
        const storagePath = String(row.storagePath || '');
        if (!storagePath.startsWith(SECTION_SETTINGS_MAP_PREFIX)) continue;
        const id = String(storagePath.replace(SECTION_SETTINGS_MAP_PREFIX, ''));
        if (sectionSettingsBySectionId[id] !== undefined) continue;
        sectionSettingsBySectionId[id] = normalizeSectionSettings(parseMetadata(row.metadataJson));
    }

    return { sectionSettingsBySectionId };
}

export {
    listContents,
    saveContent,
    deleteContent,
    getCourseContentId,
    findCourseIdByContentId,
    setCourseContentId,
    getCourseThumbnail,
    setCourseThumbnail,
    getCourseAutoApprove,
    setCourseAutoApprove,
    getCourseSettings,
    setCourseSettings,
    getSectionSettings,
    setSectionSettings,
    getCourseCompatMaps,
    getSectionCompatMaps,
    normalizeCourseSettings,
    normalizeSectionSettings,
    evaluateRegisterWindow,
    evaluateLearnWindow,
};
