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
    listUserRoleCodes,
    mapRoleCodesToSessionRole,
    parseUserStatus,
} from '@/lib/server/enterprise-context';
import {
    deleteUserGroups,
    getUserGroupMapByUserIds,
    setUserGroups,
} from '@/lib/server/user-group-membership-db';
import {
    getDefaultGroupCodeByRoleFromDb,
    getGroupMapByCodesFromDb,
} from '@/lib/server/group-directory-db';
import { writeAdminAudit } from '@/lib/server/admin-audit';
import {
    defaultGroupCodeFromEnterpriseRoleCode,
    inferEnterpriseRoleCodeFromGroup,
    normalizeEnterpriseRoleCode,
} from '@/lib/shared/role-directory';

const PHONE_REGEX = /^\d{8,20}$/;

function normalizeGroupCode(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeGroupCodes(values = []) {
    if (!Array.isArray(values)) return [];
    const unique = new Set();
    for (const value of values) {
        const code = normalizeGroupCode(value);
        if (code) unique.add(code);
    }
    return Array.from(unique);
}

async function resolveRoleCodeFromSelectedGroups(selectedGroups, fallbackRoleCode) {
    const requestedRoleCode = String(fallbackRoleCode || '').trim();
    if (requestedRoleCode) {
        return normalizeEnterpriseRoleCode(requestedRoleCode);
    }

    const normalizedGroups = normalizeGroupCodes(selectedGroups);
    if (normalizedGroups.length === 0) return normalizeEnterpriseRoleCode('LEARNER');

    const groupMap = await getGroupMapByCodesFromDb(normalizedGroups);
    for (const groupCode of normalizedGroups) {
        const group = groupMap.get(groupCode);
        if (!group || group.isActive === false) continue;
        return normalizeEnterpriseRoleCode(
            group.roleCode || inferEnterpriseRoleCodeFromGroup(group)
        );
    }

    return normalizeEnterpriseRoleCode('LEARNER');
}

async function resolveAssignedGroupsByRole(roleCode, fallbackGroups = []) {
    const normalizedRoleCode = normalizeEnterpriseRoleCode(roleCode);
    const mappedDefaultGroup = await getDefaultGroupCodeByRoleFromDb(normalizedRoleCode);
    if (mappedDefaultGroup) return [mappedDefaultGroup];

    const normalizedFallback = normalizeGroupCodes(fallbackGroups);
    if (normalizedFallback.length > 0) return [normalizedFallback[0]];
    return [];
}

function splitName(fullName) {
    const value = String(fullName || '').trim();
    if (!value) return { firstName: null, lastName: null };
    const parts = value.split(/\s+/);
    const firstName = parts.shift() || null;
    const lastName = parts.length ? parts.join(' ') : null;
    return { firstName, lastName };
}

function mapUser(user, roleCodes = [], groups = []) {
    const normalizedStatus = String(user?.status || '').toLowerCase() || 'active';
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: getUserDisplayName(user),
        phone: user?.profile?.phone || '',
        role: mapRoleCodesToSessionRole(roleCodes),
        groups: Array.isArray(groups) ? groups : [],
        avatar: user?.profile?.avatarUrl || '',
        status: normalizedStatus,
        isActive: normalizedStatus === 'active',
        createdAt: null,
        updatedAt: user.lastLoginAt || null,
    };
}

