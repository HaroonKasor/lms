'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';
import { getUser } from '@/lib/auth';
import {
    CERTIFICATE_ASPECT_RATIO,
    CERTIFICATE_HOLDER_RATIO,
    CERTIFICATE_LAYOUT,
    CERTIFICATE_SIGNATURE_IMAGE,
    CERTIFICATE_TEMPLATE_IMAGE,
    formatCertificateDate,
} from '@/lib/certificate-layout';

function containsThai(value) {
    return /[\u0E00-\u0E7F]/.test(String(value || ''));
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH');
}

function resolveEnrollmentStatus(enrollment) {
    const raw = String(enrollment?.status || '').toUpperCase();
    const progress = Number(enrollment?.progress ?? enrollment?.progressPercent ?? 0);
    const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

    if (raw === 'PENDING') return 'PENDING';
    if (raw === 'COMPLETED' || safeProgress >= 100) return 'COMPLETED';
    if (raw === 'LEARNING' || raw === 'IN_PROGRESS' || safeProgress > 0) return 'LEARNING';
    if (raw === 'FAILED') return 'FAILED';
    if (raw === 'CANCELLED') return 'CANCELLED';
    return 'APPROVED';
}

const STAR_VALUES = [1, 2, 3, 4, 5];
const ENROLLMENTS_TIMEOUT_MS = 15000;
const REVIEWS_TIMEOUT_MS = 10000;
const COURSES_PER_PAGE = 6;

