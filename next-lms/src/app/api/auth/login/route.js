import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import {
    createSessionToken,
    getSessionCookieOptions,
    SESSION_COOKIE_NAME,
    SESSION_NON_REMEMBER_TTL_SECONDS,
    SESSION_TTL_SECONDS,
} from '@/lib/session';
import { getRequestIp } from '@/lib/server/auth';
import { clearRateLimitKey, takeRateLimitToken } from '@/lib/server/rate-limit';
import { readJsonBody } from '@/lib/server/request-validation';
import {
    ensureDefaultOrganization,
    getUserDisplayName,
    listUserRoleCodes,
    mapRoleCodesToSessionRole,
} from '@/lib/server/enterprise-context';

const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOGIN_MAX_ATTEMPTS = 10;
const INVALID_CREDENTIALS_MESSAGE = 'Invalid username or password';

/**
 * POST /api/auth/login - Login a user
 */
export async function POST(request) {
    try {
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const { username, password, rememberMe } = body;
        const normalizedUsername = String(username || '').trim().toLowerCase();
        const ip = getRequestIp(request);
        const limiterKey = `login:${ip}:${normalizedUsername || 'unknown'}`;

        const rate = takeRateLimitToken({
            key: limiterKey,
            windowMs: LOGIN_WINDOW_MS,
            maxAttempts: LOGIN_MAX_ATTEMPTS,
        });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: 'Too many login attempts. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(rate.retryAfterSeconds),
                    },
                }
            );
        }

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
        }

        const organizationId = await ensureDefaultOrganization();
        const user = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { email: username }],
                status: 'active',
            },
            include: { profile: true },
        });

        if (!user) return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });

        const isValidPassword = await verifyPassword(password, user.passwordHash);
        if (!isValidPassword) {
            return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        const roleCodes = await listUserRoleCodes(user.id, organizationId);
        const role = mapRoleCodesToSessionRole(roleCodes);

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: getUserDisplayName(user) || user.username,
                role,
                avatar: user.profile?.avatarUrl || null,
            },
        });
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
        response.cookies.set(
            SESSION_COOKIE_NAME,
            sessionToken,
            shouldRemember ? getSessionCookieOptions(ttlSeconds) : getSessionCookieOptions(null)
        );
        clearRateLimitKey(limiterKey);
        return response;
    } catch (err) {
        console.error('[auth/login] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
