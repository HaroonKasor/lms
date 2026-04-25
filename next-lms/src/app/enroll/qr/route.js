import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySessionToken } from '@/lib/session';
import { getRequestSession } from '@/lib/server/auth';
import {
    evaluateLearnWindow,
    evaluateRegisterWindow,
    getCourseCompatMaps,
    getSectionCompatMaps,
} from '@/lib/server/compat-db';
import { ensureDefaultOrganization, listUserRoleCodes } from '@/lib/server/enterprise-context';
import { createAdminNotification } from '@/lib/server/notifications';
import {
    findMissingPrerequisites,
    resolvePrerequisiteCourses,
} from '@/lib/server/enrollment-rules';

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

function buildLoginRedirectUrl(requestUrl, origin) {
    const loginUrl = new URL('/login', origin || requestUrl.origin);
    loginUrl.searchParams.set('next', `${requestUrl.pathname}${requestUrl.search}`);
    return loginUrl;
}

function buildFallbackRedirect(requestUrl, code = 'invalid_qr', origin) {
    const fallback = new URL('/dashboard', origin || requestUrl.origin);
    fallback.searchParams.set('qr', code);
    return fallback;
}

function resolveDisplayName(user) {
    const first = String(user?.profile?.firstName || '').trim();
    const last = String(user?.profile?.lastName || '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full || String(user?.username || '').trim() || String(user?.email || '').trim() || 'Learner';
}

function isTruthyFlag(value) {
    if (value === true) return true;
    if (value === false || value == null) return false;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return false;
        if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    return Boolean(value);
}

function normalizeEnrollmentRoleCode(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return '';
    if (normalized === 'ADMIN' || normalized === 'ADMINISTRATOR') return 'ADMIN';
    if (normalized === 'INSTRUCTOR' || normalized === 'INSTRUCTURE' || normalized === 'TEACHER') return 'INSTRUCTOR';
    if (normalized === 'LEARNER' || normalized === 'USER' || normalized === 'STUDENT') return 'LEARNER';
    return '';
}

function normalizeEnrollmentRoleCodes(input) {
    const source = Array.isArray(input) ? input : [input];
    const normalized = Array.from(new Set(source.map(normalizeEnrollmentRoleCode).filter(Boolean)));
    if (normalized.length > 0) return normalized;
    return ['LEARNER'];
}

function getAllowedRoleCodesForSection(sectionId, sectionSettingsBySectionId = {}) {
    const key = String(sectionId || '').trim();
    const sectionSettings = key ? (sectionSettingsBySectionId?.[key] || {}) : {};
    return normalizeEnrollmentRoleCodes(sectionSettings?.groups || []);
}

function canRoleEnroll(roleCodes = [], allowedRoleCodes = []) {
    const allowed = new Set(normalizeEnrollmentRoleCodes(allowedRoleCodes));
    return normalizeEnrollmentRoleCodes(roleCodes).some((code) => allowed.has(code));
}

export async function GET(request) {
    try {
        const requestUrl = new URL(request.url);
        const appBaseUrl = resolveAppBaseUrl(request);
        const appOrigin = appBaseUrl || requestUrl.origin;
        const session = await getRequestSession(request);
        if (!session?.uid) {
            return NextResponse.redirect(buildLoginRedirectUrl(requestUrl, appOrigin), 307);
        }

        const token = String(requestUrl.searchParams.get('t') || '').trim();
        if (!token) {
            return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'missing_token', appOrigin), 307);
        }

        const payload = await verifySessionToken(token);
        if (!payload || payload.kind !== 'qr-enroll') {
            return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'invalid_token', appOrigin), 307);
        }

        const courseId = Number(payload.courseId || 0);
        const sectionIdRaw = Number(payload.sectionId || 0);
        const sectionId = Number.isInteger(sectionIdRaw) && sectionIdRaw > 0 ? sectionIdRaw : null;
        if (!Number.isInteger(courseId) || courseId <= 0) {
            return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'invalid_course', appOrigin), 307);
        }

        const organizationId = await ensureDefaultOrganization();
        const course = await prisma.course.findFirst({
            where: { id: courseId, organization_id: organizationId },
            select: { id: true, title: true, maxEnrollment: true },
        });
        if (!course) {
            return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'course_not_found', appOrigin), 307);
        }

        const courseCompatMaps = await getCourseCompatMaps([course.id]);
        const courseAutoApprove = courseCompatMaps?.autoApproveByCourseId?.[String(course.id)] !== false;
        const courseSettings = courseCompatMaps?.courseSettingsByCourseId?.[String(course.id)] || {};
        const prerequisiteCourses = await resolvePrerequisiteCourses({
            organizationId,
            prerequisites: courseSettings?.prerequisites || [],
            excludeCourseId: course.id,
        });

        const existing = await prisma.enrollment.findUnique({
            where: {
                userId_courseId_organization_id: {
                    userId: Number(session.uid),
                    courseId: course.id,
                    organization_id: organizationId,
                },
            },
            select: { id: true, status: true },
        });
        const existingStatus = String(existing?.status || '').toLowerCase();
        const hasActiveExistingEnrollment = Boolean(
            existing && !['dropped', 'cancelled'].includes(existingStatus)
        );
        const shouldReactivateEnrollment = Boolean(
            existing && ['dropped', 'cancelled'].includes(existingStatus)
        );
        let effectiveAutoApprove = courseAutoApprove;

        if (prerequisiteCourses.length > 0 && !hasActiveExistingEnrollment) {
            const missingPrerequisites = await findMissingPrerequisites({
                userId: Number(session.uid),
                organizationId,
                prerequisiteCourses,
            });
            if (missingPrerequisites.length > 0) {
                return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'missing_prerequisites', appOrigin), 307);
            }
        }

        if (!session.isAdmin) {
            const courseWindow = evaluateRegisterWindow(courseSettings);
            if (!courseWindow.allowed) {
                return NextResponse.redirect(
                        buildFallbackRedirect(
                            requestUrl,
                            courseWindow.reason === 'not_open_yet' ? 'course_register_not_open' : 'course_register_closed',
                            appOrigin
                        ),
                        307
                    );
            }
        }

        let validSectionId = null;
        let selectedSection = null;
        let sectionSettingsBySectionId = {};
        if (sectionId) {
            selectedSection = await prisma.section.findFirst({
                where: {
                    id: sectionId,
                    courseId: course.id,
                },
                select: { id: true, isActive: true, maxLearner: true },
            });
            if (!selectedSection?.id || selectedSection.isActive === false) {
                return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'invalid_section', appOrigin), 307);
            }
        } else {
            selectedSection = await prisma.section.findFirst({
                where: {
                    courseId: course.id,
                    isActive: true,
                },
                select: { id: true, isActive: true, maxLearner: true },
                orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
            });
        }

        if (selectedSection?.id) {
            const sectionCompatMaps = await getSectionCompatMaps([selectedSection.id]);
            sectionSettingsBySectionId = sectionCompatMaps?.sectionSettingsBySectionId || {};
            const sectionSettings = sectionSettingsBySectionId?.[String(selectedSection.id)] || {};

            const targetRoleCodes = normalizeEnrollmentRoleCodes(
                await listUserRoleCodes(Number(session.uid), organizationId)
            );
            const allowedRoleCodes = getAllowedRoleCodesForSection(
                selectedSection.id,
                sectionSettingsBySectionId
            );
            if (!canRoleEnroll(targetRoleCodes, allowedRoleCodes)) {
                return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'forbidden_by_role', appOrigin), 307);
            }

            if (typeof sectionSettings?.autoApprove === 'boolean') {
                effectiveAutoApprove = sectionSettings.autoApprove;
            }

            if (!session.isAdmin) {
                const sectionRegisterWindow = evaluateRegisterWindow(sectionSettings);
                if (!sectionRegisterWindow.allowed) {
                    return NextResponse.redirect(
                        buildFallbackRedirect(
                            requestUrl,
                            sectionRegisterWindow.reason === 'not_open_yet' ? 'section_register_not_open' : 'section_register_closed',
                            appOrigin
                        ),
                        307
                    );
                }

                const sectionLearnWindow = evaluateLearnWindow(sectionSettings);
                if (!sectionLearnWindow.allowed) {
                    return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'section_expired', appOrigin), 307);
                }
            }

            const sectionMaxLearner = Number(selectedSection.maxLearner || 0);
            const hasSectionCapacity = Number.isFinite(sectionMaxLearner) && sectionMaxLearner > 0;
            const isSectionUnlimited = isTruthyFlag(sectionSettings?.registerUnlimit) || isTruthyFlag(sectionSettings?.maxLearnerUnlimit) || !hasSectionCapacity;
            if (sectionMaxLearner > 0 && !isSectionUnlimited && !hasActiveExistingEnrollment) {
                const reservedSeats = await prisma.learningProgress.findMany({
                    where: {
                        sectionId: selectedSection.id,
                        enrollments: {
                            organization_id: organizationId,
                            status: { notIn: ['dropped', 'cancelled'] },
                        },
                    },
                    distinct: ['enrollmentId'],
                    select: { enrollmentId: true },
                });
                if (reservedSeats.length >= sectionMaxLearner) {
                    return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'section_full', appOrigin), 307);
                }
            }

            validSectionId = selectedSection.id;
        }

        const shouldUpgradePendingEnrollment = Boolean(
            existing && existingStatus === 'enrolled' && effectiveAutoApprove
        );

        const courseMaxEnrollment = Number(course.maxEnrollment || 0);
        const hasCourseCapacity = Number.isFinite(courseMaxEnrollment) && courseMaxEnrollment > 0;
        const isCourseUnlimited = isTruthyFlag(courseSettings?.registerUnlimit) || isTruthyFlag(courseSettings?.maxLearnerUnlimit) || !hasCourseCapacity;
        // When QR contains sectionId, enforce section capacity only.
        const shouldCheckCourseCapacity = !validSectionId;
        if (shouldCheckCourseCapacity && !hasActiveExistingEnrollment && !isCourseUnlimited) {
            const currentCount = await prisma.enrollment.count({
                where: {
                    organization_id: organizationId,
                    courseId: course.id,
                    status: { notIn: ['dropped', 'cancelled'] },
                },
            });
            if (currentCount >= courseMaxEnrollment) {
                return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'course_full', appOrigin), 307);
            }
        }

        const enrollment = await prisma.enrollment.upsert({
            where: {
                userId_courseId_organization_id: {
                    userId: Number(session.uid),
                    courseId: course.id,
                    organization_id: organizationId,
                },
            },
            update: (shouldReactivateEnrollment || shouldUpgradePendingEnrollment)
                ? {
                    status: effectiveAutoApprove ? 'in_progress' : 'enrolled',
                    progressPercent: 0,
                    startedAt: null,
                    completedAt: null,
                    lastActivityAt: null,
                }
                : {},
            create: {
                userId: Number(session.uid),
                courseId: course.id,
                organization_id: organizationId,
                status: effectiveAutoApprove ? 'in_progress' : 'enrolled',
                progressPercent: 0,
            },
            select: { id: true, userId: true, courseId: true, status: true },
        });

        if (validSectionId) {
            try {
                await prisma.learningProgress.upsert({
                    where: {
                        enrollmentId_sectionId: {
                            enrollmentId: enrollment.id,
                            sectionId: validSectionId,
                        },
                    },
                    update: {},
                    create: {
                        enrollmentId: enrollment.id,
                        courseId: course.id,
                        sectionId: validSectionId,
                        status: 'not_started',
                        progressPercent: 0,
                    },
                });
            } catch (progressErr) {
                console.error('[enroll/qr][GET] reserve section seat failed', progressErr);
            }
        }

        const enrollmentStatus = String(enrollment?.status || '').toLowerCase();

        if (!effectiveAutoApprove && !session.isAdmin && !hasActiveExistingEnrollment) {
            try {
                const learner = await prisma.user.findUnique({
                    where: { id: Number(session.uid) },
                    include: { profile: true },
                });
                const learnerName = resolveDisplayName(learner);
                await createAdminNotification({
                    organizationId,
                    type: 'ENROLLMENT_APPROVAL_REQUESTED',
                    title: 'Enrollment Approval Requested',
                    message: `${learnerName} requested enrollment for "${String(course.title || 'Course').trim()}".`,
                    payload: {
                        kind: 'enrollment_approval_requested',
                        enrollmentId: Number(enrollment.id || 0),
                        courseId: Number(course.id || 0),
                        userId: Number(session.uid || 0),
                        actionUrl: '/admin-dashboard/learn/enrollment',
                    },
                    createdBy: Number(session.uid || 0),
                });
            } catch (notifyErr) {
                console.error('[enroll/qr][GET] create admin notification failed', notifyErr);
            }
        }

        const destination = enrollmentStatus === 'enrolled' && !session.isAdmin
            ? new URL(`/courses/${course.id}`, appOrigin)
            : new URL(`/courses/${course.id}/learn`, appOrigin);

        if (enrollmentStatus === 'enrolled' && !session.isAdmin) {
            destination.searchParams.set('pendingApproval', '1');
        } else {
            destination.searchParams.set('launch', '1');
            if (validSectionId) {
                destination.searchParams.set('sectionId', String(validSectionId));
            }
        }
        destination.searchParams.set('fromQr', '1');

        return NextResponse.redirect(destination, 307);
    } catch (err) {
        console.error('[enroll/qr][GET] failed', err);
        const requestUrl = new URL(request.url);
        const appBaseUrl = resolveAppBaseUrl(request);
        const appOrigin = appBaseUrl || requestUrl.origin;
        return NextResponse.redirect(buildFallbackRedirect(requestUrl, 'internal_error', appOrigin), 307);
    }
}
