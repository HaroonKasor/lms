import prisma from '@/lib/prisma';
import { evaluateLearnWindow, getSectionCompatMaps } from '@/lib/server/compat-db';
import { resolveEnrollmentSectionId } from '@/lib/server/section-runtime';

function toSafeInteger(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizePublishStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    return normalized;
}

export async function evaluateEnrollmentLearningAccess({
    enrollmentId = null,
    enrollment = null,
    preferredSectionId = null,
} = {}) {
    const numericEnrollmentId = toSafeInteger(enrollmentId);
    let targetEnrollment = enrollment;

    if (!targetEnrollment) {
        if (!numericEnrollmentId) {
            return { allowed: false, reason: 'ENROLLMENT_NOT_FOUND', message: 'Enrollment not found' };
        }
        targetEnrollment = await prisma.enrollment.findUnique({
            where: { id: numericEnrollmentId },
            include: {
                courses: {
                    select: {
                        id: true,
                        publishStatus: true,
                        sections: {
                            select: {
                                id: true,
                                isActive: true,
                                orderNo: true,
                            },
                            orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                        },
                    },
                },
                learning_progress: {
                    select: {
                        sectionId: true,
                        status: true,
                        progressPercent: true,
                        id: true,
                    },
                    orderBy: { id: 'desc' },
                    take: 20,
                },
            },
        });
    }

    if (!targetEnrollment) {
        return { allowed: false, reason: 'ENROLLMENT_NOT_FOUND', message: 'Enrollment not found' };
    }

    const publishStatus = normalizePublishStatus(targetEnrollment?.courses?.publishStatus);
    if (publishStatus && publishStatus !== 'published') {
        return {
            allowed: false,
            reason: 'COURSE_INACTIVE',
            message: 'Course is not available for learning',
        };
    }

    const availableSections = Array.isArray(targetEnrollment?.courses?.sections)
        ? targetEnrollment.courses.sections
        : [];
    const learningProgressRows = Array.isArray(targetEnrollment?.learning_progress)
        ? targetEnrollment.learning_progress
        : [];
    const resolvedSectionId = resolveEnrollmentSectionId({
        explicitSectionId: preferredSectionId || targetEnrollment?.sectionId || null,
        learningProgressRows,
        availableSections,
    });

    const numericSectionId = toSafeInteger(resolvedSectionId);
    if (!numericSectionId) {
        return {
            allowed: false,
            reason: 'SECTION_NOT_FOUND',
            message: 'Section not found',
        };
    }

    const section = availableSections.find((item) => Number(item?.id || 0) === numericSectionId);
    if (!section || section.isActive === false) {
        return {
            allowed: false,
            reason: 'SECTION_INACTIVE',
            message: 'Section is inactive',
            sectionId: numericSectionId,
        };
    }

    const sectionCompatMaps = await getSectionCompatMaps([numericSectionId]);
    const sectionSettings = sectionCompatMaps?.sectionSettingsBySectionId?.[String(numericSectionId)] || {};
    const learnWindow = evaluateLearnWindow(sectionSettings);
    if (!learnWindow.allowed) {
        return {
            allowed: false,
            reason: 'LEARN_WINDOW_EXPIRED',
            message: 'Learning period expired',
            sectionId: numericSectionId,
        };
    }

    return {
        allowed: true,
        reason: null,
        message: '',
        sectionId: numericSectionId,
    };
}
