import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import {
    createSessionToken,
    getLogoutMarkerCookieOptions,
    getSessionCookieOptions,
    LOGOUT_MARKER_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
} from '@/lib/session';
import { readJsonBody } from '@/lib/server/request-validation';
import {
    ensureDefaultOrganization,
    ensureUserRole,
    getUserDisplayName,
} from '@/lib/server/enterprise-context';
import { hasMailConfig, sendRegistrationSuccessEmail } from '@/lib/server/mailer';
import { sanitizeRegisterInput, validateRegisterInput } from '@/lib/validation/register';

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

function splitName(fullName) {
    const value = String(fullName || '').trim();
    if (!value) return { firstName: null, lastName: null };
    const parts = value.split(/\s+/);
    const firstName = parts.shift() || null;
    const lastName = parts.length ? parts.join(' ') : null;
    return { firstName, lastName };
}

/**
 * POST /api/auth/register - Register a new user
 */
export async function POST(request) {
    try {
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const { username, email, password, fullName, phone } = sanitizeRegisterInput(body);

        const validation = validateRegisterInput({ username, email, password, fullName, phone });
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        // Check if username or email already exists
        const existing = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] },
        });
        if (existing) {
            return NextResponse.json({
                error: existing.username === username ? 'Username already taken' : 'Email already registered',
            }, { status: 409 });
        }

        const hashedPassword = await hashPassword(password);
        const { firstName, lastName } = splitName(fullName || username);
        const organizationId = await ensureDefaultOrganization();

        const user = await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    username,
                    email,
                    passwordHash: hashedPassword,
                    status: 'active',
                    profile: {
                        create: {
                            firstName,
                            lastName,
                            phone: phone || null,
                        },
                    },
                },
                include: { profile: true },
            });

            await ensureUserRole(tx, {
                organizationId,
                userId: created.id,
                roleCode: 'USER',
            });

            return created;
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: getUserDisplayName(user) || user.username,
                role: 'user',
            },
        });
        const sessionToken = await createSessionToken(
            { uid: user.id, role: 'user', rm: 1 },
            { ttlSeconds: SESSION_TTL_SECONDS }
        );
        response.cookies.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());
        clearLogoutMarkerCookie(response, request);

        // Best-effort email notification for successful registration.
        // Registration should still succeed even if SMTP is not configured or temporarily fails.
        if (hasMailConfig()) {
            sendRegistrationSuccessEmail({
                to: user.email,
                name: getUserDisplayName(user) || user.username || user.email,
            }).catch((mailErr) => {
                console.error('[auth/register] registration email failed', mailErr);
            });
        } else {
            console.warn('[auth/register] email service not configured, skip registration email');
        }

        return response;
    } catch (err) {
        console.error('[auth/register] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
