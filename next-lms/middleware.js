import { NextResponse } from 'next/server';
import {
    LOGOUT_MARKER_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    verifySessionToken,
} from './src/lib/session';
import { takeRateLimitToken } from './src/lib/server/rate-limit';

const AUTH_PAGES = ['/login', '/register'];
const PUBLIC_API_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/seed',
    '/api/auth/logout',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/contact',
    '/api/newsletter/subscribe',
]);
const USER_PROTECTED_PREFIXES = [
    '/dashboard',
    '/my-learning',
    '/my-courses',
    '/my-notes',
    '/training-results',
    '/profile',
    '/learner-dashboard',
    '/courses',
];
const ADMIN_PREFIX = '/admin-dashboard';
const API_ADMIN_PREFIX = '/api/admin';

const API_RATE_LIMIT_AUTH = {
    windowMs: 10 * 60 * 1000,
    maxAttempts: 30,
};

function getRequestIp(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
    return 'unknown';
}

function jsonError(status, message, extraHeaders = {}) {
    const response = NextResponse.json({ error: message }, { status });
    for (const [name, value] of Object.entries(extraHeaders)) {
        response.headers.set(name, String(value));
    }
    return response;
}

function getApiRateLimitConfig(pathname) {
    if (
        pathname === '/api/auth/login'
        || pathname === '/api/auth/register'
        || pathname === '/api/auth/seed'
        || pathname === '/api/auth/forgot-password'
        || pathname === '/api/auth/reset-password'
    ) {
        return API_RATE_LIMIT_AUTH;
    }
    return null;
}

function isProtectedUserPath(pathname) {
    return USER_PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function loginRedirect(request) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search || ''}`;
    url.searchParams.set('next', nextPath);
    return NextResponse.redirect(url);
}

function dashboardByRole(role) {
    return role === 'admin' ? '/admin-dashboard' : '/dashboard';
}

function noStoreResponse() {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
}

function resolveLegacyPhpRoute(request) {
    if (request.nextUrl.pathname !== '/index.php') return null;

    const rawRoute = String(request.nextUrl.searchParams.get('route') || '').trim();
    if (!rawRoute) return '/';

    const normalizedKey = rawRoute
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/*/, '')
        .replace(/\?.*$/, '')
        .toLowerCase();

    const legacyAliases = new Map([
        ['login', '/login'],
        ['auth/login', '/login'],
        ['user/login', '/login'],
        ['signin', '/login'],
        ['sign-in', '/login'],
        ['register', '/register'],
        ['signup', '/register'],
        ['sign-up', '/register'],
        ['dashboard', '/dashboard'],
        ['admin', '/admin-dashboard'],
        ['admin/dashboard', '/admin-dashboard'],
        ['courses', '/courses'],
        ['my-learning', '/my-learning'],
    ]);

    if (legacyAliases.has(normalizedKey)) {
        return legacyAliases.get(normalizedKey) || '/';
    }

    try {
        // Normalize both absolute and relative route values safely to same-origin path.
        const parsed = new URL(rawRoute, request.nextUrl.origin);
        const normalizedPath = String(parsed.pathname || '/').startsWith('/')
            ? String(parsed.pathname || '/')
            : `/${String(parsed.pathname || '/').replace(/^\/+/, '')}`;
        const query = parsed.searchParams.toString();
        return query ? `${normalizedPath}?${query}` : normalizedPath;
    } catch {
        const normalized = rawRoute.startsWith('/') ? rawRoute : `/${rawRoute}`;
        return normalized || '/';
    }
}

export async function middleware(request) {
    const { pathname } = request.nextUrl;
    const isApiRequest = pathname === '/api' || pathname.startsWith('/api/');

    const legacyRoute = resolveLegacyPhpRoute(request);
    if (legacyRoute !== null) {
        const destination = request.nextUrl.clone();
        const [legacyPath = '/', legacyQuery = ''] = String(legacyRoute).split('?');
        destination.pathname = legacyPath || '/';

        const mergedQuery = new URLSearchParams(request.nextUrl.searchParams);
        mergedQuery.delete('route');
        if (legacyQuery) {
            const legacyParams = new URLSearchParams(legacyQuery);
            for (const [key, value] of legacyParams.entries()) {
                if (!mergedQuery.has(key)) {
                    mergedQuery.set(key, value);
                }
            }
        }
        destination.search = mergedQuery.toString() ? `?${mergedQuery.toString()}` : '';
        return NextResponse.redirect(destination, 307);
    }

    const logoutMarker = request.cookies.get(LOGOUT_MARKER_COOKIE_NAME)?.value === '1';
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = (!logoutMarker && token) ? await verifySessionToken(token) : null;
    const isAuthenticated = Boolean(session);
    const isAdmin = session?.role === 'admin';

    if (isApiRequest) {
        if (request.method !== 'OPTIONS') {
            const rateConfig = getApiRateLimitConfig(pathname);
            if (rateConfig) {
                const ip = getRequestIp(request);
                const rate = takeRateLimitToken({
                    key: `api:${pathname}:${ip}`,
                    windowMs: rateConfig.windowMs,
                    maxAttempts: rateConfig.maxAttempts,
                });
                if (!rate.allowed) {
                    return jsonError(429, 'Too many requests', { 'Retry-After': rate.retryAfterSeconds });
                }
            }
        }

        const isPublicApi = PUBLIC_API_PATHS.has(pathname);
        if (!isPublicApi && !isAuthenticated) {
            return jsonError(401, 'Unauthorized');
        }
        if (pathname.startsWith(API_ADMIN_PREFIX) && !isAdmin) {
            return jsonError(403, 'Forbidden');
        }

        return NextResponse.next();
    }

    if (AUTH_PAGES.includes(pathname) && isAuthenticated) {
        // Keep login/register accessible when:
        // 1) a `next` target is present (avoid stale-session redirect loops), or
        // 2) `force=1` is present (manual QA/debug to re-open auth form).
        // 3) `loggedOut=1` is present (allow post-logout landing page).
        const forceAuthPage = request.nextUrl.searchParams.get('force') === '1';
        const isLoggedOutLanding = request.nextUrl.searchParams.get('loggedOut') === '1';
        if (request.nextUrl.searchParams.has('next') || forceAuthPage || isLoggedOutLanding) {
            return noStoreResponse();
        }
        const url = request.nextUrl.clone();
        url.pathname = dashboardByRole(session.role);
        url.search = '';
        return NextResponse.redirect(url);
    }

    if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
        if (!isAuthenticated) {
            return loginRedirect(request);
        }
        if (!isAdmin) {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            url.search = '';
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    if (isProtectedUserPath(pathname) && !isAuthenticated) {
        return loginRedirect(request);
    }

    if (AUTH_PAGES.includes(pathname)) {
        return noStoreResponse();
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/api/:path*',
        '/login',
        '/register',
        '/dashboard',
        '/dashboard/:path*',
        '/my-learning',
        '/my-learning/:path*',
        '/my-courses',
        '/my-courses/:path*',
        '/my-notes',
        '/my-notes/:path*',
        '/training-results',
        '/training-results/:path*',
        '/profile',
        '/profile/:path*',
        '/learner-dashboard',
        '/learner-dashboard/:path*',
        '/courses',
        '/courses/:path*',
        '/index.php',
        '/admin-dashboard',
        '/admin-dashboard/:path*',
    ],
};
