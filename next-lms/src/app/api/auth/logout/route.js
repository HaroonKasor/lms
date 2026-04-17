import { NextResponse } from 'next/server';
import {
    getCandidateCookieDomains,
    getLogoutMarkerCookieOptions,
    getSessionCookieOptions,
    LOGOUT_MARKER_COOKIE_NAME,
    LOGOUT_MARKER_TTL_SECONDS,
    SESSION_COOKIE_NAME,
} from '@/lib/session';

function clearSessionCookie(response, request) {
    const base = {
        ...getSessionCookieOptions(0),
        maxAge: 0,
        expires: new Date(0),
        value: '',
    };

    // Host-only cookie clear
    response.cookies.set(SESSION_COOKIE_NAME, '', {
        ...base,
        domain: undefined,
    });

    // Domain-scoped cookie clear (for legacy/proxy setups)
    const domains = getCandidateCookieDomains(request);
    for (const domain of domains) {
        response.cookies.set(SESSION_COOKIE_NAME, '', {
            ...base,
            domain,
        });
    }
}

function setLogoutMarkerCookie(response, request) {
    const base = {
        ...getLogoutMarkerCookieOptions(LOGOUT_MARKER_TTL_SECONDS),
    };

    response.cookies.set(LOGOUT_MARKER_COOKIE_NAME, '1', {
        ...base,
        domain: undefined,
    });

    const domains = getCandidateCookieDomains(request);
    for (const domain of domains) {
        response.cookies.set(LOGOUT_MARKER_COOKIE_NAME, '1', {
            ...base,
            domain,
        });
    }
}

async function handleLogout(request) {
    const response = NextResponse.json({ success: true });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    clearSessionCookie(response, request);
    setLogoutMarkerCookie(response, request);
    return response;
}

export async function POST(request) {
    return handleLogout(request);
}

// Support old clients/links that call GET /api/auth/logout
export async function GET(request) {
    return handleLogout(request);
}
