import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    evaluateLearnWindow,
    evaluateRegisterWindow,
    getCourseCompatMaps,
    getSectionCompatMaps,
    listContents,
} from '@/lib/server/compat-db';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { ensureDefaultOrganization, resolveUserId } from '@/lib/server/enterprise-context';
import { createAdminNotification, createNotification } from '@/lib/server/notifications';

const ENROLLMENT_STATUS_RANK = {
    COMPLETED: 5,
    LEARNING: 4,
    APPROVED: 3,
    PENDING: 2,
    FAILED: 1,
    CANCELLED: 0,
};

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

function toProgressNumber(progressPercent) {
    const n = Number(progressPercent || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeThumbnail(thumbnail) {
    const value = String(thumbnail || '').trim();
    if (!value) return '/course.png';
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.startsWith('/api/uploads/image?file=')) return value;
    if (value.startsWith('api/uploads/image?file=')) return `/${value}`;
    const uploadPathMatch = value.match(/(?:^https?:\/\/[^/]+)?\/?uploads\/courses\/([^/?#]+)/i);
    if (uploadPathMatch?.[1]) {
        return `/api/uploads/image?file=${encodeURIComponent(uploadPathMatch[1])}`;
    }
    if (value.startsWith('/')) return value;
    if (value.startsWith('uploads/')) return `/${value}`;
    return '/course.png';
}

function toLegacyStatus(status) {
    const value = String(status || '').toUpperCase();
    if (value === 'PENDING' || value === 'APPROVED' || value === 'LEARNING' || value === 'COMPLETED' || value === 'FAILED' || value === 'CANCELLED') {
        return value;
    }
    if (value === 'COMPLETED') return 'COMPLETED';
    if (value === 'DROPPED') return 'FAILED';
    if (value === 'CANCELLED') return 'CANCELLED';
    return 'APPROVED';
}

function resolveLegacyStatus(enrollment, autoApproveByCourseId = {}) {
    if (!enrollment || typeof enrollment !== 'object') {
        return toLegacyStatus(enrollment);
    }

    const direct = toLegacyStatus(enrollment.status);
    if (direct === 'PENDING' || direct === 'APPROVED' || direct === 'LEARNING' || direct === 'COMPLETED' || direct === 'FAILED' || direct === 'CANCELLED') {
        const dbStatus = String(enrollment.status || '').toLowerCase();
        if (!['enrolled', 'in_progress', 'completed', 'dropped', 'cancelled'].includes(dbStatus)) {
            return direct;
        }
    }

    const dbStatus = String(enrollment.status || '').toLowerCase();
    const progress = Number(enrollment.progressPercent ?? enrollment.progress ?? 0);
    const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    const hasStarted = Boolean(enrollment.startedAt) || safeProgress > 0;

    if (dbStatus === 'completed' || Boolean(enrollment.completedAt)) return 'COMPLETED';
    if (dbStatus === 'dropped') return 'FAILED';
    if (dbStatus === 'cancelled') return 'CANCELLED';

    if (dbStatus === 'in_progress') {
        return hasStarted ? 'LEARNING' : 'APPROVED';
    }

    if (dbStatus === 'enrolled') {
        const courseKey = String(enrollment?.courses?.id || enrollment?.courseId || '').trim();
        const autoApprove = courseKey && typeof autoApproveByCourseId?.[courseKey] === 'boolean'
            ? Boolean(autoApproveByCourseId[courseKey])
            : true;
        return autoApprove ? 'APPROVED' : 'PENDING';
    }

    return 'APPROVED';
}

function toDbStatus(status) {
    const value = String(status || '').toUpperCase();
    if (value === 'COMPLETED') return 'completed';
    if (value === 'LEARNING' || value === 'IN_PROGRESS' || value === 'APPROVED') return 'in_progress';
    if (value === 'PENDING') return 'enrolled';
    if (value === 'FAILED' || value === 'DROPPED') return 'dropped';
    if (value === 'CANCELLED') return 'cancelled';
    return 'in_progress';
}

function toVirtualAssetFromContent(content) {
    if (!content) return null;

    const contentId = String(content.id || '').trim();
    if (!contentId) return null;

    const entryPoint = String(content.entryPoint || '').trim().replace(/^\/+/, '');
    const uploadedAt = content.uploadedAt || new Date().toISOString();

    return {
        id: null,
        title: String(content.title || 'Learning Content').trim(),
        assetType: 'xapi',
        storagePath: `content/${contentId}`,
        publicUrl: entryPoint ? `/${entryPoint}` : null,
        metadataJson: {
            kind: 'content',
            contentId,
            title: String(content.title || '').trim(),
            type: String(content.type || 'tincan').trim() || 'tincan',
            fileName: String(content.fileName || '').trim(),
            entryPoint,
            status: String(content.status || 'active').trim(),
            activities: Array.isArray(content.activities) ? content.activities : [],
            completionPolicy: content.completionPolicy ?? null,
            packageConfig: content.packageConfig ?? null,
            uploadedAt,
        },
        uploadedAt,
    };
}

function normalizeSection(section, sectionSettingsBySectionId = {}) {
    if (!section) return null;

    const metadata = section?.asset?.metadataJson && typeof section.asset.metadataJson === 'object'
        ? section.asset.metadataJson
        : {};
    const sectionKey = String(section?.id || '').trim();
    const settings = sectionSettingsBySectionId?.[sectionKey] || {};

    return {
        ...section,
        sectionType: String(section.sectionType || '').toUpperCase(),
        registerDateFrom: String(settings?.registerDateFrom || '').trim(),
        registerDateTo: String(settings?.registerDateTo || '').trim(),
        registerUnlimit: Boolean(settings?.registerUnlimit),
        learnDateTo: String(settings?.learnDateTo || '').trim(),
        learnDateUnlimit: settings?.learnDateUnlimit !== false,
        asset: section.asset
            ? {
                ...section.asset,
                metadataJson: metadata,
            }
            : null,
    };
}

function pickPrimarySection(sections = []) {
    if (!Array.isArray(sections) || sections.length === 0) return null;
    const sorted = [...sections].sort((a, b) => {
        const assetScoreA = a?.asset ? 1 : 0;
        const assetScoreB = b?.asset ? 1 : 0;
        if (assetScoreB !== assetScoreA) return assetScoreB - assetScoreA;

        const activeScoreA = a?.isActive ? 1 : 0;
        const activeScoreB = b?.isActive ? 1 : 0;
        if (activeScoreB !== activeScoreA) return activeScoreB - activeScoreA;

        const orderA = Number(a?.orderNo || 0);
        const orderB = Number(b?.orderNo || 0);
        if (orderA !== orderB) return orderA - orderB;

        return Number(a?.id || 0) - Number(b?.id || 0);
    });
    return sorted[0] || null;
}

function normalizeEnrollmentCourse(
    enrollment,
    compatMaps = {},
    contentById = new Map(),
    reviewSummaryByCourseId = {},
    sectionSettingsBySectionId = {}
) {
    if (!enrollment?.courses) return enrollment;
    const courseKey = String(enrollment.courses.id);
    const normalizedEnrollmentId = Number(enrollment?.id || 0);
    const normalizedCourseId = Number(enrollment?.courseId || enrollment?.courses?.id || 0);
    const thumbnailByCourseId = compatMaps?.thumbnailByCourseId || {};
    const contentByCourseId = compatMaps?.contentByCourseId || {};
    const mappedContentId = String(contentByCourseId?.[courseKey] || '').trim() || null;
    const mappedContent = mappedContentId ? (contentById.get(mappedContentId) || null) : null;

    const primarySection = pickPrimarySection(enrollment?.courses?.sections || []);
    let section = normalizeSection(primarySection, sectionSettingsBySectionId);

    const virtualAsset = toVirtualAssetFromContent(mappedContent);
    if (virtualAsset) {
        if (section) {
            if (!section.asset) {
                section = {
                    ...section,
                    asset: virtualAsset,
                };
            }
        } else {
            section = {
                id: null,
                courseId: enrollment.courses.id,
                assetId: null,
                title: virtualAsset.title || enrollment.courses.title || 'Learning Content',
                orderNo: 1,
                sectionType: 'TINCAN',
                isActive: true,
                isPublic: false,
                maxLearner: null,
                asset: virtualAsset,
            };
        }
    }

    const profile = enrollment?.organization_users?.users?.profile || null;
    const username = String(enrollment?.organization_users?.users?.username || '').trim();
    const email = String(enrollment?.organization_users?.users?.email || '').trim();
    const firstName = String(profile?.firstName || '').trim();
    const lastName = String(profile?.lastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || username || email || `User ${enrollment.userId}`;
    const learningProgressRows = Array.isArray(enrollment?.learning_progress)
        ? enrollment.learning_progress
        : [];
    const sectionProgressRows = section?.id
        ? learningProgressRows.filter((row) => Number(row?.sectionId || 0) === Number(section.id))
        : learningProgressRows;
    const latestProgressRow = (sectionProgressRows[0] || learningProgressRows[0] || null);
    const progressStatus = String(latestProgressRow?.status || '').toLowerCase();
    const progressPercent = Number(latestProgressRow?.progressPercent || 0);
    const progressSaysFailed =
        progressStatus === 'failed' ||
        latestProgressRow?.success === false ||
        latestProgressRow?.completion === false;
    const progressSaysCompleted =
        !progressSaysFailed &&
        progressStatus === 'completed' &&
        (
            latestProgressRow?.success === true ||
            latestProgressRow?.completion === true ||
            (Number.isFinite(progressPercent) && progressPercent >= 100)
        );

    const effectiveEnrollment = progressSaysCompleted
        ? {
            ...enrollment,
            status: 'completed',
            progressPercent: 100,
            completedAt: enrollment?.completedAt || enrollment?.lastActivityAt || new Date().toISOString(),
        }
        : enrollment;

    const legacyStatus = resolveLegacyStatus(effectiveEnrollment, compatMaps?.autoApproveByCourseId || {});
    const courseAutoApprove = compatMaps?.autoApproveByCourseId?.[courseKey];
    const courseReviewSummary = reviewSummaryByCourseId?.[courseKey] || {};
    const reviewCount = Number(courseReviewSummary?.reviewCount || 0);
    const averageRating = Number(courseReviewSummary?.averageRating || 0);
    const normalizedSections = (Array.isArray(enrollment?.courses?.sections) ? enrollment.courses.sections : [])
        .map((item) => normalizeSection(item, sectionSettingsBySectionId))
        .filter(Boolean);

    return {
        ...enrollment,
        id: Number.isInteger(normalizedEnrollmentId) && normalizedEnrollmentId > 0
            ? normalizedEnrollmentId
            : enrollment?.id,
        courseId: Number.isInteger(normalizedCourseId) && normalizedCourseId > 0
            ? normalizedCourseId
            : enrollment?.courseId,
        status: legacyStatus,
        progress: toProgressNumber(
            progressSaysCompleted
                ? 100
                : Math.max(
                    Number(enrollment.progressPercent || 0),
                    Number(latestProgressRow?.progressPercent || 0)
                )
        ),
        sectionId: section?.id ?? null,
        learner: {
            userId: Number(enrollment.userId),
            username,
            email,
            firstName,
            lastName,
            fullName,
        },
        course: {
            ...enrollment.courses,
            sections: normalizedSections,
            name: enrollment.courses.title || '',
            detail: '',
            category: enrollment.courses.categories?.name || '',
            categoryId: enrollment.courses.categoryId ?? null,
            certificate: Boolean(enrollment.courses.hasCertificate),
            certificateMode: String(enrollment.courses.certificateMode || 'none').toLowerCase(),
            autoApprove: typeof courseAutoApprove === 'boolean' ? courseAutoApprove : true,
            thumbnail: normalizeThumbnail(thumbnailByCourseId?.[courseKey]),
            tincanId: mappedContentId,
            reviewCount: Number.isFinite(reviewCount) && reviewCount > 0 ? reviewCount : 0,
            averageRating: Number.isFinite(averageRating) && averageRating > 0 ? Number(averageRating.toFixed(1)) : 0,
        },
        certificate: enrollment?.certificates
            ? {
                id: Number(enrollment.certificates.id || 0),
                verifyCode: String(enrollment.certificates.verifyCode || '').trim(),
                status: String(enrollment.certificates.status || '').toUpperCase(),
                certificateUrl: String(enrollment.certificates.certificateUrl || '').trim(),
                issuedAt: enrollment.certificates.issuedAt || null,
            }
            : null,
        section,
    };
}

function getStatusRank(status) {
    const key = String(status || '').toUpperCase();
    return ENROLLMENT_STATUS_RANK[key] ?? -1;
}

function toTime(value) {
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
}

function selectPreferredEnrollment(current, candidate) {
    if (!current) return candidate;

    const currentRank = getStatusRank(current.status);
    const candidateRank = getStatusRank(candidate.status);
    if (candidateRank > currentRank) return candidate;
    if (candidateRank < currentRank) return current;

    const currentProgress = Number(current.progressPercent || 0);
    const candidateProgress = Number(candidate.progressPercent || 0);
    if (candidateProgress > currentProgress) return candidate;
    if (candidateProgress < currentProgress) return current;

    const currentUpdated = toTime(current.lastActivityAt || current.enrolledAt);
    const candidateUpdated = toTime(candidate.lastActivityAt || candidate.enrolledAt);
    if (candidateUpdated > currentUpdated) return candidate;
    if (candidateUpdated < currentUpdated) return current;

    return Number(candidate.id || 0) > Number(current.id || 0) ? candidate : current;
}

function collapseEnrollmentsByCourse(enrollments = []) {
    const byCourse = new Map();
    for (const enrollment of enrollments) {
        const courseId = Number(enrollment?.courseId || enrollment?.courses?.id || 0);
        if (!Number.isInteger(courseId) || courseId <= 0) continue;
        const prev = byCourse.get(courseId);
        byCourse.set(courseId, selectPreferredEnrollment(prev, enrollment));
    }

    return Array.from(byCourse.values()).sort((a, b) => {
        const aTime = toTime(a?.lastActivityAt || a?.enrolledAt);
        const bTime = toTime(b?.lastActivityAt || b?.enrolledAt);
        return bTime - aTime;
    });
}

function collectSectionIds(enrollments = []) {
    const ids = new Set();
    for (const enrollment of enrollments || []) {
        const selectedSectionId = Number(enrollment?.section?.id || enrollment?.sectionId || 0);
        if (Number.isInteger(selectedSectionId) && selectedSectionId > 0) {
            ids.add(selectedSectionId);
        }
        const sections = Array.isArray(enrollment?.courses?.sections) ? enrollment.courses.sections : [];
        for (const section of sections) {
            const sectionId = Number(section?.id || 0);
            if (Number.isInteger(sectionId) && sectionId > 0) ids.add(sectionId);
        }
    }
    return Array.from(ids);
}

function isSameSessionUser(userKey, session) {
    const raw = String(userKey || '').trim();
    if (!raw) return true;

    const asNumber = Number(raw);
    if (Number.isInteger(asNumber) && asNumber > 0) {
        return asNumber === Number(session?.uid || 0);
    }

    const normalized = raw.toLowerCase();
    return normalized === String(session?.user?.username || '').toLowerCase()
        || normalized === String(session?.user?.email || '').toLowerCase();
}

function resolveDisplayName(user) {
    const first = String(user?.profile?.firstName || '').trim();
    const last = String(user?.profile?.lastName || '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full || String(user?.username || '').trim() || String(user?.email || '').trim() || 'Learner';
}

async function buildContentMapForEnrollments(enrollments = [], compatMaps = {}) {
    const contentByCourseId = compatMaps?.contentByCourseId || {};
    const contentIds = Array.from(
        new Set(
            (enrollments || [])
                .map((enrollment) => contentByCourseId[String(enrollment?.courses?.id || '')])
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        )
    );

    if (contentIds.length === 0) return new Map();

    const contents = await listContents();
    const sourceMap = new Map((contents || []).map((content) => [String(content.id || '').trim(), content]));
    const result = new Map();
    for (const id of contentIds) {
        if (sourceMap.has(id)) {
            result.set(id, sourceMap.get(id));
        }
    }
    return result;
}

async function buildReviewSummaryByCourse(courseIds = []) {
    const normalizedIds = Array.from(
        new Set(
            (courseIds || [])
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    );
    if (normalizedIds.length === 0) return {};

    const grouped = await prisma.course_reviews.groupBy({
        by: ['course_id'],
        where: {
            course_id: { in: normalizedIds },
            is_public: true,
        },
        _count: { _all: true },
        _avg: { rating: true },
    });

    return Object.fromEntries(
        grouped.map((row) => {
            const courseId = Number(row?.course_id || 0);
            const count = Number(row?._count?._all || 0);
            const average = Number(row?._avg?.rating || 0);
            return [
                String(courseId),
                {
                    reviewCount: Number.isFinite(count) && count > 0 ? count : 0,
                    averageRating: Number.isFinite(average) && average > 0 ? Number(average.toFixed(1)) : 0,
                },
            ];
        })
    );
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const { userId = 'anonymous', courseId, sectionId } = body;

        if (!courseId) {
            return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
        }
        const numericCourseId = parseInt(courseId, 10);
        if (!Number.isInteger(numericCourseId) || numericCourseId <= 0) {
            return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });
        }

        let numericUserId = session.uid;
        if (session.isAdmin && userId) {
            const resolved = await resolveUserId(userId);
            if (resolved) numericUserId = resolved;
        }

        const existingEnrollment = await prisma.enrollment.findUnique({
            where: {
                userId_courseId_organization_id: {
                    userId: numericUserId,
                    courseId: numericCourseId,
                    organization_id: organizationId,
                },
            },
            select: { id: true, status: true },
        });
        const existingStatus = String(existingEnrollment?.status || '').toLowerCase();
        const hasActiveExistingEnrollment = Boolean(
            existingEnrollment && !['dropped', 'cancelled'].includes(existingStatus)
        );
        const shouldReactivateEnrollment = Boolean(
            existingEnrollment && ['dropped', 'cancelled'].includes(existingStatus)
        );
        const course = await prisma.course.findFirst({
            where: {
                id: numericCourseId,
                organization_id: organizationId,
            },
            select: { id: true, title: true, maxEnrollment: true },
        });
        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }
        const courseCompatMaps = await getCourseCompatMaps([course.id]);
        const courseAutoApprove = courseCompatMaps?.autoApproveByCourseId?.[String(course.id)] !== false;
        const courseSettings = courseCompatMaps?.courseSettingsByCourseId?.[String(course.id)] || {};
        const shouldUpgradePendingEnrollment = Boolean(
            existingEnrollment && existingStatus === 'enrolled' && courseAutoApprove
        );

        if (!session.isAdmin) {
            const courseWindow = evaluateRegisterWindow(courseSettings);
            if (!courseWindow.allowed) {
                const message = courseWindow.reason === 'not_open_yet'
                    ? 'ยังไม่ถึงช่วงเปิดลงทะเบียนของหลักสูตรนี้'
                    : 'ปิดรับลงทะเบียนหลักสูตรนี้แล้ว';
                return NextResponse.json({ error: message }, { status: 400 });
            }
        }

        let validatedSection = null;
        let sectionSettingsBySectionId = {};

        if (sectionId) {
            const numericSectionId = parseInt(sectionId, 10);
            if (!Number.isInteger(numericSectionId) || numericSectionId <= 0) {
                return NextResponse.json({ error: 'Invalid sectionId' }, { status: 400 });
            }
            const section = await prisma.section.findUnique({
                where: { id: numericSectionId },
                select: { id: true, courseId: true, maxLearner: true, isActive: true },
            });
            if (!section) {
                return NextResponse.json({ error: 'Section not found' }, { status: 404 });
            }
            if (Number(section.courseId) !== Number(course.id)) {
                return NextResponse.json({ error: 'Section does not belong to this course' }, { status: 400 });
            }
            if (section.isActive === false) {
                return NextResponse.json({ error: 'Section is inactive' }, { status: 400 });
            }

            const sectionCompatMaps = await getSectionCompatMaps([section.id]);
            sectionSettingsBySectionId = sectionCompatMaps?.sectionSettingsBySectionId || {};
            const sectionSettings = sectionSettingsBySectionId?.[String(section.id)] || {};

            if (!session.isAdmin) {
                const sectionRegisterWindow = evaluateRegisterWindow(sectionSettings);
                if (!sectionRegisterWindow.allowed) {
                    const message = sectionRegisterWindow.reason === 'not_open_yet'
                        ? 'ยังไม่ถึงช่วงเปิดลงทะเบียนของ Section นี้'
                        : 'ปิดรับลงทะเบียน Section นี้แล้ว';
                    return NextResponse.json({ error: message }, { status: 400 });
                }

                const sectionLearnWindow = evaluateLearnWindow(sectionSettings);
                if (!sectionLearnWindow.allowed) {
                    return NextResponse.json({ error: 'หมดระยะเวลาเรียนของ Section นี้แล้ว' }, { status: 400 });
                }
            }

            const sectionMaxLearner = Number(section.maxLearner || 0);
            const hasSectionCapacity = Number.isFinite(sectionMaxLearner) && sectionMaxLearner > 0;
            const isSectionUnlimited = isTruthyFlag(sectionSettings?.registerUnlimit) || isTruthyFlag(sectionSettings?.maxLearnerUnlimit) || !hasSectionCapacity;
            if (sectionMaxLearner > 0 && !isSectionUnlimited && !hasActiveExistingEnrollment) {
                const reservedSeats = await prisma.learningProgress.findMany({
                    where: {
                        sectionId: section.id,
                        enrollments: {
                            organization_id: organizationId,
                            status: { notIn: ['dropped', 'cancelled'] },
                        },
                    },
                    distinct: ['enrollmentId'],
                    select: { enrollmentId: true },
                });
                if (reservedSeats.length >= sectionMaxLearner) {
                    return NextResponse.json({ error: 'Section is full' }, { status: 400 });
                }
            }

            validatedSection = section;
        }

        if (!validatedSection?.id && (sectionId === undefined || sectionId === null || sectionId === '')) {
            const fallbackSection = await prisma.section.findFirst({
                where: {
                    courseId: course.id,
                    isActive: true,
                },
                orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                select: { id: true, courseId: true, maxLearner: true, isActive: true },
            });

            if (fallbackSection?.id) {
                const sectionCompatMaps = await getSectionCompatMaps([fallbackSection.id]);
                const fallbackSectionSettings = sectionCompatMaps?.sectionSettingsBySectionId?.[String(fallbackSection.id)] || {};
                sectionSettingsBySectionId = {
                    ...(sectionSettingsBySectionId || {}),
                    ...(sectionCompatMaps?.sectionSettingsBySectionId || {}),
                };

                if (!session.isAdmin) {
                    const sectionRegisterWindow = evaluateRegisterWindow(fallbackSectionSettings);
                    if (!sectionRegisterWindow.allowed) {
                        const message = sectionRegisterWindow.reason === 'not_open_yet'
                            ? 'ยังไม่ถึงช่วงเปิดลงทะเบียนของ Section นี้'
                            : 'ปิดรับลงทะเบียน Section นี้แล้ว';
                        return NextResponse.json({ error: message }, { status: 400 });
                    }

                    const sectionLearnWindow = evaluateLearnWindow(fallbackSectionSettings);
                    if (!sectionLearnWindow.allowed) {
                        return NextResponse.json({ error: 'หมดระยะเวลาเรียนของ Section นี้แล้ว' }, { status: 400 });
                    }
                }

                const sectionMaxLearner = Number(fallbackSection.maxLearner || 0);
                const hasSectionCapacity = Number.isFinite(sectionMaxLearner) && sectionMaxLearner > 0;
                const isSectionUnlimited = isTruthyFlag(fallbackSectionSettings?.registerUnlimit)
                    || isTruthyFlag(fallbackSectionSettings?.maxLearnerUnlimit)
                    || !hasSectionCapacity;

                if (sectionMaxLearner > 0 && !isSectionUnlimited && !hasActiveExistingEnrollment) {
                    const reservedSeats = await prisma.learningProgress.findMany({
                        where: {
                            sectionId: fallbackSection.id,
                            enrollments: {
                                organization_id: organizationId,
                                status: { notIn: ['dropped', 'cancelled'] },
                            },
                        },
                        distinct: ['enrollmentId'],
                        select: { enrollmentId: true },
                    });
                    if (reservedSeats.length >= sectionMaxLearner) {
                        return NextResponse.json({ error: 'Section is full' }, { status: 400 });
                    }
                }

                validatedSection = fallbackSection;
            }
        }

        const courseMaxEnrollment = Number(course.maxEnrollment || 0);
        const hasCourseCapacity = Number.isFinite(courseMaxEnrollment) && courseMaxEnrollment > 0;
        const isCourseUnlimited = isTruthyFlag(courseSettings?.registerUnlimit) || isTruthyFlag(courseSettings?.maxLearnerUnlimit) || !hasCourseCapacity;
        // When enrolling via a specific section, enforce section capacity only to avoid conflicting seat checks.
        const shouldCheckCourseCapacity = !validatedSection?.id;
        if (shouldCheckCourseCapacity && !isCourseUnlimited && !hasActiveExistingEnrollment) {
            const currentCount = await prisma.enrollment.count({
                where: {
                    organization_id: organizationId,
                    courseId: course.id,
                    status: { notIn: ['dropped', 'cancelled'] },
                },
            });
            if (currentCount >= courseMaxEnrollment) {
                return NextResponse.json({ error: 'Course is full' }, { status: 400 });
            }
        }

        const enrollment = await prisma.enrollment.upsert({
            where: {
                userId_courseId_organization_id: {
                    userId: numericUserId,
                    courseId: course.id,
                    organization_id: organizationId,
                },
            },
            update: (shouldReactivateEnrollment || shouldUpgradePendingEnrollment)
                ? {
                    status: courseAutoApprove ? 'in_progress' : 'enrolled',
                    progressPercent: 0,
                    startedAt: null,
                    completedAt: null,
                    lastActivityAt: null,
                }
                : {},
            create: {
                userId: numericUserId,
                courseId: course.id,
                organization_id: organizationId,
                status: courseAutoApprove ? 'in_progress' : 'enrolled',
                progressPercent: 0,
            },
            include: {
                certificates: true,
                courses: {
                    include: {
                        quizzes: { select: { id: true } },
                        categories: true,
                        sections: {
                            include: { asset: true },
                            orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                        },
                    },
                },
            },
        });

        if (validatedSection?.id) {
            try {
                await prisma.learningProgress.upsert({
                    where: {
                        enrollmentId_sectionId: {
                            enrollmentId: enrollment.id,
                            sectionId: validatedSection.id,
                        },
                    },
                    update: {},
                    create: {
                        enrollmentId: enrollment.id,
                        courseId: course.id,
                        sectionId: validatedSection.id,
                        status: 'not_started',
                        progressPercent: 0,
                    },
                });
            } catch (progressErr) {
                console.error('[enrollments/POST] reserve section seat failed', progressErr);
            }
        }

        const compatMaps = await getCourseCompatMaps([enrollment.courses.id]);
        const sectionIds = collectSectionIds([enrollment]);
        const [contentById, reviewSummaryByCourseId, hydratedSectionCompatMaps] = await Promise.all([
            buildContentMapForEnrollments([enrollment], compatMaps),
            buildReviewSummaryByCourse([enrollment?.courses?.id]),
            getSectionCompatMaps(sectionIds),
        ]);
        const effectiveSectionSettings = {
            ...(sectionSettingsBySectionId || {}),
            ...(hydratedSectionCompatMaps?.sectionSettingsBySectionId || {}),
        };

        if (!courseAutoApprove && !session.isAdmin && !hasActiveExistingEnrollment) {
            const learner = await prisma.user.findUnique({
                where: { id: numericUserId },
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
                    userId: Number(numericUserId || 0),
                    actionUrl: '/admin-dashboard/learn/enrollment',
                },
                createdBy: session.uid,
            });
        }

        return NextResponse.json({
            success: true,
            enrollment: normalizeEnrollmentCourse(
                enrollment,
                compatMaps,
                contentById,
                reviewSummaryByCourseId,
                effectiveSectionSettings
            ),
        });
    } catch (err) {
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
        }
        console.error('[enrollments/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || '';
        const courseId = searchParams.get('courseId');
        const raw = searchParams.get('raw');

        if (!session.isAdmin && userId && !isSameSessionUser(userId, session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let numericUserId = session.uid;
        if (session.isAdmin && userId) {
            const resolved = await resolveUserId(userId);
            if (!resolved) return NextResponse.json([]);
            numericUserId = resolved;
        }

        const where = { organization_id: organizationId };
        if (!session.isAdmin || userId) {
            where.userId = numericUserId;
        }
        if (courseId) where.courseId = parseInt(courseId, 10);

        const enrollmentIncludeBase = {
            organization_users: {
                include: {
                    users: {
                        include: {
                            profile: true,
                        },
                    },
                },
            },
            courses: {
                include: {
                    quizzes: { select: { id: true } },
                    categories: true,
                    sections: {
                        include: { asset: true },
                        orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                    },
                },
            },
            certificates: true,
        };

        let enrollments = [];
        try {
            enrollments = await prisma.enrollment.findMany({
                where,
                include: {
                    ...enrollmentIncludeBase,
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
                        take: 10,
                    },
                },
                orderBy: { enrolledAt: 'desc' },
            });
        } catch (includeErr) {
            const code = String(includeErr?.code || '');
            const msg = String(includeErr?.message || '').toLowerCase();
            const shouldFallback =
                code === 'P2021' || // missing table
                code === 'P2022' || // missing column
                msg.includes('learning_progress');
            if (!shouldFallback) throw includeErr;

            enrollments = await prisma.enrollment.findMany({
                where,
                include: enrollmentIncludeBase,
                orderBy: { enrolledAt: 'desc' },
            });
        }

        const compatMaps = await getCourseCompatMaps(
            enrollments.map((enrollment) => enrollment?.courses?.id).filter(Boolean)
        );
        const normalized = enrollments.map((enrollment) => ({
            ...enrollment,
            status: resolveLegacyStatus(enrollment, compatMaps?.autoApproveByCourseId || {}),
        }));
        const collapsed = raw === '1' ? normalized : collapseEnrollmentsByCourse(normalized);

        const sectionIds = collectSectionIds(collapsed);
        const [contentById, reviewSummaryByCourseId, sectionCompatMaps] = await Promise.all([
            buildContentMapForEnrollments(collapsed, compatMaps),
            buildReviewSummaryByCourse(collapsed.map((enrollment) => enrollment?.courses?.id || enrollment?.courseId)),
            getSectionCompatMaps(sectionIds),
        ]);
        return NextResponse.json(
            collapsed.map((enrollment) => normalizeEnrollmentCourse(
                enrollment,
                compatMaps,
                contentById,
                reviewSummaryByCourseId,
                sectionCompatMaps?.sectionSettingsBySectionId || {}
            ))
        );
    } catch (err) {
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
        }
        console.error('[enrollments/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;
        const organizationId = session.organizationId || await ensureDefaultOrganization();

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const { id, status, progress } = body;

        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

        const enrollmentId = parseInt(id, 10);
        const existing = await prisma.enrollment.findUnique({
            where: { id: enrollmentId },
            select: { id: true, userId: true, courseId: true, status: true, progressPercent: true, completedAt: true },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
        }
        if (!session.isAdmin && Number(existing.userId) !== Number(session.uid)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const patchCompatMaps = await getCourseCompatMaps([existing.courseId]);
        const existingStatus = String(
            resolveLegacyStatus(existing, patchCompatMaps?.autoApproveByCourseId || {})
        ).toUpperCase();
        if (!session.isAdmin && existingStatus === 'PENDING') {
            return NextResponse.json({ error: 'Awaiting admin approval' }, { status: 403 });
        }
        const incomingStatus = status ? String(status).toUpperCase() : '';
        const existingProgress = Number(existing.progressPercent || 0);
        const incomingProgress = progress !== undefined ? Number(progress) : undefined;
        const safeIncomingProgress = Number.isFinite(incomingProgress)
            ? Math.max(0, Math.min(100, incomingProgress))
            : undefined;
        const allowsCompletionDowngrade =
            incomingStatus === 'LEARNING'
            || incomingStatus === 'APPROVED'
            || incomingStatus === 'FAILED'
            || incomingStatus === 'PENDING';
        const shouldPreserveCompleted =
            existingStatus === 'COMPLETED' &&
            !!incomingStatus &&
            incomingStatus !== 'COMPLETED' &&
            !allowsCompletionDowngrade;
        const isDowngradingCompleted =
            existingStatus === 'COMPLETED' &&
            !!incomingStatus &&
            incomingStatus !== 'COMPLETED' &&
            allowsCompletionDowngrade;
        const shouldComplete =
            incomingStatus === 'COMPLETED' ||
            (!incomingStatus && existingStatus === 'COMPLETED') ||
            shouldPreserveCompleted;

        const updateData = {};
        if (shouldComplete) {
            updateData.status = 'completed';
            updateData.progressPercent = 100;
            if (!existing.completedAt) {
                updateData.completedAt = new Date();
            }
        } else {
            if (incomingStatus) {
                updateData.status = toDbStatus(incomingStatus);
                if (incomingStatus === 'LEARNING') updateData.startedAt = new Date();
            }
            if (isDowngradingCompleted) {
                updateData.completedAt = null;
            }
            if (safeIncomingProgress !== undefined) {
                const cappedProgress = Math.min(99, safeIncomingProgress);
                updateData.progressPercent = isDowngradingCompleted
                    ? cappedProgress
                    : Math.max(existingProgress, cappedProgress);
            } else if (isDowngradingCompleted) {
                updateData.progressPercent = Math.min(99, Math.max(0, existingProgress || 99));
            }
        }

        const enrollment = await prisma.enrollment.update({
            where: { id: enrollmentId },
            data: updateData,
            include: {
                courses: {
                    select: {
                        id: true,
                        title: true,
                        hasCertificate: true,
                        certificateMode: true,
                    },
                },
            },
        });

        if (session.isAdmin && existingStatus === 'PENDING' && incomingStatus === 'APPROVED') {
            await createNotification({
                organizationId,
                type: 'ENROLLMENT_APPROVED',
                title: 'Enrollment Approved',
                message: `Your enrollment for "${String(enrollment?.courses?.title || 'Course').trim()}" is approved. You can start learning now.`,
                payload: {
                    kind: 'enrollment_approved',
                    enrollmentId: Number(enrollment.id || 0),
                    courseId: Number(enrollment.courseId || 0),
                    actionUrl: `/courses/${Number(enrollment.courseId || 0)}`,
                },
                createdBy: session.uid,
                recipientUserIds: [Number(enrollment.userId || 0)],
            });
        }

        const certMode = String(enrollment.courses?.certificateMode || 'none').toLowerCase();
        if (
            String(enrollment.status || '').toLowerCase() === 'completed'
            && enrollment.courses?.hasCertificate
            && certMode === 'auto'
        ) {
            const user = await prisma.user.findUnique({
                where: { id: enrollment.userId },
                include: { profile: true },
            });
            const verifyCode = `CERT-${Date.now().toString(36).toUpperCase()}`;
            await prisma.certificate.upsert({
                where: { enrollmentId: enrollment.id },
                update: {},
                create: {
                    enrollmentId: enrollment.id,
                    verifyCode,
                    recipientName:
                        user?.profile?.firstName
                            ? [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ')
                            : (user?.username || `User ${enrollment.userId}`),
                    status: 'issued',
                },
            });
        }

        return NextResponse.json({
            success: true,
            enrollment: {
                ...enrollment,
                status: resolveLegacyStatus(enrollment, patchCompatMaps?.autoApproveByCourseId || {}),
                progress: toProgressNumber(enrollment.progressPercent),
            },
        });
    } catch (err) {
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
        }
        console.error('[enrollments/PATCH] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
