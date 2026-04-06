'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Header from '@/components/layout/Header';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';
import { clearUser, getRememberMePreference, getUser, saveUser } from '@/lib/auth';

function toFixedNumber(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(digits);
}

export default function CourseReportPage() {
    const params = useParams();
    const courseId = Number(params?.id);

    const [course, setCourse] = useState(null);
    const [sections, setSections] = useState([]);
    const [summary, setSummary] = useState({ totalStudyMinutes: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [user, setUser] = useState(null);
    const [userResolved, setUserResolved] = useState(false);

    useEffect(() => {
        const resolveUser = async () => {
            try {
                const profileRes = await fetch('/api/users/profile', { cache: 'no-store' });
                if (profileRes.status === 401) {
                    clearUser();
                    if (typeof window !== 'undefined') {
                        const next = encodeURIComponent(window.location.pathname + window.location.search);
                        window.location.href = `/login?next=${next}`;
                    }
                    return;
                }
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    setUser(profile || null);
                    try {
                        if (profile && typeof window !== 'undefined') {
                            const fallbackRemember = Boolean(localStorage.getItem('lms_user'));
                            const remember = getRememberMePreference(fallbackRemember);
                            saveUser(profile, { remember });
                        }
                    } catch {}
                    return;
                }

                setUser(getUser());
            } catch {
                setUser(getUser());
            } finally {
                setUserResolved(true);
            }
        };

        resolveUser();
    }, []);

    useEffect(() => {
        if (!userResolved) return;
        if (!Number.isInteger(courseId) || courseId <= 0) {
            setError('Invalid course');
            setLoading(false);
            return;
        }

        const loadReport = async () => {
            setLoading(true);
            setError('');
            setNotice('');
            try {
                const res = await fetch(`/api/reports/my-course?courseId=${encodeURIComponent(courseId)}`, { cache: 'no-store' });
                if (res.status === 401) {
                    clearUser();
                    if (typeof window !== 'undefined') {
                        const next = encodeURIComponent(window.location.pathname + window.location.search);
                        window.location.href = `/login?next=${next}`;
                    }
                    return;
                }
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data?.error || 'Failed to load report');
                }

                setCourse(data?.course || null);
                setSummary({
                    totalStudyMinutes: Number(data?.summary?.totalStudyMinutes || 0),
                });
                setSections(Array.isArray(data?.sections) ? data.sections : []);
                if (data?.enrollmentFound === false) {
                    setNotice(String(data?.message || 'Enrollment not found'));
                }
            } catch (err) {
                setError(err?.message || 'Failed to load report');
                setCourse(null);
                setSummary({ totalStudyMinutes: 0 });
                setSections([]);
            } finally {
                setLoading(false);
            }
        };

        loadReport();
    }, [courseId, userResolved]);

    if (loading) {
        return <LoadScreen text="Loading report..." />;
    }

    return (
        <div className="min-h-screen font-['Outfit',sans-serif]" style={{ background: '#FCFCFC' }}>
            {user ? <Navbar /> : <Header />}

            <main className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-20 sm:pb-24">
                <FadeIn direction="up">
                    <div className="relative mb-8 h-[220px] w-full overflow-hidden rounded-[16px] bg-[#D9D9D9] sm:mb-10 sm:h-[340px]">
                        {course?.thumbnail ? (
                            <img
                                src={course.thumbnail}
                                alt={course?.name || 'Course'}
                                className="w-full h-full object-cover"
                                onError={(event) => {
                                    event.currentTarget.onerror = null;
                                    event.currentTarget.src = '/course.png';
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <img src="/skillup_logo.png" alt="Logo" className="w-[80px] h-[80px] opacity-20" />
                            </div>
                        )}
                    </div>

                    <div className="mb-10 space-y-2 text-[32px] leading-[130%] text-[#052143] sm:mb-14 sm:text-[42px] sm:leading-[150%]">
                        <div><span className="font-semibold">Course:</span> {course?.name || '-'}</div>
                        <div><span className="font-semibold">Category:</span> {course?.category || '-'}</div>
                        <div><span className="font-semibold">Total Study Time:</span> {toFixedNumber(summary.totalStudyMinutes, 2)} Minutes</div>
                    </div>

                    <div className="flex flex-col gap-10">
                        {error ? (
                            <div className="rounded-[14px] border border-[#F5D0D0] bg-[#FFF5F5] p-8 text-[#B91C1C] text-[16px]">
                                {error}
                            </div>
                        ) : notice ? (
                            <div className="rounded-[14px] border border-[#E4E8FF] bg-[#F8FAFF] p-8 text-[#42537A] text-[16px]">
                                {notice}
                            </div>
                        ) : sections.length === 0 ? (
                            <div className="rounded-[14px] border border-[#E4E8FF] bg-white p-8 text-[#6B778B] text-[16px]">
                                No report data found for this course.
                            </div>
                        ) : (
                            sections.map((section, sectionIdx) => (
                                <div key={`${section.title || 'section'}-${sectionIdx}`} className="flex flex-col gap-4">
                                    <h3 className="text-[#052143] text-[22px] font-semibold leading-[140%]">
                                        {section?.title || `Section ${sectionIdx + 1}`}
                                    </h3>
                                    <div className="w-full overflow-x-auto">
                                        <table className="w-full min-w-[760px] border-collapse sm:min-w-[1180px]">
                                            <thead>
                                                <tr>
                                                    <th className="text-white text-[16px] font-medium py-[10px] px-[14px] text-left border border-white bg-[#687EFF]">No.</th>
                                                    <th className="text-white text-[16px] font-medium py-[10px] px-[14px] text-left border border-white bg-[#687EFF]">Date and Time</th>
                                                    <th className="text-white text-[16px] font-medium py-[10px] px-[14px] text-left border border-white bg-[#687EFF]">Study Duration (Minutes)</th>
                                                    <th className="text-white text-[16px] font-medium py-[10px] px-[14px] text-left border border-white bg-[#687EFF]">Score</th>
                                                    <th className="text-white text-[16px] font-medium py-[10px] px-[14px] text-left border border-white bg-[#687EFF]">Result</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(Array.isArray(section?.records) ? section.records : []).map((row, rowIdx) => (
                                                    <tr key={`${sectionIdx}-${row?.id || rowIdx}`}>
                                                        <td
                                                            className="text-[#052143] text-[15px] font-medium py-[10px] px-[14px] border border-white"
                                                            style={{ background: rowIdx % 2 === 0 ? '#F2F3FF' : '#FFFFFF' }}
                                                        >
                                                            {Number(row?.id || rowIdx + 1)}.
                                                        </td>
                                                        <td
                                                            className="text-[#052143] text-[15px] font-medium py-[10px] px-[14px] border border-white"
                                                            style={{ background: rowIdx % 2 === 0 ? '#F2F3FF' : '#FFFFFF' }}
                                                        >
                                                            {row?.dateTime || '-'}
                                                        </td>
                                                        <td
                                                            className="text-[#052143] text-[15px] font-medium py-[10px] px-[14px] border border-white"
                                                            style={{ background: rowIdx % 2 === 0 ? '#F2F3FF' : '#FFFFFF' }}
                                                        >
                                                            {toFixedNumber(row?.durationMinutes || 0, 2)}
                                                        </td>
                                                        <td
                                                            className="text-[#052143] text-[15px] font-medium py-[10px] px-[14px] border border-white"
                                                            style={{ background: rowIdx % 2 === 0 ? '#F2F3FF' : '#FFFFFF' }}
                                                        >
                                                            {row?.scoreText || '-'}
                                                        </td>
                                                        <td
                                                            className="text-[#052143] text-[15px] font-medium py-[10px] px-[14px] border border-white"
                                                            style={{ background: rowIdx % 2 === 0 ? '#F2F3FF' : '#FFFFFF' }}
                                                        >
                                                            {row?.resultText || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-14 flex justify-start">
                        <Link
                            href="/my-learning"
                            className="bg-[#687EFF] text-white px-8 py-3 rounded-full text-[16px] font-medium hover:bg-[#5a6fe0] transition-colors shadow-sm"
                        >
                            ← Back to My Learning
                        </Link>
                    </div>
                </FadeIn>
            </main>
        </div>
    );
}
