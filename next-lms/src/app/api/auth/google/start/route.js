import { NextResponse } from 'next/server';
import { createSessionToken, getSessionCookieOptions } from '@/lib/session';

const OAUTH_STATE_COOKIE = 'lms_oauth_google_state';
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

function normalizeNextPath(rawNext) {
    const value = String(rawNext || '').trim();
    if (!value) return '';
    if (!value.startsWith('/')) return '';
    if (value.startsWith('//')) return '';
    return value;
}

function getAppOrigin(request) {
    const envOrigin = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim();
    if (envOrigin) {
        try {
            return new URL(envOrigin).origin;
        } catch {
            // ignore invalid env origin
        }
    }
    return request?.nextUrl?.origin || new URL(request.url).origin;
}

function createNonce() {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    return `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * GET /api/auth/google/start?next=/dashboard&rm=1
 */
export async function GET(request) {
    try {
        const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
        const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
        if (!clientId || !clientSecret) {
            const dest = new URL('/login', getAppOrigin(request));
            dest.searchParams.set('error', 'google_not_configured');
            return NextResponse.redirect(dest.toString());
        }

        const url = new URL(request.url);
        const next = normalizeNextPath(url.searchParams.get('next')) || '';
        const rememberMe = url.searchParams.get('rm') === '1';
        const nonce = createNonce();
        const origin = getAppOrigin(request);
        const redirectUri = new URL('/api/auth/google/callback', origin).toString();

        const stateToken = await createSessionToken(
            {
                typ: 'oauth-google',
                nonce,
                next,
                rm: rememberMe ? 1 : 0,
            },
            { ttlSeconds: OAUTH_STATE_TTL_SECONDS }
        );

        const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authorizeUrl.searchParams.set('client_id', clientId);
        authorizeUrl.searchParams.set('redirect_uri', redirectUri);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('scope', 'openid email profile');
        authorizeUrl.searchParams.set('state', nonce);
        authorizeUrl.searchParams.set('prompt', 'select_account');

        const response = NextResponse.redirect(authorizeUrl.toString());
        response.cookies.set(OAUTH_STATE_COOKIE, stateToken, getSessionCookieOptions(OAUTH_STATE_TTL_SECONDS));
        return response;
    } catch (err) {
        console.error('[auth/google/start] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
