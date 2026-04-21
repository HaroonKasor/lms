'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Navbar from '@/components/layout/Navbar';
import Header from '@/components/layout/Header';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';
import HomeFloatingChatbot from '@/components/ui/HomeFloatingChatbot';
import { getUser } from '@/lib/auth';
import { toast } from 'react-toastify';

const DEFAULT_AVATAR_URL = '/images/default-avatar.svg';
const LEARNER_TOAST = { containerId: 'global-toast' };

function formatReviewDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatDateLabel(value, locale = 'en-US') {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
}

function formatDateRange(from, to, unlimit = false) {
    if (unlimit) return 'Unlimited';
    const hasFrom = Boolean(from);
    const hasTo = Boolean(to);
    if (!hasFrom && !hasTo) return '-';
    if (hasFrom && hasTo) return `${formatDateLabel(from)} - ${formatDateLabel(to)}`;
    if (hasFrom) return `Starts ${formatDateLabel(from)}`;
    return `Until ${formatDateLabel(to)}`;
}

export default function CourseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.id;

    const [course, setCourse] = useState(null);
    const [allCourses, setAllCourses] = useState([]);
    const [enrollment, setEnrollment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewItems, setReviewItems] = useState([]);
    const [reviewSummary, setReviewSummary] = useState({ averageRating: 0, totalReviews: 0, ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
    const [canReview, setCanReview] = useState(false);
    const [myEnrollmentId, setMyEnrollmentId] = useState(null);
    const [myReview, setMyReview] = useState(null);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [reviewSuccessModal, setReviewSuccessModal] = useState({
        open: false,
        message: 'Your review has been submitted successfully. It helps us and other students a lot.',
    });
    const isWebboardEnabled = course?.webboard !== false;

    const pickDefaultSection = (courseData) => {
        const sections = Array.isArray(courseData?.sections) ? courseData.sections : [];
        if (sections.length === 0) return null;
        return sections.find((section) => section?.isActive) || sections[0];
    };

    useEffect(() => {
        setUser(getUser());
    }, []);

    const loadCourseReviews = useCallback(async () => {
        const id = Number(courseId || 0);
        if (!Number.isInteger(id) || id <= 0) return;
        if (course?.webboard === false) {
            setReviewItems([]);
            setReviewSummary({ averageRating: 0, totalReviews: 0, ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
            setCanReview(false);
            setMyEnrollmentId(null);
            setMyReview(null);
            return;
        }
        try {
            setReviewsLoading(true);
            const res = await fetch(`/api/course-reviews?courseId=${id}&limit=30`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Load reviews failed');

            const items = Array.isArray(data?.items) ? data.items : [];
            setReviewItems(items);
            setReviewSummary({
                averageRating: Number(data?.summary?.averageRating || 0),
                totalReviews: Number(data?.summary?.totalReviews || 0),
                ratingCounts: data?.summary?.ratingCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            });
            setCanReview(Boolean(data?.canReview));
            setMyEnrollmentId(Number(data?.myEnrollmentId || 0) || null);

            const mine = data?.myReview || null;
            setMyReview(mine);
            if (mine) {
                setReviewRating(Number(mine?.rating || 0));
                setReviewText(String(mine?.reviewText || ''));
            } else {
                setReviewRating(0);
                setReviewText('');
            }
        } catch (error) {
            console.error('[CourseDetail] loadCourseReviews failed', error);
        } finally {
            setReviewsLoading(false);
        }
    }, [courseId, course?.webboard]);

    useEffect(() => {
        const load = async () => {
            try {
                // Load course
                const cRes = await fetch('/api/courses?public=true');
                if (cRes.ok) {
                    const courses = await cRes.json();
                    setAllCourses(Array.isArray(courses) ? courses : []);
                    const found = courses.find(c => c.id === parseInt(courseId));
                    if (found) setCourse(found);
                }

                // Load enrollment if user exists
                if (getUser()) {
                    const eRes = await fetch(`/api/enrollments?courseId=${courseId}`);
                    if (eRes.ok) {
                        const enrollments = await eRes.json();
                        if (enrollments.length > 0) setEnrollment(enrollments[0]);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [courseId]);

    useEffect(() => {
        if (!course) return;
        loadCourseReviews();
    }, [course, loadCourseReviews]);

    const handleEnroll = async () => {
        if (!getUser()) {
            toast.info('Please login first to enroll', LEARNER_TOAST);
            setTimeout(() => {
                window.location.href = '/login';
            }, 450);
            return;
        }

        const defaultSection = pickDefaultSection(course);
        if (!defaultSection?.id) {
            toast.warning('This course has no available section for enrollment. Please contact support.', LEARNER_TOAST);
            return;
        }

        setEnrolling(true);
        try {
            const res = await fetch('/api/enrollments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId: parseInt(courseId, 10),
                    sectionId: parseInt(defaultSection.id, 10),
                }),
            });
            if (res.ok) {
                const payload = await res.json();
                setEnrollment(payload?.enrollment || null);
            } else {
                const err = await res.json();
                toast.error(err.error || 'Enrollment failed', LEARNER_TOAST);
            }
        } catch (e) { toast.error(e.message || 'Enrollment failed', LEARNER_TOAST); }
        setEnrolling(false);
    };

    const formatDuration = (c) => {
        const parts = [];
        if (c.durationHours > 0) parts.push(`${c.durationHours} hours`);
        if (c.durationMinutes > 0) parts.push(`${c.durationMinutes} minutes`);
        return parts.join(' ') || 'Unlimited';
    };

    const normalizedSections = useMemo(() => {
        const sections = Array.isArray(course?.sections) ? course.sections : [];
        return [...sections].sort((a, b) => {
            const aOrder = Number(a?.orderNo || 0);
            const bOrder = Number(b?.orderNo || 0);
            if (aOrder !== bOrder) return aOrder - bOrder;
            return Number(a?.id || 0) - Number(b?.id || 0);
        });
    }, [course]);

    const defaultSection = useMemo(() => pickDefaultSection(course), [course]);

    const instructorName = useMemo(
        () => String(course?.instructor || '').trim() || 'Instructor Name',
        [course]
    );
    const instructorExperience = useMemo(
        () => String(course?.instructorExperience || '').trim(),
        [course]
    );
    const registrationWindowText = useMemo(
        () => formatDateRange(course?.registerDateFrom, course?.registerDateTo, course?.registerUnlimit),
        [course]
    );
    const prerequisitesDisplay = useMemo(() => {
        const raw = Array.isArray(course?.prerequisites) ? course.prerequisites : [];
        if (raw.length === 0) return [];

        const all = Array.isArray(allCourses) ? allCourses : [];
        const normalize = (value) => String(value || '').trim().toLowerCase();

        const byId = new Map(all.map((item) => [String(item?.id || ''), item]));
        const byCode = new Map(all.map((item) => [normalize(item?.courseCode), item]));
        const byName = new Map(all.map((item) => [normalize(item?.name), item]));

        return raw.map((value) => {
            const token = String(value || '').trim();
            if (!token) return null;

            const byIdMatch = byId.get(token);
            if (byIdMatch?.name) return byIdMatch.name;

            const normalized = normalize(token);
            const byCodeMatch = byCode.get(normalized);
            if (byCodeMatch?.name) return byCodeMatch.name;

            const byNameMatch = byName.get(normalized);
            if (byNameMatch?.name) return byNameMatch.name;

            return token;
        }).filter(Boolean);
    }, [allCourses, course?.prerequisites]);

    const renderStars = (value, { interactive = false, sizeClass = 'w-[12px] h-[12px]' } = {}) => {
        const current = Number(value || 0);
        return (
            <div className="flex items-center gap-[2px]">
                {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= current;
                    const className = `${sizeClass} ${filled ? 'text-[#FFC224]' : 'text-[#cfd6e4]'} ${interactive ? 'cursor-pointer transition-transform hover:scale-110' : ''}`;
                    return (
                        <svg
                            key={star}
                            className={className}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            onClick={interactive ? () => setReviewRating(star) : undefined}
                        >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    );
                })}
            </div>
        );
    };

    const reviewAverageText = useMemo(() => {
        const avg = Number(reviewSummary?.averageRating || 0);
        const total = Number(reviewSummary?.totalReviews || 0);
        if (total <= 0) return '(No Rating Yet)';
        return `(${avg.toFixed(1)} / 5.0 Rating)`;
    }, [reviewSummary]);

    const jumpToReviewSection = () => {
        if (!isWebboardEnabled) return;
        setActiveTab('review');
        window.setTimeout(() => {
            const target = document.getElementById('course-review-section');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 0);
    };

    useEffect(() => {
        if (!isWebboardEnabled && activeTab === 'review') {
            setActiveTab('overview');
        }
    }, [activeTab, isWebboardEnabled]);

    const handleSubmitReview = async () => {
        if (!user) {
            window.location.href = '/login';
            return;
        }
        if (!canReview) {
            setReviewError('You must complete this course before leaving a review.');
            return;
        }
        if (!Number.isInteger(reviewRating) || reviewRating < 1 || reviewRating > 5) {
            setReviewError('Please select a rating between 1 and 5 stars.');
            return;
        }
        try {
            setReviewSubmitting(true);
            setReviewError('');
            const payload = {
                courseId: Number(courseId || 0),
                enrollmentId: myEnrollmentId || undefined,
                rating: reviewRating,
                reviewText: String(reviewText || '').trim(),
            };
            const res = await fetch('/api/course-reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Submit review failed');

            await loadCourseReviews();
            setReviewSuccessModal((prev) => ({ ...prev, open: true }));
        } catch (error) {
            setReviewError(error?.message || 'Submit review failed');
        } finally {
            setReviewSubmitting(false);
        }
    };

    const closeReviewSuccessModal = useCallback(() => {
        setReviewSuccessModal((prev) => ({ ...prev, open: false }));
    }, []);

    useEffect(() => {
        if (!reviewSuccessModal.open) return undefined;
        const previousOverflow = document.body.style.overflow;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') closeReviewSuccessModal();
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [reviewSuccessModal.open, closeReviewSuccessModal]);

    if (loading) {
        return <LoadScreen text="Loading course..." variant="minimal" />;
    }

    if (!course) {
        return (
            <div className="min-h-screen font-['Outfit',sans-serif]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
                {user ? <Navbar /> : <Header />}
                {!user ? <HomeFloatingChatbot /> : null}
                <div className="flex items-center justify-center py-40">
                    <div className="text-center">
                        <div className="text-6xl mb-4">😕</div>
                        <h2 className="text-2xl text-[#052143] font-medium mb-2">Course not found</h2>
                        <Link href="/courses" className="text-[#687EFF] underline">Back to course list</Link>
                    </div>
                </div>
            </div>
        );
    }

    const enrollmentStatus = String(enrollment?.status || '').toUpperCase();
    const isPendingApproval = enrollmentStatus === 'PENDING';
    const isEnrolled = enrollment && ['APPROVED', 'LEARNING', 'COMPLETED'].includes(enrollmentStatus);
    const hasStartedLearning = enrollmentStatus === 'LEARNING'
        || enrollmentStatus === 'COMPLETED'
        || Number(enrollment?.progress || 0) > 0;
    const enrolledSectionId = hasStartedLearning
        ? Number(
            enrollment?.sectionId
            || enrollment?.section?.id
            || defaultSection?.id
            || 0
        )
        : Number(defaultSection?.id || enrollment?.sectionId || enrollment?.section?.id || 0);
    const showMaxLearner = !course?.maxLearnerUnlimit && Number(course?.maxLearner || 0) > 0;
    const ctaLabel = enrolling
        ? 'Enrolling...'
        : isPendingApproval
            ? 'Pending'
            : isEnrolled
                ? (enrollmentStatus === 'LEARNING' ? 'Continue Learning' : 'Start Learning')
                : 'Enroll Now';
    const learnHref = enrolledSectionId > 0
        ? `/courses/${courseId}/learn?launch=1&sectionId=${enrolledSectionId}`
        : `/courses/${courseId}/learn?launch=1`;

    return (
        <div className="min-h-screen font-['Outfit',sans-serif]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
            {user ? <Navbar /> : <Header />}
            {!user ? <HomeFloatingChatbot /> : null}

            <main className="max-w-[1290px] mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-20 sm:pb-24 flex flex-col gap-8">
                <FadeIn direction="up">
                    {/* Top Hero Section */}
                    <div className="flex flex-col gap-6">
                        <div className="w-full h-[320px] bg-[#D9D9D9] rounded-[20px] overflow-hidden">
                            {course.thumbnail ? (
                                <img src={course.thumbnail} alt={course.name} className="w-full h-full object-cover" />
                            ) : (
                                <img src="/skillup_logo.png" alt="SkillUp" className="w-[100px] h-[100px] m-auto mt-[110px] opacity-20" />
                            )}
                        </div>

                        <div className="flex flex-col gap-[16px] max-w-[852px]">
                            <div className="flex items-center">
                                <div className="bg-[#687EFF] rounded-full px-[14px] py-[6px] flex items-center gap-[6px]">
                                    <div className="w-[6px] h-[6px] bg-white rounded-full"></div>
                                    <span className="text-white text-[13px] font-medium leading-[130%]">{course.category || 'General'}</span>
                                </div>
                            </div>

                            <h1 className="text-[#052143] text-[32px] font-semibold leading-[130%]">{course.name}</h1>
                            <div className="flex flex-wrap items-center gap-[40px] pt-2">
                                {/* Instructor */}
                                <div className="flex items-center gap-3">
                                    <img
                                        src={DEFAULT_AVATAR_URL}
                                        alt={instructorName}
                                        className="w-[44px] h-[44px] border border-[#eaedf5] rounded-full object-cover"
                                    />
                                    <div className="flex flex-col">
                                        {instructorExperience && (
                                            <span className="text-[#6B778B] text-[12px] leading-[140%]">{instructorExperience}</span>
                                        )}
                                        <span className="text-[#052143] text-[15px] font-bold leading-[140%]">{instructorName}</span>
                                    </div>
                                </div>

                                {/* Last Update */}
                                <div className="flex flex-col">
                                    <span className="text-[#6B778B] text-[12px] leading-[140%]">Last Update</span>
                                    <span className="text-[#052143] text-[15px] font-bold leading-[140%]">
                                        {course.createdAt ? new Date(course.createdAt).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : 'March 04, 2026'}
                                    </span>
                                </div>

                                {/* Students */}
                                <div className="flex flex-col">
                                    <span className="text-[#6B778B] text-[12px] leading-[140%]">Available</span>
                                    <span className="text-[#052143] text-[15px] font-bold leading-[140%]">{course.maxLearnerUnlimit ? 'Unlimited Users' : `${course.maxLearner} Students`}</span>
                                </div>

                                {/* Rating */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-[#6B778B] text-[12px] leading-[100%]">{reviewAverageText}</span>
                                    {renderStars(Math.round(Number(reviewSummary?.averageRating || 0)))}
                                    <span className="text-[#6B778B] text-[12px] leading-[100%]">
                                        {Number(reviewSummary?.totalReviews || 0)} reviews
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="mt-6 mb-6 max-w-[852px] overflow-x-auto pb-2">
                        <div className="flex min-w-max items-center rounded-full border border-[#D1E3FB] bg-white p-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('overview')}
                                className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-full min-w-[110px] sm:min-w-[130px] font-medium transition-colors ${activeTab === 'overview' ? 'bg-[#687EFF] text-white' : 'text-[#6B778B] hover:text-[#052143]'}`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                <span className="text-[14px]">Overview</span>
                            </button>
                            <button type="button" onClick={() => setActiveTab('curriculum')} className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-full min-w-[110px] sm:min-w-[130px] font-medium transition-colors ${activeTab === 'curriculum' ? 'bg-[#687EFF] text-white' : 'text-[#6B778B] hover:text-[#052143]'}`}>
                                <svg width="11" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                <span className="text-[14px]">Curriculum</span>
                            </button>
                            <button type="button" onClick={() => setActiveTab('instructor')} className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-full min-w-[110px] sm:min-w-[130px] font-medium transition-colors ${activeTab === 'instructor' ? 'bg-[#687EFF] text-white' : 'text-[#6B778B] hover:text-[#052143]'}`}>
                                <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                                <span className="text-[14px]">Instructor</span>
                            </button>
                            {isWebboardEnabled && (
                                <button
                                    type="button"
                                    onClick={jumpToReviewSection}
                                    className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-full min-w-[110px] sm:min-w-[130px] font-medium transition-colors ${activeTab === 'review' ? 'bg-[#687EFF] text-white' : 'text-[#6B778B] hover:text-[#052143]'}`}
                                >
                                    <svg width="16" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                    <span className="text-[14px]">Review</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-[40px] items-start">
                        {/* LEFT COLUMN: Main Content */}
                        <div className="flex-1 max-w-[852px] flex flex-col gap-10">

                            {activeTab === 'overview' && (
                                <>
                                    <div className="flex flex-col gap-4">
                                        <h2 className="text-[#052143] text-[22px] font-bold leading-[130%]">Course Overview</h2>
                                        <p className="text-[#6B778B] text-[15px] leading-[1.6]">
                                            {course.detail || '-'}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-6">
                                        <h2 className="text-[#052143] text-[22px] font-bold leading-[130%]">What You Will Learn?</h2>
                                        {normalizedSections.length === 0 ? (
                                            <p className="text-[#6B778B] text-[15px] leading-[1.6]">No sections available in this course yet.</p>
                                        ) : (
                                            <div className="flex flex-col gap-5">
                                                {normalizedSections.map((section) => (
                                                    <div key={section.id} className="flex gap-3 items-start">
                                                        <div className="mt-1 w-[16px] h-[16px] bg-[#687EFF] rounded-full text-white flex items-center justify-center shrink-0">
                                                            <svg className="w-[10px] h-[10px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <h3 className="text-[#052143] text-[15px] font-bold leading-[1.4] m-0">
                                                                {section?.name || section?.title || `Section ${section?.orderNo || '-'}`}
                                                            </h3>
                                                            <p className="text-[#6B778B] text-[14px] leading-[1.6]">
                                                                {String(section?.detail || '').trim() || `Type: ${String(section?.sectionType || 'lesson')}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <h2 className="text-[#052143] text-[22px] font-bold leading-[130%]">Prerequisites</h2>
                                        {prerequisitesDisplay.length === 0 ? (
                                            <p className="text-[#6B778B] text-[15px] leading-[1.6]">No prerequisites</p>
                                        ) : (
                                            <ul className="list-disc pl-5 space-y-2">
                                                {prerequisitesDisplay.map((item, index) => (
                                                    <li key={`${item}-${index}`} className="text-[#6B778B] text-[15px] leading-[1.6]">{item}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </>
                            )}

                            {activeTab === 'curriculum' && (
                                <div className="flex flex-col gap-4">
                                    <h2 className="text-[#052143] text-[22px] font-bold leading-[130%]">Curriculum</h2>
                                    {normalizedSections.length === 0 ? (
                                        <p className="text-[#6B778B] text-[15px] leading-[1.6]">No sections available in this course yet.</p>
                                    ) : (
                                        <div className="flex flex-col gap-4">
                                            {normalizedSections.map((section) => (
                                                <div key={section.id} className="rounded-[16px] border border-[#D1E3FB] bg-white p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-[#052143] text-[16px] font-semibold leading-[130%]">
                                                                {section?.name || section?.title || `Section ${section?.orderNo || '-'}`}
                                                            </h3>
                                                            {section?.sessionCode && (
                                                                <p className="text-[#6B778B] text-[13px] mt-1">
                                                                    Session {section.sessionCode}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className={`text-[12px] px-3 py-1 rounded-full ${section?.status === 'active' ? 'bg-[#E8FFF5] text-[#0F9B63] border border-[#BDEFD6]' : 'bg-[#FFF3F3] text-[#D14343] border border-[#FFD7D7]'}`}>
                                                            {section?.status === 'active' ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </div>
                                                    {String(section?.detail || '').trim() && (
                                                        <p className="text-[#6B778B] text-[14px] leading-[1.6] mt-3">{section.detail}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'instructor' && (
                                <div className="rounded-[16px] border border-[#D1E3FB] bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <img
                                        src={DEFAULT_AVATAR_URL}
                                        alt={instructorName}
                                        className="w-[64px] h-[64px] rounded-full border border-[#D1E3FB] object-cover"
                                    />
                                    <div className="flex-1">
                                        <h2 className="text-[#052143] text-[22px] font-bold leading-[130%]">Instructor</h2>
                                        <p className="text-[#052143] text-[18px] font-semibold mt-2">{instructorName}</p>
                                        {instructorExperience && (
                                            <p className="text-[#6B778B] text-[14px] mt-1">{instructorExperience}</p>
                                        )}
                                        <p className="text-[#6B778B] text-[14px] mt-2">Section: {defaultSection?.name || defaultSection?.title || '-'}</p>
                                    </div>
                                </div>
                            )}

                            {/* Reviews */}
                            {isWebboardEnabled && activeTab === 'review' && (
                                <section id="course-review-section" className="scroll-mt-28 flex flex-col gap-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <h2 className="text-[#052143] text-[22px] font-bold leading-[130%]">Review & Comments</h2>
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#D1E3FB] px-4 py-2 text-[#6B778B] text-[13px]">
                                            {renderStars(Math.round(Number(reviewSummary?.averageRating || 0)), { sizeClass: 'w-[14px] h-[14px]' })}
                                            <span className="font-medium text-[#052143]">
                                                {Number(reviewSummary?.averageRating || 0).toFixed(1)}
                                            </span>
                                            <span>
                                                ({Number(reviewSummary?.totalReviews || 0)} reviews)
                                            </span>
                                        </div>
                                    </div>

                                <div className="bg-white border border-[#D1E3FB] rounded-[20px] p-5 md:p-6 shadow-[0_0_20px_rgba(0,0,0,0.04)]">
                                    <h3 className="text-[#052143] text-[17px] font-semibold mb-3">Leave your review</h3>
                                    {!user && (
                                        <div className="text-[14px] text-[#6B778B] mb-3">
                                            Please <Link href="/login" className="text-[#687EFF] font-medium underline">login</Link> to write a review.
                                        </div>
                                    )}
                                    {user && !canReview && (
                                        <div className="text-[14px] text-[#F59E0B] bg-[#FFF7ED] border border-[#FDE7C8] rounded-[12px] px-3 py-2 mb-3">
                                            You must complete this course before submitting a review.
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <div className="text-[13px] text-[#6B778B] mb-1">Rating</div>
                                        {renderStars(reviewRating, { interactive: Boolean(user && canReview), sizeClass: 'w-[20px] h-[20px]' })}
                                    </div>

                                    <textarea
                                        value={reviewText}
                                        onChange={(event) => setReviewText(event.target.value.slice(0, 2000))}
                                        disabled={!user || !canReview || reviewSubmitting}
                                        placeholder="Share your experience with this course..."
                                        className="w-full min-h-[120px] rounded-[14px] border border-[#D1E3FB] px-4 py-3 text-[14px] text-[#052143] outline-none focus:border-[#687EFF] disabled:bg-[#F8FAFF] disabled:text-[#94A3B8]"
                                    />

                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <span className="text-[12px] text-[#94A3B8]">{String(reviewText || '').length}/2000</span>
                                        <button
                                            type="button"
                                            disabled={!user || !canReview || reviewSubmitting}
                                            onClick={handleSubmitReview}
                                            className="h-[40px] px-5 rounded-full bg-[#687EFF] text-white text-[14px] font-medium hover:bg-[#5a6fe0] disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {reviewSubmitting ? 'Submitting...' : myReview ? 'Update Review' : 'Submit Review'}
                                        </button>
                                    </div>
                                    {reviewError && <p className="mt-2 text-[13px] text-[#E11D48]">{reviewError}</p>}
                                </div>

                                <div className="bg-white border border-[#D1E3FB] rounded-[20px] p-5 md:p-6 shadow-[0_0_20px_rgba(0,0,0,0.04)]">
                                    <h3 className="text-[#052143] text-[17px] font-semibold mb-4">Learner Comments</h3>
                                    {reviewsLoading && (
                                        <div className="text-[14px] text-[#6B778B]">Loading reviews...</div>
                                    )}
                                    {!reviewsLoading && reviewItems.length === 0 && (
                                        <div className="text-[14px] text-[#6B778B]">No comments for this course yet.</div>
                                    )}
                                    {!reviewsLoading && reviewItems.length > 0 && (
                                        <div className="flex flex-col gap-4">
                                            {reviewItems.map((item) => (
                                                <div key={item.id} className="rounded-[14px] border border-[#EEF2FF] bg-[#FCFDFF] p-4">
                                                    <div className="flex items-start gap-3">
                                                        <img
                                                            src={item?.user?.avatar || DEFAULT_AVATAR_URL}
                                                            alt={item?.user?.fullName || item?.user?.username || 'User'}
                                                            className="w-[42px] h-[42px] rounded-full border border-[#D1E3FB] object-cover"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div className="text-[#052143] text-[14px] font-semibold truncate">
                                                                    {item?.user?.fullName || item?.user?.username || 'Learner'}
                                                                </div>
                                                                <div className="text-[12px] text-[#94A3B8]">{formatReviewDate(item?.createdAt)}</div>
                                                            </div>
                                                            <div className="mt-1">
                                                                {renderStars(item?.rating, { sizeClass: 'w-[14px] h-[14px]' })}
                                                            </div>
                                                            <p className="mt-2 text-[14px] text-[#334155] whitespace-pre-line break-words">
                                                                {item?.reviewText || '-'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                </section>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Sidebar Form */}
                        <div className="w-full xl:w-[340px] shrink-0 xl:sticky xl:top-[100px]">
                            <div className="bg-white border border-[#D1E3FB] rounded-[20px] shadow-[0_0_20px_rgba(0,0,0,0.04)] p-[24px] flex flex-col items-start gap-3">
                                {/* Video Placeholder */}
                                <div className="w-full h-[180px] bg-[#D9D9D9] rounded-[16px] relative flex items-center justify-center overflow-hidden">
                                    {course.thumbnail && <img src={course.thumbnail} alt={course.name} className="absolute inset-0 w-full h-full object-cover" />}
                                    <div className="w-[48px] h-[48px] bg-white/40 rounded-full flex items-center justify-center z-10 cursor-pointer hover:bg-white/60 transition-colors">
                                        <div className="w-[36px] h-[36px] bg-[#F2F4FF] rounded-full flex items-center justify-center shadow-sm">
                                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-[#687EFF] border-b-[6px] border-b-transparent ml-1"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Price / Enroll */}
                                <div className="w-full flex justify-between items-center py-2">
                                    <span className="text-[#687EFF] text-[20px] font-bold leading-[150%]">
                                        {Number(course?.price || 0) > 0 ? `THB ${Number(course.price).toLocaleString()}` : 'Free'}
                                    </span>
                                    <div
                                        className="relative group cursor-pointer inline-flex items-center"
                                        onClick={() => {
                                            if (isEnrolled) {
                                                window.location.href = learnHref;
                                                return;
                                            }
                                            if (isPendingApproval) {
                                                toast.info('Your enrollment request is pending admin approval.', LEARNER_TOAST);
                                                return;
                                            }
                                            handleEnroll();
                                        }}
                                    >
                                        <div className="bg-[#F87A53] rounded-full px-3 flex items-center justify-between min-w-[160px] h-[32px] z-10 relative overflow-hidden transition-opacity hover:opacity-90">
                                            <div className="absolute bg-white opacity-10 w-full h-[31px] rotate-35 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                                            <span className="text-white text-[13px] font-medium leading-[140%] relative z-10 mr-2">{ctaLabel}</span>
                                            <div className="w-[20px] h-[20px] border border-white/40 rounded-full flex items-center justify-center relative z-10">
                                                <svg width="6" height="6" viewBox="0 0 24 24" fill="white"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {isPendingApproval && (
                                    <div className="text-[#F59E0B] text-[12px] font-medium -mt-1">
                                        Waiting for admin approval before learning access.
                                    </div>
                                )}

                                {/* Share Course */}
                                <div className="w-full bg-[#f8fafe] rounded-[8px] p-3 flex items-center justify-between">
                                    <span className="text-[#052143] text-[14px] font-medium leading-[150%]">Share Course</span>
                                    <div className="flex items-center gap-2">
                                        <a href="#" className="w-[24px] h-[24px] bg-white border border-[#D1E3FB] rounded-full flex items-center justify-center text-[#052143] hover:bg-[#687EFF] hover:text-white transition-colors">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                                        </a>
                                        <a href="#" className="w-[24px] h-[24px] bg-white border border-[#D1E3FB] rounded-full flex items-center justify-center text-[#052143] hover:bg-[#687EFF] hover:text-white transition-colors">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.917 16.083c-1.158 0-2.083-.925-2.083-2.083s.925-2.083 2.083-2.083 2.083.925 2.083 2.083-.925 2.083-2.083 2.083zm4.583 0c-1.158 0-2.083-.925-2.083-2.083s.925-2.083 2.083-2.083 2.083.925 2.083 2.083-.925 2.083-2.083 2.083zm0-4.583c-1.158 0-2.083-.925-2.083-2.083s.925-2.083 2.083-2.083 2.083.925 2.083 2.083-.925 2.083-2.083 2.083z" /></svg>
                                        </a>
                                        <a href="#" className="w-[24px] h-[24px] bg-[#687EFF] rounded-full flex items-center justify-center text-white">
                                            <svg width="8" height="12" viewBox="0 0 10 18" fill="currentColor"><path d="M6.39 18V9.79h2.67l.4-3.18H6.39V4.56c0-.92.25-1.55 1.54-1.55h1.65V.13A21.57 21.57 0 0 0 7.2 0C4.8 0 3.15 1.49 3.15 4.23v2.38H.46v3.18h2.69V18h3.24z" /></svg>
                                        </a>
                                        <a href="#" className="w-[24px] h-[24px] bg-white border border-[#D1E3FB] rounded-full flex items-center justify-center text-[#052143] hover:bg-[#687EFF] hover:text-white transition-colors">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
                                        </a>
                                    </div>
                                </div>

                                {/* This Course Included */}
                                <div className="w-full flex flex-col pt-3 gap-3">
                                    <h3 className="text-[#052143] text-[15px] font-bold leading-[150%] mb-1">This Course Included</h3>

                                    {/* Item: Lesson */}
                                    <div className="flex justify-between items-center w-full">
                                        <div className="flex items-center gap-2">
                                            <svg className="text-[#6B778B] w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M6.012 18H21V4a2 2 0 0 0-2-2H6c-1.206 0-3 .799-3 3v14c0 2.201 1.794 3 3 3h15v-2H6.012C5.55 19.988 5 19.805 5 19s.55-.988 1.012-1zM8 6h9v2H8V6z" /></svg>
                                            <span className="text-[#6B778B] text-[13px] leading-[150%]">Lesson</span>
                                        </div>
                                        <span className="text-[#6B778B] text-[13px] leading-[150%]">{course.lessons || 0}</span>
                                    </div>
                                    <div className="w-full border-b border-dashed border-[#D1E3FB]"></div>

                                    {/* Item: Duration */}
                                    <div className="flex justify-between items-center w-full">
                                        <div className="flex items-center gap-2">
                                            <svg className="text-[#6B778B] w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" /><path d="M13 7h-2v6h6v-2h-4z" /></svg>
                                            <span className="text-[#6B778B] text-[13px] leading-[150%]">Duration</span>
                                        </div>
                                        <span className="text-[#6B778B] text-[13px] leading-[150%]">{formatDuration(course)}</span>
                                    </div>
                                    <div className="w-full border-b border-dashed border-[#D1E3FB]"></div>

                                    {/* Item: Registration */}
                                    <div className="flex justify-between items-center w-full">
                                        <div className="flex items-center gap-2">
                                            <svg className="text-[#6B778B] w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2v2H6V2H4v22h2v-2h12v2h2V2h-2zm-2 10H8V6h8v6zm0 6H8v-4h8v4z" /></svg>
                                            <span className="text-[#6B778B] text-[13px] leading-[150%]">Registration</span>
                                        </div>
                                        <span className="text-[#6B778B] text-[13px] leading-[150%] text-right max-w-[55%]">{registrationWindowText}</span>
                                    </div>
                                    <div className="w-full border-b border-dashed border-[#D1E3FB]"></div>

                                    {showMaxLearner && (
                                        <>
                                            {/* Item: Max Learner */}
                                            <div className="flex justify-between items-center w-full">
                                                <div className="flex items-center gap-2">
                                                    <svg className="text-[#6B778B] w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M3 22h18v-2H3v2zm6-6h4V8H9v8zm-6 0h4v-4H3v4zm12-12v12h4V4h-4z" /></svg>
                                                    <span className="text-[#6B778B] text-[13px] leading-[150%]">Max Learner</span>
                                                </div>
                                                <span className="text-[#6B778B] text-[13px] leading-[150%]">{Number(course.maxLearner || 0)}</span>
                                            </div>
                                            <div className="w-full border-b border-dashed border-[#D1E3FB]"></div>
                                        </>
                                    )}

                                    {/* Item: Sections */}
                                    <div className="flex justify-between items-center w-full">
                                        <div className="flex items-center gap-2">
                                            <svg className="text-[#6B778B] w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4z" /></svg>
                                            <span className="text-[#6B778B] text-[13px] leading-[150%]">Sections</span>
                                        </div>
                                        <span className="text-[#6B778B] text-[13px] leading-[150%]">{normalizedSections.length}</span>
                                    </div>
                                    <div className="w-full border-b border-dashed border-[#D1E3FB]"></div>
                                </div>
                            </div>
                        </div>

                    </div>
                </FadeIn>
            </main>

            {typeof window !== 'undefined' && reviewSuccessModal.open && createPortal(
                <div
                    className="fixed inset-0 z-[1100] bg-[rgba(10,16,36,0.5)] backdrop-blur-[3px] flex items-center justify-center p-4"
                    onClick={closeReviewSuccessModal}
                >
                    <div
                        className="w-full max-w-[560px] rounded-[26px] bg-white px-6 sm:px-7 py-7 sm:py-8 text-center shadow-[0_32px_80px_rgba(9,16,35,0.38)] border border-[#E8ECFF]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mx-auto mb-2 flex items-center justify-center relative w-[80px] h-[80px]">
                            <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="36" y="52" width="20" height="32" rx="3" transform="rotate(-35 36 52)" fill="#FFC224" />
                                <rect x="32" y="78" width="16" height="8" rx="2" transform="rotate(-35 32 78)" fill="#F59E0B" />
                                <line x1="58" y1="36" x2="68" y2="28" stroke="#687EFF" strokeWidth="4" strokeLinecap="round" />
                                <line x1="50" y1="26" x2="55" y2="15" stroke="#F87A53" strokeWidth="4" strokeLinecap="round" />
                                <line x1="72" y1="46" x2="86" y2="44" stroke="#34D399" strokeWidth="4" strokeLinecap="round" />
                                <line x1="38" y1="28" x2="30" y2="20" stroke="#FFC224" strokeWidth="4" strokeLinecap="round" />
                                <circle cx="80" cy="24" r="3.5" fill="#FFC224" />
                                <circle cx="64" cy="12" r="3" fill="#687EFF" />
                                <circle cx="44" cy="14" r="3" fill="#34D399" />
                                <circle cx="88" cy="34" r="3.5" fill="#F87A53" />
                                <circle cx="46" cy="34" r="2.5" fill="#687EFF" />
                            </svg>
                        </div>

                        <h3 className="text-[#687EFF] text-[24px] sm:text-[26px] font-bold leading-[130%] mb-3">
                            Thank you for your feedback!
                        </h3>
                        <p className="text-[#6B778B] text-[15px] sm:text-[16px] leading-[145%] mb-6 max-w-[430px] mx-auto">
                            Your review has been submitted successfully. It helps us and other students a lot.
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                closeReviewSuccessModal();
                                router.push('/my-learning');
                            }}
                            className="h-[48px] px-8 rounded-full bg-[#F87A53] text-white text-[16px] leading-none font-medium hover:bg-[#E96E48] transition-colors w-full max-w-[320px] mx-auto"
                        >
                            Back to My LMS
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}



