'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Navbar from '@/components/layout/Navbar';
import LoadScreen from '@/components/ui/LoadScreen';

const PAGE_SIZE = 6;
const CAN_LEARN_STATUSES = new Set(['APPROVED', 'LEARNING', 'COMPLETED']);
const ENROLLED_DISPLAY_STATUSES = new Set(['APPROVED', 'LEARNING', 'COMPLETED', 'PENDING']);
const ENROLLMENT_STATUS_RANK = {
    COMPLETED: 5,
    LEARNING: 4,
    APPROVED: 3,
    PENDING: 2,
    FAILED: 1,
    CANCELLED: 0,
};

function normalizeEnrollmentStatus(status) {
    return String(status || '').trim().toUpperCase();
}

function toCourseKey(value) {
    if (value === undefined || value === null) return null;
    const asNumber = Number(value);
    if (Number.isInteger(asNumber) && asNumber > 0) return String(asNumber);
    const asText = String(value).trim();
    return asText || null;
}

function getEnrollmentCourseKey(enrollment) {
    return toCourseKey(
        enrollment?.courseId
        ?? enrollment?.course?.id
        ?? enrollment?.courses?.id
    );
}

function toTime(value) {
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
}

function pickPreferredEnrollment(current, candidate) {
    if (!current) return candidate;
    const currentStatus = normalizeEnrollmentStatus(current?.status);
    const candidateStatus = normalizeEnrollmentStatus(candidate?.status);
    const currentRank = ENROLLMENT_STATUS_RANK[currentStatus] ?? -1;
    const candidateRank = ENROLLMENT_STATUS_RANK[candidateStatus] ?? -1;

    if (candidateRank > currentRank) return candidate;
    if (candidateRank < currentRank) return current;

    const currentProgress = Number(current?.progress ?? current?.progressPercent ?? 0);
    const candidateProgress = Number(candidate?.progress ?? candidate?.progressPercent ?? 0);
    if (candidateProgress > currentProgress) return candidate;
    if (candidateProgress < currentProgress) return current;

    const currentUpdated = toTime(current?.updatedAt || current?.lastActivityAt || current?.enrolledAt);
    const candidateUpdated = toTime(candidate?.updatedAt || candidate?.lastActivityAt || candidate?.enrolledAt);
    if (candidateUpdated > currentUpdated) return candidate;
    if (candidateUpdated < currentUpdated) return current;

    return Number(candidate?.id || 0) > Number(current?.id || 0) ? candidate : current;
}

function formatDuration(course) {
    const h = Number(course?.durationHours || 0);
    const m = Number(course?.durationMinutes || 0);
    if (h <= 0 && m <= 0) return '0h';
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH');
}

function containsThai(value) {
    return /[\u0E00-\u0E7F]/.test(String(value || ''));
}

