function parseBool(value, fallback = false) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return fallback;
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function parseNameList(value) {
    return new Set(
        String(value || '')
            .split(/[,\n;]+/g)
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean)
    );
}

function parseUserIdSet(value) {
    const out = new Set();
    for (const token of String(value || '').split(/[,\n;]+/g)) {
        const n = Number(String(token || '').trim());
        if (Number.isInteger(n) && n > 0) out.add(n);
    }
    return out;
}

export function canAccessAdminAudit(session) {
    if (!session?.isAdmin) return false;

    const allowedNames = parseNameList(process.env.AUDIT_LOG_ALLOWED_USERS || '');
    const allowedUserIds = parseUserIdSet(process.env.AUDIT_LOG_ALLOWED_USER_IDS || '');

    if (allowedNames.size === 0 && allowedUserIds.size === 0) {
        return true;
    }

    const uid = Number(session?.uid || 0);
    const username = String(session?.user?.username || '').trim().toLowerCase();
    const email = String(session?.user?.email || '').trim().toLowerCase();

    if (allowedUserIds.size > 0 && allowedUserIds.has(uid)) return true;
    if (allowedNames.size > 0 && (allowedNames.has(username) || allowedNames.has(email))) return true;
    return false;
}

export function shouldShowAdminAuditInMenu(session) {
    if (!canAccessAdminAudit(session)) return false;
    return parseBool(process.env.AUDIT_LOG_SHOW_IN_MENU, false);
}

