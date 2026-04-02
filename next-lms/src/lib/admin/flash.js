const ADMIN_FLASH_KEY = 'lt-admin-flash';

export function setAdminFlash(payload) {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(ADMIN_FLASH_KEY, JSON.stringify(payload));
    } catch {
        // ignore storage issues
    }
}

export function consumeAdminFlash() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(ADMIN_FLASH_KEY);
        if (!raw) return null;
        window.sessionStorage.removeItem(ADMIN_FLASH_KEY);
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