export default function UserCoursesView() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortBy, setSortBy] = useState('latest');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedEnrollmentStatus, setSelectedEnrollmentStatus] = useState('All');

    const [courses, setCourses] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [enrollingId, setEnrollingId] = useState(null);
    const [enrollSuccessModal, setEnrollSuccessModal] = useState({
        open: false,
        courseName: '',
        learnHref: '/my-learning',
        isPending: false,
    });
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        const rafId = window.requestAnimationFrame(() => setAnimateIn(true));
        return () => window.cancelAnimationFrame(rafId);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [courseRes, enrollmentRes] = await Promise.all([
                fetch('/api/courses?public=true', { cache: 'no-store' }),
                fetch('/api/enrollments', { cache: 'no-store' }),
            ]);

            if (!courseRes.ok) {
                const data = await courseRes.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to load courses');
            }
            if (!enrollmentRes.ok && enrollmentRes.status !== 401 && enrollmentRes.status !== 403) {
                const data = await enrollmentRes.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to load enrollments');
            }

            const coursesData = await courseRes.json();
            const enrollmentsData = enrollmentRes.ok
                ? await enrollmentRes.json()
                : [];

            setCourses(Array.isArray(coursesData) ? coursesData : []);
            setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
        } catch (e) {
            setError(e.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const onStorage = (event) => {
            if (event.key === 'lms_learning_refresh') {
                loadData();
            }
        };
        const onFocus = () => loadData();
        const onVisibility = () => {
            if (document.visibilityState === 'visible') loadData();
        };

        let channel = null;
        try {
            channel = new BroadcastChannel('lms_learning');
            channel.onmessage = (event) => {
                if (event?.data?.type === 'refresh') {
                    loadData();
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
    }, [loadData]);

    const enrollmentByCourseId = useMemo(() => {
        const map = new Map();
        for (const e of enrollments) {
            const courseKey = getEnrollmentCourseKey(e);
            if (!courseKey) continue;
            const current = map.get(courseKey);
            map.set(courseKey, pickPreferredEnrollment(current, e));
        }
        return map;
    }, [enrollments]);

    const enrichedCourses = useMemo(() => {
        return courses.map((course) => {
            const enrollment = enrollmentByCourseId.get(toCourseKey(course?.id));
            const enrollmentStatus = normalizeEnrollmentStatus(enrollment?.status);
            const enrolled = Boolean(enrollment && ENROLLED_DISPLAY_STATUSES.has(enrollmentStatus));
            const canStart = Boolean(enrollment && CAN_LEARN_STATUSES.has(enrollmentStatus));
            return { course, enrollment, enrolled, canStart, enrollmentStatus };
        });
    }, [courses, enrollmentByCourseId]);

    const categories = useMemo(() => {
        const counts = {};
        for (const item of enrichedCourses) {
            const key = item.course?.category || 'Uncategorized';
            counts[key] = (counts[key] || 0) + 1;
        }
        return [
            { label: 'All', count: enrichedCourses.length },
            ...Object.entries(counts)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([label, count]) => ({ label, count })),
        ];
    }, [enrichedCourses]);

    const enrollmentStatuses = useMemo(() => {
        const enrolledCount = enrichedCourses.filter((x) => x.enrolled).length;
        const availableCount = enrichedCourses.length - enrolledCount;
        return [
            { label: 'All', count: enrichedCourses.length },
            { label: 'Enrolled', count: enrolledCount },
            { label: 'Available', count: availableCount },
        ];
    }, [enrichedCourses]);

    const filteredCourses = useMemo(() => {
        let items = [...enrichedCourses];

        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            items = items.filter(({ course }) => {
                return (
                    String(course?.name || '').toLowerCase().includes(q) ||
                    String(course?.instructor || '').toLowerCase().includes(q) ||
                    String(course?.category || '').toLowerCase().includes(q)
                );
            });
        }

        if (selectedCategory !== 'All') {
            items = items.filter(({ course }) => (course?.category || 'Uncategorized') === selectedCategory);
        }

        if (selectedEnrollmentStatus === 'Enrolled') {
            items = items.filter((item) => item.enrolled);
        } else if (selectedEnrollmentStatus === 'Available') {
            items = items.filter((item) => !item.enrolled);
        }

        if (sortBy === 'name') {
            items.sort((a, b) => String(a.course?.name || '').localeCompare(String(b.course?.name || '')));
        } else {
            items.sort((a, b) => new Date(b.course?.createdAt || 0) - new Date(a.course?.createdAt || 0));
        }

        return items;
    }, [enrichedCourses, searchQuery, selectedCategory, selectedEnrollmentStatus, sortBy]);

    const pageCount = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));

    useEffect(() => {
        if (currentPage > pageCount) setCurrentPage(1);
    }, [currentPage, pageCount]);

    const pagedCourses = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredCourses.slice(start, start + PAGE_SIZE);
    }, [filteredCourses, currentPage]);

    const closeEnrollSuccessModal = useCallback(() => {
        setEnrollSuccessModal((prev) => ({ ...prev, open: false }));
    }, []);

    useEffect(() => {
        if (!enrollSuccessModal.open) return undefined;
        const previousOverflow = document.body.style.overflow;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') closeEnrollSuccessModal();
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [enrollSuccessModal.open, closeEnrollSuccessModal]);

    if (loading) {
        return <LoadScreen text="Loading courses..." variant="minimal" />;
    }

    const handleEnroll = async (courseItem) => {
        setEnrollingId(courseItem.course.id);
        try {
            const res = await fetch('/api/enrollments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId: courseItem.course.id }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Enroll failed');
            }

            const nextEnrollment = data?.enrollment || null;
            setEnrollments((prev) => {
                const next = [...prev];
                const idx = next.findIndex((e) => e.id === nextEnrollment?.id);
                if (idx >= 0) next[idx] = nextEnrollment;
                else if (nextEnrollment) next.unshift(nextEnrollment);
                return next;
            });

            const enrolledStatus = normalizeEnrollmentStatus(nextEnrollment?.status);
            const courseId = Number(courseItem?.course?.id || 0);
            const sectionId = Number(
                nextEnrollment?.section?.id
                || nextEnrollment?.sectionId
                || 0
            );
            const learnHref = sectionId > 0
                ? `/courses/${courseId}/learn?launch=1&sectionId=${sectionId}`
                : `/courses/${courseId}/learn?launch=1`;

            setEnrollSuccessModal({
                open: true,
                courseName: String(courseItem?.course?.name || 'Course').trim() || 'Course',
                learnHref,
                isPending: enrolledStatus === 'PENDING',
            });
        } catch (e) {
            alert(e.message || 'Enroll failed');
        } finally {
            setEnrollingId(null);
        }
    };

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] text-[#052143] flex flex-col" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
            <Navbar />

            <main className="flex-1 w-full max-w-[1780px] mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12 relative z-10">
                <aside className="w-full lg:w-[408px] shrink-0 flex flex-col gap-12">
                    <div className={`entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '40ms' }}>
                        <h3 className="font-medium text-[#052143] text-[20px] mb-2 leading-[130%]">Search Now</h3>
                        <div className="w-[60px] h-[4px] bg-[#FFC224] rounded-full mb-6 relative bottom-1"></div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search Course"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full bg-white border border-[#D1E3FB] rounded-full pl-6 pr-32 h-[50px] text-[16px] outline-none placeholder:text-[#6B778B] focus:border-[#687EFF] transition-colors"
                            />
                            <button className="absolute right-1.5 top-1.5 bottom-1.5 w-[84px] bg-[#687EFF] text-white rounded-full font-medium flex items-center justify-center text-[14px]" type="button">
                                Search
                            </button>
                        </div>
                    </div>

                    <div className={`entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '90ms' }}>
                        <h3 className="font-medium text-[#052143] text-[20px] mb-2 leading-[130%]">Categories</h3>
                        <div className="w-[60px] h-[4px] bg-[#FFC224] rounded-full mb-6 relative bottom-1"></div>
                        <div className="flex flex-col gap-4">
                            {categories.map((cat) => (
                                <label key={cat.label} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="category"
                                        className="sr-only"
                                        checked={selectedCategory === cat.label}
                                        onChange={() => {
                                            setSelectedCategory(cat.label);
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <div className={`w-[18px] h-[18px] flex items-center justify-center rounded-[6px] border-2 transition-colors ${selectedCategory === cat.label ? 'bg-[#687EFF] border-[#687EFF]' : 'bg-transparent border-[#687EFF]'}`}>
                                        {selectedCategory === cat.label && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                    <span className={`text-[#6B778B] text-[16px] leading-[130%] ${containsThai(cat.label) ? 'font-thai-sarabun' : ''}`}>{cat.label} ({cat.count})</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={`entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '140ms' }}>
                        <h3 className="font-medium text-[#052143] text-[20px] mb-2 leading-[130%]">Enrollment status</h3>
                        <div className="w-[60px] h-[4px] bg-[#FFC224] rounded-full mb-6 relative bottom-1"></div>
                        <div className="flex flex-col gap-4">
                            {enrollmentStatuses.map((status) => (
                                <label key={status.label} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="enrollment"
                                        className="sr-only"
                                        checked={selectedEnrollmentStatus === status.label}
                                        onChange={() => {
                                            setSelectedEnrollmentStatus(status.label);
                                            setCurrentPage(1);
                                        }}
                                    />
                                    <div className={`w-[18px] h-[18px] flex items-center justify-center border-2 transition-colors rounded-[6px] ${selectedEnrollmentStatus === status.label ? 'bg-[#687EFF] border-[#687EFF]' : 'bg-transparent border-[#687EFF]'}`}>
                                        {selectedEnrollmentStatus === status.label && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                    <span className="text-[#6B778B] text-[16px] leading-[130%]">{status.label} ({status.count})</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col gap-8">
                    <div className={`bg-white rounded-[16px] border border-[#D1E3FB] px-5 h-[68px] flex items-center justify-between shadow-sm entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '180ms' }}>
                        <p className="text-[#6B778B] text-[14px] leading-[130%]">Showing <span className="text-[#052143]">{pagedCourses.length} Courses</span> of {filteredCourses.length}</p>

                        <div className="flex items-center gap-8">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`w-[28px] h-[28px] rounded-full flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-[#687EFF] text-white' : 'bg-transparent text-[#9BA5B7] hover:bg-[#f6f8fb]'}`}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill={viewMode === 'grid' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={viewMode === 'grid' ? '0' : '2'}><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`w-[28px] h-[28px] rounded-full flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-[#687EFF] text-white' : 'bg-transparent text-[#9BA5B7] hover:bg-[#f6f8fb]'}`}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill={viewMode === 'list' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={viewMode === 'list' ? '0' : '2'}><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-[#052143] text-[14px] leading-[130%] font-normal">Sort by:</span>
                                <div className="relative">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => {
                                            setSortBy(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="appearance-none bg-transparent text-[#6B778B] text-[14px] leading-[130%] outline-none cursor-pointer pr-4"
                                    >
                                        <option value="latest">Latest</option>
                                        <option value="name">Name</option>
                                    </select>
                                    <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6B778B] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>
                    ) : pagedCourses.length === 0 ? (
                        <div className="bg-white border border-[#D1E3FB] rounded-xl p-10 text-center text-[#6B778B]">No courses found</div>
                    ) : (
                        <div className={`w-full max-w-[1272px] ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-x-[24px] gap-y-[48px]' : 'flex flex-col gap-6'}`}>
                            {pagedCourses.map((item, index) => {
                                const course = item.course;
                                const enrolled = item.enrolled;
                                const canStart = item.canStart;
                                const cardDelay = `${230 + index * 45}ms`;
                                const isEnrolling = enrollingId === course.id;
                                const thumbnail = course.thumbnail || '/course.png';
                                const isCompleted = item.enrollment?.status === 'COMPLETED';
                                const ratingSource = item?.enrollment?.course || course;
                                const reviewCount = Number(ratingSource?.reviewCount || 0);
                                const averageRating = Number(ratingSource?.averageRating || 0);
                                const averageRatingText = reviewCount > 0 && Number.isFinite(averageRating)
                                    ? averageRating.toFixed(1)
                                    : '0.0';
                                const learnSectionId = Number(
                                    item?.enrollment?.section?.id
                                    || 0
                                );
                                const learnHref = learnSectionId > 0
                                    ? `/courses/${course.id}/learn?launch=1&sectionId=${learnSectionId}`
                                    : `/courses/${course.id}/learn?launch=1`;
                                const isPendingApproval = item.enrollmentStatus === 'PENDING';
                                const statusLabel = isPendingApproval ? 'Pending' : (enrolled ? 'Enrolled' : 'Available');
                                const statusClass = isPendingApproval ? 'text-[#F59E0B]' : (enrolled ? 'text-[#8E8E93]' : 'text-[#687EFF]');

                                return (
                                    <div
                                        key={course.id}
                                        className={`bg-white rounded-[20px] border border-[#eaedf5] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-300 box-border p-[20px] flex entry-fade course-card ${animateIn ? 'is-visible' : ''} ${viewMode === 'grid' ? 'w-full flex-col' : 'w-full flex-row gap-5 items-start'}`}
                                        style={{ '--entry-delay': cardDelay }}
                                    >
                                        <Link
                                            href={`/courses/${course.id}`}
                                            className={`${viewMode === 'grid' ? 'w-full h-[230px]' : 'w-[260px] h-[160px] shrink-0'} rounded-[16px] bg-[#D9D9D9] overflow-hidden block cursor-pointer shrink-0`}
                                            aria-label={`View course detail: ${course.name}`}
                                        >
                                            <img
                                                src={thumbnail}
                                                alt={course.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = '/course.png';
                                                }}
                                            />
                                        </Link>

                                        <div className={`${viewMode === 'grid' ? 'pt-[24px]' : 'flex-1 py-1'} flex flex-col flex-1`}>
                                            {/* Status & Rating */}
                                            <div className="flex items-center justify-between mb-[16px]">
                                                <span className={`font-semibold text-[18px] leading-[130%] ${statusClass}`}>
                                                    {statusLabel}
                                                </span>
                                                <div className="flex items-center gap-[6px]">
                                                    <svg className="w-[16px] h-[16px] text-[#FFC224]" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                    <span className="text-[#052143] text-[15px] font-bold leading-[100%] mt-0.5">{averageRatingText}</span>
                                                    <span className="text-[#6B778B] text-[14px] font-normal leading-[100%] mt-0.5">({reviewCount} Reviews)</span>
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <div className="flex items-start justify-between mb-[24px] min-h-[62px]">
                                                <Link href={`/courses/${course.id}`} className="hover:text-[#687EFF] transition-colors group flex-1">
                                                    <h3 className={`font-semibold text-[22px] text-[#052143] group-hover:text-[#687EFF] leading-[140%] line-clamp-2 pr-[8px] transition-colors ${containsThai(course.name) ? 'font-thai-sarabun' : ''}`}>{course.name}</h3>
                                                </Link>
                                                {isCompleted && (
                                                    <button className="text-[#6B778B] hover:text-[#052143] mt-1 shrink-0" aria-label="More actions" type="button">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Action & Instructor */}
                                            <div className="flex items-center justify-between mb-[24px]">
                                                {canStart ? (
                                                    <Link
                                                        href={learnHref}
                                                        className="flex items-center group cursor-pointer hover:opacity-90 transition-opacity"
                                                    >
                                                        <div className="px-5 h-[36px] box-border rounded-[20px] flex items-center justify-center border border-[#F87A53] bg-white text-[#F87A53] mr-[-12px] z-0 min-w-[70px]">
                                                            <span className="font-medium text-[14px] pr-2">Start</span>
                                                        </div>
                                                        <div className="w-[36px] h-[36px] box-border rounded-full flex items-center justify-center z-10 bg-white border border-[#F87A53]">
                                                            <svg className="w-4 h-4 text-[#F87A53] ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                                                        </div>
                                                    </Link>
                                                ) : enrolled ? (
                                                    <div className="flex items-center cursor-not-allowed opacity-70">
                                                        <div className="px-5 h-[36px] box-border rounded-[20px] flex items-center justify-center border border-[#F59E0B] bg-[#FFF7ED] text-[#B45309] mr-[-12px] z-0 min-w-[92px]">
                                                            <span className="font-medium text-[14px] pr-2">
                                                                {isPendingApproval ? 'Pending' : 'Unavailable'}
                                                            </span>
                                                        </div>
                                                        <div className="w-[36px] h-[36px] box-border rounded-full flex items-center justify-center z-10 bg-[#FFF7ED] border border-[#F59E0B]">
                                                            <svg className="w-4 h-4 text-[#B45309]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="6" x2="12" y2="13"></line><circle cx="12" cy="17" r="1"></circle><circle cx="12" cy="12" r="10"></circle></svg>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => handleEnroll(item)} disabled={isEnrolling} className="flex items-center group cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
                                                        <div className="px-5 h-[36px] box-border rounded-[20px] flex items-center justify-center bg-[#F87A53] text-white mr-[-12px] z-0 min-w-[70px]">
                                                            <span className="font-medium text-[14px] pr-2">{isEnrolling ? '...' : 'Enroll'}</span>
                                                        </div>
                                                        <div className="w-[36px] h-[36px] box-border rounded-full flex items-center justify-center z-10 bg-[#F87A53] border border-white">
                                                            <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                                                        </div>
                                                    </button>
                                                )}

                                                <div className="flex items-center gap-[10px] shrink-0 text-right">
                                                    <div className="w-[42px] h-[42px] box-border rounded-full object-cover border-2 border-[#eaedf5] shrink-0 bg-[#eef1fa] text-[#687EFF] flex items-center justify-center font-bold text-[18px]">
                                                        {(course.instructor || 'I').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col justify-center items-end">
                                                        <span className={`text-[#052143] font-medium text-[14px] leading-[130%] truncate max-w-[120px] ${containsThai(course.instructor) ? 'font-thai-sarabun' : ''}`}>{course.instructor || 'Instructor Name'}</span>
                                                        <span className="text-[#8E8E93] font-normal text-[11px] leading-[130%] truncate max-w-[120px] mt-0.5">8+ Years Experience</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer */}
                                            <div className="flex items-center justify-between pt-[20px] border-t border-dashed border-[#eaedf5] mt-auto">
                                                <div className="flex items-center gap-[6px]">
                                                    <svg className="w-[14px] h-[14px] text-[#FF3EA5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                    <span className="text-[#6B778B] font-medium text-[13px]">{formatDate(course.createdAt)}</span>
                                                </div>
                                                <div className="flex items-center gap-[6px]">
                                                    <svg className="w-[14px] h-[14px] text-[#FFC224]" viewBox="0 0 24 24" fill="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                                    <span className="text-[#6B778B] font-medium text-[13px]">{course.lessons || 0} Lesson</span>
                                                </div>
                                                <div className="flex items-center gap-[6px]">
                                                    <svg className="w-[14px] h-[14px] text-[#687EFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                    <span className="text-[#6B778B] font-medium text-[13px]">{formatDuration(course)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-between w-full mt-10 gap-8 h-[47px]">
                        <div className="hidden lg:block flex-1"></div>

                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-[40px] h-[40px] box-border rounded-full border border-[#D1E3FB] flex items-center justify-center text-[#6B778B] hover:bg-[#F6F8FF] transition-colors disabled:opacity-50"
                            >
                                <svg width="11" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>

                            {Array.from({ length: pageCount }, (_, i) => i + 1).slice(0, 7).map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-[40px] h-[40px] box-border rounded-full flex items-center justify-center text-[16px] leading-[130%] font-normal ${currentPage === page ? 'bg-[#687EFF] text-white' : 'border border-[#D1E3FB] text-[#6B778B] hover:bg-[#F6F8FF]'}`}
                                >
                                    {String(page).padStart(2, '0')}
                                </button>
                            ))}

                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                                disabled={currentPage === pageCount}
                                className="w-[40px] h-[40px] box-border rounded-full border border-[#D1E3FB] flex items-center justify-center text-[#6B778B] hover:bg-[#F6F8FF] transition-colors disabled:opacity-50"
                            >
                                <svg width="11" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>

                        <div className="flex-1 flex justify-end shrink-0">
                            <div className="w-[180px] h-[47px] relative flex items-center cursor-pointer group hover:opacity-90 transition-opacity" onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}>
                                <div className="absolute left-0 w-[142px] h-[47px] rounded-full bg-[#F87A53] flex items-center justify-center z-0">
                                    <span className="font-medium text-[18px] text-white leading-[150%] relative left-[-8px]">More Course</span>
                                </div>
                                <div className="absolute right-0 w-[46px] h-[46px] rounded-full bg-[#F87A53] border-[1px] border-white flex items-center justify-center z-10 box-border">
                                    <svg className="w-[14px] h-[14px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {typeof window !== 'undefined' && enrollSuccessModal.open && createPortal(
                <div
                    className="fixed inset-0 z-[1100] bg-[rgba(10,16,36,0.52)] backdrop-blur-[3px] flex items-center justify-center p-4"
                    onClick={closeEnrollSuccessModal}
                >
                    <div
                        className="w-full max-w-[560px] rounded-[24px] bg-white px-6 sm:px-8 py-8 text-center shadow-[0_28px_80px_rgba(9,16,35,0.35)] border border-[#E8ECFF]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F7FF]">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                                <path d="M4 8.5l5 2.3L20 4M10 10l1.2 5.3L16 14" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="4.5" cy="4.5" r="1.2" fill="#1DBA9F" />
                                <circle cx="18.5" cy="19" r="1.1" fill="#F87A53" />
                                <circle cx="20.5" cy="7.5" r="1.1" fill="#687EFF" />
                            </svg>
                        </div>

                        <h3 className="text-[#687EFF] text-[34px] sm:text-[38px] font-semibold leading-[118%] mb-3">
                            {enrollSuccessModal.isPending
                                ? 'Enrollment request sent!'
                                : "Congratulations! You've enrolled successfully"}
                        </h3>
                        <p className="text-[#4B5567] text-[16px] leading-[145%] mb-5">
                            {enrollSuccessModal.isPending
                                ? 'Your request is waiting for admin approval. We will notify you once it is approved.'
                                : 'You can start learning immediately or come back later. Your progress will be saved.'}
                        </p>

                        <div className="rounded-[12px] bg-[#EEF2FF] px-4 py-3 text-[#1F2A44] text-[14px] font-medium leading-[140%] mb-7">
                            {enrollSuccessModal.courseName}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    const target = enrollSuccessModal.isPending ? '/my-learning' : enrollSuccessModal.learnHref;
                                    closeEnrollSuccessModal();
                                    router.push(target);
                                }}
                                className="h-[46px] px-7 rounded-full bg-[#687EFF] text-white text-[16px] font-medium hover:bg-[#5C70EA] transition-colors min-w-[190px]"
                            >
                                {enrollSuccessModal.isPending ? 'Go to My Learning' : 'Start Learning Now'}
                            </button>
                            <button
                                type="button"
                                onClick={closeEnrollSuccessModal}
                                className="h-[46px] px-7 rounded-full border border-[#D5DDF5] text-[#5C6784] text-[16px] font-medium hover:bg-[#F8FAFF] transition-colors min-w-[150px]"
                            >
                                Learn Later
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <style jsx>{`
                .entry-fade {
                    opacity: 0;
                    transform: translate3d(0, 16px, 0) scale(0.985);
                    filter: blur(1px);
                }

                .entry-fade.is-visible {
                    animation: coursesFadeUp 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
                    animation-delay: var(--entry-delay, 0ms);
                }

                .course-card {
                    transform-origin: center bottom;
                }

                @keyframes coursesFadeUp {
                    0% {
                        opacity: 0;
                        transform: translate3d(0, 16px, 0) scale(0.985);
                        filter: blur(1px);
                    }
                    100% {
                        opacity: 1;
                        transform: translate3d(0, 0, 0) scale(1);
                        filter: blur(0);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .entry-fade,
                    .entry-fade.is-visible {
                        opacity: 1;
                        transform: none;
                        filter: none;
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}