function withRoleFallbackGroups(roleCodes = [], groups = []) {
    const normalizedGroups = Array.isArray(groups) ? groups.filter(Boolean) : [];
    if (normalizedGroups.length > 0) return normalizedGroups;

    const primaryRoleCode = Array.isArray(roleCodes) && roleCodes.length > 0
        ? normalizeEnterpriseRoleCode(roleCodes[0])
        : normalizeEnterpriseRoleCode('LEARNER');
    return [defaultGroupCodeFromEnterpriseRoleCode(primaryRoleCode)];
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

        const { searchParams } = new URL(request.url);
        const groupCodeFilter = String(searchParams.get('groupCode') || '').trim().toUpperCase();
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

        const userIds = users.map((user) => user.id);
        const roleMap = await getRoleMapByUserIds(userIds, organizationId);
        const groupMap = await getUserGroupMapByUserIds(userIds, organizationId);
        const mappedUsers = users.map((user) => mapUser(
            user,
            roleMap.get(String(user.id)) || [],
            withRoleFallbackGroups(
                roleMap.get(String(user.id)) || [],
                groupMap.get(Number(user.id)) || []
            )
        ));
        const filteredUsers = groupCodeFilter
            ? mappedUsers.filter((user) => (user.groups || []).includes(groupCodeFilter))
            : mappedUsers;
        return NextResponse.json(
            filteredUsers
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
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const username = (body.username || '').trim();
        const email = (body.email || '').trim();
        const password = String(body.password || '');
        const fullName = String(body.fullName || '').trim();
        const rawPhone = String(body.phone || '').trim();
        const phone = rawPhone.replace(/\D/g, '');
        const avatar = String(body.avatar || '').trim();
        const userStatus = parseUserStatus(body.status ?? body.isActive);
        const selectedGroups = normalizeGroupCodes(Array.isArray(body.selectedGroups) ? body.selectedGroups : []);
        const roleInput = String(body.role || '').trim();
        const roleCode = await resolveRoleCodeFromSelectedGroups(selectedGroups, roleInput);
        const assignedGroups = await resolveAssignedGroupsByRole(roleCode, selectedGroups);

        if (!username || !email || !password) {
            return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }
        if (phone && !PHONE_REGEX.test(phone)) {
            return NextResponse.json({ error: 'Phone number must be 8-20 digits' }, { status: 400 });
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
                    status: userStatus,
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
            await setUserGroups(tx, {
                organizationId,
                userId: created.id,
                groups: assignedGroups,
            });

            return created;
        });

        await writeAdminAudit({
            organizationId,
            actorUserId: session.uid,
            actorUsername: session.user?.username || '',
            actorEmail: session.user?.email || '',
            action: 'CREATE',
            entity: 'USER',
            entityId: user?.id ?? null,
            message: 'Created user account',
            severity: 'info',
            details: {
                username: user?.username || '',
                email: user?.email || '',
                roleCode,
                groups: assignedGroups,
                status: userStatus,
            },
            request: { path: '/api/users', method: 'POST' },
        });

        return NextResponse.json({ success: true, user: mapUser(user, [roleCode], assignedGroups) });
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
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get('id'), 10);
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const username = (body.username || '').trim();
        const email = (body.email || '').trim();
        const fullName = String(body.fullName || '').trim();
        const rawPhone = String(body.phone || '').trim();
        const phone = rawPhone.replace(/\D/g, '');
        const avatar = String(body.avatar || '').trim();
        const userStatus = parseUserStatus(body.status ?? body.isActive);
        const selectedGroups = Array.isArray(body.selectedGroups)
            ? normalizeGroupCodes(body.selectedGroups)
            : null;
        const organizationId = await ensureDefaultOrganization();
        const currentRoleCodes = await listUserRoleCodes(id, organizationId);
        const fallbackRoleCode = normalizeEnterpriseRoleCode(currentRoleCodes[0] || 'LEARNER');
        const roleInput = String(body.role || '').trim() || fallbackRoleCode;
        const roleCode = await resolveRoleCodeFromSelectedGroups(selectedGroups, roleInput);
        const assignedGroups = await resolveAssignedGroupsByRole(roleCode, selectedGroups || []);

        if (!username || !email) {
            return NextResponse.json({ error: 'Username and email are required' }, { status: 400 });
        }
        if (phone && !PHONE_REGEX.test(phone)) {
            return NextResponse.json({ error: 'Phone number must be 8-20 digits' }, { status: 400 });
        }

        const { firstName, lastName } = splitName(fullName || username);
        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id },
                data: {
                    username,
                    email,
                    status: userStatus,
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
            await setUserGroups(tx, {
                organizationId,
                userId: id,
                groups: assignedGroups,
            });

            return tx.user.findUnique({
                where: { id: updated.id },
                include: { profile: true },
            });
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const groupMap = await getUserGroupMapByUserIds([user.id], organizationId);
        const resolvedGroups = groupMap.get(Number(user.id)) || assignedGroups;
        await writeAdminAudit({
            organizationId,
            actorUserId: session.uid,
            actorUsername: session.user?.username || '',
            actorEmail: session.user?.email || '',
            action: 'UPDATE',
            entity: 'USER',
            entityId: user?.id ?? id,
            message: 'Updated user account',
            severity: 'info',
            details: {
                username: user?.username || '',
                email: user?.email || '',
                roleCode,
                groups: resolvedGroups,
                status: userStatus,
            },
            request: { path: '/api/users', method: 'PUT' },
        });
        return NextResponse.json({
            success: true,
            user: mapUser(user, [roleCode], resolvedGroups),
        });
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
        const { session, response } = await requireSession(request, { requireAdmin: true });
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

        const organizationId = await ensureDefaultOrganization();
        await writeAdminAudit({
            organizationId,
            actorUserId: session.uid,
            actorUsername: session.user?.username || '',
            actorEmail: session.user?.email || '',
            action: 'PASSWORD_RESET',
            entity: 'USER',
            entityId: id,
            message: 'Admin reset user password',
            severity: 'warning',
            request: { path: '/api/users', method: 'PATCH' },
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
        const { session, response } = await requireSession(request, { requireAdmin: true });
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

        const organizationId = await ensureDefaultOrganization();
        const deletingUser = await prisma.user.findUnique({
            where: { id },
            include: { profile: true },
        });
        await prisma.$transaction(async (tx) => {
            await deleteUserGroups(tx, {
                organizationId,
                userId: id,
            });
            await tx.user.delete({ where: { id } });
        });
        await writeAdminAudit({
            organizationId,
            actorUserId: session.uid,
            actorUsername: session.user?.username || '',
            actorEmail: session.user?.email || '',
            action: 'DELETE',
            entity: 'USER',
            entityId: id,
            message: 'Deleted user account',
            severity: 'critical',
            details: {
                username: deletingUser?.username || '',
                email: deletingUser?.email || '',
                status: deletingUser?.status || '',
            },
            request: { path: '/api/users', method: 'DELETE' },
        });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[users/DELETE] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
