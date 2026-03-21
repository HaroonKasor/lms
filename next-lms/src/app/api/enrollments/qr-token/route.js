import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSessionToken } from '@/lib/session';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';

const QR_ENROLL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function normalizeBaseUrl(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withProtocol);
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/+$/, '');
    } catch {
        return '';
    }
}

function isLocalOrPrivateHost(hostname = '') {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host) return true;
    if (host === 'localhost' || host === '0.0.0.0' || host === '::1') return true;
    if (host.startsWith('127.')) return true;
    if (host.startsWith('10.')) return true;
    if (host.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    return false;
}

function resolveAppBaseUrl(request) {
    const candidates = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.APP_URL,
    ]
        .map((x) => normalizeBaseUrl(x))
        .filter(Boolean);

    const forwardedProto = String(request?.headers?.get('x-forwarded-proto') || '').split(',')[0].trim();
    const forwardedHost = String(request?.headers?.get('x-forwarded-host') || '').split(',')[0].trim();
    const host = forwardedHost || String(request?.headers?.get('host') || '').trim();
    const proto = forwardedProto || 'https';
    const requestCandidate = normalizeBaseUrl(`${proto}://${host}`);
    if (requestCandidate) candidates.push(requestCandidate);

    const publicCandidate = candidates.find((candidate) => {
        try {
            return !isLocalOrPrivateHost(new URL(candidate).hostname);
        } catch {
            return false;
        }
    });
    if (publicCandidate) return publicCandidate;

    return candidates[0] || '';
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const courseId = Number(body?.courseId || 0);
        const sectionIdRaw = Number(body?.sectionId || 0);
        const sectionId = Number.isInteger(sectionIdRaw) && sectionIdRaw > 0 ? sectionIdRaw : null;
        if (!Number.isInteger(courseId) || courseId <= 0) {
            return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
        }

        const organizationId = await ensureDefaultOrganization();
        const course = await prisma.course.findFirst({
            where: { id: courseId, organization_id: organizationId },
            select: { id: true },
        });
        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        let validatedSectionId = null;
        if (sectionId) {
            const section = await prisma.section.findFirst({
                where: {
                    id: sectionId,
                    courseId: course.id,
                },
                select: { id: true, isActive: true },
            });
            if (!section) {
                return NextResponse.json({ error: 'Section not found for this course' }, { status: 404 });
            }
            validatedSectionId = section.id;
        }

        const token = await createSessionToken(
            {
                kind: 'qr-enroll',
                courseId: course.id,
                sectionId: validatedSectionId,
                issuedBy: Number(session?.uid || 0),
                nonce: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            },
            { ttlSeconds: QR_ENROLL_TTL_SECONDS }
        );

        const path = `/enroll/qr?t=${encodeURIComponent(token)}`;
        const baseUrl = resolveAppBaseUrl(request);
        const url = baseUrl ? `${baseUrl}${path}` : path;

        return NextResponse.json({
            success: true,
            token,
            expiresInSeconds: QR_ENROLL_TTL_SECONDS,
            path,
            url,
        });
    } catch (err) {
        console.error('[enrollments/qr-token][POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
