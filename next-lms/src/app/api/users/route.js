import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import {
    ensureDefaultOrganization,
    ensureOrgUser,
    ensureUserRole,
    getUserDisplayName,
    mapRoleCodesToSessionRole,
    normalizeRoleCode,
    parseUserStatus,
} from '@/lib/server/enterprise-context';

function splitName(fullName) {
    const value = String(fullName || '').trim();
    if (!value) return { firstName: null, lastName: null };
    const parts = value.split(/\s+/);
    const firstName = parts.shift() || null;
    const lastName = parts.length ? parts.join(' ') : null;
    return { firstName, lastName };
}

function mapUser(user, roleCodes = []) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: getUserDisplayName(user),
        phone: user?.profile?.phone || '',
        role: mapRoleCodesToSessionRole(roleCodes),
        avatar: user?.profile?.avatarUrl || '',
        isActive: String(user.status || '').toLowerCase() === 'active',
        createdAt: null,
        updatedAt: user.lastLoginAt || null,
    };
}

async function getRoleMapByUserIds(userIds, organizationId) {
    const ids = (userIds || []).filter(Boolean);
    if (ids.length === 0) return new Map();

    const rows = await prisma.userRole.findMany({
        where: {
            organization_id: organizationId,
            userId: { in: ids },
        },
        include: { roles: true },
    });

    const roleMap = new Map();
    for (const row of rows) {
        const key = String(row.userId);
        const list = roleMap.get(key) || [];
        const code = String(row?.roles?.code || '').toUpperCase();
        if (code) list.push(code);
        roleMap.set(key, list);
    }
    return roleMap;
}

/**
 * GET - Get all users (without password)
 */
export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const users = await prisma.user.findMany({
            where: {
                organization_users: {
                    some: { organization_id: organizationId },
                },
            },
            include: { profile: true },
            orderBy: { id: 'asc' },
        });

        const roleMap = await getRoleMapByUserIds(users.map((user) => user.id), organizationId);
        return NextResponse.json(
            users.map((user) => mapUser(user, roleMap.get(String(user.id)) || []))
        );
    } catch (err) {
        console.error('[users/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST - Create user (same flow/rules as users management)
 */
export async function POST(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const username = (body.username || '').trim();
        const email = (body.email || '').trim();
        const password = String(body.password || '');
        const fullName = String(body.fullName || '').trim();
        const phone = String(body.phone || '').trim();
        const avatar = String(body.avatar || '').trim();
        const roleCode = normalizeRoleCode(body.role);
        const isActive = body.isActive ?? true;

        if (!username || !email || !password) {
            return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const existing = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] },
            select: { username: true, email: true },
        });
        if (existing) {
            return NextResponse.json({
                error: existing.username === username ? 'Username already taken' : 'Email already registered',
            }, { status: 409 });
        }

        const hashed = await hashPassword(password);
        const { firstName, lastName } = splitName(fullName || username);
        const organizationId = await ensureDefaultOrganization();

        const user = await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    username,
                    email,
                    passwordHash: hashed,
                    status: parseUserStatus(isActive),
                    profile: {
                        create: {
                            firstName,
                            lastName,
                            phone: phone || null,
                            avatarUrl: avatar || null,
                        },
                    },
                },
                include: { profile: true },
            });

            await ensureOrgUser(tx, { organizationId, userId: created.id });
            await ensureUserRole(tx, {
                organizationId,
                userId: created.id,
                roleCode,
            });

            return created;
        });

        return NextResponse.json({ success: true, user: mapUser(user, [roleCode]) });
    } catch (err) {
        console.error('[users/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT - Update user profile fields
 * /api/users?id=1
 */
export async function PUT(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get('id'), 10);
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const username = (body.username || '').trim();
        const email = (body.email || '').trim();
        const fullName = String(body.fullName || '').trim();
        const phone = String(body.phone || '').trim();
        const avatar = String(body.avatar || '').trim();
        const roleCode = normalizeRoleCode(body.role);
        const isActive = body.isActive ?? true;

        if (!username || !email) {
            return NextResponse.json({ error: 'Username and email are required' }, { status: 400 });
        }

        const { firstName, lastName } = splitName(fullName || username);
        const organizationId = await ensureDefaultOrganization();

        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id },
                data: {
                    username,
                    email,
                    status: parseUserStatus(isActive),
                },
                include: { profile: true },
            });

            await tx.userProfile.upsert({
                where: { userId: id },
                update: {
                    firstName,
                    lastName,
                    phone: phone || null,
                    avatarUrl: avatar || null,
                },
                create: {
                    userId: id,
                    firstName,
                    lastName,
                    phone: phone || null,
                    avatarUrl: avatar || null,
                },
            });

            await ensureOrgUser(tx, { organizationId, userId: id });
            await tx.userRole.deleteMany({ where: { userId: id, organization_id: organizationId } });
            await ensureUserRole(tx, {
                organizationId,
                userId: id,
                roleCode,
            });

            return tx.user.findUnique({
                where: { id: updated.id },
                include: { profile: true },
            });
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, user: mapUser(user, [roleCode]) });
    } catch (err) {
        if (err?.code === 'P2002') {
            return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 });
        }
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        console.error('[users/PUT] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH - Change user password
 * /api/users?id=1
 */
export async function PATCH(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get('id'), 10);
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const password = String(body.password || '');
        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const hashed = await hashPassword(password);
        await prisma.user.update({
            where: { id },
            data: { passwordHash: hashed },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        console.error('[users/PATCH] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE - Delete user only when disabled
 * /api/users?id=1
 */
export async function DELETE(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get('id'), 10);
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, status: true },
        });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (String(user.status || '').toLowerCase() === 'active') {
            return NextResponse.json(
                { error: 'ต้องปิดใช้งานผู้ใช้ก่อน จึงจะลบได้' },
                { status: 400 }
            );
        }

        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[users/DELETE] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
