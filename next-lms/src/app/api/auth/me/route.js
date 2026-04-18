import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import {
    ensureDefaultOrganization,
    getUserDisplayName,
    listUserRoleCodes,
    mapRoleCodesToSessionRole,
} from '@/lib/server/enterprise-context';

/**
 * GET /api/auth/me
 * Returns the current logged-in user (for OAuth callback + client hydration).
 */
export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const user = await prisma.user.findUnique({
            where: { id: session.uid },
            include: { profile: true },
        });
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleCodes = await listUserRoleCodes(user.id, organizationId);
        const role = mapRoleCodesToSessionRole(roleCodes);

        return NextResponse.json({
            authenticated: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: getUserDisplayName(user) || user.username,
                role,
                avatar: user.profile?.avatarUrl || null,
            },
        });
    } catch (err) {
        console.error('[auth/me] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

