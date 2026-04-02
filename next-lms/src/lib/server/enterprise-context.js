import prisma from '@/lib/prisma';

const DEFAULT_ORG_CODE = String(process.env.DEFAULT_ORG_CODE || 'LMS').trim() || 'LMS';
const DEFAULT_ORG_SLUG = String(process.env.DEFAULT_ORG_SLUG || 'lms').trim() || 'lms';
const DEFAULT_ORG_NAME = String(process.env.DEFAULT_ORG_NAME || 'LMS Enterprise').trim() || 'LMS Enterprise';

const ROLE_LABEL = {
    ADMIN: 'Administrator',
    INSTRUCTOR: 'Instructor',
    LEARNER: 'Learner',
};

let cachedOrgId = null;

function toPositiveInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

export function normalizeRoleCode(role) {
    const code = String(role || '').trim().toUpperCase();
    if (code === 'ADMIN' || code === 'INSTRUCTOR' || code === 'LEARNER') return code;
    // Backward compatibility for legacy USER role code.
    if (code === 'USER') return 'LEARNER';
    return 'LEARNER';
}

export function mapRoleCodesToSessionRole(roleCodes = []) {
    const codes = roleCodes.map((item) => String(item || '').toUpperCase());
    if (codes.includes('ADMIN')) return 'admin';
    if (codes.includes('INSTRUCTOR')) return 'instructor';
    if (codes.includes('LEARNER') || codes.includes('USER')) return 'learner';
    return 'learner';
}

export function getUserDisplayName(user) {
    const first = String(user?.profile?.firstName || '').trim();
    const last = String(user?.profile?.lastName || '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full || String(user?.username || '');
}

export function parseUserStatus(value) {
    if (typeof value === 'string') {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'active') return 'active';
        if (normalized === 'inactive') return 'inactive';
        if (normalized === 'suspended') return 'suspended';
        if (normalized === 'pending') return 'pending';
    }
    if (value === false) return 'inactive';
    return 'active';
}

export function isUserActive(status) {
    return String(status || '').toLowerCase() === 'active';
}

export async function ensureDefaultOrganization(tx = prisma) {
    if (cachedOrgId) {
        const byId = await tx.organizations.findUnique({
            where: { id: cachedOrgId },
            select: { id: true },
        });
        if (byId?.id) return cachedOrgId;
        cachedOrgId = null;
    }

    const byCode = await tx.organizations.findFirst({
        where: { code: DEFAULT_ORG_CODE },
        select: { id: true },
    });
    if (byCode?.id) {
        cachedOrgId = byCode.id;
        return cachedOrgId;
    }

    const bySlug = await tx.organizations.findFirst({
        where: { slug: DEFAULT_ORG_SLUG },
        select: { id: true },
    });
    if (bySlug?.id) {
        cachedOrgId = bySlug.id;
        return cachedOrgId;
    }

    const created = await tx.organizations.create({
        data: {
            code: DEFAULT_ORG_CODE,
            slug: DEFAULT_ORG_SLUG,
            name: DEFAULT_ORG_NAME,
            status: 'active',
        },
        select: { id: true },
    });
    cachedOrgId = created.id;
    return cachedOrgId;
}

export async function ensureOrgUser(tx, { organizationId, userId, status = 'active' }) {
    return tx.organization_users.upsert({
        where: {
            organization_id_user_id: {
                organization_id: organizationId,
                user_id: userId,
            },
        },
        update: { status },
        create: {
            organization_id: organizationId,
            user_id: userId,
            status,
        },
    });
}

export async function ensureRole(tx, { organizationId, code }) {
    const normalizedCode = normalizeRoleCode(code);
    return tx.role.upsert({
        where: {
            organization_id_code: {
                organization_id: organizationId,
                code: normalizedCode,
            },
        },
        update: {},
        create: {
            organization_id: organizationId,
            code: normalizedCode,
            displayName: ROLE_LABEL[normalizedCode] || normalizedCode,
        },
    });
}

export async function ensureUserRole(tx, { organizationId, userId, roleCode }) {
    const role = await ensureRole(tx, { organizationId, code: roleCode });
    await ensureOrgUser(tx, { organizationId, userId });
    return tx.userRole.upsert({
        where: {
            userId_roleId: {
                userId,
                roleId: role.id,
            },
        },
        update: {
            organization_id: organizationId,
        },
        create: {
            userId,
            roleId: role.id,
            organization_id: organizationId,
        },
    });
}

export async function listUserRoleCodes(userId, organizationId) {
    if (!userId || !organizationId) return [];
    const rows = await prisma.userRole.findMany({
        where: {
            userId,
            organization_id: organizationId,
        },
        include: { roles: true },
    });
    return rows
        .map((row) => String(row?.roles?.code || '').toUpperCase())
        .filter(Boolean);
}

export async function resolveUserId(userKey = '') {
    const raw = String(userKey || '').trim();
    if (!raw) return null;

    const numericId = toPositiveInt(raw);
    if (numericId) {
        const byId = await prisma.user.findUnique({
            where: { id: numericId },
            select: { id: true },
        });
        return byId?.id || null;
    }

    const user = await prisma.user.findFirst({
        where: {
            OR: [{ username: raw }, { email: raw }],
        },
        select: { id: true },
    });
    return user?.id || null;
}
