import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { ensureDefaultOrganization, getUserDisplayName } from '@/lib/server/enterprise-context';
import { createNotification } from '@/lib/server/notifications';
import { getSectionCompatMaps } from '@/lib/server/compat-db';
import {
    resolveEffectiveCertificateConfig,
    resolveEnrollmentSectionId,
} from '@/lib/server/section-runtime';

function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toSafeText(value) {
    return String(value || '').trim();
}

function toDateStart(value) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toDateEnd(value) {
    if (!value) return null;
    const date = new Date(`${value}T23:59:59.999`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeEnrollmentStatus(enrollment) {
    const raw = String(enrollment?.status || '').toLowerCase();
    const progress = Number(enrollment?.progressPercent || 0);
    const hasStarted = Boolean(enrollment?.startedAt);
    const hasCompleted = Boolean(enrollment?.completedAt);
    const progressRows = Array.isArray(enrollment?.learning_progress) ? enrollment.learning_progress : [];
    const progressSaysCompleted = progressRows.some((row) => {
        const rowStatus = String(row?.status || '').toLowerCase();
        const rowProgress = toSafeNumber(row?.progressPercent, 0);
        return rowStatus === 'completed'
            || row?.completion === true
            || (row?.success === true && rowProgress >= 100)
            || rowProgress >= 100;
    });

    if (raw === 'cancelled') return 'CANCELLED';
    if (raw === 'dropped') return 'FAILED';
    if (raw === 'completed' || hasCompleted || progressSaysCompleted) return 'COMPLETED';
    if (raw === 'in_progress' || hasStarted || progress > 0) return 'LEARNING';
    return 'NOT_STARTED';
}

function certificateStatusLabel(status) {
    const key = String(status || '').toUpperCase();
    if (key === 'ISSUED') return 'Issued';
    if (key === 'REVOKED') return 'Revoked';
    if (key === 'EXPIRED') return 'Expired';
    return 'Pending';
}

function userStatusLabel(status) {
    const key = String(status || '').toUpperCase();
    if (key === 'COMPLETED') return 'Completed';
    if (key === 'LEARNING') return 'Learning';
    if (key === 'FAILED') return 'Failed';
    if (key === 'CANCELLED') return 'Cancelled';
    return 'Not Started';
}

function formatDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function buildVerifyCode() {
    return `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function buildRecipientName(user) {
    const displayName = getUserDisplayName(user);
    if (displayName) return displayName;
    return toSafeText(user?.email) || 'Learner';
}

function mapIssuedBy(issuedBy) {
    if (!issuedBy) return '-';
    const first = toSafeText(issuedBy?.profile?.firstName);
    const last = toSafeText(issuedBy?.profile?.lastName);
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    return fullName || toSafeText(issuedBy?.username) || toSafeText(issuedBy?.email) || '-';
}

function buildSearchText(row) {
    return [
        row.username,
        row.firstName,
        row.lastName,
        row.fullName,
        row.courseName,
        row.categoryName,
        row.sectionName,
        row.certificateNo,
        row.responseBy,
    ]
        .map((item) => String(item || '').toLowerCase())
        .join(' ');
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { searchParams } = new URL(request.url);

        const categoryId = toSafeNumber(searchParams.get('categoryId'), 0);
        const courseId = toSafeNumber(searchParams.get('courseId'), 0);
        const certificateStatus = toSafeText(searchParams.get('certificateStatus') || 'ALL').toUpperCase();
        const userStatus = toSafeText(searchParams.get('userStatus') || 'ALL').toUpperCase();
        const q = toSafeText(searchParams.get('q')).toLowerCase();
        const fromDate = toDateStart(searchParams.get('fromDate'));
        const toDate = toDateEnd(searchParams.get('toDate'));

        const [categories, courses, enrollments] = await Promise.all([
            prisma.category.findMany({
                where: { organization_id: organizationId },
                orderBy: { name: 'asc' },
                select: { id: true, name: true },
            }),
            prisma.course.findMany({
                where: {
                    organization_id: organizationId,
                    ...(categoryId > 0 ? { categoryId } : {}),
                },
                orderBy: { title: 'asc' },
                select: {
                    id: true,
                    title: true,
                    categoryId: true,
                },
            }),
            prisma.enrollment.findMany({
                where: {
                    organization_id: organizationId,
                    ...(courseId > 0 ? { courseId } : {}),
                },
                include: {
                    courses: {
                        include: {
                            categories: true,
                            sections: {
                                orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                                select: { id: true, title: true },
                            },
                        },
                    },
                    organization_users: {
                        include: {
                            users: {
                                include: { profile: true },
                            },
                        },
                    },
                    certificates: {
                        include: {
                            issuedBy: {
                                include: { profile: true },
                            },
                        },
                    },
                    learning_progress: {
                        select: {
                            id: true,
                            sectionId: true,
                            status: true,
                            progressPercent: true,
                            success: true,
                            completion: true,
                        },
                        orderBy: { id: 'desc' },
                        take: 20,
                    },
                },
                orderBy: { enrolledAt: 'desc' },
            }),
        ]);

        const targetSectionIds = new Set();
        for (const enrollment of enrollments) {
            const progressRows = Array.isArray(enrollment?.learning_progress) ? enrollment.learning_progress : [];
            for (const row of progressRows) {
                const sectionId = Number(row?.sectionId || 0);
                if (Number.isInteger(sectionId) && sectionId > 0) targetSectionIds.add(sectionId);
            }
            const sections = Array.isArray(enrollment?.courses?.sections) ? enrollment.courses.sections : [];
            for (const section of sections) {
                const sectionId = Number(section?.id || 0);
                if (Number.isInteger(sectionId) && sectionId > 0) targetSectionIds.add(sectionId);
            }
        }
        const sectionCompatMaps = await getSectionCompatMaps(Array.from(targetSectionIds));
        const sectionSettingsBySectionId = sectionCompatMaps?.sectionSettingsBySectionId || {};

        const rows = enrollments
            .map((enrollment) => {
                const user = enrollment?.organization_users?.users;
                const certificate = enrollment?.certificates || null;
                const firstName = toSafeText(user?.profile?.firstName);
                const lastName = toSafeText(user?.profile?.lastName);
                const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
                const resolvedUserStatus = normalizeEnrollmentStatus(enrollment);
                const resolvedCertStatus = certificate ? String(certificate.status || 'issued').toUpperCase() : 'PENDING';
                const courseSections = Array.isArray(enrollment?.courses?.sections) ? enrollment.courses.sections : [];
                const selectedSectionId = resolveEnrollmentSectionId({
                    learningProgressRows: enrollment?.learning_progress || [],
                    availableSections: courseSections,
                });
                const selectedSection = selectedSectionId
                    ? courseSections.find((item) => Number(item?.id || 0) === Number(selectedSectionId))
                    : null;
                const effectiveCertificate = resolveEffectiveCertificateConfig({
                    courseHasCertificate: enrollment?.courses?.hasCertificate,
                    courseCertificateMode: enrollment?.courses?.certificateMode,
                    sectionId: selectedSectionId,
                    sectionSettingsBySectionId,
                });
                if (!effectiveCertificate.required) return null;
                const row = {
                    enrollmentId: Number(enrollment.id || 0),
                    userId: Number(enrollment.userId || 0),
                    courseId: Number(enrollment.courseId || 0),
                    categoryId: Number(enrollment?.courses?.categoryId || 0) || null,
                    categoryName: toSafeText(enrollment?.courses?.categories?.name) || '-',
                    courseName: toSafeText(enrollment?.courses?.title) || '-',
                    sectionName: toSafeText(selectedSection?.title) || '-',
                    username: toSafeText(user?.username) || toSafeText(user?.email) || '-',
                    firstName: firstName || '-',
                    lastName: lastName || '-',
                    fullName: fullName || '-',
                    userStatus: resolvedUserStatus,
                    userStatusLabel: userStatusLabel(resolvedUserStatus),
                    certificateStatus: resolvedCertStatus,
                    certificateStatusLabel: certificateStatusLabel(resolvedCertStatus),
                    certificateNo: toSafeText(certificate?.verifyCode) || '-',
                    issuedAt: formatDateTime(certificate?.issuedAt),
                    enrolledAt: formatDateTime(enrollment?.enrolledAt),
                    responseBy: mapIssuedBy(certificate?.issuedBy),
                    recipientName: toSafeText(certificate?.recipientName) || buildRecipientName(user),
                    certificateUrl: toSafeText(certificate?.certificateUrl),
                };
                row.searchText = buildSearchText(row);
                return row;
            })
            .filter(Boolean)
            .filter((row) => {
                if (categoryId > 0 && Number(row.categoryId || 0) !== categoryId) return false;
                if (courseId > 0 && Number(row.courseId || 0) !== courseId) return false;
                if (userStatus !== 'ALL' && row.userStatus !== userStatus) return false;
                if (certificateStatus !== 'ALL' && row.certificateStatus !== certificateStatus) return false;

                if (fromDate || toDate) {
                    const basis = row.issuedAt || row.enrolledAt;
                    const date = basis ? new Date(basis) : null;
                    if (!date || Number.isNaN(date.getTime())) return false;
                    if (fromDate && date < fromDate) return false;
                    if (toDate && date > toDate) return false;
                }

                if (q && !row.searchText.includes(q)) return false;
                return true;
            })
            .sort((a, b) => {
                const aDate = new Date(a.issuedAt || a.enrolledAt || 0).getTime();
                const bDate = new Date(b.issuedAt || b.enrolledAt || 0).getTime();
                return bDate - aDate;
            })
            .map((row, index) => ({
                no: index + 1,
                ...row,
            }));

        const summaryBase = {
            ISSUED: 0,
            REVOKED: 0,
            EXPIRED: 0,
            PENDING: 0,
        };
        rows.forEach((row) => {
            const key = String(row.certificateStatus || 'PENDING').toUpperCase();
            summaryBase[key] = Number(summaryBase[key] || 0) + 1;
        });

        return NextResponse.json({
            rows,
            summary: {
                totalRows: rows.length,
                issued: summaryBase.ISSUED,
                revoked: summaryBase.REVOKED,
                expired: summaryBase.EXPIRED,
                pending: summaryBase.PENDING,
            },
            selected: {
                categoryId: categoryId > 0 ? categoryId : null,
                courseId: courseId > 0 ? courseId : null,
                certificateStatus,
                userStatus,
                fromDate: searchParams.get('fromDate') || '',
                toDate: searchParams.get('toDate') || '',
                q: searchParams.get('q') || '',
            },
            filters: {
                categories: categories.map((item) => ({ id: Number(item.id), name: item.name })),
                courses: courses.map((item) => ({
                    id: Number(item.id),
                    name: toSafeText(item.title) || '-',
                    categoryId: Number(item.categoryId || 0) || null,
                })),
                certificateStatuses: [
                    { id: 'ALL', name: 'All Certificate Status' },
                    { id: 'ISSUED', name: 'Issued' },
                    { id: 'REVOKED', name: 'Revoked' },
                    { id: 'EXPIRED', name: 'Expired' },
                    { id: 'PENDING', name: 'Pending' },
                ],
                userStatuses: [
                    { id: 'ALL', name: 'All User Status' },
                    { id: 'NOT_STARTED', name: 'Not Started' },
                    { id: 'LEARNING', name: 'Learning' },
                    { id: 'COMPLETED', name: 'Completed' },
                    { id: 'FAILED', name: 'Failed' },
                    { id: 'CANCELLED', name: 'Cancelled' },
                ],
            },
        });
    } catch (err) {
        console.error('[reports/certificate-report][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const enrollmentId = toSafeNumber(body?.enrollmentId, 0);
        const action = toSafeText(body?.action).toUpperCase();

        if (!enrollmentId) {
            return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
        }
        if (!['APPROVE', 'NOT_APPROVE', 'REGENERATE'].includes(action)) {
            return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
        }

        const enrollment = await prisma.enrollment.findFirst({
            where: {
                id: enrollmentId,
                organization_id: organizationId,
            },
            include: {
                courses: {
                    select: {
                        id: true,
                        title: true,
                        hasCertificate: true,
                        certificateMode: true,
                        sections: {
                            orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                            select: { id: true, title: true, isActive: true },
                        },
                    },
                },
                organization_users: {
                    include: {
                        users: { include: { profile: true } },
                    },
                },
                certificates: true,
                learning_progress: {
                    select: {
                        id: true,
                        sectionId: true,
                        status: true,
                        progressPercent: true,
                        success: true,
                        completion: true,
                    },
                    orderBy: { id: 'desc' },
                    take: 20,
                },
            },
        });
        if (!enrollment) {
            return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
        }

        const selectedSectionId = resolveEnrollmentSectionId({
            learningProgressRows: enrollment?.learning_progress || [],
            availableSections: enrollment?.courses?.sections || [],
        });
        const sectionCompatMaps = await getSectionCompatMaps(
            Number.isInteger(Number(selectedSectionId)) && Number(selectedSectionId) > 0 ? [Number(selectedSectionId)] : []
        );
        const effectiveCertificate = resolveEffectiveCertificateConfig({
            courseHasCertificate: enrollment?.courses?.hasCertificate,
            courseCertificateMode: enrollment?.courses?.certificateMode,
            sectionId: Number.isInteger(Number(selectedSectionId)) && Number(selectedSectionId) > 0 ? Number(selectedSectionId) : null,
            sectionSettingsBySectionId: sectionCompatMaps?.sectionSettingsBySectionId || {},
        });
        if (!effectiveCertificate.required) {
            return NextResponse.json({ error: 'Enrollment section does not support certificate' }, { status: 400 });
        }

        const learnerStatus = normalizeEnrollmentStatus(enrollment);

        const user = enrollment?.organization_users?.users;
        const recipientName = buildRecipientName(user);
        const existing = enrollment?.certificates || null;

        let certificate = null;
        if (action === 'NOT_APPROVE') {
            if (!existing) {
                return NextResponse.json({ error: 'No certificate to revoke' }, { status: 400 });
            }
            certificate = await prisma.certificate.update({
                where: { enrollmentId: enrollment.id },
                data: {
                    status: 'revoked',
                    issuedById: session.uid,
                    recipientName: recipientName || existing.recipientName,
                    issuedAt: existing.issuedAt || new Date(),
                },
            });
        } else if (action === 'REGENERATE') {
            if (learnerStatus !== 'COMPLETED') {
                return NextResponse.json({ error: 'Learner must be completed before certificate actions' }, { status: 400 });
            }
            const verifyCode = buildVerifyCode();
            certificate = await prisma.certificate.upsert({
                where: { enrollmentId: enrollment.id },
                update: {
                    verifyCode,
                    status: 'issued',
                    issuedById: session.uid,
                    recipientName,
                    issuedAt: new Date(),
                },
                create: {
                    enrollmentId: enrollment.id,
                    verifyCode,
                    status: 'issued',
                    issuedById: session.uid,
                    recipientName,
                    issuedAt: new Date(),
                },
            });
        } else {
            if (learnerStatus !== 'COMPLETED') {
                return NextResponse.json({ error: 'Learner must be completed before certificate actions' }, { status: 400 });
            }
            const verifyCode = existing?.verifyCode || buildVerifyCode();
            certificate = await prisma.certificate.upsert({
                where: { enrollmentId: enrollment.id },
                update: {
                    verifyCode,
                    status: 'issued',
                    issuedById: session.uid,
                    recipientName,
                    issuedAt: existing?.issuedAt || new Date(),
                },
                create: {
                    enrollmentId: enrollment.id,
                    verifyCode,
                    status: 'issued',
                    issuedById: session.uid,
                    recipientName,
                    issuedAt: new Date(),
                },
            });
        }

        if (action === 'APPROVE' || action === 'REGENERATE') {
            await createNotification({
                organizationId,
                type: 'CERTIFICATE_ISSUED',
                title: action === 'REGENERATE' ? 'Certificate Regenerated' : 'Certificate Issued',
                message: action === 'REGENERATE'
                    ? `Your certificate for "${toSafeText(enrollment?.courses?.title) || 'Course'}" has been regenerated and is ready.`
                    : `Your certificate for "${toSafeText(enrollment?.courses?.title) || 'Course'}" is approved and ready.`,
                payload: {
                    kind: action === 'REGENERATE' ? 'certificate_regenerated' : 'certificate_issued',
                    enrollmentId: Number(enrollment.id || 0),
                    courseId: Number(enrollment.courseId || 0),
                    actionUrl: '/training-results',
                },
                severity: 'info',
                category: 'COURSE',
                createdBy: session.uid,
                recipientUserIds: [Number(enrollment.userId || 0)],
            });
        } else if (action === 'NOT_APPROVE') {
            await createNotification({
                organizationId,
                type: 'CERTIFICATE_NOT_APPROVED',
                title: 'Certificate Not Approved',
                message: `Your certificate request for "${toSafeText(enrollment?.courses?.title) || 'Course'}" was not approved yet.`,
                payload: {
                    kind: 'certificate_not_approved',
                    enrollmentId: Number(enrollment.id || 0),
                    courseId: Number(enrollment.courseId || 0),
                    courseName: toSafeText(enrollment?.courses?.title) || 'Course',
                    actionUrl: '/training-results',
                },
                severity: 'critical',
                category: 'COURSE',
                createdBy: session.uid,
                recipientUserIds: [Number(enrollment.userId || 0)],
            });
        }

        return NextResponse.json({
            success: true,
            action,
            certificate: {
                id: Number(certificate.id || 0),
                status: String(certificate.status || '').toUpperCase(),
                verifyCode: certificate.verifyCode || '',
                issuedAt: certificate.issuedAt || null,
            },
        });
    } catch (err) {
        console.error('[reports/certificate-report][PATCH] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