export default function MyLearning() {
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Enrolled');
    const [activeCategory, setActiveCategory] = useState('All categories');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    const [pendingReviews, setPendingReviews] = useState([]);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [reviewModalStage, setReviewModalStage] = useState('form');
    const [selectedRating, setSelectedRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [dismissedReviewIds, setDismissedReviewIds] = useState([]);
    const [submittedReview, setSubmittedReview] = useState(null);
    const reviewScrollLockRef = useRef(null);

    const lockReviewScroll = useCallback(() => {
        if (typeof document === 'undefined') return;
        if (!reviewScrollLockRef.current) {
            reviewScrollLockRef.current = {
                bodyOverflow: document.body.style.overflow,
                htmlOverflow: document.documentElement.style.overflow,
            };
        }
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    }, []);

    const unlockReviewScroll = useCallback((force = false) => {
        if (typeof document === 'undefined') return;
        const previous = reviewScrollLockRef.current;
        if (!previous && !force) return;
        document.body.style.overflow = previous?.bodyOverflow || '';
        document.documentElement.style.overflow = previous?.htmlOverflow || '';
        reviewScrollLockRef.current = null;
    }, []);

    const fetchWithTimeout = useCallback(async (url, options = {}, timeoutMs = 10000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }
    }, []);

    const loadEnrollments = useCallback(async () => {
        try {
            const res = await fetchWithTimeout(
                '/api/enrollments',
                { cache: 'no-store' },
                ENROLLMENTS_TIMEOUT_MS
            );
            if (res.ok) {
                const data = await res.json();
                setEnrollments(data);
            } else {
                setEnrollments([]);
            }
        } catch (e) {
            if (e?.name === 'AbortError') {
                console.error('[MyLearning] /api/enrollments request timed out');
            } else {
                console.error(e);
            }
            setEnrollments([]);
        } finally {
            setLoading(false);
        }
    }, [fetchWithTimeout]);

    const loadPendingReviews = useCallback(async () => {
        try {
            const res = await fetchWithTimeout(
                '/api/course-reviews?pending=1',
                { cache: 'no-store' },
                REVIEWS_TIMEOUT_MS
            );
            if (!res.ok) return;
            const data = await res.json().catch(() => []);
            setPendingReviews(Array.isArray(data) ? data : []);
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.error('[MyLearning] /api/course-reviews?pending=1 request timed out');
                return;
            }
            console.error('[MyLearning] loadPendingReviews failed', error);
        }
    }, [fetchWithTimeout]);

    const activePendingReview = useMemo(() => (
        pendingReviews.find((row) => !dismissedReviewIds.includes(Number(row?.enrollmentId || 0))) || null
    ), [pendingReviews, dismissedReviewIds]);
    const activePendingReviewId = Number(activePendingReview?.enrollmentId || 0);
    const reviewModalReview = reviewModalStage === 'thanks'
        ? submittedReview
        : activePendingReview;

    const closeReviewModal = useCallback((options = {}) => {
        const dismissCurrent = options?.dismissCurrent !== false;
        if (dismissCurrent && activePendingReview?.enrollmentId) {
            setDismissedReviewIds((prev) => {
                const next = new Set(prev);
                next.add(Number(activePendingReview.enrollmentId));
                return Array.from(next);
            });
        }
        setReviewModalOpen(false);
        setReviewModalStage('form');
        setSelectedRating(0);
        setHoverRating(0);
        setReviewText('');
        setReviewError('');
        setSubmittedReview(null);
        unlockReviewScroll(true);
    }, [activePendingReview, unlockReviewScroll]);

    const submitReview = useCallback(async () => {
        if (!activePendingReview || selectedRating < 1 || selectedRating > 5) return;
        try {
            setReviewSubmitting(true);
            setReviewError('');
            const res = await fetch('/api/course-reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enrollmentId: Number(activePendingReview.enrollmentId),
                    rating: Number(selectedRating),
                    reviewText: String(reviewText || '').trim(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Submit rating failed');

            const doneId = Number(activePendingReview.enrollmentId);
            setSubmittedReview(activePendingReview);
            setPendingReviews((prev) => prev.filter((row) => Number(row?.enrollmentId || 0) !== doneId));
            setDismissedReviewIds((prev) => prev.filter((id) => Number(id) !== doneId));
            setReviewModalStage('thanks');
            setSelectedRating(0);
            setHoverRating(0);
            setReviewText('');
        } catch (error) {
            setReviewError(error?.message || 'Submit rating failed');
        } finally {
            setReviewSubmitting(false);
        }
    }, [activePendingReview, selectedRating, reviewText]);

    // Fetch enrollments from API
    useEffect(() => {
        setUser(getUser());
        loadEnrollments();
        loadPendingReviews();
    }, [loadEnrollments, loadPendingReviews]);

    // Auto refresh when learning tab closes or when user returns to this tab.
    useEffect(() => {
        const onStorage = (event) => {
            if (event.key === 'lms_learning_refresh') {
                loadEnrollments();
                loadPendingReviews();
            }
        };
        const onFocus = () => {
            loadEnrollments();
            loadPendingReviews();
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                loadEnrollments();
                loadPendingReviews();
            }
        };

        let channel = null;
        try {
            channel = new BroadcastChannel('lms_learning');
            channel.onmessage = (event) => {
                if (event?.data?.type === 'refresh') {
                    loadEnrollments();
                    loadPendingReviews();
                }
            };
        } catch {
            channel = null;
        }

        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
            if (channel) channel.close();
        };
    }, [loadEnrollments, loadPendingReviews]);

    useEffect(() => {
        if (!activePendingReviewId) return;
        if (reviewModalOpen) return;
        setReviewModalOpen(true);
        setReviewModalStage('form');
        setSelectedRating(0);
        setHoverRating(0);
        setReviewText(String(activePendingReview?.reviewText || ''));
        setReviewError('');
        setSubmittedReview(null);
    }, [activePendingReviewId, reviewModalOpen, activePendingReview?.reviewText]);

    useEffect(() => {
        if (!reviewModalOpen) return;
        if (activePendingReview) return;
        if (reviewModalStage === 'thanks' && submittedReview) return;
        setReviewModalOpen(false);
        setReviewModalStage('form');
        setSelectedRating(0);
        setHoverRating(0);
        setReviewText('');
        setReviewError('');
        setSubmittedReview(null);
    }, [reviewModalOpen, activePendingReview, reviewModalStage, submittedReview]);

    useEffect(() => {
        if (!reviewModalOpen || !reviewModalReview) {
            unlockReviewScroll();
            return undefined;
        }
        lockReviewScroll();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeReviewModal();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [reviewModalOpen, reviewModalReview, closeReviewModal, lockReviewScroll, unlockReviewScroll]);

    // Safety net: ensure page can scroll when review modal is closed.
    useEffect(() => {
        if (!reviewModalOpen) {
            unlockReviewScroll();
        }
    }, [reviewModalOpen, unlockReviewScroll]);

    // Map enrollment status to tab names
    const getTabStatus = (enrollment) => {
        const normalized = resolveEnrollmentStatus(enrollment);
        if (normalized === 'LEARNING') return 'Learning';
        if (normalized === 'COMPLETED') return 'Completed';
        return 'Enrolled';
    };

    // Build dynamic categories from enrollments
    const allCategories = [...new Set(enrollments.map(e => e.course?.category).filter(Boolean))];
    const categories = [
        { name: 'All categories' },
        ...allCategories.map(c => ({ name: c })),
    ];

    // If no enrollments, show "Start enrolling to see categories"
    const sidebarEmpty = enrollments.length === 0;

    const filteredCourses = enrollments.filter(e => {
        const matchesTab = getTabStatus(e) === activeTab;
        const matchesCategory = activeCategory === 'All categories' || e.course?.category === activeCategory;
        const matchesSearch = !searchQuery || e.course?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesCategory && matchesSearch;
    });
    const totalPages = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PER_PAGE));
    const pagedCourses = useMemo(() => {
        const start = (currentPage - 1) * COURSES_PER_PAGE;
        return filteredCourses.slice(start, start + COURSES_PER_PAGE);
    }, [filteredCourses, currentPage]);
    const pageNumbers = useMemo(() => {
        const windowSize = 5;
        if (totalPages <= windowSize) {
            return Array.from({ length: totalPages }, (_, index) => index + 1);
        }
        const half = Math.floor(windowSize / 2);
        let start = Math.max(1, currentPage - half);
        let end = Math.min(totalPages, start + windowSize - 1);
        if (end - start + 1 < windowSize) {
            start = Math.max(1, end - windowSize + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, activeCategory, searchQuery]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const tabIcons = {
        Enrolled: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 448 512"><path d="M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z" /></svg>
        ),
        Learning: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 512 512"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2M495.3 176.3c15.6-15.6 15.6-40.9 0-56.6l-36.7-36.7c-15.6-15.6-40.9-15.6-56.6 0L381.7 104 416 138.3z" /></svg>
        ),
        Completed: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 640 512"><path d="M320 32c-8.1 0-16.1 1.4-23.7 4.1L15.8 137.4C6.3 140.9 0 149.9 0 160s6.3 19.1 15.8 22.6l57.9 20.9C57.3 229.3 48 259.8 48 291.9v28.1c0 28.4-10.8 57.7-22.3 80.8c-6.5 13-13.9 25.8-22.5 37.6C0 442.7-.9 448.3 .9 453.4s6 8.9 11.2 10.2l64 16c4.2 1.1 8.7 .3 12.4-2s6.3-6.1 7.1-10.4c8.6-42.8 4.3-81.2-2.1-108.7C90.3 344.3 86 329.8 80 316.5V291.9c0-30.2 10.2-58.7 27.9-81.5c12.9-15.5 29.6-28 49.2-35.7l157-56.7c8.3-3 17.5 1.4 20.5 9.7s-1.4 17.5-9.7 20.5l-157 56.7C147.2 214.3 128 244.4 128 278.1c0 12.3 3.6 23.8 9.7 33.5L296.3 373c14.4 5.2 30.1 5.2 44.5 0L502.3 311.5c6.1-9.7 9.7-21.2 9.7-33.5c0-33.7-19.2-63.8-39.8-73.2l-157-56.7c-8.3-3-12.7-12.2-9.7-20.5s12.2-12.7 20.5-9.7l157 56.7c19.6 7.7 36.3 20.2 49.2 35.7c17.7 22.8 27.9 51.3 27.9 81.5v25.4c-6.1 13.3-10.3 27.8-13.5 42.1c-6.4 27.4-10.7 65.8-2.1 108.7c.8 4.3 3.4 8.1 7.1 10.4s8.2 3.1 12.4 2l64-16c5.2-1.3 9.3-5.1 11.2-10.2s.8-10.7-2.4-15l0 0c-8.6-11.8-16.1-24.6-22.6-37.6C618.8 377.6 608 348.3 608 320V291.9c0-32.1-9.3-62.6-25.7-88.4l57.9-20.9c9.5-3.4 15.8-12.5 15.8-22.6s-6.3-19.1-15.8-22.6L343.7 36.1C336.1 33.4 328.1 32 320 32z" /></svg>
        )
    };

    const formatDuration = (c) => {
        if (!c) return '0h';
        const parts = [];
        if (c.durationHours > 0) parts.push(`${c.durationHours}h`);
        if (c.durationMinutes > 0) parts.push(`${c.durationMinutes}min`);
        return parts.join(', ') || '0h';
    };
    const canRenderPortal = typeof window !== 'undefined';

    if (loading) {
        return <LoadScreen text="Loading learning data..." variant="minimal" />;
    }

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] relative overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
            <Navbar />

            {/* Hero Banner */}
            <div className="relative w-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #3C59FC 0%, #687EFF 100%)' }}>
                <div className="absolute w-[828px] h-[107px] bg-white/10 -rotate-45 -left-[303px] -top-[60px] pointer-events-none"></div>
                <div className="absolute w-[1428px] h-[107px] bg-white/10 -rotate-45 right-[-200px] -top-[60px] pointer-events-none"></div>
                <div className="absolute w-[369px] h-[369px] rounded-full border border-white/20 right-[200px] -top-[32px] opacity-60 pointer-events-none"></div>
                <div className="absolute w-[388px] h-[388px] rounded-full border border-white/15 right-[190px] -top-[41px] opacity-60 pointer-events-none"></div>
                <div className="max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-20 py-8 sm:py-10 relative z-10">
                    <h1 className="text-white font-semibold text-[30px] sm:text-[40px] leading-[110%] mb-3 sm:mb-4">Good morning, {user?.fullName || user?.username || 'Learner'}!</h1>
                    <p className="text-white font-medium text-[16px] sm:text-xl leading-[120%]">Let&apos;s start learning! Explore our courses and find what inspires you.</p>
                </div>
            </div>

            <div className="absolute hidden md:block w-[104px] h-[104px] right-16 top-[548px] rounded-full pointer-events-none" style={{ background: 'linear-gradient(134.15deg, rgba(247, 13, 197, 0.099) 15.4%, rgba(247, 13, 197, 0) 73.27%)' }}></div>

            <main className="w-full max-w-[1840px] mx-auto relative z-10 pt-8 pb-24 px-4 sm:px-6 lg:px-20 flex flex-col lg:flex-row gap-8">
                <FadeIn direction="right" className="w-full lg:w-[408px] shrink-0 h-fit lg:sticky lg:top-24">
                    <div className="bg-white border border-[#D1E3FB] rounded-[20px] p-6 pb-8">
                        <div className="flex items-center gap-2.5 pb-4 mb-6 border-b border-dashed border-[#D1E3FB]">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3z" fill="#052143" />
                                <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" fill="#F87A53" fillOpacity="0.3" />
                            </svg>
                            <h2 className="text-[#052143] font-semibold text-2xl">Category</h2>
                        </div>
                        <div className="flex flex-col gap-1">
                            {sidebarEmpty ? (
                                <p className="text-[#6B778B] text-base px-3 py-4">Start enrolling to see categories</p>
                            ) : (
                                categories.map((cat, idx) => (
                                    <button key={idx} onClick={() => setActiveCategory(cat.name)}
                                        className={`w-full text-left px-3 py-2 rounded-lg font-medium text-xl leading-[150%] transition-all
                                            ${activeCategory === cat.name ? 'bg-[#E3E7FF] text-[#687EFF]' : 'text-[#052143] hover:bg-[#F6F8FF]'}`}>
                                        {cat.name}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </FadeIn>

                <FadeIn direction="up" className="flex-1 flex flex-col gap-6 min-w-0">
                    {/* Search Bar + View Controls */}
                    <div className="flex flex-col xl:flex-row gap-4 items-center">
                        <div className="flex-1 w-full bg-white border border-[#D1E3FB] rounded-full flex items-center pl-5 pr-2 py-2 gap-2">
                            <input type="text" placeholder="Search Course" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 bg-transparent border-none outline-none text-[#052143] text-[15px] placeholder:text-[#6B778B] font-normal" />
                            <button className="w-12 h-12 rounded-full bg-[#687EFF] flex items-center justify-center shrink-0 hover:bg-[#5a6fe6] transition-colors">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 512 512"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" /></svg>
                            </button>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                            <div className="bg-white border border-[#D1E3FB] rounded-2xl flex items-center p-5 gap-2.5">
                                <button className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                                    <svg className="w-3.5 h-4" viewBox="0 0 14 16" fill="none"><rect x="0" y="0" width="5.5" height="5.5" rx="1" fill="#687EFF" /><rect x="8" y="0" width="5.5" height="5.5" rx="1" fill="#687EFF" /><rect x="0" y="8" width="5.5" height="5.5" rx="1" fill="#687EFF" /><rect x="8" y="8" width="5.5" height="5.5" rx="1" fill="#687EFF" /></svg>
                                </button>
                                <button className="w-7 h-7 rounded-full bg-[#687EFF] flex items-center justify-center">
                                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><rect y="1" width="12" height="1.5" rx="0.75" fill="white" /><rect y="5" width="12" height="1.5" rx="0.75" fill="white" /><rect y="9" width="12" height="1.5" rx="0.75" fill="white" /></svg>
                                </button>
                            </div>
                            <div className="bg-white border border-[#D1E3FB] rounded-2xl flex items-center px-5 py-5 gap-3 whitespace-nowrap">
                                <span className="text-[#052143] text-sm font-normal">Sort by:</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-[#6B778B] text-sm font-normal">Date</span>
                                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="#6B778B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-1">
                            {['Enrolled', 'Learning', 'Completed'].map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium text-base transition-all
                                        ${activeTab === tab ? 'bg-[#687EFF] text-white shadow-md' : 'text-[#052143] hover:bg-[#F6F8FF]'}`}>
                                    <span className={activeTab === tab ? 'text-white' : 'text-[#052143]'}>{tabIcons[tab]}</span>
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <span className="text-[#6B778B] text-sm font-normal">
                            Showing {pagedCourses.length} Courses (Page {currentPage}/{totalPages}) of {filteredCourses.length} in this view
                        </span>
                    </div>

                    {(
                        <>
                            {/* Course Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {pagedCourses.map((enrollment) => (
                                    <CourseCard
                                        key={enrollment.id}
                                        enrollment={enrollment}
                                        formatDuration={formatDuration}
                                        currentUser={user}
                                    />
                                ))}
                            </div>

                            {/* Empty State */}
                            {filteredCourses.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <img src="/images/empty-state-courses.jpg" alt="No courses" className="w-[160px] h-auto mb-6 opacity-70" />
                                    <p className="text-[#6B778B] text-base leading-relaxed mb-6">
                                        You haven&apos;t enrolled in any courses yet.<br />
                                        Let&apos;s find something exciting to learn today.
                                    </p>
                                    <Link href="/courses" className="bg-[#F87A53] hover:bg-[#e06a45] text-white px-8 py-3 rounded-full text-base font-medium transition-colors shadow-md">
                                        Courses
                                    </Link>
                                </div>
                            )}

                            {/* Pagination */}
                            {filteredCourses.length > 0 && (
                                <div className="flex items-center justify-end gap-4 mt-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="w-10 h-10 rounded-full bg-white border border-[#D1E3FB] flex items-center justify-center text-[#6B778B] hover:bg-[#F6F8FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-2.5 h-3" fill="currentColor" viewBox="0 0 320 512"><path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z" /></svg>
                                        </button>
                                        {pageNumbers.map(page => (
                                            <button key={page} onClick={() => setCurrentPage(page)}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-normal transition-colors
                                                    ${currentPage === page ? 'bg-[#687EFF] text-white' : 'bg-white border border-[#D1E3FB] text-[#6B778B] hover:bg-[#F6F8FF]'}`}>
                                                {String(page).padStart(2, '0')}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="w-10 h-10 rounded-full bg-white border border-[#D1E3FB] flex items-center justify-center text-[#6B778B] hover:bg-[#F6F8FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-2.5 h-3" fill="currentColor" viewBox="0 0 320 512"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z" /></svg>
                                        </button>
                                    </div>
                                    <div className="bg-white border border-[#D1E3FB] rounded-lg flex items-center px-5 py-2.5 gap-2">
                                        <span className="text-[#052143] text-sm font-normal">{COURSES_PER_PAGE} items/page</span>
                                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="#6B778B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </FadeIn>
            </main>

            {canRenderPortal && reviewModalOpen && reviewModalReview && createPortal(
                <div
                    className="fixed inset-0 z-[1000] bg-[rgba(60,60,67,0.6)] backdrop-blur-[1px] flex items-center justify-center p-4"
                    onClick={closeReviewModal}
                >
                    <div
                        className="w-full max-w-[685px] bg-white rounded-[12px] shadow-[0_24px_80px_rgba(0,0,0,0.25)] px-6 sm:px-10 py-8 text-center"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {reviewModalStage === 'form' ? (
                            <>
                                <div className="w-[140px] h-[88px] rounded-[16px] overflow-hidden mx-auto mb-6 bg-[#E6F5F1]">
                                    <img
                                        src={reviewModalReview.courseThumbnail || '/course.png'}
                                        alt={reviewModalReview.courseName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = '/course.png';
                                        }}
                                    />
                                </div>
                                <h3 className="text-[#052143] text-[20px] font-medium leading-[130%] mb-2">
                                    {reviewModalReview.courseName}
                                </h3>
                                <p className="text-[#052143] text-[16px] font-normal leading-[140%] mb-5">
                                    How was your learning experience? Your feedback helps us improve.
                                </p>

                                <div
                                    className="flex items-center justify-center gap-3 mb-8"
                                    onMouseLeave={() => setHoverRating(0)}
                                >
                                    {STAR_VALUES.map((value) => {
                                        const active = value <= (hoverRating || selectedRating);
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onMouseEnter={() => setHoverRating(value)}
                                                onClick={() => setSelectedRating(value)}
                                                className="w-8 h-8 flex items-center justify-center"
                                                aria-label={`Rate ${value} star`}
                                            >
                                                <svg
                                                    className={`w-8 h-8 ${active ? 'text-[#FFC224]' : 'text-[#A2AEC3]'}`}
                                                    viewBox="0 0 24 24"
                                                    fill={active ? 'currentColor' : 'none'}
                                                    stroke="currentColor"
                                                    strokeWidth="1.6"
                                                >
                                                    <path d="M12 2.8l2.82 5.72 6.31.92-4.56 4.45 1.08 6.3L12 17.2l-5.65 2.97 1.08-6.3L2.87 9.44l6.31-.92L12 2.8z" />
                                                </svg>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mb-5 text-left">
                                    <label
                                        htmlFor="review-comment"
                                        className="block text-[#052143] text-[14px] font-medium mb-2"
                                    >
                                        Comment (optional)
                                    </label>
                                    <textarea
                                        id="review-comment"
                                        value={reviewText}
                                        onChange={(event) => setReviewText(event.target.value.slice(0, 2000))}
                                        placeholder="Share what you liked or what should be improved..."
                                        className="w-full min-h-[96px] rounded-[12px] border border-[#D7E0F0] px-3 py-2 text-[14px] text-[#052143] outline-none resize-y focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20"
                                        disabled={reviewSubmitting}
                                    />
                                    <div className="mt-1 text-right text-[#94A3B8] text-[12px]">
                                        {String(reviewText || '').length}/2000
                                    </div>
                                </div>

                                {reviewError && (
                                    <p className="text-[#E11D48] text-[13px] mb-4">{reviewError}</p>
                                )}

                                <div className="flex items-center justify-center gap-6">
                                    <button
                                        type="button"
                                        onClick={closeReviewModal}
                                        className="w-[148px] h-[45px] rounded-full border border-[#6B778B] text-[#6B778B] text-[16px] font-normal hover:bg-[#F8FAFF] transition-colors"
                                    >
                                        Close
                                    </button>
                                    <button
                                        type="button"
                                        disabled={selectedRating < 1 || reviewSubmitting}
                                        onClick={submitReview}
                                        className="w-[148px] h-[45px] rounded-full bg-[#F87A53] text-white text-[16px] font-normal hover:bg-[#E96E48] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
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
                                        closeReviewModal({ dismissCurrent: false });
                                    }}
                                    className="h-[48px] px-8 rounded-full bg-[#F87A53] text-white text-[16px] leading-none font-medium hover:bg-[#E96E48] transition-colors w-full max-w-[320px] mx-auto"
                                >
                                    Back to My LMS
                                </button>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

// --- Course Card ---
function CourseCard({ enrollment, formatDuration, currentUser }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [showCertificateModal, setShowCertificateModal] = useState(false);
    const course = enrollment.course;
    const normalizedStatus = resolveEnrollmentStatus(enrollment);
    const isCompleted = normalizedStatus === 'COMPLETED';
    const isLearning = normalizedStatus === 'LEARNING';
    const isPending = normalizedStatus === 'PENDING';
    const certificateImage = CERTIFICATE_TEMPLATE_IMAGE;
    const signatureImage = CERTIFICATE_SIGNATURE_IMAGE;
    const thumbnail = course?.thumbnail || '/course.png';
    const tabStatus = isCompleted ? 'Completed' : isLearning ? 'Learning' : isPending ? 'Pending Approval' : 'Enrolled';
    const statusColorClass = isCompleted ? 'text-[#1DBA9F]' : isLearning ? 'text-[#687EFF]' : isPending ? 'text-[#F59E0B]' : 'text-[#8E8E93]';
    const actionLabel = isLearning ? 'Continue' : 'Start';
    const hasCertificateEnabled = Boolean(course?.certificate);
    const certificateMode = String(course?.certificateMode || 'none').toLowerCase();
    const certificateStatus = String(enrollment?.certificate?.status || '').toUpperCase();
    const certificateReady = isCompleted && hasCertificateEnabled && certificateStatus === 'ISSUED';
    const certificatePendingApproval = isCompleted && hasCertificateEnabled && certificateMode === 'manual' && !certificateReady;
    const certificateGenerating = isCompleted && hasCertificateEnabled && certificateMode === 'auto' && !certificateReady;
    const certificateUnavailable = isCompleted && !hasCertificateEnabled;
    const displayDate = formatDate(course?.createdAt || enrollment?.createdAt);
    const reviewCount = Number(course?.reviewCount || 0);
    const averageRating = Number(course?.averageRating || 0);
    const averageRatingText = reviewCount > 0 && Number.isFinite(averageRating)
        ? averageRating.toFixed(1)
        : '0.0';
    const canRenderPortal = typeof window !== 'undefined';
    const learnSectionId = Number(enrollment?.section?.id || 0);
    const learnHref = learnSectionId > 0
        ? `/courses/${course?.id}/learn?launch=1&sectionId=${learnSectionId}`
        : `/courses/${course?.id}/learn?launch=1`;
    const certificateRecipient =
        enrollment?.certificate?.recipientName ||
        currentUser?.fullName ||
        currentUser?.name ||
        enrollment?.learner?.fullName ||
        enrollment?.learner?.username ||
        currentUser?.username ||
        'Learner';
    const certificateCourseName = course?.name || course?.title || 'Course';
    const certificateIssuedDateValue = enrollment?.certificate?.issuedAt || enrollment?.updatedAt || enrollment?.createdAt || new Date();
    const certificateIssuedDate = formatCertificateDate(certificateIssuedDateValue);
    const certificateNo = enrollment?.certificate?.verifyCode || `CERT-${course?.id || 'N/A'}`;
    const instructorExperience = String(course?.instructorExperience || '').trim();
    const sectionLabel = String(
        enrollment?.section?.name
        || enrollment?.section?.title
        || enrollment?.sectionName
        || ''
    ).trim();
    const instructorName = String(course?.instructor || '').trim();
    const displayInstructor = instructorName || 'Instructor Name';
    const displayInstructorMeta = sectionLabel ? `Section: ${sectionLabel}` : (instructorExperience || '-');

    const openCertificatePrint = useCallback(() => {
        const templateUrl = `${window.location.origin}${certificateImage}`;
        const signatureUrl = `${window.location.origin}${signatureImage}`;
        const recipient = escapeHtml(certificateRecipient);
        const courseName = escapeHtml(certificateCourseName);
        const certNoText = escapeHtml(certificateNo);
        const issuedDate = formatCertificateDate(certificateIssuedDateValue);

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <!DOCTYPE html>
            <html><head><title>Certificate</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Noto+Serif+Thai:wght@500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
                @page { size: A4 landscape; margin: 0; }
                html, body { margin: 0; padding: 0; background: #eef2ff; }
                body { min-height: 100vh; display: flex; justify-content: center; align-items: center; font-family: 'Noto Sans Thai', 'Outfit', sans-serif; overflow: hidden; }
                .viewer { width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; padding: 10px; box-sizing: border-box; overflow: hidden; }
                .holder { position: relative; width: min(96vw, calc(96vh * ${CERTIFICATE_HOLDER_RATIO})); aspect-ratio: ${CERTIFICATE_ASPECT_RATIO}; }
                .cert { width: 100%; height: 100%; position: relative; container-type: inline-size; background: url('${templateUrl}') center/100% 100% no-repeat; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                .field { position: absolute; transform: translate(-50%, -50%); text-align: center; color: #22304a; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
                .template { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
                .name { left: ${CERTIFICATE_LAYOUT.recipient.left}; top: ${CERTIFICATE_LAYOUT.recipient.top}; width: ${CERTIFICATE_LAYOUT.recipient.width}; min-height: 132px; font-family: 'Noto Serif Thai', 'Noto Sans Thai', serif; font-size: ${CERTIFICATE_LAYOUT.recipient.fontSizePrint}; line-height: 1.12; font-weight: 600; color: #2e3e76; letter-spacing: 0.2px; word-break: break-word; }
                .course { left: ${CERTIFICATE_LAYOUT.course.left}; top: ${CERTIFICATE_LAYOUT.course.top}; width: ${CERTIFICATE_LAYOUT.course.width}; min-height: 120px; font-family: 'Noto Serif Thai', 'Noto Sans Thai', serif; font-size: ${CERTIFICATE_LAYOUT.course.fontSizePrint}; line-height: 1.18; font-weight: 600; color: #2e3e76; word-break: break-word; }
                .date { left: ${CERTIFICATE_LAYOUT.date.left}; top: ${CERTIFICATE_LAYOUT.date.top}; width: ${CERTIFICATE_LAYOUT.date.width}; font-size: ${CERTIFICATE_LAYOUT.date.fontSizePrint}; line-height: 1.18; font-weight: 500; color: #5a6781; }
                .signature { position: absolute; left: ${CERTIFICATE_LAYOUT.signature.left}; top: ${CERTIFICATE_LAYOUT.signature.top}; transform: translate(-50%, -50%); width: ${CERTIFICATE_LAYOUT.signature.width}; max-height: ${CERTIFICATE_LAYOUT.signature.maxHeight}; object-fit: contain; }
                .cert-no { position: absolute; left: ${CERTIFICATE_LAYOUT.certificateNo.left}; bottom: ${CERTIFICATE_LAYOUT.certificateNo.bottom}; font-size: ${CERTIFICATE_LAYOUT.certificateNo.fontSizePrint}; letter-spacing: 0.6px; color: #5a6781; font-family: 'Noto Sans Thai', 'Outfit', sans-serif; }
                @media print {
                    html, body { background: white; overflow: visible; }
                    .viewer { width: auto; height: auto; overflow: visible; padding: 0; }
                    .holder { width: 297mm !important; height: 210mm !important; aspect-ratio: auto; }
                    .cert { box-shadow: none; }
                }
            </style>
            </head><body>
            <div class="viewer">
              <div class="holder">
                <div class="cert">
                    <img class="template" src="${templateUrl}" alt="Certificate template" />
                    <div class="field name">${recipient}</div>
                    <div class="field course">${courseName}</div>
                    <div class="field date">${issuedDate}</div>
                    <img class="signature" src="${signatureUrl}" alt="Signature" />
                    <div class="cert-no">No. ${certNoText}</div>
                </div>
              </div>
            </div>
            <script>
              (function () {
                if (document.fonts && document.fonts.ready) {
                  document.fonts.ready.then(function () {
                    setTimeout(function () { window.print(); }, 350);
                  });
                } else {
                  setTimeout(function () { window.print(); }, 350);
                }
              })();
            </script>
            </body></html>
        `);
        printWindow.document.close();
    }, [certificateCourseName, certificateImage, certificateIssuedDateValue, certificateNo, certificateRecipient, signatureImage]);

    useEffect(() => {
        if (!showCertificateModal) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowCertificateModal(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [showCertificateModal]);

    return (
        <div className="bg-white rounded-[20px] border border-[#eaedf5] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-300 box-border p-[20px] flex flex-col h-full relative">
            <Link href={`/courses/${course?.id}`} className="w-full h-[230px] rounded-[16px] bg-[#D9D9D9] overflow-hidden block cursor-pointer">
                <img
                    src={thumbnail}
                    alt={course?.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/course.png';
                    }}
                />
            </Link>

            <div className="pt-[24px] flex flex-col flex-1">
                <div className="flex items-center justify-between mb-[16px]">
                    <span className={`font-semibold text-[18px] leading-[130%] ${statusColorClass}`}>
                        {tabStatus}
                    </span>
                    <div className="flex items-center gap-[6px]">
                        <svg className="w-[16px] h-[16px] text-[#FFC224]" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        <span className="text-[#052143] text-[15px] font-bold leading-[100%] mt-0.5">{averageRatingText}</span>
                        <span className="text-[#6B778B] text-[14px] font-normal leading-[100%] mt-0.5">({reviewCount} Reviews)</span>
                    </div>
                </div>

                <div className="flex items-start justify-between mb-[24px] min-h-[62px]">
                    <Link href={`/courses/${course?.id}`} className="hover:text-[#687EFF] transition-colors group flex-1">
                        <h3 className={`font-semibold text-[22px] text-[#052143] group-hover:text-[#687EFF] leading-[140%] line-clamp-2 pr-[8px] transition-colors ${containsThai(course?.name) ? 'font-thai-sarabun' : ''}`}>
                            {course?.name}
                        </h3>
                    </Link>
                    {(isCompleted || isLearning) && (
                        <div className="relative shrink-0">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMenuOpen(!menuOpen);
                                }}
                                className="text-[#6B778B] hover:text-[#052143] mt-1 shrink-0"
                                aria-label="More actions"
                                type="button"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                            </button>
                            {menuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                                    <div className="absolute right-0 top-full mt-1 bg-white border border-[#D1E3FB] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 py-2 min-w-[160px] overflow-hidden">
                                        {isCompleted ? (
                                            <>
                                                <Link
                                                    href={learnHref}
                                                    onClick={() => setMenuOpen(false)}
                                                    className="block w-full text-left px-5 py-3 text-[#052143] text-base font-normal hover:bg-[#F6F8FF] transition-colors"
                                                >
                                                    Learn again
                                                </Link>
                                                <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); }} className="w-full text-left px-5 py-3 text-[#052143] text-base font-normal hover:bg-[#F6F8FF] transition-colors" type="button">Rate course</button>
                                            </>
                                        ) : null}
                                        <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/courses/${course?.id}/report`; }} className="w-full text-left px-5 py-3 text-[#052143] text-base font-normal hover:bg-[#F6F8FF] transition-colors" type="button">Report</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 sm:gap-0 sm:flex-row sm:items-center sm:justify-between mb-[24px]">
                    {isCompleted ? (
                        hasCertificateEnabled ? (
                            certificateReady ? (
                                <button
                                    type="button"
                                    className="flex items-center group cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCertificateModal(true);
                                    }}
                                >
                                    <div className="px-5 h-[36px] box-border rounded-[20px] flex items-center justify-center bg-[#F87A53] text-white mr-[-12px] z-0 min-w-[100px]">
                                        <span className="font-medium text-[14px] pr-2">Certificate</span>
                                    </div>
                                    <div className="w-[36px] h-[36px] box-border rounded-full flex items-center justify-center z-10 bg-[#F87A53] border border-white">
                                        <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                                    </div>
                                </button>
                            ) : (
                                <div className="flex items-center cursor-not-allowed opacity-85" title={certificatePendingApproval ? 'รอแอดมินอนุมัติใบประกาศ' : 'กำลังสร้างใบประกาศ'}>
                                    <div className="px-5 h-[36px] box-border rounded-[20px] flex items-center justify-center bg-[#E2E8F0] text-[#64748B] mr-[-12px] z-0 min-w-[140px]">
                                        <span className="font-medium text-[14px] pr-2">
                                            {certificatePendingApproval ? 'Pending Approval' : certificateGenerating ? 'Generating' : 'Unavailable'}
                                        </span>
                                    </div>
                                    <div className="w-[36px] h-[36px] box-border rounded-full flex items-center justify-center z-10 bg-[#E2E8F0] border border-white">
                                        <svg className="w-4 h-4 text-[#64748B] ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="flex items-center cursor-not-allowed opacity-90" title="หลักสูตรนี้ไม่มีใบประกาศ">
                                <div className="px-5 h-[36px] box-border rounded-[20px] flex items-center justify-center bg-[#F1F5F9] text-[#64748B] mr-[-12px] z-0 min-w-[130px] border border-[#E2E8F0]">
                                    <span className="font-medium text-[14px] pr-2">{certificateUnavailable ? 'No Certificate' : 'Unavailable'}</span>
                                </div>
                                <div className="w-[36px] h-[36px] box-border rounded-full flex items-center justify-center z-10 bg-[#F1F5F9] border border-[#E2E8F0]">
                                    <svg className="w-4 h-4 text-[#94A3B8] ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="5" y1="5" x2="19" y2="19"></line>
                                        <line x1="19" y1="5" x2="5" y2="19"></line>
                                    </svg>
                                </div>
                            </div>
                        )
                    ) : isPending ? (
                        <div className="flex items-center cursor-not-allowed opacity-90" title="Waiting for admin approval">
                            <div className="px-5 h-[36px] box-border rounded-[20px] flex items-center justify-center bg-[#FEF3C7] text-[#B45309] mr-[-12px] z-0 min-w-[150px] border border-[#FDE68A]">
                                <span className="font-medium text-[14px] pr-2">Pending Approval</span>
                            </div>
                            <div className="w-[36px] h-[36px] box-border rounded-full flex items-center justify-center z-10 bg-[#FEF3C7] border border-[#FDE68A]">
                                <svg className="w-4 h-4 text-[#B45309] ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="8"></circle>
                                    <path d="M12 8v5l3 2"></path>
                                </svg>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center">
                            <Link
                                href={learnHref}
                                className="flex items-center group cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="px-5 h-[36px] box-border rounded-[20px] flex items-center justify-center border border-[#F87A53] bg-white text-[#F87A53] mr-[-12px] z-0 min-w-[70px]">
                                    <span className="font-medium text-[14px] pr-2">{actionLabel}</span>
                                </div>
                                <div className="w-[36px] h-[36px] box-border rounded-full flex items-center justify-center z-10 bg-white border border-[#F87A53]">
                                    <svg className="w-4 h-4 text-[#F87A53] ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                                </div>
                            </Link>
                        </div>
                    )}

                    <div className="flex items-center gap-[10px] shrink-0 sm:text-right">
                        <div className="w-[42px] h-[42px] box-border rounded-full object-cover border-2 border-[#eaedf5] shrink-0 bg-[#C7C7CC] text-white flex items-center justify-center">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        </div>
                        <div className="flex flex-col justify-center sm:items-end">
                            <span className={`text-[#052143] font-medium text-[14px] leading-[130%] truncate max-w-[180px] ${containsThai(displayInstructor) ? 'font-thai-sarabun' : ''}`}>
                                {displayInstructor}
                            </span>
                            <span className="text-[#8E8E93] font-normal text-[11px] leading-[130%] truncate max-w-[180px] mt-0.5">{displayInstructorMeta}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-y-2 pt-[20px] border-t border-dashed border-[#eaedf5] mt-auto">
                    <div className="flex items-center gap-[6px]">
                        <svg className="w-[14px] h-[14px] text-[#FF3EA5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span className="text-[#6B778B] font-medium text-[13px]">{displayDate}</span>
                    </div>
                    <div className="flex items-center gap-[6px]">
                        <svg className="w-[14px] h-[14px] text-[#FFC224]" viewBox="0 0 24 24" fill="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        <span className="text-[#6B778B] font-medium text-[13px]">{course?.lessons || 0} Lesson</span>
                    </div>
                    <div className="flex items-center gap-[6px]">
                        <svg className="w-[14px] h-[14px] text-[#687EFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span className="text-[#6B778B] font-medium text-[13px]">{formatDuration(course)}</span>
                    </div>
                </div>
            </div>

            {canRenderPortal && showCertificateModal && createPortal(
                <div
                    className="fixed inset-0 z-[999] bg-[#0B1020]/70 backdrop-blur-[3px] flex items-center justify-center p-4 sm:p-6"
                    onClick={() => setShowCertificateModal(false)}
                >
                    <div
                        className="relative bg-white rounded-[24px] shadow-[0_24px_90px_rgba(0,0,0,0.45)] max-w-[1200px] w-full border border-[#E5EAF8] pt-14 px-8 sm:px-10 pb-8 max-h-[88vh] overflow-hidden my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setShowCertificateModal(false)}
                            className="absolute top-5 right-5 text-[#052143] hover:text-[#1E3A8A] transition-colors"
                            aria-label="Close certificate"
                        >
                            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 5L15 15M15 5L5 15" />
                            </svg>
                        </button>

                        <div className="h-[62vh] min-h-[420px] max-h-[620px] flex items-center justify-center">
                            <div
                                className="relative w-full max-w-[980px] border border-[#E5EAF8] overflow-hidden rounded-[8px] bg-[#f4f7ff]"
                                style={{ aspectRatio: CERTIFICATE_ASPECT_RATIO }}
                            >
                                <img
                                    src={certificateImage}
                                    alt="Certificate preview"
                                    className="absolute inset-0 w-full h-full object-cover"
                                />

                                <div
                                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center text-[#2e3e76] font-semibold leading-[1.12] px-2"
                                    style={{
                                        left: CERTIFICATE_LAYOUT.recipient.left,
                                        top: CERTIFICATE_LAYOUT.recipient.top,
                                        width: CERTIFICATE_LAYOUT.recipient.width,
                                        fontFamily: "'Noto Serif Thai', 'Noto Sans Thai', serif",
                                        fontSize: CERTIFICATE_LAYOUT.recipient.fontSizePreview,
                                        letterSpacing: '0.2px',
                                    }}
                                >
                                    {certificateRecipient}
                                </div>

                                <div
                                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center text-[#2e3e76] font-semibold leading-[1.12] px-2"
                                    style={{
                                        left: CERTIFICATE_LAYOUT.course.left,
                                        top: CERTIFICATE_LAYOUT.course.top,
                                        width: CERTIFICATE_LAYOUT.course.width,
                                        fontFamily: "'Noto Serif Thai', 'Noto Sans Thai', serif",
                                        fontSize: CERTIFICATE_LAYOUT.course.fontSizePreview,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {certificateCourseName}
                                </div>

                                <div
                                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center text-[#5a6781] font-medium px-2"
                                    style={{
                                        left: CERTIFICATE_LAYOUT.date.left,
                                        top: CERTIFICATE_LAYOUT.date.top,
                                        width: CERTIFICATE_LAYOUT.date.width,
                                        fontFamily: "'Noto Sans Thai', 'Outfit', sans-serif",
                                        fontSize: CERTIFICATE_LAYOUT.date.fontSizePreview,
                                    }}
                                >
                                    {certificateIssuedDate}
                                </div>

                                <img
                                    src={signatureImage}
                                    alt="Signature"
                                    className="absolute -translate-x-1/2 -translate-y-1/2 object-contain"
                                    style={{
                                        left: CERTIFICATE_LAYOUT.signature.left,
                                        top: CERTIFICATE_LAYOUT.signature.top,
                                        width: CERTIFICATE_LAYOUT.signature.width,
                                        maxHeight: CERTIFICATE_LAYOUT.signature.maxHeight,
                                    }}
                                />

                                <div
                                    className="absolute text-[#5a6781]"
                                    style={{
                                        left: CERTIFICATE_LAYOUT.certificateNo.left,
                                        bottom: CERTIFICATE_LAYOUT.certificateNo.bottom,
                                        fontFamily: "'Noto Sans Thai', 'Outfit', sans-serif",
                                        fontSize: CERTIFICATE_LAYOUT.certificateNo.fontSizePreview,
                                        letterSpacing: '0.4px',
                                    }}
                                >
                                    No. {certificateNo}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                type="button"
                                onClick={openCertificatePrint}
                                className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-[#F87A53] text-white text-[20px] font-medium hover:bg-[#E96E48] transition-colors"
                            >
                                Download Certificate
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
