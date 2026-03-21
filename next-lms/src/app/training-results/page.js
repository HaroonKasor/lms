'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/layout/Navbar';

const STATUS_META = {
    APPROVED: { label: 'Not Started', className: 'bg-[#EEF3FF] text-[#51607A]' },
    LEARNING: { label: 'Learning', className: 'bg-[#E8EDFF] text-[#425CF2]' },
    COMPLETED: { label: 'Completed', className: 'bg-[#EAFBF5] text-[#0F9D75]' },
    FAILED: { label: 'Failed', className: 'bg-[#FFECEC] text-[#D83A52]' },
    CANCELLED: { label: 'Cancelled', className: 'bg-[#F3F4F6] text-[#6B7280]' },
};

function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function resolveEnrollmentStatus(status, progress = 0) {
    const raw = String(status || '').toUpperCase();
    if (raw === 'COMPLETED' || progress >= 100) return 'COMPLETED';
    if (raw === 'LEARNING' || raw === 'IN_PROGRESS' || progress > 0) return 'LEARNING';
    if (raw === 'FAILED') return 'FAILED';
    if (raw === 'CANCELLED') return 'CANCELLED';
    return 'APPROVED';
}

function extractScorePercent(enrollment = {}) {
    const scoreRaw = Number(enrollment?.scoreRaw);
    if (Number.isFinite(scoreRaw)) return clampPercent(scoreRaw);

    const scoreScaled = Number(enrollment?.scoreScaled);
    if (Number.isFinite(scoreScaled)) {
        const normalized = scoreScaled <= 1 ? scoreScaled * 100 : scoreScaled;
        return clampPercent(normalized);
    }

    return null;
}

