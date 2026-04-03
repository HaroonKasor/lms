import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRequestSession, requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { readJsonBody } from '@/lib/server/request-validation';
import { getCourseCompatMaps } from '@/lib/server/compat-db';

function toPositiveInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function toRating(value) {
    const n = Number(value);
    if (!Number.isInteger(n)) return null;
    if (n < 1 || n > 5) return null;
    return n;
}

function normalizeThumbnail(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '/course.png';
    if (raw.startsWith('data:image/')) return raw;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/api/uploads/image?file=')) return raw;
    if (raw.startsWith('api/uploads/image?file=')) return `/${raw}`;
    const uploadPathMatch = raw.match(/(?:^https?:\/\/[^/]+)?\/?uploads\/courses\/([^/?#]+)/i);
    if (uploadPathMatch?.[1]) {
        return `/api/uploads/image?file=${encodeURIComponent(uploadPathMatch[1])}`;
    }
    if (raw.startsWith('/')) return raw;
    if (raw.startsWith('uploads/')) return `/${raw}`;
    return '/course.png';
}

function normalizeAvatar(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '/images/default-avatar.svg';
    if (raw.startsWith('data:image/')) return raw;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/api/uploads/image?file=')) return raw;
    if (raw.startsWith('api/uploads/image?file=')) return `/${raw}`;
    if (raw.startsWith('/')) return raw;
    if (raw.startsWith('uploads/')) return `/${raw}`;
    return '/images/default-avatar.svg';
}

function toReviewItem(review, userById = {}) {
    const userId = Number(review?.user_id || 0);
    const user = userById[String(userId)] || null;
    const firstName = String(user?.profile?.firstName || '').trim();
    const lastName = String(user?.profile?.lastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return {
        id: Number(review?.id || 0),
        enrollmentId: Number(review?.enrollment_id || 0),
        courseId: Number(review?.course_id || 0),
        userId,
        user: {
            id: userId,
            username: String(user?.username || '').trim(),
            fullName: fullName || String(user?.username || '').trim() || `User ${userId || ''}`.trim(),
            avatar: normalizeAvatar(user?.profile?.avatarUrl || ''),
        },
        rating: Number(review?.rating || 0),
        reviewText: String(review?.review_text || ''),
        createdAt: review?.created_at || null,
    };
}

function buildRatingSummary(items = []) {
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalReviews = 0;
    let totalRating = 0;

    for (const item of items) {
        const rating = Number(item?.rating || 0);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
        totalReviews += 1;
        totalRating += rating;
        ratingCounts[String(rating)] += 1;
    }

    return {
        totalReviews,
        averageRating: totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(1)) : 0,
        ratingCounts,
    };
}

async function getCourseSettings(courseId) {
    const numericCourseId = Number(courseId);
    if (!Number.isInteger(numericCourseId) || numericCourseId <= 0) return {};
    const compatMaps = await getCourseCompatMaps([numericCourseId]);
    return compatMaps?.courseSettingsByCourseId?.[String(numericCourseId)] || {};
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const pendingOnly = String(searchParams.get('pending') || '0') === '1';
        const courseId = toPositiveInt(searchParams.get('courseId'));
        const limitRaw = Number(searchParams.get('limit') || 20);
        const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 20;

        if (courseId) {
            const organizationId = await ensureDefaultOrganization();
            const session = await getRequestSession(request);
            const courseSettings = await getCourseSettings(courseId);
            if (courseSettings?.webboard === false) {
                return NextResponse.json({ error: 'Webboard is disabled for this course' }, { status: 403 });
            }

            const reviews = await prisma.course_reviews.findMany({
                where: {
                    course_id: courseId,
                    is_public: true,
                },
                orderBy: { created_at: 'desc' },
                take: limit,
                select: {
                    id: true,
                    enrollment_id: true,
                    course_id: true,
                    user_id: true,
                    rating: true,
                    review_text: true,
                    created_at: true,
                },
            });

            const userIds = Array.from(new Set(
                reviews.map((row) => Number(row?.user_id || 0)).filter((id) => Number.isInteger(id) && id > 0)
            ));

            const users = userIds.length > 0
                ? await prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: {
                        id: true,
                        username: true,
                        profile: {
                            select: {
                                firstName: true,
                                lastName: true,
                                avatarUrl: true,
                            },
                        },
                    },
                })
                : [];

            const userById = Object.fromEntries(
                users.map((item) => [String(Number(item?.id || 0)), item])
            );

            const items = reviews.map((row) => toReviewItem(row, userById));
            const summary = buildRatingSummary(items);

            let canReview = false;
            let myEnrollmentId = null;
            let myReview = null;
            if (session?.uid) {
                const completedEnrollment = await prisma.enrollment.findFirst({
                    where: {
                        userId: session.uid,
                        courseId,
                        organization_id: organizationId,
                        status: 'completed',
                    },
                    orderBy: { completedAt: 'desc' },
                    select: { id: true },
                });
                const enrollmentId = Number(completedEnrollment?.id || 0);
                if (enrollmentId > 0) {
                    canReview = true;
                    myEnrollmentId = enrollmentId;
                    myReview = items.find((item) => Number(item?.enrollmentId || 0) === enrollmentId) || null;
                }
            }

            return NextResponse.json({
                items,
                summary,
                canReview,
                myEnrollmentId,
                myReview,
            });
        }

        const { session, response } = await requireSession(request);
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const completedEnrollments = await prisma.enrollment.findMany({
            where: {
                userId: session.uid,
                organization_id: organizationId,
                status: 'completed',
            },
            orderBy: { completedAt: 'desc' },
            include: {
                courses: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });

        if (completedEnrollments.length === 0) {
            return NextResponse.json([]);
        }

        const enrollmentIdSet = completedEnrollments.map((item) => Number(item.id || 0)).filter(Boolean);
        const courseIdSet = completedEnrollments.map((item) => Number(item.courseId || 0)).filter(Boolean);

        const [reviews, compatMaps] = await Promise.all([
            prisma.course_reviews.findMany({
                where: {
                    user_id: session.uid,
                    enrollment_id: { in: enrollmentIdSet },
                },
                select: {
                    enrollment_id: true,
                    rating: true,
                    review_text: true,
                    created_at: true,
                },
            }),
            getCourseCompatMaps(courseIdSet),
        ]);

        const reviewedByEnrollmentId = new Map(
            reviews.map((item) => [Number(item.enrollment_id || 0), item])
        );
        const thumbnailByCourseId = compatMaps?.thumbnailByCourseId || {};
        const courseSettingsByCourseId = compatMaps?.courseSettingsByCourseId || {};

        const rows = completedEnrollments
            .map((enrollment) => {
                const enrollmentId = Number(enrollment.id || 0);
                const review = reviewedByEnrollmentId.get(enrollmentId) || null;
                const courseId = Number(enrollment.courseId || 0);
                return {
                    enrollmentId,
                    courseId,
                    courseName: String(enrollment?.courses?.title || '').trim() || 'Course',
                    courseThumbnail: normalizeThumbnail(thumbnailByCourseId[String(courseId)]),
                    completedAt: enrollment.completedAt || enrollment.enrolledAt || null,
                    hasReview: Boolean(review),
                    rating: review?.rating ? Number(review.rating) : null,
                    reviewText: String(review?.review_text || ''),
                    reviewedAt: review?.created_at || null,
                };
            })
            .filter((row) => {
                const settings = courseSettingsByCourseId[String(Number(row?.courseId || 0))] || {};
                return settings?.webboard !== false;
            })
            .filter((row) => (pendingOnly ? !row.hasReview : true));

        return NextResponse.json(rows);
    } catch (err) {
        console.error('[course-reviews/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const enrollmentId = toPositiveInt(body?.enrollmentId);
        const courseId = toPositiveInt(body?.courseId);
        const rating = toRating(body?.rating);
        const reviewText = String(body?.reviewText || '').trim().slice(0, 2000);

        if (!enrollmentId && !courseId) {
            return NextResponse.json({ error: 'enrollmentId or courseId is required' }, { status: 400 });
        }
        if (!rating) {
            return NextResponse.json({ error: 'rating must be 1-5' }, { status: 400 });
        }

        let enrollment = null;
        if (enrollmentId) {
            enrollment = await prisma.enrollment.findFirst({
                where: {
                    id: enrollmentId,
                    userId: session.uid,
                    organization_id: organizationId,
                    status: 'completed',
                },
                select: {
                    id: true,
                    courseId: true,
                    userId: true,
                },
            });
        } else {
            enrollment = await prisma.enrollment.findFirst({
                where: {
                    userId: session.uid,
                    courseId,
                    organization_id: organizationId,
                    status: 'completed',
                },
                orderBy: { completedAt: 'desc' },
                select: {
                    id: true,
                    courseId: true,
                    userId: true,
                },
            });
        }

        if (!enrollment) {
            return NextResponse.json({ error: 'Completed enrollment not found' }, { status: 404 });
        }

        const courseSettings = await getCourseSettings(enrollment.courseId);
        if (courseSettings?.webboard === false) {
            return NextResponse.json({ error: 'Webboard is disabled for this course' }, { status: 403 });
        }

        const saved = await prisma.course_reviews.upsert({
            where: { enrollment_id: enrollment.id },
            update: {
                rating,
                review_text: reviewText || null,
                is_public: true,
            },
            create: {
                enrollment_id: enrollment.id,
                course_id: enrollment.courseId,
                user_id: enrollment.userId,
                rating,
                review_text: reviewText || null,
                is_public: true,
            },
            select: {
                id: true,
                enrollment_id: true,
                rating: true,
                review_text: true,
                created_at: true,
            },
        });

        return NextResponse.json({
            success: true,
            review: {
                id: Number(saved.id || 0),
                enrollmentId: Number(saved.enrollment_id || 0),
                rating: Number(saved.rating || 0),
                reviewText: String(saved.review_text || ''),
                createdAt: saved.created_at || null,
            },
        });
    } catch (err) {
        console.error('[course-reviews/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
