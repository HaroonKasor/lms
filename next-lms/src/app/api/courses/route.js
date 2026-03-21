import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    getCourseCompatMaps,
    setCourseAutoApprove,
    setCourseContentId,
    setCourseSettings,
    setCourseThumbnail,
} from '@/lib/server/compat-db';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';

function normalizeCourseCode(value, fallbackTitle = '') {
    const code = String(value || '').trim();
    if (code) return code.slice(0, 100);
    const base = String(fallbackTitle || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return base || `COURSE-${Date.now()}`;
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

function mapLegacyStatusToPublishStatus(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'active') return 'published';
    if (s === 'inactive') return 'draft';
    if (s === 'archived') return 'archived';
    if (s === 'review') return 'review';
    return 'draft';
}

function mapLegacyPublicToVisibility(isPublic) {
    if (typeof isPublic === 'boolean') return isPublic ? 'public' : 'private';
    return 'organization';
}

function normalizeLevel(level) {
    const value = String(level || '').toLowerCase();
    if (['beginner', 'intermediate', 'advanced', 'all'].includes(value)) return value;
    return 'all';
}

function normalizePublishStatus(status, legacyStatus) {
    const value = String(status || '').toLowerCase();
    if (['draft', 'review', 'published', 'archived'].includes(value)) return value;
    return mapLegacyStatusToPublishStatus(legacyStatus);
}

function normalizeVisibility(visibility, legacyIsPublic) {
    const value = String(visibility || '').toLowerCase();
    if (['private', 'organization', 'public'].includes(value)) return value;
    return mapLegacyPublicToVisibility(legacyIsPublic);
}

function resolveCertificateMode(body = {}) {
    const hasCertificate = Boolean(body.hasCertificate ?? body.certificate ?? false);
    if (!hasCertificate) return 'none';

    const explicitMode = String(body.certificateMode || '').toLowerCase();
    if (explicitMode === 'auto' || explicitMode === 'manual') return explicitMode;

    if (typeof body.autoCert === 'boolean') {
        return body.autoCert ? 'auto' : 'manual';
    }

    return 'auto';
}

function isTruthyFlag(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return false;
        return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
    }
    return false;
}

