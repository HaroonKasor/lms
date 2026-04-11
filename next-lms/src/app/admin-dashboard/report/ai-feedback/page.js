'use client';

import AdminShell from '@/components/admin/layout/AdminShell';
import React, { useEffect, useMemo, useState } from 'react';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminEntriesControl,
    AdminPageHeader,
    AdminPagination,
    AdminSearchInput,
    AdminTable,
    AdminTableHead,
    AdminTableWrap,
    AdminTd,
    AdminTh,
    AdminToolbar,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
    adminSelectClass,
} from '@/components/admin/ui/AdminPrimitives';

function toCsv(rows = []) {
    const header = ['No', 'Date', 'Rating', 'Course', 'Reason', 'Assistant Message', 'Username', 'Email'];
    const body = rows.map((row, index) => ([
        index + 1,
        row?.createdAt || '-',
        row?.ratingLabel || '-',
        row?.courseTitle || '-',
        row?.reason || '-',
        row?.assistantMessage || '-',
        row?.actorUsername || '-',
        row?.actorEmail || '-',
    ]));
    return [header, ...body]
        .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

function RatingPill({ rating }) {
    const normalized = String(rating || '').toLowerCase();
    if (normalized === 'up') {
        return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Helpful</span>;
    }
    return <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">Not helpful</span>;
}

export default function AiFeedbackReportPage() {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [entries, setEntries] = useState(20);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [summary, setSummary] = useState({
        helpfulCount: 0,
        notHelpfulCount: 0,
        reasonCount: 0,
        notHelpfulRatePercent: 0,
    });
    const [filters, setFilters] = useState({ courses: [] });
    const [selected, setSelected] = useState({
        rating: 'all',
        fromDate: '',
        toDate: '',
        course: '',
        q: '',
    });

    const fetchReport = async (overrides = {}) => {
        setLoading(true);
        try {
            const nextSelected = { ...selected, ...overrides };
            const nextPage = Number(overrides.page || page || 1);
            const params = new URLSearchParams();
            params.set('page', String(nextPage));
            params.set('limit', String(entries));
            if (nextSelected.rating) params.set('rating', String(nextSelected.rating));
            if (nextSelected.fromDate) params.set('fromDate', String(nextSelected.fromDate));
            if (nextSelected.toDate) params.set('toDate', String(nextSelected.toDate));
            if (nextSelected.course) params.set('course', String(nextSelected.course));
            if (nextSelected.q) params.set('q', String(nextSelected.q));

            const res = await fetch(`/api/reports/ai-feedback?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Failed to load AI feedback report');

            setRows(Array.isArray(data?.items) ? data.items : []);
            setTotalCount(Number(data?.totalCount || 0));
            setSummary({
                helpfulCount: Number(data?.summary?.helpfulCount || 0),
                notHelpfulCount: Number(data?.summary?.notHelpfulCount || 0),
                reasonCount: Number(data?.summary?.reasonCount || 0),
                notHelpfulRatePercent: Number(data?.summary?.notHelpfulRatePercent || 0),
            });
            setFilters({
                courses: Array.isArray(data?.filters?.courses) ? data.filters.courses : [],
            });
            setSelected({
                rating: String(data?.selected?.rating || nextSelected.rating || 'all'),
                fromDate: String(data?.selected?.fromDate || nextSelected.fromDate || ''),
                toDate: String(data?.selected?.toDate || nextSelected.toDate || ''),
                course: String(data?.selected?.course || nextSelected.course || ''),
                q: String(data?.selected?.q || nextSelected.q || ''),
            });
            setPage(Number(data?.page || nextPage));
        } catch (err) {
            console.error(err);
            setRows([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport({ page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchReport({ page: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entries]);

    const totalPages = Math.max(1, Math.ceil(totalCount / entries));
    const startRow = totalCount === 0 ? 0 : ((page - 1) * entries) + 1;
    const endRow = Math.min(page * entries, totalCount);

    const exportCsv = () => {
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-feedback-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const statCards = useMemo(() => ([
        { label: 'Total Feedback', value: totalCount },
        { label: 'Helpful', value: summary.helpfulCount },
        { label: 'Not Helpful', value: summary.notHelpfulCount },
        { label: 'Negative Rate', value: `${summary.notHelpfulRatePercent}%` },
    ]), [summary, totalCount]);

    return (
        <AdminShell>
            <div className="relative z-10 w-full space-y-6 pb-20 lg:space-y-7">
                <AdminPageHeader
                    title="Report: AI Feedback"
                    description="Review thumbs up/down with reason, filter by course/time, and export for prompt or RAG tuning."
                />

                <AdminCard title="AI Feedback Filters" contentClassName="space-y-6 mt-2">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <select
                            value={selected.rating}
                            onChange={(e) => setSelected((prev) => ({ ...prev, rating: e.target.value }))}
                            className={adminSelectClass}
                        >
                            <option value="all">Rating: All</option>
                            <option value="up">Helpful</option>
                            <option value="down">Not helpful</option>
                        </select>
                        <select
                            value={selected.course}
                            onChange={(e) => setSelected((prev) => ({ ...prev, course: e.target.value }))}
                            className={adminSelectClass}
                        >
                            <option value="">Course: All</option>
                            {filters.courses.map((course) => (
                                <option key={course.id} value={course.name}>{course.name}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={selected.fromDate}
                            onChange={(e) => setSelected((prev) => ({ ...prev, fromDate: e.target.value }))}
                            className={adminSelectClass}
                        />
                        <input
                            type="date"
                            value={selected.toDate}
                            onChange={(e) => setSelected((prev) => ({ ...prev, toDate: e.target.value }))}
                            className={adminSelectClass}
                        />
                        <AdminSearchInput
                            value={selected.q}
                            onChange={(e) => setSelected((prev) => ({ ...prev, q: e.target.value }))}
                            placeholder="Search reason/message/user..."
                            className="lg:w-full"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button onClick={() => fetchReport({ page: 1 })} className={adminPrimaryButtonClass}>
                            {loading ? 'Loading...' : 'Apply'}
                        </button>
                        <button
                            onClick={() => {
                                const reset = { rating: 'all', fromDate: '', toDate: '', course: '', q: '' };
                                setSelected(reset);
                                fetchReport({ ...reset, page: 1 });
                            }}
                            className={adminSecondaryButtonClass}
                        >
                            Reset
                        </button>
                        <button onClick={exportCsv} className={adminSecondaryButtonClass}>Export CSV</button>
                    </div>
                </AdminCard>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {statCards.map((card) => (
                        <div key={card.label} className="rounded-2xl border border-[#DDE4FF] bg-white px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A94B2]">{card.label}</div>
                            <div className="mt-1 text-[24px] font-semibold text-[#0F2243]">{card.value}</div>
                        </div>
                    ))}
                </div>

                <AdminCard title="AI Feedback Records" headerTone="secondary" contentClassName="mt-1">
                    <AdminToolbar left={<AdminEntriesControl value={entries} onChange={setEntries} />} />
                    <AdminTableWrap>
                        <AdminTable className="min-w-[1120px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[70px]">No.</AdminTh>
                                    <AdminTh className="w-[180px]">Date</AdminTh>
                                    <AdminTh className="w-[130px]">Rating</AdminTh>
                                    <AdminTh className="w-[220px]">Course</AdminTh>
                                    <AdminTh className="w-[230px]">Reason</AdminTh>
                                    <AdminTh>Assistant Message</AdminTh>
                                    <AdminTh className="w-[160px]">User</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.id || index} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd className="font-medium text-[#0F2243]">{startRow + index}</AdminTd>
                                        <AdminTd>{row.createdAt || '-'}</AdminTd>
                                        <AdminTd><RatingPill rating={row.rating} /></AdminTd>
                                        <AdminTd>{row.courseTitle || '-'}</AdminTd>
                                        <AdminTd title={row.reason || '-'}>{row.reason || '-'}</AdminTd>
                                        <AdminTd>
                                            <div className="line-clamp-3 max-w-[520px]" title={row.assistantMessage || '-'}>
                                                {row.assistantMessage || '-'}
                                            </div>
                                        </AdminTd>
                                        <AdminTd>
                                            <div className="font-medium text-[#334155]">{row.actorUsername || '-'}</div>
                                            <div className="text-[11px] text-[#64748B]">{row.actorEmail || '-'}</div>
                                        </AdminTd>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <AdminBodyStateRow colSpan={7}>
                                        {loading ? 'Loading AI feedback...' : 'No feedback found'}
                                    </AdminBodyStateRow>
                                )}
                            </tbody>
                        </AdminTable>
                    </AdminTableWrap>
                    <AdminPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={(next) => fetchReport({ page: next })}
                        totalItems={totalCount}
                        startRow={startRow}
                        endRow={endRow}
                    />
                </AdminCard>
            </div>
        </AdminShell>
    );
}
