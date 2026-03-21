import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import {
    ensureDefaultOrganization,
    getUserDisplayName,
    resolveUserId,
} from '@/lib/server/enterprise-context';

function mapCertificate(certificate) {
    return {
        ...certificate,
        certificateNo: certificate.verifyCode,
        courseName: certificate.enrollment?.courses?.title || '',
        userId: certificate.enrollment?.userId || null,
        courseId: certificate.enrollment?.courseId || null,
    };
}

/**
 * GET - Get certificates for a user
 */
export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { searchParams } = new URL(request.url);
        const requestedUserKey = searchParams.get('userId');
        let userId = session.uid;

        if (session.isAdmin && requestedUserKey) {
            userId = await resolveUserId(requestedUserKey);
        } else if (!session.isAdmin && requestedUserKey) {
            const requestedUserId = await resolveUserId(requestedUserKey);
            if (requestedUserId && requestedUserId !== session.uid) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        if (!userId) return NextResponse.json([]);

        const certificates = await prisma.certificate.findMany({
            where: {
                status: 'issued',
                enrollment: {
                    userId,
                    organization_id: organizationId,
                },
            },
            include: {
                enrollment: {
                    include: {
                        courses: true,
                    },
                },
            },
            orderBy: { issuedAt: 'desc' },
        });

        return NextResponse.json(certificates.map(mapCertificate));
    } catch (err) {
        console.error('[certificates/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST - Manually issue a certificate (admin)
 */
export async function POST(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const courseId = parseInt(body.courseId, 10);
        const userId = await resolveUserId(body.userId);
        const recipientName = String(body.recipientName || '').trim();

        if (!userId || !courseId) {
            return NextResponse.json({ error: 'userId and courseId required' }, { status: 400 });
        }

        const [course, user, enrollment] = await Promise.all([
            prisma.course.findFirst({
                where: { id: courseId, organization_id: organizationId },
                select: { id: true, title: true },
            }),
            prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
            prisma.enrollment.findFirst({
                where: {
                    organization_id: organizationId,
                    userId,
                    courseId,
                },
                select: { id: true },
            }),
        ]);
        if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (!enrollment) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

        const verifyCode = `CERT-${Date.now().toString(36).toUpperCase()}`;
        const resolvedRecipientName = recipientName || getUserDisplayName(user) || user.username;

        const certificate = await prisma.certificate.upsert({
            where: { enrollmentId: enrollment.id },
            update: {
                recipientName: resolvedRecipientName,
                status: 'issued',
            },
            create: {
                enrollmentId: enrollment.id,
                verifyCode,
                recipientName: resolvedRecipientName,
                status: 'issued',
            },
            include: {
                enrollment: {
                    include: {
                        courses: true,
                    },
                },
            },
        });

        return NextResponse.json({ success: true, certificate: mapCertificate(certificate) });
    } catch (err) {
        console.error('[certificates/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