function normalizeMaxEnrollment(body = {}) {
    if (isTruthyFlag(body?.maxLearnerUnlimit)) return null;
    const rawValue = body?.maxEnrollment ?? body?.maxLearner;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
    return Math.floor(numericValue);
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

function normalizeCourse(
    course,
    compatMaps = { contentByCourseId: {}, thumbnailByCourseId: {} },
    reviewSummaryByCourseId = {}
) {
    const categoryName = course.categories?.name || '';
    const publishStatus = String(course.publishStatus || 'draft').toLowerCase();
    const visibility = String(course.visibility || 'organization').toLowerCase();
    const courseKey = String(course.id);
    const autoApprove = compatMaps?.autoApproveByCourseId?.[courseKey];
    const courseReviewSummary = reviewSummaryByCourseId?.[courseKey] || {};
    const reviewCount = Number(courseReviewSummary?.reviewCount || 0);
    const averageRating = Number(courseReviewSummary?.averageRating || 0);
    const settings = compatMaps?.courseSettingsByCourseId?.[courseKey] || {};

    const hasMaxEnrollmentCapacity = Number.isFinite(Number(course.maxEnrollment)) && Number(course.maxEnrollment) > 0;
    const isMaxLearnerUnlimited = Boolean(settings?.maxLearnerUnlimit) || !hasMaxEnrollmentCapacity;

    return {
        ...course,
        name: course.title || '',
        nameEn: course.titleEn || '',
        detail: '',
        status: publishStatus === 'published' ? 'active' : publishStatus === 'archived' ? 'archived' : 'inactive',
        isPublic: visibility === 'public',
        certificate: Boolean(course.hasCertificate),
        certificateMode: String(course.certificateMode || 'none').toLowerCase(),
        autoCert: String(course.certificateMode || 'none').toLowerCase() === 'auto',
        autoApprove: typeof autoApprove === 'boolean' ? autoApprove : true,
        instructor: '',
        lessons: 0,
        durationHours: 0,
        durationMinutes: 0,
        price: 0,
        reviewCount: Number.isFinite(reviewCount) && reviewCount > 0 ? reviewCount : 0,
        averageRating: Number.isFinite(averageRating) && averageRating > 0 ? Number(averageRating.toFixed(1)) : 0,
        thumbnail: normalizeThumbnail(compatMaps.thumbnailByCourseId?.[courseKey]),
        tincanId: compatMaps.contentByCourseId?.[courseKey] || null,
        registerDateFrom: String(settings?.registerDateFrom || '').trim(),
        registerDateTo: String(settings?.registerDateTo || '').trim(),
        registerUnlimit: Boolean(settings?.registerUnlimit),
        maxLearner: Number(course.maxEnrollment ?? 0),
        maxLearnerUnlimit: isMaxLearnerUnlimited,
        category: categoryName,
        categoryId: course.categoryId ?? null,
    };
}

function toErrorResponse(err, fallbackMessage = 'Internal server error') {
    if (err?.code === 'P2025') {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (err?.code === 'P2002') {
        const targets = Array.isArray(err?.meta?.target) ? err.meta.target.map(String) : [];
        const isCourseCodeUnique = targets.some((t) => t.includes('course_code') || t.includes('courseCode'));
        if (isCourseCodeUnique) {
            return NextResponse.json(
                { error: 'Course Code นี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น' },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: 'พบข้อมูลซ้ำในระบบ กรุณาตรวจสอบอีกครั้ง' }, { status: 409 });
    }

    return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

/**
 * GET - Get all courses
 * ?public=true -> only published+public courses WITH at least 1 active section
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const isPublicOnly = searchParams.get('public') === 'true';
        const organizationId = await ensureDefaultOrganization();

        if (!isPublicOnly) {
            const { response } = await requireSession(request, { requireAdmin: true });
            if (response) return response;
        }

        const where = { organization_id: organizationId };
        if (isPublicOnly) {
            where.publishStatus = 'published';
            where.visibility = 'public';
            where.sections = { some: { isActive: true } };
        }

        const sectionSelection = isPublicOnly
            ? {
                select: {
                    id: true,
                    title: true,
                    sectionType: true,
                    isActive: true,
                    orderNo: true,
                },
            }
            : {
                include: { asset: true },
            };

        const courses = await prisma.course.findMany({
            where,
            include: {
                sections: sectionSelection,
                categories: true,
            },
            orderBy: { id: 'desc' },
        });

        const [compatMaps, reviewSummaryByCourseId] = await Promise.all([
            getCourseCompatMaps(courses.map((course) => course.id)),
            buildReviewSummaryByCourse(courses.map((course) => course.id)),
        ]);
        return NextResponse.json(courses.map((course) => normalizeCourse(course, compatMaps, reviewSummaryByCourseId)));
    } catch (err) {
        return toErrorResponse(err);
    }
}

/**
 * POST - Create a new course
 */
export async function POST(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const courseName = String(body.name || body.title || '').trim();
        if (!courseName) {
            return NextResponse.json({ error: 'Course name is required' }, { status: 400 });
        }

        if (body.categoryId === undefined || body.categoryId === null || body.categoryId === '') {
            return NextResponse.json({ error: 'Category is required' }, { status: 400 });
        }

        const parsedCategoryId = parseInt(body.categoryId, 10);
        if (Number.isNaN(parsedCategoryId)) {
            return NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 });
        }

        const foundCategory = await prisma.category.findFirst({
            where: {
                id: parsedCategoryId,
                organization_id: organizationId,
            },
            select: { id: true },
        });
        if (!foundCategory) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const normalizedCourseCode = normalizeCourseCode(body.courseCode, courseName);
        const existingCode = await prisma.course.findFirst({
            where: {
                organization_id: organizationId,
                courseCode: normalizedCourseCode,
            },
            select: { id: true },
        });
        if (existingCode) {
            return NextResponse.json(
                { error: 'Course Code นี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น' },
                { status: 409 }
            );
        }

        const course = await prisma.course.create({
            data: {
                organization_id: organizationId,
                courseCode: normalizedCourseCode,
                title: courseName,
                titleEn: body.titleEn || body.nameEn || null,
                categoryId: foundCategory.id,
                level: normalizeLevel(body.level),
                publishStatus: normalizePublishStatus(body.publishStatus, body.status),
                visibility: normalizeVisibility(body.visibility, body.isPublic),
                hasCertificate: body.hasCertificate ?? body.certificate ?? false,
                certificateMode: resolveCertificateMode(body),
                maxEnrollment: normalizeMaxEnrollment(body),
            },
            include: { sections: true, categories: true },
        });

        if (body.tincanId) {
            await setCourseContentId(course.id, body.tincanId);
        }
        if (body.thumbnail !== undefined) {
            await setCourseThumbnail(course.id, normalizeThumbnail(body.thumbnail));
        }
        await setCourseAutoApprove(
            course.id,
            body.autoApprove === undefined || body.autoApprove === null ? true : Boolean(body.autoApprove)
        );
        await setCourseSettings(course.id, {
            registerDateFrom: body.registerDateFrom,
            registerDateTo: body.registerDateTo,
            registerUnlimit: body.registerUnlimit,
            maxLearnerUnlimit: body.maxLearnerUnlimit,
        });

        const [compatMaps, reviewSummaryByCourseId] = await Promise.all([
            getCourseCompatMaps([course.id]),
            buildReviewSummaryByCourse([course.id]),
        ]);
        return NextResponse.json({ success: true, course: normalizeCourse(course, compatMaps, reviewSummaryByCourseId) });
    } catch (err) {
        return toErrorResponse(err);
    }
}

