function inferRoleFromGroups(groups = []) {
    const normalized = Array.isArray(groups)
        ? groups.map((item) => String(item || '').trim().toUpperCase())
        : [];

    if (normalized.some((item) => item === 'ADMINISTRATOR' || item === 'ADMIN' || item.includes('ADMIN'))) return 'admin';
    if (normalized.some((item) => item === 'INSTRUCTOR' || item.includes('INSTRUCTOR'))) return 'instructor';
    return 'learner';
}

function normalizeUiRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'admin' || normalized === 'instructor' || normalized === 'learner') return normalized;
    // Backward compatibility for legacy value.
    if (normalized === 'user') return 'learner';
    return 'learner';
}

function normalizeGroups(groups = []) {
    if (!Array.isArray(groups)) return [];
    const unique = new Set();
    for (const group of groups) {
        const normalized = String(group || '').trim().toUpperCase();
        if (normalized) unique.add(normalized);
    }
    return Array.from(unique);
}

function normalizeUserStatus(status, fallbackActive = true) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'active' || normalized === 'inactive' || normalized === 'suspended' || normalized === 'pending') {
        return normalized;
    }
    return fallbackActive ? 'active' : 'inactive';
}

function normalizeAuthProviders(values = []) {
    if (!Array.isArray(values)) return [];
    const unique = new Set();
    for (const value of values) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized) unique.add(normalized);
    }
    return Array.from(unique);
}

export function mapUserRecord(user) {
    const status = normalizeUserStatus(user?.status, user?.isActive !== false);
    return {
        id: Number(user?.id) || 0,
        username: String(user?.username || '').trim(),
        email: String(user?.email || '').trim(),
        fullName: String(user?.fullName || '').trim(),
        phone: String(user?.phone || '').trim(),
        role: normalizeUiRole(user?.role),
        groups: normalizeGroups(user?.groups),
        authProviders: normalizeAuthProviders(user?.authProviders),
        status,
        isActive: status === 'active',
        avatar: String(user?.avatar || '').trim(),
        createdAt: String(user?.createdAt || '').trim(),
        updatedAt: String(user?.updatedAt || '').trim(),
    };
}

export function mapUserCollection(payload) {
    if (Array.isArray(payload)) return payload.map(mapUserRecord);
    if (Array.isArray(payload?.data)) return payload.data.map(mapUserRecord);
    if (Array.isArray(payload?.users)) return payload.users.map(mapUserRecord);
    return [];
}

export function toCreateUserPayload(form) {
    const status = normalizeUserStatus(form?.status, true);
    const role = normalizeUiRole(form?.role || inferRoleFromGroups(form?.selectedGroups));
    return {
        username: String(form?.username || '').trim(),
        email: String(form?.email || '').trim(),
        password: String(form?.password || ''),
        fullName: String(form?.fullName || '').trim(),
        phone: String(form?.phoneNumber || form?.phone || '').trim(),
        selectedGroups: normalizeGroups(form?.selectedGroups),
        role,
        status,
        isActive: status === 'active',
    };
}

export function toUpdateUserPayload(form) {
    const status = normalizeUserStatus(form?.status, Boolean(form?.isActive));
    const payload = {
        username: String(form?.username || '').trim(),
        email: String(form?.email || '').trim(),
        fullName: String(form?.fullName || '').trim(),
        phone: String(form?.phone || '').trim(),
        role: normalizeUiRole(form?.role),
        avatar: String(form?.avatar || '').trim(),
        status,
        isActive: status === 'active',
    };
    if (Array.isArray(form?.selectedGroups)) {
        payload.selectedGroups = normalizeGroups(form.selectedGroups);
    }
    return payload;
}
