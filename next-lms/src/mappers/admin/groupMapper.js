export function normalizeGroupModel(group, index = 0) {
    return {
        id: Number(group?.id) || Date.now() + index,
        code: String(group?.code || group?.name || '').trim(),
        name: String(group?.name || '').trim(),
        description: String(group?.description || '').trim(),
        roleCode: String(group?.roleCode || 'LEARNER').trim().toUpperCase(),
        isActive: Boolean(group?.isActive),
        isSystemDefault: Boolean(group?.isSystemDefault),
        roles: Array.isArray(group?.roles) ? group.roles.map((item) => String(item).trim()).filter(Boolean) : [],
        memberCount: Number(group?.memberCount || 0),
        lastUpdatedAt: String(group?.lastUpdatedAt || new Date().toISOString()),
    };
}

export function toGroupFormValues(group) {
    return {
        code: String(group?.code || '').trim(),
        name: String(group?.name || '').trim(),
        description: String(group?.description || '').trim(),
        roleCode: String(group?.roleCode || 'LEARNER').trim().toUpperCase(),
        isActive: Boolean(group?.isActive),
        roles: Array.isArray(group?.roles) ? group.roles : [],
    };
}

export function toCreateGroupPayload(form) {
    return {
        id: Date.now(),
        code: String(form?.code || form?.name || '').trim().toUpperCase(),
        name: String(form?.name || '').trim(),
        description: String(form?.description || '').trim(),
        roleCode: String(form?.roleCode || 'LEARNER').trim().toUpperCase(),
        isActive: Boolean(form?.isActive),
        roles: Array.isArray(form?.roles) ? form.roles : [],
        memberCount: 0,
        lastUpdatedAt: new Date().toISOString(),
    };
}

export function toUpdateGroupPayload(form, currentGroup) {
    return {
        ...currentGroup,
        code: String(form?.code || form?.name || '').trim().toUpperCase(),
        name: String(form?.name || '').trim(),
        description: String(form?.description || '').trim(),
        roleCode: String(form?.roleCode || 'LEARNER').trim().toUpperCase(),
        isActive: Boolean(form?.isActive),
        roles: Array.isArray(form?.roles) ? form.roles : [],
        lastUpdatedAt: new Date().toISOString(),
    };
}