/**
 * PUT - Update a course
 */
export async function PUT(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const id = parseInt(body.id, 10);
        if (Number.isNaN(id)) {
            return NextResponse.json({ error: 'Invalid course id' }, { status: 400 });
        }

        const courseName = String(body.name || body.title || '').trim();
        if (!courseName) {
            return NextResponse.json({ error: 'Course name is required' }, { status: 400 });
        }

        if (body.categoryId === undefined || body.categoryId === null || body.categoryId === '') {
            return NextResponse.json({ error: 'Category is required' }, { status: 400 });
        }

        const parsedCategoryId = parseInt(body.categoryId, 10);
        if (Number.isNaN(parsedCategoryId)) {
            return NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 });
        }

        const foundCategory = await prisma.category.findFirst({
            where: {
                id: parsedCategoryId,
                organization_id: organizationId,
            },
            select: { id: true },
        });
        if (!foundCategory) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const normalizedCourseCode = normalizeCourseCode(body.courseCode, courseName);
        const existingCode = await prisma.course.findFirst({
            where: {
                organization_id: organizationId,
                courseCode: normalizedCourseCode,
                NOT: { id },
            },
            select: { id: true },
        });
        if (existingCode) {
            return NextResponse.json(
                { error: 'Course Code นี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น' },
                { status: 409 }
            );
        }

        const course = await prisma.course.update({
            where: {
                id_organization_id: {
                    id,
                    organization_id: organizationId,
                },
            },
            data: {
                courseCode: normalizedCourseCode,
                title: courseName,
                titleEn: body.titleEn || body.nameEn || null,
                categoryId: foundCategory.id,
                level: normalizeLevel(body.level),
                publishStatus: normalizePublishStatus(body.publishStatus, body.status),
                visibility: normalizeVisibility(body.visibility, body.isPublic),
                hasCertificate: body.hasCertificate ?? body.certificate ?? false,
                certificateMode: resolveCertificateMode(body),
                maxEnrollment: normalizeMaxEnrollment(body),
            },
            include: { sections: true, categories: true },
        });

        if (body.tincanId !== undefined) {
            await setCourseContentId(course.id, body.tincanId || null);
        }
        if (body.thumbnail !== undefined) {
            await setCourseThumbnail(course.id, normalizeThumbnail(body.thumbnail));
        }
        if (body.autoApprove !== undefined && body.autoApprove !== null) {
            await setCourseAutoApprove(course.id, Boolean(body.autoApprove));
        }
        if (
            body.registerDateFrom !== undefined
            || body.registerDateTo !== undefined
            || body.registerUnlimit !== undefined
            || body.maxLearnerUnlimit !== undefined
        ) {
            await setCourseSettings(course.id, {
                registerDateFrom: body.registerDateFrom,
                registerDateTo: body.registerDateTo,
                registerUnlimit: body.registerUnlimit,
                maxLearnerUnlimit: body.maxLearnerUnlimit,
            });
        }

        const [compatMaps, reviewSummaryByCourseId] = await Promise.all([
            getCourseCompatMaps([course.id]),
            buildReviewSummaryByCourse([course.id]),
        ]);
        return NextResponse.json({ success: true, course: normalizeCourse(course, compatMaps, reviewSummaryByCourseId) });
    } catch (err) {
        return toErrorResponse(err);
    }
}

/**
 * DELETE - Delete a course
 */
export async function DELETE(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get('id'), 10);
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const sectionCount = await prisma.section.count({ where: { courseId: id } });
        if (sectionCount > 0) {
            return NextResponse.json(
                { error: 'ไม่สามารถลบหลักสูตรได้: กรุณาลบ Section ทั้งหมดก่อน' },
                { status: 400 }
            );
        }

        await prisma.course.delete({
            where: {
                id_organization_id: {
                    id,
                    organization_id: organizationId,
                },
            },
        });
        await setCourseContentId(id, null);
        await setCourseThumbnail(id, null);
        await setCourseAutoApprove(id, null);
        await setCourseSettings(id, null);
        return NextResponse.json({ success: true });
    } catch (err) {
        return toErrorResponse(err);
    }
}
