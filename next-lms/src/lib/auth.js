const USER_STORAGE_KEY = 'lms_user';
const REMEMBER_ME_KEY = 'lms_remember_me';

/**
 * Persist user session in browser storage.
 * remember=true  -> localStorage (survives browser restart)
 * remember=false -> sessionStorage (ends when browser/tab session ends)
 */
export function saveUser(user, options = {}) {
    if (typeof window === 'undefined') return;
    const remember = Boolean(options.remember);
    const raw = JSON.stringify(user || null);

    try {
        if (remember) {
            localStorage.setItem(USER_STORAGE_KEY, raw);
            sessionStorage.removeItem(USER_STORAGE_KEY);
        } else {
            sessionStorage.setItem(USER_STORAGE_KEY, raw);
            localStorage.removeItem(USER_STORAGE_KEY);
        }
    } catch {
        // ignore storage errors
    }
}

export function clearUser() {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(USER_STORAGE_KEY);
        sessionStorage.removeItem(USER_STORAGE_KEY);
    } catch {
        // ignore storage errors
    }
}

/**
 * Get the current logged-in user from storage.
 * Priority: sessionStorage -> localStorage
 */
export function getUser() {
    if (typeof window === 'undefined') return null;
    try {
        const sessionValue = sessionStorage.getItem(USER_STORAGE_KEY);
        if (sessionValue) return JSON.parse(sessionValue);

        const localValue = localStorage.getItem(USER_STORAGE_KEY);
        return localValue ? JSON.parse(localValue) : null;
    } catch {
        return null;
    }
}

export function getRememberMePreference(defaultValue = false) {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const raw = localStorage.getItem(REMEMBER_ME_KEY);
        if (raw === null) return defaultValue;
        return raw === '1';
    } catch {
        return defaultValue;
    }
}

export function setRememberMePreference(remember) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(REMEMBER_ME_KEY, remember ? '1' : '0');
    } catch {
        // ignore storage errors
    }
}

/**
 * Get the current user's ID (username) for API calls.
 * Returns empty string if not logged in.
 */
export function getUserId() {
    const user = getUser();
    return user?.username || '';
}
