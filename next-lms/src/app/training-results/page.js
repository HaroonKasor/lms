'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/layout/Navbar';

const STATUS_META = {
    APPROVED: { label: 'Not Started', className: 'bg-[#EEF3FF] text-[#51607A]', dot: '#8EA0BD' },
    LEARNING: { label: 'Learning', className: 'bg-[#E8EDFF] text-[#425CF2]', dot: '#687EFF' },
    COMPLETED: { label: 'Completed', className: 'bg-[#EAFBF5] text-[#0F9D75]', dot: '#10B981' },
    FAILED: { label: 'Failed', className: 'bg-[#FFECEC] text-[#D83A52]', dot: '#EF4444' },
    CANCELLED: { label: 'Cancelled', className: 'bg-[#F3F4F6] text-[#6B7280]', dot: '#9CA3AF' },
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
    const scorePercent = enrollment?.scorePercent;
    if (scorePercent !== null && scorePercent !== undefined && scorePercent !== '') {
        const normalized = Number(scorePercent);
        if (Number.isFinite(normalized)) return clampPercent(normalized);
    }
    const rawValue = enrollment?.scoreRaw;
    if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
        const scoreRaw = Number(rawValue);
        if (Number.isFinite(scoreRaw)) return clampPercent(scoreRaw);
    }
    const scaledValue = enrollment?.scoreScaled;
    if (scaledValue !== null && scaledValue !== undefined && scaledValue !== '') {
        const scoreScaled = Number(scaledValue);
        if (!Number.isFinite(scoreScaled)) return null;
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

// Donut chart component
function DonutChart({ value, total, color, size = 72, stroke = 8 }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E7EEFF" strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }}
            />
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                fill="#052143" fontSize="15" fontWeight="700" fontFamily="Outfit, sans-serif">
                {pct}%
            </text>
        </svg>
    );
}

