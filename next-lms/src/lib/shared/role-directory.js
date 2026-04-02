export const ENTERPRISE_ROLE_CODES = Object.freeze({
    ADMIN: 'ADMIN',
    INSTRUCTOR: 'INSTRUCTOR',
    LEARNER: 'LEARNER',
});

export const GROUP_ROLE_OPTIONS = Object.freeze([
    {
        code: ENTERPRISE_ROLE_CODES.ADMIN,
        groupCode: 'ADMINISTRATOR',
        label: 'Administrator',
        uiRole: 'admin',
    },
    {
        code: ENTERPRISE_ROLE_CODES.INSTRUCTOR,
        groupCode: 'INSTRUCTOR',
        label: 'Instructor',
        uiRole: 'instructor',
    },
    {
        code: ENTERPRISE_ROLE_CODES.LEARNER,
        groupCode: 'LEARNER',
        label: 'Learner',
        uiRole: 'learner',
    },
]);

const ROLE_OPTION_BY_CODE = Object.freeze(
    GROUP_ROLE_OPTIONS.reduce((acc, option) => {
        acc[option.code] = option;
        return acc;
    }, {})
);

export function normalizeEnterpriseRoleCode(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return ENTERPRISE_ROLE_CODES.LEARNER;
    if (normalized === 'ADMIN' || normalized === 'ADMINISTRATOR') return ENTERPRISE_ROLE_CODES.ADMIN;
    if (normalized === 'INSTRUCTOR' || normalized === 'INSTRUCTURE' || normalized === 'TEACHER') return ENTERPRISE_ROLE_CODES.INSTRUCTOR;
    if (normalized === 'LEARNER' || normalized === 'USER' || normalized === 'STUDENT') return ENTERPRISE_ROLE_CODES.LEARNER;
    return ENTERPRISE_ROLE_CODES.LEARNER;
}

export function getRoleOptionByEnterpriseRoleCode(roleCode) {
    const normalized = normalizeEnterpriseRoleCode(roleCode);
    return ROLE_OPTION_BY_CODE[normalized] || ROLE_OPTION_BY_CODE.LEARNER;
}

export function defaultGroupCodeFromEnterpriseRoleCode(roleCode) {
    return getRoleOptionByEnterpriseRoleCode(roleCode)?.groupCode || 'LEARNER';
}

export function toUiRoleFromEnterpriseRoleCode(roleCode) {
    const normalized = normalizeEnterpriseRoleCode(roleCode);
    if (normalized === ENTERPRISE_ROLE_CODES.ADMIN) return 'admin';
    if (normalized === ENTERPRISE_ROLE_CODES.INSTRUCTOR) return 'instructor';
    return 'learner';
}

export function roleLabelFromEnterpriseRoleCode(roleCode) {
    const normalized = normalizeEnterpriseRoleCode(roleCode);
    if (normalized === ENTERPRISE_ROLE_CODES.ADMIN) return 'Administrator';
    if (normalized === ENTERPRISE_ROLE_CODES.INSTRUCTOR) return 'Instructor';
    return 'Learner';
}

export function inferEnterpriseRoleCodeFromGroup(group = {}) {
    const direct = String(group?.roleCode || '').trim();
    if (direct) return normalizeEnterpriseRoleCode(direct);

    const code = String(group?.code || '').trim().toUpperCase();
    const name = String(group?.name || '').trim().toUpperCase();
    const values = []
        .concat(Array.isArray(group?.roles) ? group.roles : [])
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean);

    if (
        code.includes('ADMIN')
        || name.includes('ADMIN')
        || values.some((item) => item.includes('ADMIN'))
    ) {
        return ENTERPRISE_ROLE_CODES.ADMIN;
    }

    if (
        code.includes('INSTRUCTOR')
        || code.includes('INSTRUCTURE')
        || name.includes('INSTRUCTOR')
        || name.includes('INSTRUCTURE')
        || values.some((item) => item.includes('INSTRUCTOR') || item.includes('INSTRUCTURE'))
    ) {
        return ENTERPRISE_ROLE_CODES.INSTRUCTOR;
    }

    return ENTERPRISE_ROLE_CODES.LEARNER;
}
