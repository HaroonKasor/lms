const USER_STORAGE_KEY = 'lms_user';
const REMEMBER_ME_KEY = 'lms_remember_me';
const CHAT_SESSION_KEY = 'lms_chat_session_id';

function createSessionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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
        localStorage.removeItem(CHAT_SESSION_KEY);
        sessionStorage.removeItem(CHAT_SESSION_KEY);
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

/**
 * Start a fresh chatbot session for a successful login.
 * Uses the same storage tier as saveUser(remember) so it follows auth lifespan.
 */
export function beginChatSession(options = {}) {
    if (typeof window === 'undefined') return '';
    const remember = Boolean(options.remember);
    const nextSessionId = createSessionId();
    try {
        if (remember) {
            localStorage.setItem(CHAT_SESSION_KEY, nextSessionId);
            sessionStorage.removeItem(CHAT_SESSION_KEY);
        } else {
            sessionStorage.setItem(CHAT_SESSION_KEY, nextSessionId);
            localStorage.removeItem(CHAT_SESSION_KEY);
        }
    } catch {
        // ignore storage errors
    }
    return nextSessionId;
}

/**
 * Get chatbot session id bound to current login lifecycle.
 * Priority: sessionStorage -> localStorage
 */
export function getChatSessionId() {
    if (typeof window === 'undefined') return '';
    try {
        const sessionValue = sessionStorage.getItem(CHAT_SESSION_KEY);
        if (sessionValue) return String(sessionValue || '');
        const localValue = localStorage.getItem(CHAT_SESSION_KEY);
        return String(localValue || '');
    } catch {
        return '';
    }
}
