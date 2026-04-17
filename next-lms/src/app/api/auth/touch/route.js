import { NextResponse } from 'next/server';
import {
    createSessionToken,
    getCandidateCookieDomains,
    getLogoutMarkerCookieOptions,
    getSessionCookieOptions,
    LOGOUT_MARKER_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    SESSION_NON_REMEMBER_TTL_SECONDS,
    SESSION_TTL_SECONDS,
    verifySessionToken,
} from '@/lib/session';
import { triggerEnrollmentExpiryReminderSweep } from '@/lib/server/enrollment-email-reminders';

function clearSessionCookie(response, request) {
    const base = {
        ...getSessionCookieOptions(0),
        maxAge: 0,
        expires: new Date(0),
    };

    response.cookies.set(SESSION_COOKIE_NAME, '', {
        ...base,
        domain: undefined,
    });

    const domains = getCandidateCookieDomains(request);
    for (const domain of domains) {
        response.cookies.set(SESSION_COOKIE_NAME, '', {
            ...base,
            domain,
        });
    }
}

function clearLogoutMarkerCookie(response, request) {
    const base = {
        ...getLogoutMarkerCookieOptions(0),
        maxAge: 0,
        expires: new Date(0),
    };

    response.cookies.set(LOGOUT_MARKER_COOKIE_NAME, '', {
        ...base,
        domain: undefined,
    });

    const domains = getCandidateCookieDomains(request);
    for (const domain of domains) {
        response.cookies.set(LOGOUT_MARKER_COOKIE_NAME, '', {
            ...base,
            domain,
        });
    }
}

export async function POST(request) {
    try {
        const isLoggedOut = request.cookies.get(LOGOUT_MARKER_COOKIE_NAME)?.value === '1';
        if (isLoggedOut) {
            const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            clearSessionCookie(response, request);
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
                role: payload.role || 'learner',
                rm: shouldRemember ? 1 : 0,
            },
            { ttlSeconds }
        );

        const response = NextResponse.json({ success: true });
        clearLogoutMarkerCookie(response, request);
        response.cookies.set(
            SESSION_COOKIE_NAME,
            refreshedToken,
            shouldRemember ? getSessionCookieOptions(ttlSeconds) : getSessionCookieOptions(null)
        );

        // Trigger a throttled background-like sweep for "course expires in 3 days" reminder emails.
        // The sweep is best-effort and should never block session refresh success.
        triggerEnrollmentExpiryReminderSweep().catch((sweepErr) => {
            console.error('[auth/touch] enrollment reminder sweep failed', sweepErr);
        });

        return response;
    } catch (err) {
        console.error('[auth/touch] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
