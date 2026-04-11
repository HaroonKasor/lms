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
 * GET /api/users/profile?userId=1&username=administrator
 * Returns profile + learning stats for the current user.
 */
export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { searchParams } = new URL(request.url);
        const userIdParam = searchParams.get('userId');
        const username = searchParams.get('username');

        const numericId = Number(userIdParam);
        const hasNumericId = Number.isInteger(numericId) && numericId > 0;
        const currentUsername = String(session.user.username || '').toLowerCase();
        const currentEmail = String(session.user.email || '').toLowerCase();
        const requestedUsername = String(username || '').trim().toLowerCase();
        const isSelfById = hasNumericId && numericId === session.uid;
        const isSelfByUsername =
            requestedUsername
            && (requestedUsername === currentUsername || requestedUsername === currentEmail);

        if (!session.isAdmin && (userIdParam || username) && !isSelfById && !isSelfByUsername) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const useId = session.isAdmin
            ? hasNumericId
            : true;
        const effectiveUserId = useId ? (hasNumericId ? numericId : session.uid) : null;
        const where = useId
            ? { OR: [{ id: effectiveUserId }, ...(username ? [{ username }] : [])] }
            : { username: username || session.user.username };

        const user = await prisma.user.findFirst({
            where,
            include: { profile: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const roleCodes = await listUserRoleCodes(user.id, organizationId);
        const [enrolledCourses, completedCourses, certificates, firstRole, firstEnrollment] = await Promise.all([
            prisma.enrollment.count({ where: { userId: user.id } }),
            prisma.enrollment.count({ where: { userId: user.id, status: 'completed' } }),
            prisma.certificate.count({
                where: {
                    status: 'issued',
                    enrollment: { userId: user.id },
                },
            }),
            prisma.userRole.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            }),
            prisma.enrollment.findFirst({
                where: { userId: user.id },
                orderBy: { enrolledAt: 'asc' },
                select: { enrolledAt: true },
            }),
        ]);

        return NextResponse.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: getUserDisplayName(user) || user.username,
            avatar: user?.profile?.avatarUrl || '',
            role: mapRoleCodesToSessionRole(roleCodes),
            isActive: String(user.status || '').toLowerCase() === 'active',
            createdAt: firstRole?.createdAt || firstEnrollment?.enrolledAt || user.lastLoginAt || null,
            enrolledCourses,
            completedCourses,
            certificates,
        });
    } catch (err) {
        console.error('[users/profile] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
