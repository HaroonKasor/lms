import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import {
    createSessionToken,
    getSessionCookieOptions,
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
        const { username, email, password, fullName, phone } = body;

        if (!username || !email || !password) {
            return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
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
