'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';
import { getUser } from '@/lib/auth';

function toDateOnly(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(value) {
    const date = value instanceof Date ? value : toDateOnly(value);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getEnrollmentScheduleDate(enrollment) {
    return (
        toDateOnly(enrollment?.section?.registerDateFrom)
        || toDateOnly(enrollment?.section?.learnDateTo)
        || toDateOnly(enrollment?.section?.registerDateTo)
        || toDateOnly(enrollment?.enrolledAt)
        || toDateOnly(enrollment?.createdAt)
    );
}

function getSectionLabel(enrollment) {
    const value = String(
        enrollment?.section?.name
        || enrollment?.section?.title
        || enrollment?.sectionName
        || ''
    ).trim();
    return value || '-';
}

function isTruthyFlag(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return ['1', 'true', 'yes', 'y'].includes(normalized);
    }
    return false;
}

function getContinueCardDate(enrollment) {
    const sectionRegisterUnlimit = isTruthyFlag(enrollment?.section?.registerUnlimit);
    const courseRegisterUnlimit = isTruthyFlag(enrollment?.course?.registerUnlimit);
    if (sectionRegisterUnlimit || courseRegisterUnlimit) {
        return null;
    }
    return (
        toDateOnly(enrollment?.course?.registerDateFrom)
        || toDateOnly(enrollment?.section?.registerDateFrom)
        || null
    );
}

function formatCalendarLabel(value) {
    const date = value instanceof Date ? value : toDateOnly(value);
    if (!date) return '-';
    return date.toLocaleDateString('th-TH');
}

export default function LearnerDashboard() {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        setUser(getUser());
        const load = async () => {
            try {
                const res = await fetch('/api/enrollments', { cache: 'no-store' });
                if (res.ok) setEnrollments(await res.json());
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        load();
    }, []);

    // Compute stats
    const completedCount = enrollments.filter(e => e.status === 'COMPLETED').length;
    const learningCount = enrollments.filter((e) => {
        const status = String(e?.status || '').toUpperCase();
        if (status === 'LEARNING') return true;
        if (status === 'APPROVED') return Number(e?.progress || 0) > 0;
        return false;
    }).length;
    const pendingCount = enrollments.filter((e) => {
        const status = String(e?.status || '').toUpperCase();
        if (status === 'PENDING') return true;
        if (status === 'APPROVED') return Number(e?.progress || 0) <= 0;
        return false;
    }).length;
    const totalCount = enrollments.length;
    const maxBar = Math.max(completedCount, learningCount, pendingCount, totalCount, 1);

    // Continue learning: first enrollment that is LEARNING or APPROVED
    const continueCourse = enrollments.find(e => ['APPROVED', 'LEARNING'].includes(e.status));
    const continueSectionId = Number(continueCourse?.sectionId || continueCourse?.section?.id || 0);
    const continueLearnHref = continueSectionId > 0
        ? `/courses/${continueCourse?.course?.id}/learn?launch=1&sectionId=${continueSectionId}`
        : `/courses/${continueCourse?.course?.id}/learn?launch=1`;
    const continueCalendarDateLabel = formatCalendarLabel(getContinueCardDate(continueCourse));

    // Calendar + schedule (real enrollment dates)
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayDate = new Date(year, month, 1);
        const firstDay = firstDayDate.getDay();
        const startDay = firstDay === 0 ? 6 : firstDay - 1;
        const startDate = new Date(year, month, 1 - startDay);
        return Array.from({ length: 42 }, (_, index) => {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + index);
            return {
                day: currentDate.getDate(),
                date: currentDate,
                current: currentDate.getMonth() === month,
            };
        });
    };

    const calendarDays = getDaysInMonth(currentMonth);
    const todayKey = toDateKey(new Date());
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const goPrevMonth = () => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };
    const goNextMonth = () => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const upcomingEnrollments = useMemo(() => (
        enrollments
            .filter((enrollment) => ['APPROVED', 'PENDING'].includes(String(enrollment?.status || '').toUpperCase()))
            .map((enrollment) => {
                const scheduleDate = getEnrollmentScheduleDate(enrollment);
                return {
                    enrollment,
                    scheduleDate,
                    scheduleLabel: scheduleDate
                        ? scheduleDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '-',
                };
            })
            .sort((a, b) => {
                const timeA = a?.scheduleDate ? a.scheduleDate.getTime() : Number.POSITIVE_INFINITY;
                const timeB = b?.scheduleDate ? b.scheduleDate.getTime() : Number.POSITIVE_INFINITY;
                return timeA - timeB;
            })
            .slice(0, 4)
    ), [enrollments]);

    const scheduleCountByDate = useMemo(() => {
        const byDate = new Map();
        for (const enrollment of enrollments) {
            const dateCandidates = [
                toDateOnly(enrollment?.section?.registerDateFrom),
                toDateOnly(enrollment?.section?.learnDateTo),
                toDateOnly(enrollment?.section?.registerDateTo),
                toDateOnly(enrollment?.enrolledAt),
            ].filter(Boolean);
            const uniqueDateKeys = new Set(dateCandidates.map((item) => toDateKey(item)).filter(Boolean));
            for (const key of uniqueDateKeys) {
                byDate.set(key, (byDate.get(key) || 0) + 1);
            }
        }
        return byDate;
    }, [enrollments]);

    const formatDuration = (c) => {
        if (!c) return '0h';
        const parts = [];
        if (c.durationHours > 0) parts.push(`${c.durationHours}h`);
        if (c.durationMinutes > 0) parts.push(`${c.durationMinutes}min`);
        return parts.join(', ') || '0h';
    };

    if (loading) {
        return <LoadScreen text="Loading dashboard..." variant="minimal" />;
    }

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] relative overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
            <Navbar />

            <main className="w-full max-w-[1840px] mx-auto relative z-10 pt-6 sm:pt-8 pb-20 sm:pb-24 px-4 sm:px-6 lg:px-20">
                <FadeIn direction="up">

                    {/* === TOP ROW === */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">

                        {/* --- Continue Learning Card --- */}
                        <div className="lg:col-span-6 bg-white border border-[#D1E3FB] rounded-[20px] p-5 sm:p-8 flex flex-col gap-6">
                            <h2 className="text-[#052143] font-semibold text-xl sm:text-2xl">Continue learning</h2>

                            {continueCourse ? (
                                <div className="flex flex-col xl:flex-row gap-6">
                                    <div className="w-full xl:w-[291px] h-[220px] sm:h-[236px] shrink-0 rounded-2xl overflow-hidden relative border border-[#687EFF] bg-gradient-to-br from-[#687EFF]/20 to-[#1DBA9F]/20">
                                        <img
                                            src={continueCourse?.course?.thumbnail || '/course.png'}
                                            alt="Course"
                                            className="w-full h-full object-cover"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = '/course.png';
                                            }}
                                        />
                                        <div className="absolute bottom-0 left-0 w-full h-2 flex">
                                            <div className="h-full bg-[#687EFF]" style={{ width: `${continueCourse.progress || 0}%` }}></div>
                                            <div className="h-full bg-[#E5E5EA] flex-1"></div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-between flex-1 min-w-0">
                                        <div>
                                            <p className="text-[#6B778B] text-sm mb-1">Progress: {continueCourse.progress || 0}%</p>
                                            <h3 className="text-[#052143] font-medium text-xl sm:text-2xl leading-[150%] mb-3 break-words">{continueCourse.course?.name}</h3>

                                            <div className="flex items-center flex-wrap gap-6 text-sm py-4">
                                                <span className="flex items-center gap-3">
                                                    <svg className="w-[12px] h-[12px]" fill="none" stroke="#FF3EA5" strokeWidth="2.5" viewBox="0 0 24 24">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                                    </svg>
                                                    <span className="text-[#052143] font-medium italic font-['Roboto_Serif',serif]">{continueCalendarDateLabel}</span>
                                                </span>
                                                <span className="flex items-center gap-3">
                                                    <svg className="w-[10.5px] h-3" fill="#FFC224" viewBox="0 0 448 512"><path d="M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96z" /></svg>
                                                    <span className="text-[#052143] font-medium italic font-['Roboto_Serif',serif]">{Number(continueCourse.course?.lessons || 0)} Lesson</span>
                                                </span>
                                                <span className="flex items-center gap-3">
                                                    <svg className="w-3 h-3" fill="#687EFF" viewBox="0 0 512 512"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z" /></svg>
                                                    <span className="text-[#052143] font-medium italic font-['Roboto_Serif',serif]">{formatDuration(continueCourse.course)}</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-dashed border-[#D1E3FB] pt-3">
                                            <Link
                                                href={continueLearnHref}
                                                className="flex items-center"
                                            >
                                                <span className="bg-[#F87A53] text-white text-sm font-medium min-w-[96px] h-9 inline-flex items-center justify-center rounded-full relative overflow-hidden -mr-2.5 z-10">
                                                    Continue
                                                    <span className="absolute w-[121px] h-[31px] bg-white opacity-10 rotate-[35deg] -top-2 left-1/2 -translate-x-1/2 pointer-events-none"></span>
                                                </span>
                                                <span className="w-9 h-9 bg-[#F87A53] border border-white rounded-full flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                                </span>
                                            </Link>
                                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                                <div className="w-10 h-10 rounded-full bg-[#C7C7CC] flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-[#052143] font-medium text-base">{continueCourse.course?.instructor || 'Instructor Name'}</p>
                                                    <p className="text-[#6B778B] text-xs">Section: {getSectionLabel(continueCourse)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <img src="/images/empty-state-courses.jpg" alt="No courses" className="w-[120px] h-auto mb-4 opacity-70" />
                                    <p className="text-[#6B778B] text-sm mb-4">You haven't enrolled in any courses yet.</p>
                                    <Link href="/courses" className="bg-[#F87A53] hover:bg-[#e06a45] text-white px-6 py-2 rounded-full text-sm font-medium transition-colors">
                                        Browse Courses
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* --- Right Column: Upcoming + Calendar --- */}
                        <div className="lg:col-span-6 flex flex-col xl:flex-row gap-6">

                            {/* --- Upcoming Card --- */}
                            <div className="bg-white border border-[#D1E3FB] rounded-[20px] p-5 sm:p-8 flex flex-col" style={{ flex: '391' }}>
                                <h2 className="text-[#052143] font-semibold text-xl sm:text-2xl mb-6">Upcoming</h2>
                                <div className="flex flex-col gap-5 flex-1">
                                    {upcomingEnrollments.map((item, i) => {
                                        const enrollment = item.enrollment;
                                        const colors = ['#FF383C', '#00C0E8', '#FF8D28', '#687EFF'];
                                        return (
                                            <div key={i} className="flex items-start gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-2" style={{ background: colors[i % colors.length] }}></div>
                                                <div>
                                                    <p className="text-[#052143] text-base leading-relaxed">
                                                        {enrollment.course?.name} <span className="font-semibold">Section: {getSectionLabel(enrollment)}</span>
                                                    </p>
                                                    <p className="text-[#6B778B] text-xs mt-1">{item.scheduleLabel}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {upcomingEnrollments.length === 0 && (
                                        <p className="text-[#6B778B] text-sm py-4">No upcoming courses</p>
                                    )}
                                </div>
                            </div>

                            {/* --- Session Schedule (Calendar) --- */}
                            <div className="bg-white border border-[#D1E3FB] rounded-[20px] p-5 sm:p-8 flex flex-col" style={{ flex: '429' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-[#052143] font-semibold text-xl sm:text-2xl">Session Schedule</h2>
                                    <div className="flex items-center gap-2 text-[#052143] text-sm">
                                        <button type="button" onClick={goPrevMonth} className="hover:text-[#687EFF] transition-colors">‹</button>
                                        <span className="font-medium">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                                        <button type="button" onClick={goNextMonth} className="hover:text-[#687EFF] transition-colors">›</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                        <span key={d} className="text-[#6B778B] text-sm py-1">{d}</span>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {calendarDays.map((d, i) => {
                                        const dayKey = toDateKey(d.date);
                                        const isToday = d.current && dayKey === todayKey;
                                        const eventCount = d.current ? Number(scheduleCountByDate.get(dayKey) || 0) : 0;
                                        return (
                                            <div key={i} className="relative flex flex-col items-center">
                                                <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors
                                                    ${!d.current ? 'text-[#6B778B] opacity-40' : ''}
                                                    ${isToday ? 'bg-[#687EFF] text-white font-semibold rounded-lg' : 'text-[#052143]'}
                                                    ${d.current && !isToday ? 'hover:bg-[#F6F8FF] cursor-pointer' : ''}`}>
                                                    {d.day}
                                                </span>
                                                {eventCount > 0 && (
                                                    <span className={`mt-1 h-1.5 rounded-full ${isToday ? 'bg-[#687EFF]' : 'bg-[#F87A53]'}`} style={{ width: eventCount > 1 ? '10px' : '6px' }} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* === BOTTOM ROW === */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* --- My Courses Chart --- */}
                        <div className="bg-white border border-[#D1E3FB] rounded-[20px] p-5 sm:p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-[#052143] font-semibold text-xl sm:text-2xl">My courses</h2>
                                <Link href="/my-learning" className="text-[#0088FF] font-medium text-sm flex items-center gap-1.5 hover:underline">
                                    View my courses
                                    <span className="text-[#0088FF] text-xs">→</span>
                                </Link>
                            </div>

                            <div className="flex flex-col gap-5 mb-6">
                                {[
                                    { label: 'Completed', value: completedCount, color: '#6155F5' },
                                    { label: 'Learning', value: learningCount, color: '#00C0E8' },
                                    { label: 'Pending', value: pendingCount, color: '#FF8D28' },
                                    { label: 'Total', value: totalCount, color: '#687EFF' },
                                ].map((bar, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <span className="w-24 text-right text-[#052143] text-base shrink-0">{bar.label}</span>
                                        <div className="flex-1 h-8 bg-transparent relative overflow-hidden">
                                            <div className="h-full rounded-r-sm transition-all duration-1000"
                                                style={{ width: maxBar > 0 ? `${Math.min(100, (bar.value / maxBar) * 100)}%` : '0%', background: bar.color, opacity: 0.8, minWidth: bar.value > 0 ? '8px' : '0' }}>
                                            </div>
                                        </div>
                                        <span className="text-[#052143] font-semibold text-base w-8">{bar.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center ml-0 sm:ml-28">
                                <div className="flex-1 flex justify-between text-[#052143] text-base border-t border-[#8E8E93] pt-2 relative">
                                    {Array.from({ length: 6 }, (_, i) => Math.round((maxBar / 5) * i)).map((n, i) => (
                                        <span key={i}>{n}</span>
                                    ))}
                                </div>
                                <div className="w-8"></div>
                            </div>
                        </div>

                        {/* --- Recent Activity --- */}
                        <div className="bg-white border border-[#D1E3FB] rounded-[20px] p-5 sm:p-8 flex flex-col">
                            <h2 className="text-[#052143] font-semibold text-xl sm:text-2xl mb-6">Recent Activity</h2>

                            <div className="flex flex-col gap-4 flex-1">
                                {enrollments.slice(0, 3).map((e, i) => {
                                    const statusConfig = {
                                        PENDING: { text: 'Pending', color: 'text-yellow-600 bg-yellow-50' },
                                        APPROVED: { text: 'Enrolled', color: 'text-blue-600 bg-blue-50' },
                                        LEARNING: { text: 'Learning', color: 'text-purple-600 bg-purple-50' },
                                        COMPLETED: { text: 'Completed', color: 'text-green-600 bg-green-50' },
                                        FAILED: { text: 'Failed', color: 'text-red-600 bg-red-50' },
                                    };
                                    const sc = statusConfig[e.status] || statusConfig.PENDING;
                                    return (
                                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F6F8FF] transition-colors">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#687EFF]/20 to-[#1DBA9F]/20 flex items-center justify-center shrink-0 overflow-hidden">
                                                {e.course?.thumbnail ? (
                                                    <img src={e.course.thumbnail} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <span className="text-2xl">📚</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[#052143] font-medium text-base truncate">{e.course?.name}</p>
                                                <p className="text-[#6B778B] text-xs">{getSectionLabel(e)} • {new Date(e.enrolledAt).toLocaleDateString('th-TH')}</p>
                                            </div>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc.color}`}>{sc.text}</span>
                                        </div>
                                    );
                                })}
                                {enrollments.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <img src="/images/empty-state-courses.jpg" alt="No activity" className="w-[100px] h-auto mb-4 opacity-60" />
                                        <p className="text-[#6B778B] text-sm">No activity yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </FadeIn>
            </main>
        </div>
    );
}



