import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
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
import {
    ensureDefaultOrganization,
    ensureUserRole,
    getUserDisplayName,
    listUserRoleCodes,
    mapRoleCodesToSessionRole,
} from '@/lib/server/enterprise-context';
import { AUTH_PROVIDER_GOOGLE, upsertUserAuthIdentity } from '@/lib/server/user-auth-identities';

const OAUTH_STATE_COOKIE = 'lms_oauth_google_state';

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

function normalizeNextPath(rawNext) {
    const value = String(rawNext || '').trim();
    if (!value) return '';
    if (!value.startsWith('/')) return '';
    if (value.startsWith('//')) return '';
    return value;
}

function clearOAuthStateCookie(response, request) {
    const base = {
        ...getSessionCookieOptions(0),
        maxAge: 0,
        expires: new Date(0),
        path: '/',
    };

    response.cookies.set(OAUTH_STATE_COOKIE, '', { ...base, domain: undefined });
    const domains = getCandidateCookieDomains(request);
    for (const domain of domains) {
        response.cookies.set(OAUTH_STATE_COOKIE, '', { ...base, domain });
    }
}

function clearLogoutMarkerCookie(response, request) {
    const base = {
        ...getLogoutMarkerCookieOptions(0),
        maxAge: 0,
        expires: new Date(0),
    };

    response.cookies.set(LOGOUT_MARKER_COOKIE_NAME, '', { ...base, domain: undefined });
    const domains = getCandidateCookieDomains(request);
    for (const domain of domains) {
        response.cookies.set(LOGOUT_MARKER_COOKIE_NAME, '', { ...base, domain });
    }
}

function splitName(fullName) {
    const value = String(fullName || '').trim();
    if (!value) return { firstName: null, lastName: null };
    const parts = value.split(/\s+/);
    const firstName = parts.shift() || null;
    const lastName = parts.length ? parts.join(' ') : null;
    return { firstName, lastName };
}

function normalizeUsernameFromEmail(email) {
    const local = String(email || '').split('@')[0] || '';
    const base = local.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const trimmed = base.slice(0, 100);
    return trimmed || `user${Date.now()}`;
}

async function findAvailableUsername(tx, base) {
    const safeBase = String(base || '').slice(0, 90) || `user${Date.now()}`;
    for (let i = 0; i < 50; i += 1) {
        const suffix = i === 0 ? '' : `-${i}`;
        const candidate = `${safeBase}${suffix}`.slice(0, 100);
        const exists = await tx.user.findUnique({ where: { username: candidate } });
        if (!exists) return candidate;
    }
    return `user${Date.now()}`;
}

async function exchangeCodeForTokens({ code, redirectUri }) {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        return { error: 'Google OAuth is not configured' };
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }).toString(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { error: data?.error_description || data?.error || 'Failed to exchange code' };
    }

    return { tokens: data };
}

async function fetchGoogleUserInfo(accessToken) {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { error: data?.error_description || data?.error || 'Failed to fetch user info' };
    }
    return { userInfo: data };
}

/**
 * GET /api/auth/google/callback?code=...&state=...
 */
