'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';

export default function MyCoursesPage() {
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/enrollments');
                if (res.ok) setEnrollments(await res.json());
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        load();
    }, []);

    const filtered = filter === 'ALL' ? enrollments : enrollments.filter(e => e.status === filter);

    const statusCounts = {
        ALL: enrollments.length,
        LEARNING: enrollments.filter(e => ['APPROVED', 'LEARNING'].includes(e.status)).length,
        COMPLETED: enrollments.filter(e => e.status === 'COMPLETED').length,
        PENDING: enrollments.filter(e => e.status === 'PENDING').length,
    };

    if (loading) {
        return <LoadScreen text="Loading my courses..." variant="minimal" />;
    }

    return (
        <div className="min-h-screen overflow-x-hidden font-['Outfit',sans-serif]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
            <Navbar />

            <main className="max-w-[1200px] mx-auto app-shell-x pt-8 pb-24">
                <FadeIn direction="up">
                    <h1 className="text-3xl font-bold text-[#052143] mb-2">หลักสูตรของฉัน</h1>
                    <p className="text-[#6B778B] mb-8">ติดตามความคืบหน้าและผลการเรียนของคุณ</p>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <StatCard label="ทั้งหมด" count={statusCounts.ALL} icon="📚" color="#687EFF" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
                        <StatCard label="กำลังเรียน" count={statusCounts.LEARNING} icon="▶" color="#F87A53" active={filter === 'LEARNING'} onClick={() => setFilter('LEARNING')} />
                        <StatCard label="เรียนสำเร็จ" count={statusCounts.COMPLETED} icon="✅" color="#1DBA9F" active={filter === 'COMPLETED'} onClick={() => setFilter('COMPLETED')} />
                        <StatCard label="รออนุมัติ" count={statusCounts.PENDING} icon="⏳" color="#FFC224" active={filter === 'PENDING'} onClick={() => setFilter('PENDING')} />
                    </div>

                    {/* Content */}
                    {filtered.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center">
                            <img src="/images/empty-state-courses.jpg" alt="No courses" className="w-[160px] h-auto mb-6 opacity-70" />
                            <p className="text-[#6B778B] text-base leading-relaxed mb-6">
                                You haven't enrolled in any courses yet.<br />
                                Let's find something exciting to learn today.
                            </p>
                            <Link href="/courses" className="bg-[#F87A53] hover:bg-[#e06a45] text-white px-8 py-3 rounded-full text-base font-medium transition-colors shadow-md">
                                Courses
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {filtered.map(enrollment => (
                                <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                            ))}
                        </div>
                    )}
                </FadeIn>
            </main>
        </div>
    );
}

function StatCard({ label, count, icon, color, active, onClick }) {
    return (
        <button onClick={onClick}
            className={`bg-white border-2 rounded-2xl p-4 text-left transition-all hover:shadow-md ${active ? `border-[${color}] shadow-md` : 'border-[#D1E3FB]'}`}
            style={active ? { borderColor: color } : {}}>
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-2xl font-bold text-[#052143]">{count}</div>
            <div className="text-sm text-[#6B778B]">{label}</div>
        </button>
    );
}

function EnrollmentCard({ enrollment }) {
    const course = enrollment.course;
    const section = enrollment.section;
    const isCompleted = enrollment.status === 'COMPLETED';
    const isLearning = ['APPROVED', 'LEARNING'].includes(enrollment.status);
    const hasQuiz = course?.quizzes?.length > 0;
    const sortedSections = Array.isArray(course?.sections)
        ? [...course.sections].sort((a, b) => {
            const aOrder = Number(a?.orderNo || 0);
            const bOrder = Number(b?.orderNo || 0);
            if (aOrder !== bOrder) return aOrder - bOrder;
            return Number(a?.id || 0) - Number(b?.id || 0);
        })
        : [];
    const firstActiveSectionId = Number(
        sortedSections.find((item) => item?.isActive !== false)?.id
        || sortedSections[0]?.id
        || 0
    );
    const preferredSectionId = Number(enrollment?.sectionId || section?.id || 0);
    const currentStatus = String(enrollment?.status || '').toUpperCase();
    const currentProgress = Number(enrollment?.progress || 0);
    const hasStarted = currentStatus === 'LEARNING' || currentStatus === 'COMPLETED' || currentProgress > 0;
    const learnSectionId = hasStarted
        ? (preferredSectionId > 0 ? preferredSectionId : firstActiveSectionId)
        : firstActiveSectionId;
    const learnHref = learnSectionId > 0
        ? `/courses/${course?.id}/learn?launch=1&sectionId=${learnSectionId}`
        : `/courses/${course?.id}/learn?launch=1`;

    const statusConfig = {
        PENDING: { text: 'รออนุมัติ', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
        APPROVED: { text: 'พร้อมเรียน', color: 'text-blue-600 bg-blue-50 border-blue-200' },
        LEARNING: { text: 'กำลังเรียน', color: 'text-purple-600 bg-purple-50 border-purple-200' },
        COMPLETED: { text: 'เรียนสำเร็จ', color: 'text-green-600 bg-green-50 border-green-200' },
        FAILED: { text: 'ไม่ผ่าน', color: 'text-red-600 bg-red-50 border-red-200' },
    };
    const sc = statusConfig[enrollment.status] || statusConfig.PENDING;

    return (
        <div className="bg-white border border-[#D1E3FB] rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-md transition-all">
            {/* Thumbnail */}
            <div className="w-full md:w-[160px] h-[100px] rounded-xl overflow-hidden bg-gradient-to-br from-[#687EFF]/20 to-[#1DBA9F]/20 shrink-0">
                {course?.thumbnail ? (
                    <img src={course.thumbnail} alt={course.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">📚</div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.color}`}>{sc.text}</span>
                    {course?.courseCode && <span className="text-xs text-[#6B778B] font-mono">{course.courseCode}</span>}
                </div>
                <h3 className="text-[#052143] font-medium text-lg leading-tight truncate">{course?.name}</h3>
                <p className="text-[#6B778B] text-sm mt-1">Section: {section?.name || '-'}</p>

                {/* Progress bar */}
                {(isLearning || isCompleted) && (
                    <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all ${isCompleted ? 'bg-[#1DBA9F]' : 'bg-[#687EFF]'}`}
                                style={{ width: `${enrollment.progress}%` }}></div>
                        </div>
                        <span className="text-sm font-medium text-[#052143] w-12 text-right">{enrollment.progress}%</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
                {isLearning && (
                    <Link
                        href={learnHref}
                        className="bg-[#687EFF] hover:bg-[#5a6fe0] text-white px-5 py-2.5 rounded-full text-sm font-medium text-center transition-colors"
                    >
                        เข้าเรียน →
                    </Link>
                )}
                {isLearning && hasQuiz && (
                    <Link href={`/courses/${course?.id}/quiz`}
                        className="bg-[#F87A53] hover:bg-[#e06a45] text-white px-5 py-2.5 rounded-full text-sm font-medium text-center transition-colors">
                        ทำแบบทดสอบ
                    </Link>
                )}
                {isCompleted && (
                    <Link href="/certificates"
                        className="bg-[#1DBA9F] hover:bg-[#18a58c] text-white px-5 py-2.5 rounded-full text-sm font-medium text-center transition-colors">
                        🏆 ใบประกาศ
                    </Link>
                )}
                <Link href={`/courses/${course?.id}`} className="text-[#687EFF] text-sm text-center hover:underline">
                    รายละเอียด
                </Link>
            </div>
        </div>
    );
}

