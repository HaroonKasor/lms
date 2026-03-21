import { NextResponse } from 'next/server';
import {
    createSessionToken,
    getSessionCookieOptions,
    SESSION_COOKIE_NAME,
    SESSION_NON_REMEMBER_TTL_SECONDS,
    SESSION_TTL_SECONDS,
    verifySessionToken,
} from '@/lib/session';

export async function POST(request) {
    try {
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