export async function GET(request) {
    try {
        const url = new URL(request.url);
        const error = url.searchParams.get('error');
        if (error) {
            const dest = new URL('/login', getAppOrigin(request));
            dest.searchParams.set('error', `google_${error}`);
            return NextResponse.redirect(dest.toString());
        }

        const code = String(url.searchParams.get('code') || '').trim();
        const state = String(url.searchParams.get('state') || '').trim();
        if (!code || !state) {
            const dest = new URL('/login', getAppOrigin(request));
            dest.searchParams.set('error', 'google_missing_code');
            return NextResponse.redirect(dest.toString());
        }

        const stateToken = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
        const payload = await verifySessionToken(stateToken);
        const expectedNonce = String(payload?.nonce || '');
        const rememberMe = Boolean(payload?.rm);
        const next = normalizeNextPath(payload?.next) || '';

        if (!payload || payload?.typ !== 'oauth-google' || !expectedNonce || expectedNonce !== state) {
            const dest = new URL('/login', getAppOrigin(request));
            dest.searchParams.set('error', 'google_invalid_state');
            return NextResponse.redirect(dest.toString());
        }

        const origin = getAppOrigin(request);
        const redirectUri = new URL('/api/auth/google/callback', origin).toString();
        const { tokens, error: tokenError } = await exchangeCodeForTokens({ code, redirectUri });
        if (tokenError || !tokens?.access_token) {
            const dest = new URL('/login', origin);
            dest.searchParams.set('error', 'google_token_exchange_failed');
            return NextResponse.redirect(dest.toString());
        }

        const { userInfo, error: userInfoError } = await fetchGoogleUserInfo(tokens.access_token);
        if (userInfoError || !userInfo?.email) {
            const dest = new URL('/login', origin);
            dest.searchParams.set('error', 'google_userinfo_failed');
            return NextResponse.redirect(dest.toString());
        }

        if (userInfo.email_verified === false) {
            const dest = new URL('/login', origin);
            dest.searchParams.set('error', 'google_email_unverified');
            return NextResponse.redirect(dest.toString());
        }

        const email = String(userInfo.email || '').trim().toLowerCase();
        const fullName = String(userInfo.name || '').trim();
        const pictureUrl = String(userInfo.picture || '').trim();
        const googleSub = String(userInfo.sub || '').trim();
        const { firstName, lastName } = splitName(fullName);

        const organizationId = await ensureDefaultOrganization();

        const user = await prisma.$transaction(async (tx) => {
            const existing = await tx.user.findFirst({
                where: { email },
                include: { profile: true },
            });

            if (existing) {
                if (!existing.profile?.avatarUrl && pictureUrl) {
                    await tx.userProfile.upsert({
                        where: { userId: existing.id },
                        update: { avatarUrl: pictureUrl.slice(0, 500) },
                        create: { userId: existing.id, avatarUrl: pictureUrl.slice(0, 500) },
                    });
                }
                await tx.user.update({
                    where: { id: existing.id },
                    data: { lastLoginAt: new Date() },
                });
                return existing;
            }

            const usernameBase = normalizeUsernameFromEmail(email);
            const username = await findAvailableUsername(tx, usernameBase);
            const randomPassword = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
            const passwordHash = await hashPassword(randomPassword);

            const created = await tx.user.create({
                data: {
                    username,
                    email,
                    passwordHash,
                    status: 'active',
                    lastLoginAt: new Date(),
                    profile: {
                        create: {
                            firstName,
                            lastName,
                            avatarUrl: pictureUrl ? pictureUrl.slice(0, 500) : null,
                        },
                    },
                },
                include: { profile: true },
            });

            await ensureUserRole(tx, {
                organizationId,
                userId: created.id,
                roleCode: 'LEARNER',
            });

            return created;
        });

        if (googleSub) {
            try {
                await upsertUserAuthIdentity({
                    userId: Number(user.id),
                    provider: AUTH_PROVIDER_GOOGLE,
                    providerUserId: googleSub,
                    emailAtLink: email,
                    lastLoginAt: new Date(),
                });
            } catch (identityErr) {
                console.error('[auth/google/callback] identity link failed', identityErr);
                const dest = new URL('/login', origin);
                dest.searchParams.set('error', 'google_identity_conflict');
                const response = NextResponse.redirect(dest.toString());
                clearOAuthStateCookie(response, request);
                return response;
            }
        }

        const roleCodes = await listUserRoleCodes(user.id, organizationId);
        const role = mapRoleCodesToSessionRole(roleCodes);

        const shouldRemember = Boolean(rememberMe);
        const ttlSeconds = shouldRemember ? SESSION_TTL_SECONDS : SESSION_NON_REMEMBER_TTL_SECONDS;
        const sessionToken = await createSessionToken(
            {
                uid: user.id,
                role,
                rm: shouldRemember ? 1 : 0,
            },
            { ttlSeconds }
        );

        const callbackUrl = new URL('/auth/callback', origin);
        if (next) callbackUrl.searchParams.set('next', next);
        callbackUrl.searchParams.set('rm', shouldRemember ? '1' : '0');

        const response = NextResponse.redirect(callbackUrl.toString());
        response.cookies.set(
            SESSION_COOKIE_NAME,
            sessionToken,
            shouldRemember ? getSessionCookieOptions(ttlSeconds) : getSessionCookieOptions(null)
        );
        clearLogoutMarkerCookie(response, request);
        clearOAuthStateCookie(response, request);
        return response;
    } catch (err) {
        console.error('[auth/google/callback] failed', err);
        const dest = new URL('/login', getAppOrigin(request));
        dest.searchParams.set('error', 'google_callback_failed');
        return NextResponse.redirect(dest.toString());
    }
}
