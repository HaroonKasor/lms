'use client';

import AdminShell from '@/components/admin/layout/AdminShell';
import React, { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
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

const PIE_COLORS = {
    Passed: '#22C55E',
    Learning: '#00C0E8',
    Failed: '#FF383C',
    'Not attempted': '#FFC224',
};

function toCsv(rows = []) {
    const header = ['No', 'Course Category', 'Course', 'Username', 'First Name', 'Last Name', 'Status'];
    const body = rows.map((row) => [
        row.no,
        row.category,
        row.course,
        row.username,
        row.firstName,
        row.lastName,
        row.status,
    ]);
    return [header, ...body]
        .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

function statusText(status) {
    if (status === 'ALL') return 'All';
    if (status === 'COMPLETED') return 'Passed';
    if (status === 'LEARNING') return 'Learning';
    if (status === 'SUSPENDED') return 'Failed';
    return 'Not attempted';
}

export default function LearnerStatusReport() {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [entries, setEntries] = useState(10);
    const [page, setPage] = useState(1);
    const [summary, setSummary] = useState([]);
    const [totalLearners, setTotalLearners] = useState(0);
    const [filters, setFilters] = useState({
        categories: [],
        courses: [],
        sections: [],
        statuses: [],
    });
    const [selected, setSelected] = useState({
        categoryId: '',
        courseId: '',
        sectionId: '',
        userStatus: 'ALL',
        q: '',
    });

    const fetchReport = async (nextSelected = selected) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (nextSelected.categoryId) params.set('categoryId', String(nextSelected.categoryId));
            if (nextSelected.courseId) params.set('courseId', String(nextSelected.courseId));
            if (nextSelected.sectionId) params.set('sectionId', String(nextSelected.sectionId));
            if (nextSelected.userStatus) params.set('userStatus', String(nextSelected.userStatus));
            if (nextSelected.q) params.set('q', String(nextSelected.q));

            const res = await fetch(`/api/reports/learner-status?${params.toString()}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load learner status report');
            }

            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setSummary(Array.isArray(data?.summary) ? data.summary : []);
            setTotalLearners(Number(data?.totalLearners || 0));
            setFilters({
                categories: Array.isArray(data?.filters?.categories) ? data.filters.categories : [],
                courses: Array.isArray(data?.filters?.courses) ? data.filters.courses : [],
                sections: Array.isArray(data?.filters?.sections) ? data.filters.sections : [],
                statuses: Array.isArray(data?.filters?.statuses) ? data.filters.statuses : [],
            });
        } catch (error) {
            console.error(error);
            setRows([]);
            setSummary([]);
            setTotalLearners(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pieData = useMemo(() => {
        return summary.map((item) => ({
            name: item.name,
            value: Number(item.value || 0),
            percentage: String(item.percentage || '0%'),
            color: PIE_COLORS[item.name] || '#687EFF',
        }));
    }, [summary]);

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(rows.length / entries));
    }, [rows.length, entries]);

    const pagedRows = useMemo(() => {
        const start = (page - 1) * entries;
        return rows.slice(start, start + entries);
    }, [rows, page, entries]);

    useEffect(() => {
        setPage(1);
    }, [rows.length, entries]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const handleExport = () => {
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `learner-status-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <AdminShell>
            <div className="w-full relative z-10 pb-20">
                <AdminPageHeader
                    title="Report: Learner Status"
                    description="Monitor learner completion states, filter cohorts, and export status records."
                />

                <AdminCard title="Learner Status" contentClassName="space-y-6 mt-2">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <select
                            value={selected.categoryId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, categoryId: e.target.value, courseId: '', sectionId: '' }))}
                            className={adminSelectClass}
                        >
                            <option value="">Course Category: All</option>
                            {filters.categories.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                        <select
                            value={selected.courseId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, courseId: e.target.value, sectionId: '' }))}
                            className={adminSelectClass}
                        >
                            <option value="">Course: All</option>
                            {filters.courses.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                        <select
                            value={selected.sectionId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, sectionId: e.target.value }))}
                            className={adminSelectClass}
                        >
                            <option value="">Session: All</option>
                            {filters.sections.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                        <select
                            value={selected.userStatus}
                            onChange={(e) => setSelected((prev) => ({ ...prev, userStatus: e.target.value }))}
                            className={adminSelectClass}
                        >
                            {filters.statuses.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => fetchReport(selected)} className={adminPrimaryButtonClass}>
                            {loading ? 'Loading...' : 'View'}
                        </button>
                        <button onClick={handleExport} className={adminSecondaryButtonClass}>Export</button>
                    </div>
                </AdminCard>

                <div className="mt-8 grid gap-6 xl:grid-cols-[360px_1fr]">
                    <AdminCard title="Status Summary" headerTone="secondary">
                        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center xl:flex-col">
                            <div className="relative h-[280px] w-[280px]">
                                <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={180}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={75}
                                            outerRadius={132}
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="mb-1 text-[30px] font-bold leading-none text-[#052143]">{totalLearners}</span>
                                    <span className="text-[15px] font-medium text-[#052143]">Total Learners</span>
                                </div>
                            </div>

                            <div className="flex w-full flex-col gap-4">
                                {pieData.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between rounded-xl border border-[#EEF2FF] bg-[#FBFCFF] px-4 py-3 text-[14px]">
                                        <div className="flex items-center gap-3">
                                            <div className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: item.color }} />
                                            <span className="font-medium text-[#052143]">{item.name}</span>
                                        </div>
                                        <span className="font-medium text-[#6B778B]">{item.value} ({item.percentage})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </AdminCard>

                    <AdminCard title="Learner Records" headerTone="secondary">
                        <AdminToolbar
                            left={(
                                <>
                                    <div className="rounded-xl border border-[#DDE4FF] bg-[#F8FAFF] px-3 py-2 text-[13px] text-[#334155]">
                                        <span className="font-semibold text-[#0F2243]">Status:</span> {statusText(selected.userStatus)}
                                    </div>
                                    <AdminEntriesControl value={entries} onChange={setEntries} label="records" />
                                </>
                            )}
                            right={(
                                <AdminSearchInput
                                    value={selected.q}
                                    onChange={(e) => setSelected((prev) => ({ ...prev, q: e.target.value }))}
                                    placeholder="Search"
                                />
                            )}
                        />

                        <AdminTableWrap>
                            <AdminTable className="min-w-[980px]">
                                <AdminTableHead>
                                    <tr>
                                        <AdminTh className="w-[80px]">No.</AdminTh>
                                        <AdminTh>Course Category</AdminTh>
                                        <AdminTh>Course</AdminTh>
                                        <AdminTh>Username</AdminTh>
                                        <AdminTh>First Name</AdminTh>
                                        <AdminTh>Last Name</AdminTh>
                                    </tr>
                                </AdminTableHead>
                                <tbody>
                                    {pagedRows.map((row) => (
                                        <tr key={row.id} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                            <AdminTd className="font-medium text-[#0F2243]">{row.no}.</AdminTd>
                                            <AdminTd>{row.category}</AdminTd>
                                            <AdminTd>{row.course}</AdminTd>
                                            <AdminTd className="break-all">{row.username}</AdminTd>
                                            <AdminTd>{row.firstName}</AdminTd>
                                            <AdminTd>{row.lastName}</AdminTd>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <AdminBodyStateRow colSpan={6}>
                                            {loading ? 'Loading learner status report...' : 'No data found'}
                                        </AdminBodyStateRow>
                                    )}
                                </tbody>
                            </AdminTable>
                        </AdminTableWrap>

                        <AdminPagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            totalItems={rows.length}
                            startRow={rows.length === 0 ? 0 : (page - 1) * entries + 1}
                            endRow={Math.min(page * entries, rows.length)}
                        />
                    </AdminCard>
                </div>
            </div>
        </AdminShell>
    );
}

