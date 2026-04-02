"use client";

import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
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
    const header = ['No', 'Username', 'First Name', 'Last Name', 'Full score / Total', 'Score %', 'Result', 'Attempt', 'Time spent(mins)'];
    const body = rows.map((row) => [
        row.no,
        row.username,
        row.firstName,
        row.lastName,
        row.score,
        row.percent,
        row.result,
        row.attempt,
        row.timeSpent,
    ]);
    return [header, ...body]
        .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

export default function ExaminationScorePage() {
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState([]);
    const [rows, setRows] = useState([]);
    const [filters, setFilters] = useState({
        categories: [],
        courses: [],
        quizzes: [],
        users: [],
        scoreRanges: [],
    });
    const [selected, setSelected] = useState({
        categoryId: '',
        courseId: '',
        quizId: '',
        userId: '',
        scoreRange: 'ALL',
        q: '',
    });
    const [entries, setEntries] = useState(10);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({
        categoryName: '-',
        courseName: '-',
        quizName: '-',
    });

    const fetchReport = async (nextSelected = selected) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (nextSelected.categoryId) params.set('categoryId', String(nextSelected.categoryId));
            if (nextSelected.courseId) params.set('courseId', String(nextSelected.courseId));
            if (nextSelected.quizId) params.set('quizId', String(nextSelected.quizId));
            if (nextSelected.userId) params.set('userId', String(nextSelected.userId));
            if (nextSelected.scoreRange) params.set('scoreRange', String(nextSelected.scoreRange));
            if (nextSelected.q) params.set('q', String(nextSelected.q));

            const res = await fetch(`/api/reports/examination-score?${params.toString()}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load examination score report');
            }

            setChartData(Array.isArray(data?.chartData) ? data.chartData : []);
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setFilters({
                categories: Array.isArray(data?.filters?.categories) ? data.filters.categories : [],
                courses: Array.isArray(data?.filters?.courses) ? data.filters.courses : [],
                quizzes: Array.isArray(data?.filters?.quizzes) ? data.filters.quizzes : [],
                users: Array.isArray(data?.filters?.users) ? data.filters.users : [],
                scoreRanges: Array.isArray(data?.filters?.scoreRanges) ? data.filters.scoreRanges : [],
            });
            setMeta({
                categoryName: data?.selected?.categoryName || '-',
                courseName: data?.selected?.courseName || '-',
                quizName: data?.selected?.quizName || '-',
            });
            setSelected({
                categoryId: data?.selected?.categoryId ? String(data.selected.categoryId) : '',
                courseId: data?.selected?.courseId ? String(data.selected.courseId) : '',
                quizId: data?.selected?.quizId ? String(data.selected.quizId) : '',
                userId: data?.selected?.userId ? String(data.selected.userId) : '',
                scoreRange: String(data?.selected?.scoreRange || 'ALL'),
                q: String(data?.selected?.q || ''),
            });
        } catch (error) {
            console.error(error);
            setRows([]);
            setChartData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExport = () => {
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `examination-score-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const coursesByCategory = useMemo(() => {
        if (!selected.categoryId) return filters.courses;
        return filters.courses.filter((course) => String(course.categoryId || '') === String(selected.categoryId));
    }, [filters.courses, selected.categoryId]);

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

    const resultChipClass = (result) => {
        if (String(result || '').toLowerCase() === 'passed') {
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        }
        return 'bg-rose-100 text-rose-700 border-rose-200';
    };

    return (
        <AdminShell>
            <div className="w-full flex flex-col gap-8 font-outfit mt-4">
                <AdminPageHeader
                    title="Report: Examination Score"
                    description="Track quiz performance, score distribution, and exportable learner score data."
                />

                <AdminCard title="Examination Score" contentClassName="space-y-6 mt-2">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <select
                            value={selected.categoryId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, categoryId: e.target.value, courseId: '', quizId: '' }))}
                            className={adminSelectClass}
                        >
                            <option value="">Course Category: All</option>
                            {filters.categories.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>

                        <select
                            value={selected.courseId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, courseId: e.target.value, quizId: '' }))}
                            className={adminSelectClass}
                        >
                            <option value="">Course: All</option>
                            {coursesByCategory.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>

                        <select
                            value={selected.quizId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, quizId: e.target.value }))}
                            className={adminSelectClass}
                        >
                            <option value="">Exam: All</option>
                            {filters.quizzes.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>

                        <select
                            value={selected.userId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, userId: e.target.value }))}
                            className={adminSelectClass}
                        >
                            <option value="">User: All</option>
                            {filters.users.map((item) => (
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

                    <div className="grid gap-3 lg:grid-cols-3">
                        {[
                            ['Course Category', meta.categoryName],
                            ['Course', meta.courseName],
                            ['Exam', meta.quizName],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border border-[#E8EEFF] bg-[#FBFCFF] px-4 py-3">
                                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A94B2]">{label}</div>
                                <div className="mt-1 text-[16px] font-semibold text-[#0F2243]">{value}</div>
                            </div>
                        ))}
                    </div>
                </AdminCard>

                <AdminCard title="Score Distribution" headerTone="secondary">
                    <div className="relative mx-auto w-full max-w-[900px]">
                        <span className="absolute -top-8 left-0 text-[14px] font-semibold text-[#052143]">Users Count</span>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={180}>
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 30 }} barSize={48}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={{ stroke: '#8E8E93' }}
                                        tickLine={false}
                                        tick={{ fill: '#052143', fontSize: 16, dy: 15 }}
                                    />
                                    <YAxis
                                        axisLine={{ stroke: '#8E8E93' }}
                                        tickLine={false}
                                        tick={{ fill: '#052143', fontSize: 16, dx: -10 }}
                                        type="number"
                                        domain={[0, 'dataMax + 1']}
                                    />
                                    <Bar dataKey="uv">
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <span className="absolute -bottom-6 right-0 text-[14px] font-semibold text-[#052143]">Score ranges</span>
                    </div>
                </AdminCard>

                <AdminCard title="Learner Scores" headerTone="secondary">
                    <AdminToolbar
                        left={(
                            <>
                                <select
                                    value={selected.scoreRange}
                                    onChange={(e) => setSelected((prev) => ({ ...prev, scoreRange: e.target.value }))}
                                    className={adminSelectClass}
                                >
                                    {filters.scoreRanges.map((item) => (
                                        <option key={item.id} value={item.id}>{`Score: ${item.name}`}</option>
                                    ))}
                                </select>
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
                                    <AdminTh className="w-[64px]">No.</AdminTh>
                                    <AdminTh>Username</AdminTh>
                                    <AdminTh>First Name</AdminTh>
                                    <AdminTh>Last Name</AdminTh>
                                    <AdminTh className="text-center">Score</AdminTh>
                                    <AdminTh className="text-center">%</AdminTh>
                                    <AdminTh className="text-center">Result</AdminTh>
                                    <AdminTh className="text-center">Attempt</AdminTh>
                                    <AdminTh className="text-center">Time (mins)</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {pagedRows.map((row, index) => (
                                    <tr key={`${row.username}-${row.no}-${index}`} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd className="font-medium text-[#0F2243]">{row.no}.</AdminTd>
                                        <AdminTd className="break-all">{row.username}</AdminTd>
                                        <AdminTd>{row.firstName}</AdminTd>
                                        <AdminTd>{row.lastName}</AdminTd>
                                        <AdminTd className="text-center">{row.score}</AdminTd>
                                        <AdminTd className="text-center">{row.percent}</AdminTd>
                                        <AdminTd className="text-center">
                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${resultChipClass(row.result)}`}>
                                                {row.result}
                                            </span>
                                        </AdminTd>
                                        <AdminTd className="text-center">{row.attempt}</AdminTd>
                                        <AdminTd className="text-center">{row.timeSpent}</AdminTd>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <AdminBodyStateRow colSpan={9}>
                                        {loading ? 'Loading examination results...' : 'No examination result found'}
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
        </AdminShell>
    );
}

