const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_SESSION_SECRET = 'change-this-session-secret';

export const SESSION_COOKIE_NAME = 'lms_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const SESSION_NON_REMEMBER_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function parsePositiveInt(raw, fallback) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.floor(value);
}

export const SESSION_IDLE_TIMEOUT_SECONDS = parsePositiveInt(
    process.env.SESSION_IDLE_TIMEOUT_SECONDS,
    60 * 90 // 1h30m
);

function toBase64UrlFromBytes(bytes) {
    let base64;
    if (typeof btoa === 'function') {
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
            binary += String.fromCharCode(bytes[i]);
        }
        base64 = btoa(binary);
    } else {
        base64 = Buffer.from(bytes).toString('base64');
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64UrlToBytes(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    if (typeof atob === 'function') {
        const binary = atob(base64 + padding);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    return new Uint8Array(Buffer.from(base64 + padding, 'base64'));
}

function toBase64UrlFromString(value) {
    return toBase64UrlFromBytes(encoder.encode(value));
}

function fromBase64UrlToString(value) {
    return decoder.decode(fromBase64UrlToBytes(value));
}

function secureEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i += 1) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}

async function sign(value, secret) {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
    return toBase64UrlFromBytes(new Uint8Array(sig));
}

export function getSessionSecret() {
    const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || DEFAULT_SESSION_SECRET;
    const isWeakDefault = !secret || secret === DEFAULT_SESSION_SECRET || String(secret).length < 32;
    if (process.env.NODE_ENV === 'production' && isWeakDefault) {
        throw new Error('SESSION_SECRET is missing or too weak in production');
    }
    return secret;
}

function shouldUseSecureCookie() {
    const explicit = String(process.env.SESSION_COOKIE_SECURE || '').trim().toLowerCase();
    if (explicit === 'true' || explicit === '1') return true;
    if (explicit === 'false' || explicit === '0') return false;

    if (process.env.NODE_ENV !== 'production') return false;
    const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim();
    if (/^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(appUrl)) {
        return false;
    }
    return true;
}

export function getSessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
    const options = {
        httpOnly: true,
        sameSite: 'lax',
        secure: shouldUseSecureCookie(),
        path: '/',
    };
    if (Number.isFinite(maxAge) && maxAge >= 0) {
        options.maxAge = maxAge;
    }
    return options;
}

export async function createSessionToken(payload, options = {}) {
    const secret = options.secret || getSessionSecret();
    const now = Math.floor(Date.now() / 1000);
    const issuedAt = Number.isFinite(options.issuedAt) ? Math.floor(options.issuedAt) : now;
    const ttlSeconds = Number.isFinite(options.ttlSeconds) ? Math.floor(options.ttlSeconds) : SESSION_TTL_SECONDS;
    const expiresAt = Number.isFinite(options.expiresAt) ? Math.floor(options.expiresAt) : issuedAt + ttlSeconds;
    const payloadLastActivity = Number(payload?.la);
    const lastActivityAt = Number.isFinite(options.lastActivityAt)
        ? Math.floor(options.lastActivityAt)
        : (Number.isFinite(payloadLastActivity) ? Math.floor(payloadLastActivity) : issuedAt);
    const body = {
        ...payload,
        iat: issuedAt,
        la: lastActivityAt,
        exp: expiresAt,
    };
    const encodedPayload = toBase64UrlFromString(JSON.stringify(body));
    const signature = await sign(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token, options = {}) {
    if (!token || typeof token !== 'string') return null;
    const secret = options.secret || getSessionSecret();
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expectedSignature = await sign(encodedPayload, secret);
    if (!secureEqual(expectedSignature, signature)) return null;

    try {
        const payload = JSON.parse(fromBase64UrlToString(encodedPayload));
        const now = Math.floor(Date.now() / 1000);
        if (!payload?.exp || payload.exp < now) return null;
        const uid = Number(payload?.uid || 0);
        const isUserSessionToken = Number.isInteger(uid) && uid > 0;
        if (isUserSessionToken) {
            const lastActivityAt = Number(payload?.la || payload?.iat || 0);
            if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return null;
            if (lastActivityAt + SESSION_IDLE_TIMEOUT_SECONDS < now) return null;
        }
        return payload;
    } catch {
        return null;
    }
}