// Progress bar component
function ProgressBar({ value, color = '#687EFF', bg = '#E7EEFF' }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: bg }}>
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${value}%`, background: color }}
                />
            </div>
            <span className="text-[#6B778B] text-xs font-medium w-9 text-right">{value}%</span>
        </div>
    );
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

                for (const cert of certificates) {
                    const enrollmentId = Number(cert?.enrollmentId || 0);
                    if (enrollmentId > 0) certByEnrollmentId.set(enrollmentId, cert);
                }

                const builtRows = (Array.isArray(enrollData) ? enrollData : []).map((enrollment) => {
                    const enrollmentId = Number(enrollment?.id || 0);
                    const courseId = Number(enrollment?.courseId || enrollment?.course?.id || 0);
                    const progress = clampPercent(enrollment?.progress ?? enrollment?.progressPercent ?? 0);
                    const statusCode = resolveEnrollmentStatus(enrollment?.status, progress);
                    const cert = certByEnrollmentId.get(enrollmentId) || null;
                    const score = extractScorePercent(enrollment);
                    const lastActivity = enrollment?.lastActivityAt || enrollment?.updatedAt || enrollment?.enrolledAt || null;
                    const hasCertificate = Boolean(enrollment?.course?.certificate);
                    const certificateMode = String(enrollment?.course?.certificateMode || 'none').toLowerCase();
                    const certificatePendingApproval =
                        hasCertificate &&
                        statusCode === 'COMPLETED' &&
                        certificateMode === 'manual' &&
                        !cert;
                    const certificateGenerating =
                        hasCertificate &&
                        statusCode === 'COMPLETED' &&
                        certificateMode === 'auto' &&
                        !cert;

                    return {
                        id: enrollmentId || courseId,
                        course: String(enrollment?.course?.name || enrollment?.course?.title || '-'),
                        category: String(enrollment?.course?.category || '-'),
                        thumbnail: enrollment?.course?.thumbnail || null,
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
        return () => { active = false; };
    }, []);

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return rows.filter((row) => {
            const matchesStatus = statusFilter === 'ALL' || row.statusCode === statusFilter;
            const matchesQuery = !query ||
                row.course.toLowerCase().includes(query) ||
                row.category.toLowerCase().includes(query) ||
                row.statusText.toLowerCase().includes(query);
            return matchesStatus && matchesQuery;
        });
    }, [rows, searchQuery, statusFilter]);

    const summary = useMemo(() => {
        const total = rows.length;
        const completed = rows.filter((r) => r.statusCode === 'COMPLETED').length;
        const learning = rows.filter((r) => r.statusCode === 'LEARNING').length;
        const failed = rows.filter((r) => r.statusCode === 'FAILED').length;
        const certificates = rows.filter((r) => r.certificateNo || r.certificateUrl).length;
        const avgProgress = total > 0
            ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / total) : 0;
        const scoreRows = rows.filter((r) => Number.isFinite(r.score));
        const avgScore = scoreRows.length > 0
            ? Math.round(scoreRows.reduce((s, r) => s + Number(r.score || 0), 0) / scoreRows.length)
            : null;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, learning, failed, certificates, avgProgress, avgScore, completionRate };
    }, [rows]);

    const exportCsv = () => {
        const headers = ['Course', 'Category', 'Progress (%)', 'Score (%)', 'Status', 'Last Activity', 'Certificate No'];
        const lines = filteredRows.map((row) => ([
            row.course, row.category, row.progress,
            Number.isFinite(row.score) ? row.score : '',
            row.statusText, formatDateTime(row.lastActivity), row.certificateNo,
        ]));
        const content = [headers, ...lines].map((cols) => cols.map(csvEscape).join(',')).join('\n');
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

    const statCards = [
        {
            label: 'Total Enrolled',
            value: summary.total,
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
            ),
            iconBg: 'bg-[#EEF2FF]',
            valueColor: 'text-[#052143]',
            accent: '#687EFF',
        },
        {
            label: 'Completed',
            value: summary.completed,
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
            ),
            iconBg: 'bg-[#EAFBF5]',
            valueColor: 'text-[#10B981]',
            accent: '#10B981',
        },
        {
            label: 'In Progress',
            value: summary.learning,
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
            ),
            iconBg: 'bg-[#FFF4ED]',
            valueColor: 'text-[#F97316]',
            accent: '#F97316',
        },
        {
            label: 'Certificates',
            value: summary.certificates,
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                </svg>
            ),
            iconBg: 'bg-[#F5F3FF]',
            valueColor: 'text-[#8B5CF6]',
            accent: '#8B5CF6',
        },
        {
            label: 'Avg. Progress',
            value: `${summary.avgProgress}%`,
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
            ),
            iconBg: 'bg-[#EFF8FF]',
            valueColor: 'text-[#0EA5E9]',
            accent: '#0EA5E9',
        },
    ];

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-gradient-to-b from-white via-[#F6F8FF] to-[#F6F8FF] text-[#052143]">
            <Navbar />

            <main className="w-full max-w-[1290px] mx-auto pt-8 sm:pt-10 pb-20 sm:pb-28 px-4 sm:px-6">

                {/* ── Header ── */}
                <div className={`mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4 entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '40ms' }}>
                    <div>
                        <p className="text-[#687EFF] text-sm font-semibold uppercase tracking-widest mb-1">My Learning</p>
                        <h1 className="text-[#052143] font-bold text-[30px] sm:text-[38px] leading-[120%]">
                            Training <span style={{ background: 'linear-gradient(135deg,#687EFF 0%,#8C52FF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Results</span>
                        </h1>
                        <p className="text-[#6B778B] text-[15px] mt-2 leading-[150%]">
                            Track your course progress, scores, and certificates in one place.
                        </p>
                    </div>
                    <button
                        onClick={exportCsv}
                        className="h-11 inline-flex items-center justify-center gap-2 px-5 rounded-xl border border-[#D1E3FB] bg-white text-[#052143] font-medium text-[14px] hover:border-[#687EFF] hover:bg-[#EEF2FF] transition-all shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#687EFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export CSV
                    </button>
                </div>

                {/* ── Stat Cards ── */}
                <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-6 entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '100ms' }}>
                    {statCards.map((card) => (
                        <div key={card.label} className="bg-white border border-[#D1E3FB] rounded-[20px] p-5 flex flex-col gap-3 hover-lift premium-shadow">
                            <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                                {card.icon}
                            </div>
                            <div>
                                <p className="text-[#6B778B] text-[12px] font-medium uppercase tracking-wide mb-0.5">{card.label}</p>
                                <p className={`text-[32px] leading-none font-bold ${card.valueColor}`}>{card.value}</p>
                            </div>
                            <div className="h-1 rounded-full w-full" style={{ background: `${card.accent}22` }}>
                                <div className="h-full rounded-full" style={{ width: '60%', background: card.accent }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Main Panel ── */}
                <div className={`bg-white border border-[#D1E3FB] rounded-[20px] overflow-hidden entry-fade ${animateIn ? 'is-visible' : ''}`} style={{ '--entry-delay': '160ms' }}>

                    {/* Panel Header */}
                    <div className="px-6 py-5 border-b border-[#EAF0FF] flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
                        {/* Stats pills */}
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F6F8FF] border border-[#D1E3FB]">
                                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                                <span className="text-[#6B778B] text-xs">Completion Rate</span>
                                <span className="text-[#052143] font-semibold text-sm">{summary.completionRate}%</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F6F8FF] border border-[#D1E3FB]">
                                <span className="w-2 h-2 rounded-full bg-[#687EFF]" />
                                <span className="text-[#6B778B] text-xs">Avg. Score</span>
                                <span className="text-[#052143] font-semibold text-sm">{summary.avgScore !== null ? `${summary.avgScore}%` : '-'}</span>
                            </div>
                            {summary.failed > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFF5F5] border border-[#FFECEC]">
                                    <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                                    <span className="text-[#6B778B] text-xs">Failed</span>
                                    <span className="text-[#D83A52] font-semibold text-sm">{summary.failed}</span>
                                </div>
                            )}
                        </div>

                        {/* Search + Filter */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search course, category..."
                                    className="w-full sm:w-[260px] h-10 pl-10 pr-4 rounded-xl border border-[#D1E3FB] bg-[#F6F8FF] text-[#052143] text-sm placeholder:text-[#8EA0BD] outline-none focus:border-[#687EFF] focus:bg-white transition-all"
                                />
                                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8EA0BD]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                                </svg>
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="h-10 px-3 pr-8 rounded-xl border border-[#D1E3FB] bg-[#F6F8FF] text-[#052143] text-sm outline-none focus:border-[#687EFF] transition-all appearance-none"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238EA0BD' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
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

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px]">
                            <thead>
                                <tr className="bg-[#F6F8FF] border-b border-[#EAF0FF]">
                                    <th className="text-left py-3.5 px-5 text-[#6B778B] text-xs font-semibold uppercase tracking-wide">Course</th>
                                    <th className="text-left py-3.5 px-4 text-[#6B778B] text-xs font-semibold uppercase tracking-wide">Category</th>
                                    <th className="text-left py-3.5 px-4 text-[#6B778B] text-xs font-semibold uppercase tracking-wide w-[180px]">Progress</th>
                                    <th className="text-left py-3.5 px-4 text-[#6B778B] text-xs font-semibold uppercase tracking-wide">Score</th>
                                    <th className="text-left py-3.5 px-4 text-[#6B778B] text-xs font-semibold uppercase tracking-wide">Status</th>
                                    <th className="text-left py-3.5 px-4 text-[#6B778B] text-xs font-semibold uppercase tracking-wide">Last Activity</th>
                                    <th className="text-left py-3.5 px-4 text-[#6B778B] text-xs font-semibold uppercase tracking-wide">Certificate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-2 border-[#D1E3FB] border-t-[#687EFF] rounded-full animate-spin" />
                                                <p className="text-[#6B778B] text-sm">Loading training results...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-[#FFECEC] flex items-center justify-center">
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D83A52" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                                </div>
                                                <p className="text-[#D83A52] text-sm font-medium">{error}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-[#F6F8FF] flex items-center justify-center">
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8EA0BD" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                                </div>
                                                <p className="text-[#6B778B] text-sm">No matching results found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row, idx) => (
                                        <tr key={row.id} className={`border-b border-[#EAF0FF] hover:bg-[#F9FBFF] transition-colors ${idx % 2 === 0 ? '' : 'bg-[#FAFBFF]'}`}>
                                            {/* Course */}
                                            <td className="py-4 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl shrink-0 overflow-hidden bg-gradient-to-br from-[#687EFF]/20 to-[#8C52FF]/20 flex items-center justify-center">
                                                        {row.thumbnail
                                                            ? <img src={row.thumbnail} alt="" className="w-full h-full object-cover" />
                                                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#687EFF" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                                                        }
                                                    </div>
                                                    <p className="text-[#052143] text-[14px] font-medium leading-snug line-clamp-2 max-w-[220px]">{row.course}</p>
                                                </div>
                                            </td>
                                            {/* Category */}
                                            <td className="py-4 px-4">
                                                <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F6F8FF] text-[#6B778B] border border-[#E7EEFF]">{row.category}</span>
                                            </td>
                                            {/* Progress */}
                                            <td className="py-4 px-4 w-[180px]">
                                                <ProgressBar value={row.progress} color={row.statusCode === 'COMPLETED' ? '#10B981' : '#687EFF'} />
                                            </td>
                                            {/* Score */}
                                            <td className="py-4 px-4">
                                                {Number.isFinite(row.score) ? (
                                                    <span className="text-[#052143] text-sm font-semibold">{row.score}%</span>
                                                ) : (
                                                    <span className="text-[#9BA8C0] text-sm">—</span>
                                                )}
                                            </td>
                                            {/* Status */}
                                            <td className="py-4 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${row.statusBadge.className}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: row.statusBadge.dot }} />
                                                    {row.statusText}
                                                </span>
                                            </td>
                                            {/* Last Activity */}
                                            <td className="py-4 px-4 text-sm text-[#6B778B] whitespace-nowrap">{formatDateTime(row.lastActivity)}</td>
                                            {/* Certificate */}
                                            <td className="py-4 px-4">
                                                {row.certificateUrl ? (
                                                    <a
                                                        href={row.certificateUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#687EFF] to-[#8C52FF] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg>
                                                        View
                                                    </a>
                                                ) : row.certificateNo ? (
                                                    <span className="text-[#052143] text-xs font-medium font-mono">{row.certificateNo}</span>
                                                ) : row.certificatePendingApproval ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFF1E8] text-[#C2410C] border border-[#FDDCBF]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] animate-pulse" />
                                                        Pending
                                                    </span>
                                                ) : row.certificateGenerating ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#687EFF] animate-pulse" />
                                                        Generating
                                                    </span>
                                                ) : (
                                                    <span className="text-[#D1D5DB] text-sm">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table footer */}
                    {!loading && !error && filteredRows.length > 0 && (
                        <div className="px-5 py-3.5 border-t border-[#EAF0FF] flex items-center justify-between">
                            <p className="text-[#6B778B] text-xs">
                                Showing <span className="font-semibold text-[#052143]">{filteredRows.length}</span> of <span className="font-semibold text-[#052143]">{rows.length}</span> results
                            </p>
                        </div>
                    )}
                </div>
            </main>

            <style jsx global>{`
                @keyframes trainingResultsFadeUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0);    }
                }
                .entry-fade { opacity: 0; transform: translateY(18px); }
                .entry-fade.is-visible {
                    animation: trainingResultsFadeUp 560ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
                    animation-delay: var(--entry-delay, 0ms);
                }
                @media (prefers-reduced-motion: reduce) {
                    .entry-fade, .entry-fade.is-visible {
                        opacity: 1 !important; transform: none !important; animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