function toTime(value) {
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function csvEscape(value) {
    const raw = String(value ?? '');
    const escaped = raw.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export default function TrainingResultsPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        const raf = window.requestAnimationFrame(() => setAnimateIn(true));
        return () => window.cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        let active = true;
        const loadData = async () => {
            try {
                setLoading(true);
                setError('');

                const [enrollRes, certRes] = await Promise.all([
                    fetch('/api/enrollments', { cache: 'no-store' }),
                    fetch('/api/certificates', { cache: 'no-store' }),
                ]);

                const enrollData = enrollRes.ok ? await enrollRes.json() : [];
                const certData = certRes.ok ? await certRes.json() : [];

                if (!enrollRes.ok && enrollRes.status !== 401 && enrollRes.status !== 403) {
                    const enrollErr = await enrollRes.json().catch(() => ({}));
                    throw new Error(enrollErr?.error || 'Failed to load training results');
                }

                const certificates = Array.isArray(certData) ? certData : [];
                const certByEnrollmentId = new Map();
                const certByCourseId = new Map();

                for (const cert of certificates) {
                    const enrollmentId = Number(cert?.enrollmentId || 0);
                    const courseId = Number(cert?.courseId || 0);
                    if (enrollmentId > 0) certByEnrollmentId.set(enrollmentId, cert);
                    if (courseId > 0 && !certByCourseId.has(courseId)) certByCourseId.set(courseId, cert);
                }

                const builtRows = (Array.isArray(enrollData) ? enrollData : []).map((enrollment) => {
                    const enrollmentId = Number(enrollment?.id || 0);
                    const courseId = Number(enrollment?.courseId || enrollment?.course?.id || 0);
                    const progress = clampPercent(enrollment?.progress ?? enrollment?.progressPercent ?? 0);
                    const statusCode = resolveEnrollmentStatus(enrollment?.status, progress);
                    const cert = certByEnrollmentId.get(enrollmentId) || certByCourseId.get(courseId) || null;
                    const score = extractScorePercent(enrollment);
                    const lastActivity = enrollment?.lastActivityAt || enrollment?.updatedAt || enrollment?.enrolledAt || null;
                    const hasCertificate = Boolean(enrollment?.course?.certificate);
                    const certificateMode = String(enrollment?.course?.certificateMode || 'none').toLowerCase();
                    const certificatePendingApproval =
                        hasCertificate
                        && statusCode === 'COMPLETED'
                        && certificateMode === 'manual'
                        && !cert;
                    const certificateGenerating =
                        hasCertificate
                        && statusCode === 'COMPLETED'
                        && certificateMode === 'auto'
                        && !cert;

                    return {
                        id: enrollmentId || courseId,
                        course: String(enrollment?.course?.name || enrollment?.course?.title || '-'),
                        category: String(enrollment?.course?.category || '-'),
                        progress,
                        score,
                        statusCode,
                        statusText: STATUS_META[statusCode]?.label || 'Unknown',
                        statusBadge: STATUS_META[statusCode] || STATUS_META.APPROVED,
                        lastActivity,
                        certificateNo: String(cert?.certificateNo || cert?.verifyCode || '').trim(),
                        certificateUrl: String(cert?.certificateUrl || '').trim(),
                        certificatePendingApproval,
                        certificateGenerating,
                    };
                });

                builtRows.sort((a, b) => toTime(b.lastActivity) - toTime(a.lastActivity));
                if (!active) return;
                setRows(builtRows);
            } catch (err) {
                if (!active) return;
                setError(err?.message || 'Failed to load training results');
            } finally {
                if (active) setLoading(false);
            }
        };

        loadData();
        return () => {
            active = false;
        };
    }, []);

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return rows.filter((row) => {
            const matchesStatus = statusFilter === 'ALL' || row.statusCode === statusFilter;
            const matchesQuery = !query
                || row.course.toLowerCase().includes(query)
                || row.category.toLowerCase().includes(query)
                || row.statusText.toLowerCase().includes(query);
            return matchesStatus && matchesQuery;
        });
    }, [rows, searchQuery, statusFilter]);

    const summary = useMemo(() => {
        const total = rows.length;
        const completed = rows.filter((row) => row.statusCode === 'COMPLETED').length;
        const learning = rows.filter((row) => row.statusCode === 'LEARNING').length;
        const certificates = rows.filter((row) => row.certificateNo || row.certificateUrl).length;
        const avgProgress = total > 0
            ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / total)
            : 0;
        const scoreRows = rows.filter((row) => Number.isFinite(row.score));
        const avgScore = scoreRows.length > 0
            ? Math.round(scoreRows.reduce((sum, row) => sum + Number(row.score || 0), 0) / scoreRows.length)
            : null;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
            total,
            completed,
            learning,
            certificates,
            avgProgress,
            avgScore,
            completionRate,
        };
    }, [rows]);

    const exportCsv = () => {
        const headers = ['Course', 'Category', 'Progress (%)', 'Score (%)', 'Status', 'Last Activity', 'Certificate No'];
        const lines = filteredRows.map((row) => ([
            row.course,
            row.category,
            row.progress,
            Number.isFinite(row.score) ? row.score : '',
            row.statusText,
            formatDateTime(row.lastActivity),
            row.certificateNo,
        ]));

        const content = [headers, ...lines]
            .map((cols) => cols.map(csvEscape).join(','))
            .join('\n');

        const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `training-results-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-gradient-to-b from-white via-[#F6F8FF] to-[#F6F8FF] text-[#052143]">
            <Navbar />

            <main className="w-full max-w-[1290px] mx-auto relative pt-10 pb-24 px-6">
                <div className={`mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-5 entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '40ms' }}>
                    <div>
                        <h1 className="text-[#052143] font-bold text-[36px] leading-[130%] mb-2">
                            Training <span className="text-[#687EFF]">Results</span>
                        </h1>
                        <p className="text-[#6B778B] text-[16px] leading-[150%]">
                            Real-time learning outcomes from your enrolled courses.
                        </p>
                    </div>
                    <button
                        onClick={exportCsv}
                        className="h-12 inline-flex items-center justify-center gap-2 px-6 rounded-full border border-[#D1E3FB] bg-white text-[#052143] font-medium text-[15px] hover:border-[#687EFF] hover:bg-[#F6F8FF] transition-colors"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Export CSV
                    </button>
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8 entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '100ms' }}>
                    {[
                        { label: 'Enrolled Courses', value: summary.total, tone: 'text-[#052143]', bg: 'bg-white' },
                        { label: 'Completed', value: summary.completed, tone: 'text-[#10B981]', bg: 'bg-white' },
                        { label: 'In Progress', value: summary.learning, tone: 'text-[#687EFF]', bg: 'bg-white' },
                        { label: 'Avg Progress', value: `${summary.avgProgress}%`, tone: 'text-[#052143]', bg: 'bg-white' },
                        { label: 'Certificates', value: summary.certificates, tone: 'text-[#F97316]', bg: 'bg-white' },
                    ].map((item) => (
                        <div key={item.label} className={`${item.bg} border border-[#D1E3FB] rounded-2xl p-5`}>
                            <p className="text-[#6B778B] text-[13px] font-medium uppercase tracking-wide mb-2">{item.label}</p>
                            <p className={`text-[30px] leading-none font-bold ${item.tone}`}>{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className={`bg-white border border-[#D1E3FB] rounded-2xl p-6 lg:p-8 entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '160ms' }}>
                    <div className="mb-6 flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                            <div className="bg-[#F6F8FF] border border-[#D1E3FB] rounded-xl px-4 py-3">
                                <p className="text-[#6B778B] text-xs">Average Score</p>
                                <p className="text-[#052143] font-semibold text-lg">
                                    {summary.avgScore === null ? '-' : `${summary.avgScore}%`}
                                </p>
                            </div>
                            <div className="bg-[#F6F8FF] border border-[#D1E3FB] rounded-xl px-4 py-3">
                                <p className="text-[#6B778B] text-xs">Completion Rate</p>
                                <p className="text-[#687EFF] font-semibold text-lg">{summary.completionRate}%</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search course/category/status"
                                    className="w-full sm:w-[290px] h-11 pl-11 pr-4 rounded-xl border border-[#D1E3FB] bg-white text-[#052143] placeholder:text-[#8EA0BD] outline-none focus:border-[#687EFF]"
                                />
                                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8EA0BD]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.3-4.3"></path>
                                </svg>
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="h-11 px-4 rounded-xl border border-[#D1E3FB] bg-white text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="APPROVED">Not Started</option>
                                <option value="LEARNING">Learning</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="FAILED">Failed</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#E7EEFF]">
                        <table className="w-full min-w-[980px]">
                            <thead>
                                <tr className="bg-[#EEF3FF]">
                                    <th className="text-left py-3 px-4 text-[#052143] text-sm font-semibold">Course</th>
                                    <th className="text-left py-3 px-4 text-[#052143] text-sm font-semibold">Category</th>
                                    <th className="text-left py-3 px-4 text-[#052143] text-sm font-semibold">Progress</th>
                                    <th className="text-left py-3 px-4 text-[#052143] text-sm font-semibold">Score</th>
                                    <th className="text-left py-3 px-4 text-[#052143] text-sm font-semibold">Status</th>
                                    <th className="text-left py-3 px-4 text-[#052143] text-sm font-semibold">Last Activity</th>
                                    <th className="text-left py-3 px-4 text-[#052143] text-sm font-semibold">Certificate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-[#6B778B]">Loading training results...</td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-red-500">{error}</td>
                                    </tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-[#6B778B]">No matching results found.</td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => (
                                        <tr key={row.id} className="border-t border-[#EAF0FF] hover:bg-[#F9FBFF]">
                                            <td className="py-4 px-4">
                                                <p className="text-[#052143] text-[15px] font-medium">{row.course}</p>
                                            </td>
                                            <td className="py-4 px-4 text-[#6B778B] text-sm">{row.category}</td>
                                            <td className="py-4 px-4">
                                                <div className="w-[170px]">
                                                    <div className="h-2.5 rounded-full bg-[#E7EEFF] overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-[#687EFF]"
                                                            style={{ width: `${row.progress}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-[#6B778B] mt-1">{row.progress}%</p>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-sm text-[#052143] font-medium">
                                                {Number.isFinite(row.score) ? `${row.score}%` : '-'}
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${row.statusBadge.className}`}>
                                                    {row.statusText}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-sm text-[#6B778B]">{formatDateTime(row.lastActivity)}</td>
                                            <td className="py-4 px-4">
                                                {row.certificateUrl ? (
                                                    <a
                                                        href={row.certificateUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-[#687EFF] hover:underline text-sm font-medium"
                                                    >
                                                        View
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M7 17L17 7" />
                                                            <path d="M7 7h10v10" />
                                                        </svg>
                                                    </a>
                                                ) : row.certificateNo ? (
                                                    <span className="text-[#052143] text-xs font-medium">{row.certificateNo}</span>
                                                ) : row.certificatePendingApproval ? (
                                                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-[#FFF1E8] text-[#C2410C]">Pending Approval</span>
                                                ) : row.certificateGenerating ? (
                                                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#4F46E5]">Generating</span>
                                                ) : (
                                                    <span className="text-[#9BA8C0] text-sm">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <style jsx global>{`
                @keyframes trainingResultsFadeUp {
                    from {
                        opacity: 0;
                        transform: translateY(16px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .entry-fade {
                    opacity: 0;
                    transform: translateY(16px);
                }
                .entry-fade.is-visible {
                    animation: trainingResultsFadeUp 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
                    animation-delay: var(--entry-delay, 0ms);
                }
                @media (prefers-reduced-motion: reduce) {
                    .entry-fade,
                    .entry-fade.is-visible {
                        opacity: 1 !important;
                        transform: none !important;
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
