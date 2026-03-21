import { NextResponse } from 'next/server';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/session';

function getCandidateCookieDomains(request) {
    const host = String(request?.headers?.get('host') || '')
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, '');
    if (!host) return [];
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return [];
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return [];

    const labels = host.split('.').filter(Boolean);
    const rootDomain = labels.length >= 2 ? labels.slice(-2).join('.') : host;
    const values = [host, `.${host}`];
    if (rootDomain && rootDomain !== host) {
        values.push(rootDomain, `.${rootDomain}`);
    }
    return Array.from(new Set(values));
}

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

async function handleLogout(request) {
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response, request);
    return response;
}

export async function POST(request) {
    return handleLogout(request);
}

// Support old clients/links that call GET /api/auth/logout
export async function GET(request) {
    return handleLogout(request);
}
