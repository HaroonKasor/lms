import { NextResponse } from 'next/server';
import {
    createSessionToken,
    getLogoutMarkerCookieOptions,
    getSessionCookieOptions,
    LOGOUT_MARKER_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    SESSION_NON_REMEMBER_TTL_SECONDS,
    SESSION_TTL_SECONDS,
    verifySessionToken,
} from '@/lib/session';

function clearSessionCookie(response) {
    response.cookies.set(SESSION_COOKIE_NAME, '', {
        ...getSessionCookieOptions(0),
        maxAge: 0,
        expires: new Date(0),
    });
}

export async function POST(request) {
    try {
        const isLoggedOut = request.cookies.get(LOGOUT_MARKER_COOKIE_NAME)?.value === '1';
        if (isLoggedOut) {
            const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            clearSessionCookie(response);
            return response;
        }

        const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
        const payload = await verifySessionToken(token);
        if (!payload?.uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const shouldRemember = Boolean(payload?.rm);
        const ttlSeconds = shouldRemember ? SESSION_TTL_SECONDS : SESSION_NON_REMEMBER_TTL_SECONDS;
        const refreshedToken = await createSessionToken(
            {
                uid: payload.uid,
                role: payload.role || 'user',
                rm: shouldRemember ? 1 : 0,
            },
            { ttlSeconds }
        );

        const response = NextResponse.json({ success: true });
        response.cookies.set(LOGOUT_MARKER_COOKIE_NAME, '', {
            ...getLogoutMarkerCookieOptions(0),
            maxAge: 0,
            expires: new Date(0),
        });
        response.cookies.set(
            SESSION_COOKIE_NAME,
            refreshedToken,
            shouldRemember ? getSessionCookieOptions(ttlSeconds) : getSessionCookieOptions(null)
        );
        return response;
    } catch (err) {
        console.error('[auth/touch] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
