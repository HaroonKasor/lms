'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
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

function formatDate(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
}

export default function ChatAnalyticsReportPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [weeks, setWeeks] = useState(8);
    const [data, setData] = useState({
        generatedAt: '',
        totals: {
            conversations: 0,
            feedback: { total: 0, helpful: 0, notHelpful: 0, helpfulRatePercent: 0 },
            fallbackRatePercent: 0,
            averageFirstResponseMs: 0,
        },
        byIntent: [],
        byPage: [],
    });

    const fetchAnalytics = async (nextWeeks = weeks) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('weeks', String(nextWeeks));
            const res = await fetch(`/api/reports/chat-analytics?${params.toString()}`, { cache: 'no-store' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Failed to load chat analytics');

            setData({
                generatedAt: String(json?.generatedAt || ''),
                totals: {
                    conversations: Number(json?.totals?.conversations || 0),
                    feedback: {
                        total: Number(json?.totals?.feedback?.total || 0),
                        helpful: Number(json?.totals?.feedback?.helpful || 0),
                        notHelpful: Number(json?.totals?.feedback?.notHelpful || 0),
                        helpfulRatePercent: Number(json?.totals?.feedback?.helpfulRatePercent || 0),
                    },
                    fallbackRatePercent: Number(json?.totals?.fallbackRatePercent || 0),
                    averageFirstResponseMs: Number(json?.totals?.averageFirstResponseMs || 0),
                },
                byIntent: Array.isArray(json?.byIntent) ? json.byIntent : [],
                byPage: Array.isArray(json?.byPage) ? json.byPage : [],
            });
        } catch (err) {
            setError(String(err?.message || 'Failed to load chat analytics'));
            setData((prev) => ({
                ...prev,
                byIntent: [],
                byPage: [],
            }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics(weeks);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cards = useMemo(() => ([
        { label: 'Conversations', value: Number(data?.totals?.conversations || 0) },
        { label: 'Feedback Total', value: Number(data?.totals?.feedback?.total || 0) },
        { label: 'Helpful Rate', value: `${Number(data?.totals?.feedback?.helpfulRatePercent || 0)}%` },
        { label: 'Fallback Rate', value: `${Number(data?.totals?.fallbackRatePercent || 0)}%` },
        { label: 'Avg Response', value: `${Number(data?.totals?.averageFirstResponseMs || 0)} ms` },
    ]), [data?.totals]);

    return (
        <AdminShell>
            <div className="relative z-10 w-full space-y-6 pb-20 lg:space-y-7">
                <AdminPageHeader
                    title="Report: Chat Analytics"
                    description="Track conversations, fallback rate, response performance, and quality signals from chat feedback."
                />

                <AdminCard title="Analytics Window" contentClassName="space-y-4 mt-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={weeks}
                            onChange={(event) => setWeeks(Number(event.target.value))}
                            className={adminSelectClass}
                        >
                            {[1, 2, 4, 8, 12, 24].map((option) => (
                                <option key={option} value={option}>
                                    Last {option} week{option > 1 ? 's' : ''}
                                </option>
                            ))}
                        </select>
                        <button onClick={() => fetchAnalytics(weeks)} className={adminPrimaryButtonClass}>
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                        <span className="text-[12px] text-[#64748B]">
                            Generated at: {formatDate(data.generatedAt)}
                        </span>
                    </div>
                    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div> : null}
                </AdminCard>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    {cards.map((card) => (
                        <div key={card.label} className="rounded-2xl border border-[#DDE4FF] bg-white px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A94B2]">{card.label}</div>
                            <div className="mt-1 text-[24px] font-semibold text-[#0F2243]">{card.value}</div>
                        </div>
                    ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <AdminCard title="Feedback by Intent" headerTone="secondary" contentClassName="mt-1">
                        <AdminTableWrap>
                            <AdminTable className="min-w-[760px]">
                                <AdminTableHead>
                                    <tr>
                                        <AdminTh>Intent</AdminTh>
                                        <AdminTh className="w-[100px]">Total</AdminTh>
                                        <AdminTh className="w-[110px]">Helpful</AdminTh>
                                        <AdminTh className="w-[120px]">Not Helpful</AdminTh>
                                        <AdminTh className="w-[130px]">Helpful Rate</AdminTh>
                                    </tr>
                                </AdminTableHead>
                                <tbody>
                                    {data.byIntent.map((row) => (
                                        <tr key={row.intent} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                            <AdminTd className="font-medium text-[#0F2243]">{row.intent || '-'}</AdminTd>
                                            <AdminTd>{Number(row.total || 0)}</AdminTd>
                                            <AdminTd>{Number(row.helpful || 0)}</AdminTd>
                                            <AdminTd>{Number(row.notHelpful || 0)}</AdminTd>
                                            <AdminTd>{Number(row.helpfulRatePercent || 0)}%</AdminTd>
                                        </tr>
                                    ))}
                                    {data.byIntent.length === 0 && (
                                        <AdminBodyStateRow colSpan={5}>
                                            {loading ? 'Loading intent analytics...' : 'No intent analytics yet'}
                                        </AdminBodyStateRow>
                                    )}
                                </tbody>
                            </AdminTable>
                        </AdminTableWrap>
                    </AdminCard>

                    <AdminCard title="Feedback by Page" headerTone="secondary" contentClassName="mt-1">
                        <AdminTableWrap>
                            <AdminTable className="min-w-[760px]">
                                <AdminTableHead>
                                    <tr>
                                        <AdminTh>Page</AdminTh>
                                        <AdminTh className="w-[100px]">Total</AdminTh>
                                        <AdminTh className="w-[110px]">Helpful</AdminTh>
                                        <AdminTh className="w-[120px]">Not Helpful</AdminTh>
                                        <AdminTh className="w-[130px]">Helpful Rate</AdminTh>
                                    </tr>
                                </AdminTableHead>
                                <tbody>
                                    {data.byPage.map((row) => (
                                        <tr key={row.pagePath} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                            <AdminTd className="font-medium text-[#0F2243]">{row.pagePath || '-'}</AdminTd>
                                            <AdminTd>{Number(row.total || 0)}</AdminTd>
                                            <AdminTd>{Number(row.helpful || 0)}</AdminTd>
                                            <AdminTd>{Number(row.notHelpful || 0)}</AdminTd>
                                            <AdminTd>{Number(row.helpfulRatePercent || 0)}%</AdminTd>
                                        </tr>
                                    ))}
                                    {data.byPage.length === 0 && (
                                        <AdminBodyStateRow colSpan={5}>
                                            {loading ? 'Loading page analytics...' : 'No page analytics yet'}
                                        </AdminBodyStateRow>
                                    )}
                                </tbody>
                            </AdminTable>
                        </AdminTableWrap>
                    </AdminCard>
                </div>
            </div>
        </AdminShell>
    );
}
