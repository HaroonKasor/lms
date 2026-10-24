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
    const allowInstructor = Boolean(options.allowInstructor);
    const session = await getRequestSession(request);
    if (!session) {
        return {
            session: null,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }
    const isInstructor = String(session?.role || '').toLowerCase() === 'instructor';
    if (requireAdmin && !session.isAdmin && !(allowInstructor && isInstructor)) {
        return {
            session: null,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }
    return { session, response: null };
}

export function getRequestIp(request) {
    // cf-connecting-ip is client-settable unless the app is only reachable via Cloudflare,
    // so it is honoured only when TRUST_CF_CONNECTING_IP=true.
    if (String(process.env.TRUST_CF_CONNECTING_IP || '').trim().toLowerCase() === 'true') {
        const cfIp = request?.headers?.get('cf-connecting-ip');
        if (cfIp && cfIp.trim()) return cfIp.trim();
    }
    const forwarded = request?.headers?.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }
    const realIp = request?.headers?.get('x-real-ip');
    if (realIp) return realIp.trim();
    return 'unknown';
}
