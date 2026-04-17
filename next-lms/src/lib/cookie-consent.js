export const COOKIE_CONSENT_COOKIE_NAME = 'skillup_cookie_consent';
export const COOKIE_CONSENT_STORAGE_KEY = 'skillup_cookie_consent';
export const COOKIE_CONSENT_ID_STORAGE_KEY = 'skillup_cookie_consent_id';
export const COOKIE_CONSENT_SCHEMA_VERSION = 1;
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days
export const COOKIE_CONSENT_DEFAULT_POLICY_VERSION = '2026-04-16';

export function resolveCookiePolicyVersion() {
    const raw = String(
        process.env.COOKIE_POLICY_VERSION
        || process.env.NEXT_PUBLIC_COOKIE_POLICY_VERSION
        || COOKIE_CONSENT_DEFAULT_POLICY_VERSION
    ).trim();
    return raw || COOKIE_CONSENT_DEFAULT_POLICY_VERSION;
}

export function normalizeConsentChoice(choice) {
    const normalized = String(choice || '').trim().toLowerCase();
    if (normalized === 'all' || normalized === 'essential' || normalized === 'custom') {
        return normalized;
    }
    return 'essential';
}

export function normalizeConsentCategories(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    return {
        necessary: true,
        analytics: Boolean(source.analytics),
        marketing: Boolean(source.marketing),
    };
}

