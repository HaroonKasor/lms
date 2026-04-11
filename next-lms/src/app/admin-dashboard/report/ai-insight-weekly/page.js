'use client';

import AdminShell from '@/components/admin/layout/AdminShell';
import React, { useEffect, useMemo, useState } from 'react';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminPageHeader,
    AdminTable,
    AdminTableHead,
    AdminTableWrap,
    AdminTd,
    AdminTh,
    adminPrimaryButtonClass,
    adminSelectClass,
} from '@/components/admin/ui/AdminPrimitives';

export default function AiInsightWeeklyPage() {
    const [loading, setLoading] = useState(false);
    const [weeks, setWeeks] = useState(8);
    const [data, setData] = useState({
        generatedAt: '',
        totals: {
            total: 0,
            helpful: 0,
            notHelpful: 0,
            withReason: 0,
            notHelpfulRatePercent: 0,
            reasonCoveragePercent: 0,
        },
        weekly: [],
        topNegativeReasons: [],
        topCourseIssues: [],
    });

    const fetchInsight = async (nextWeeks = weeks) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('weeks', String(nextWeeks));
            const res = await fetch(`/api/reports/ai-insight-weekly?${params.toString()}`, { cache: 'no-store' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Failed to load weekly AI insights');

            setData({
                generatedAt: String(json?.generatedAt || ''),
                totals: json?.totals || {},
                weekly: Array.isArray(json?.weekly) ? json.weekly : [],
                topNegativeReasons: Array.isArray(json?.topNegativeReasons) ? json.topNegativeReasons : [],
                topCourseIssues: Array.isArray(json?.topCourseIssues) ? json.topCourseIssues : [],
            });
        } catch (err) {
            console.error(err);
            setData((prev) => ({
                ...prev,
                weekly: [],
                topNegativeReasons: [],
                topCourseIssues: [],
            }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsight(weeks);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cards = useMemo(() => ([
        { label: 'Total Feedback', value: Number(data?.totals?.total || 0) },
        { label: 'Not Helpful', value: Number(data?.totals?.notHelpful || 0) },
        { label: 'Negative Rate', value: `${Number(data?.totals?.notHelpfulRatePercent || 0)}%` },
        { label: 'Reason Coverage', value: `${Number(data?.totals?.reasonCoveragePercent || 0)}%` },
    ]), [data?.totals]);

    return (
        <AdminShell>
            <div className="relative z-10 w-full space-y-6 pb-20 lg:space-y-7">
                <AdminPageHeader
                    title="Report: AI Insight Weekly"
                    description="Weekly trend of chat feedback and top negative reasons to guide prompt/RAG improvements."
                />

                <AdminCard title="Insight Window" contentClassName="space-y-4 mt-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={weeks}
                            onChange={(e) => setWeeks(Number(e.target.value))}
                            className={adminSelectClass}
                        >
                            {[4, 8, 12, 16, 24].map((option) => (
                                <option key={option} value={option}>Last {option} weeks</option>
                            ))}
                        </select>
                        <button onClick={() => fetchInsight(weeks)} className={adminPrimaryButtonClass}>
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                        <span className="text-[12px] text-[#64748B]">
                            Generated at: {data.generatedAt || '-'}
                        </span>
                    </div>
                </AdminCard>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {cards.map((card) => (
                        <div key={card.label} className="rounded-2xl border border-[#DDE4FF] bg-white px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A94B2]">{card.label}</div>
                            <div className="mt-1 text-[24px] font-semibold text-[#0F2243]">{card.value}</div>
                        </div>
                    ))}
                </div>

                <AdminCard title="Weekly Trend" headerTone="secondary" contentClassName="mt-1">
                    <AdminTableWrap>
                        <AdminTable className="min-w-[900px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh>Week</AdminTh>
                                    <AdminTh className="w-[120px]">Total</AdminTh>
                                    <AdminTh className="w-[120px]">Helpful</AdminTh>
                                    <AdminTh className="w-[120px]">Not Helpful</AdminTh>
                                    <AdminTh className="w-[150px]">Reasons</AdminTh>
                                    <AdminTh className="w-[150px]">Negative Rate</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {data.weekly.map((row) => (
                                    <tr key={row.weekStart} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd>{row.weekLabel}</AdminTd>
                                        <AdminTd>{Number(row.total || 0)}</AdminTd>
                                        <AdminTd>{Number(row.helpful || 0)}</AdminTd>
                                        <AdminTd>{Number(row.notHelpful || 0)}</AdminTd>
                                        <AdminTd>{Number(row.withReason || 0)}</AdminTd>
                                        <AdminTd>{Number(row.notHelpfulRatePercent || 0)}%</AdminTd>
                                    </tr>
                                ))}
                                {data.weekly.length === 0 && (
                                    <AdminBodyStateRow colSpan={6}>
                                        {loading ? 'Loading weekly insight...' : 'No weekly insight data'}
                                    </AdminBodyStateRow>
                                )}
                            </tbody>
                        </AdminTable>
                    </AdminTableWrap>
                </AdminCard>

                <div className="grid gap-6 xl:grid-cols-2">
                    <AdminCard title="Top Negative Reasons" headerTone="secondary">
                        <div className="space-y-3">
                            {data.topNegativeReasons.length > 0 ? data.topNegativeReasons.map((item, index) => (
                                <div key={`${item.reason}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-[#E8EEFF] bg-[#FBFCFF] px-3 py-2">
                                    <div className="text-[13px] text-[#334155]">{item.reason}</div>
                                    <div className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                                        {Number(item.count || 0)}
                                    </div>
                                </div>
                            )) : (
                                <div className="py-8 text-center text-[13px] text-[#64748B]">
                                    {loading ? 'Loading reasons...' : 'No negative reasons found'}
                                </div>
                            )}
                        </div>
                    </AdminCard>

                    <AdminCard title="Courses with Most Negative Feedback" headerTone="secondary">
                        <div className="space-y-3">
                            {data.topCourseIssues.length > 0 ? data.topCourseIssues.map((item, index) => (
                                <div key={`${item.courseTitle}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-[#E8EEFF] bg-[#FBFCFF] px-3 py-2">
                                    <div className="text-[13px] text-[#334155]">{item.courseTitle}</div>
                                    <div className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                        {Number(item.count || 0)}
                                    </div>
                                </div>
                            )) : (
                                <div className="py-8 text-center text-[13px] text-[#64748B]">
                                    {loading ? 'Loading course signals...' : 'No course signal found'}
                                </div>
                            )}
                        </div>
                    </AdminCard>
                </div>
            </div>
        </AdminShell>
    );
}
