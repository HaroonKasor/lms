import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';
import {
    ensureDefaultOrganization,
    isUserActive,
    listUserRoleCodes,
    mapRoleCodesToSessionRole,
} from '@/lib/server/enterprise-context';

async function buildSessionFromToken(token) {
    if (!token) return null;

    const payload = await verifySessionToken(token);
    const uid = Number(payload?.uid);
    if (!Number.isInteger(uid) || uid <= 0) return null;

    const organizationId = await ensureDefaultOrganization();
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user || !isUserActive(user.status)) {
        return null;
    }

    const roleCodes = await listUserRoleCodes(user.id, organizationId);
    const role = mapRoleCodesToSessionRole(roleCodes);
    return {
        uid: user.id,
        organizationId,
        role,
        isAdmin: role === 'admin',
        user: {
            id: user.id,
            username: user.username || '',
            email: user.email || '',
            status: user.status || '',
        },
    };
}

export async function getRequestSession(request) {
    const token = request?.cookies?.get(SESSION_COOKIE_NAME)?.value;
    return buildSessionFromToken(token);
}

export async function getCookieStoreSession(cookieStore) {
    const token = cookieStore?.get(SESSION_COOKIE_NAME)?.value;
    return buildSessionFromToken(token);
}

export async function requireSession(request, options = {}) {
    const requireAdmin = Boolean(options.requireAdmin);
    const session = await getRequestSession(request);
    if (!session) {
        return {
            session: null,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }
    if (requireAdmin && !session.isAdmin) {
        return {
            session: null,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }
    return { session, response: null };
}

export function getRequestIp(request) {
    const forwarded = request?.headers?.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }
    const realIp = request?.headers?.get('x-real-ip');
    if (realIp) return realIp.trim();
    return 'unknown';
}
