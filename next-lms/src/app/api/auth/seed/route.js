import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import {
    ensureDefaultOrganization,
    ensureOrgUser,
    ensureRole,
    ensureUserRole,
} from '@/lib/server/enterprise-context';

const MIN_SEED_PASSWORD_LENGTH = 12;

function isSeedEnabled() {
    return String(process.env.ALLOW_AUTH_SEED || '').toLowerCase() === 'true';
}

function isAuthorizedSeedRequest(request) {
    if (!isSeedEnabled()) return false;
    const expectedToken = String(process.env.AUTH_SEED_TOKEN || '').trim();
    if (!expectedToken) return false;
    const headerToken = String(request?.headers?.get('x-seed-token') || '').trim();
    return headerToken === expectedToken;
}

function getSeedAdminPassword() {
    const fromEnv = String(process.env.AUTH_SEED_ADMIN_PASSWORD || '').trim();
    if (!fromEnv || fromEnv.length < MIN_SEED_PASSWORD_LENGTH) {
        throw new Error(`AUTH_SEED_ADMIN_PASSWORD must be set and at least ${MIN_SEED_PASSWORD_LENGTH} characters`);
    }
    return fromEnv;
}

function disabledResponse() {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

/**
 * POST /api/auth/seed - Create default admin user
 * GET  /api/auth/seed - Check if admin exists
 */
export async function GET(request) {
    try {
        if (!isAuthorizedSeedRequest(request)) return disabledResponse();

        const organizationId = await ensureDefaultOrganization();
        const adminRole = await prisma.role.findFirst({
            where: {
                organization_id: organizationId,
                code: 'ADMIN',
            },
            select: { id: true },
        });
        if (!adminRole?.id) {
            return NextResponse.json({ hasAdmin: false });
        }

        const admin = await prisma.userRole.findFirst({
            where: {
                organization_id: organizationId,
                roleId: adminRole.id,
            },
            select: { userId: true },
        });
        return NextResponse.json({ hasAdmin: Boolean(admin?.userId) });
    } catch (err) {
        console.error('[auth/seed][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        if (!isAuthorizedSeedRequest(request)) return disabledResponse();
        const adminPassword = getSeedAdminPassword();

        const organizationId = await ensureDefaultOrganization();
        await ensureRole(prisma, {
            organizationId,
            code: 'ADMIN',
        });

        const existing = await prisma.user.findFirst({
            where: { username: 'administrator' },
            include: { profile: true },
        });

        if (existing) {
            await ensureOrgUser(prisma, { organizationId, userId: existing.id });
            await ensureUserRole(prisma, {
                organizationId,
                userId: existing.id,
                roleCode: 'ADMIN',
            });

            return NextResponse.json({
                message: 'Admin already exists',
                user: { id: existing.id, username: existing.username, role: 'admin' },
            });
        }

        const hashedPassword = await hashPassword(adminPassword);

        const admin = await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    username: 'administrator',
                    email: 'admin@skillup.com',
                    passwordHash: hashedPassword,
                    status: 'active',
                    profile: {
                        create: {
                            firstName: 'System',
                            lastName: 'Administrator',
                            phone: null,
                        },
                    },
                },
                include: { profile: true },
            });

            await ensureOrgUser(tx, { organizationId, userId: created.id });
            await ensureUserRole(tx, {
                organizationId,
                userId: created.id,
                roleCode: 'ADMIN',
            });

            return created;
        });

        return NextResponse.json({
            success: true,
            user: { id: admin.id, username: admin.username, email: admin.email, role: 'admin' },
        });
    } catch (err) {
        const message = String(err?.message || '');
        if (message.includes('AUTH_SEED_ADMIN_PASSWORD')) {
            return NextResponse.json({ error: message }, { status: 503 });
        }
        console.error('[auth/seed][POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
