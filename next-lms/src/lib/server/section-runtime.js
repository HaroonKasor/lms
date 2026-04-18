function normalizeCertificateMode(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'auto' || normalized === 'manual') return normalized;
    return 'none';
}

function toSectionSettings(sectionId, sectionSettingsBySectionId = {}) {
    const key = String(sectionId || '').trim();
    if (!key) return null;
    if (!Object.prototype.hasOwnProperty.call(sectionSettingsBySectionId || {}, key)) return null;
    const settings = sectionSettingsBySectionId?.[key];
    if (!settings || typeof settings !== 'object') return null;
    return settings;
}

function resolveEffectiveCertificateConfig({
    courseHasCertificate = false,
    courseCertificateMode = 'none',
    sectionId = null,
    sectionSettingsBySectionId = {},
} = {}) {
    const normalizedCourseMode = normalizeCertificateMode(courseCertificateMode);
    const courseRequired = Boolean(courseHasCertificate) && normalizedCourseMode !== 'none';
    const courseMode = courseRequired ? normalizedCourseMode : 'none';

    const sectionSettings = toSectionSettings(sectionId, sectionSettingsBySectionId);
    if (!sectionSettings) {
        return {
            required: courseRequired,
            mode: courseMode,
            source: 'course',
            sectionId: Number(sectionId) || null,
        };
    }

    const sectionRequired = Boolean(sectionSettings?.certificate);
    const sectionMode = sectionRequired
        ? (sectionSettings?.autoCert ? 'auto' : 'manual')
        : 'none';
    return {
        required: sectionRequired,
        mode: sectionMode,
        source: 'section',
        sectionId: Number(sectionId) || null,
    };
}

function getProgressStatusRank(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'completed') return 4;
    if (normalized === 'in_progress') return 3;
    if (normalized === 'not_started') return 2;
    if (normalized === 'failed') return 1;
    return 0;
}

function toValidSectionId(value) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    return numeric;
}

function resolveEnrollmentSectionId({
    explicitSectionId = null,
    learningProgressRows = [],
    availableSections = [],
    preferProgressRows = false,
} = {}) {
    const sectionIds = new Set(
        (Array.isArray(availableSections) ? availableSections : [])
            .map((section) => toValidSectionId(section?.id))
            .filter(Boolean)
    );

    const normalizedProgressRows = (Array.isArray(learningProgressRows) ? learningProgressRows : [])
        .map((row) => ({
            sectionId: toValidSectionId(row?.sectionId),
            rank: getProgressStatusRank(row?.status),
            progress: Number.isFinite(Number(row?.progressPercent)) ? Number(row.progressPercent) : 0,
            id: Number.isFinite(Number(row?.id)) ? Number(row.id) : 0,
        }))
        .filter((row) => row.sectionId && (sectionIds.size === 0 || sectionIds.has(row.sectionId)))
        .sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            if (b.progress !== a.progress) return b.progress - a.progress;
            return b.id - a.id;
        });

    if (preferProgressRows && normalizedProgressRows.length > 0) {
        return normalizedProgressRows[0].sectionId;
    }

    const directSectionId = toValidSectionId(explicitSectionId);
    if (directSectionId && (sectionIds.size === 0 || sectionIds.has(directSectionId))) {
        return directSectionId;
    }

    if (normalizedProgressRows.length > 0) {
        return normalizedProgressRows[0].sectionId;
    }

    const activeSection = (Array.isArray(availableSections) ? availableSections : []).find((section) => section?.isActive);
    const activeSectionId = toValidSectionId(activeSection?.id);
    if (activeSectionId) return activeSectionId;

    const firstSectionId = toValidSectionId((Array.isArray(availableSections) ? availableSections : [])[0]?.id);
    return firstSectionId || null;
}

export {
    normalizeCertificateMode,
    resolveEffectiveCertificateConfig,
    resolveEnrollmentSectionId,
};
