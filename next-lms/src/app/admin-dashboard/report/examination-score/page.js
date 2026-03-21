"use client";

import React, { useEffect, useMemo, useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

const SearchIcon = () => (
    <svg className="w-4 h-4 text-[#687EFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

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

    const pageNumbers = useMemo(() => {
        const windowSize = 5;
        if (totalPages <= windowSize) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const half = Math.floor(windowSize / 2);
        let start = Math.max(1, page - half);
        let end = Math.min(totalPages, start + windowSize - 1);
        if (end - start + 1 < windowSize) {
            start = Math.max(1, end - windowSize + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [page, totalPages]);

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
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-8 font-outfit mt-4">
                <h1 className="text-[32px] font-medium text-[#052143]">Report: Examination Score</h1>

                <div className="flex flex-wrap items-center gap-4">
                    <label className="min-w-[240px]">
                        <select
                            value={selected.categoryId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, categoryId: e.target.value, courseId: '', quizId: '' }))}
                            className="w-full border border-[#D1E3FB] rounded-[16px] px-5 py-[14px] bg-white text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                        >
                            <option value="">Course Category: All</option>
                            {filters.categories.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="min-w-[260px]">
                        <select
                            value={selected.courseId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, courseId: e.target.value, quizId: '' }))}
                            className="w-full border border-[#D1E3FB] rounded-[16px] px-5 py-[14px] bg-white text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                        >
                            <option value="">Course: All</option>
                            {coursesByCategory.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="min-w-[200px]">
                        <select
                            value={selected.quizId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, quizId: e.target.value }))}
                            className="w-full border border-[#D1E3FB] rounded-[16px] px-5 py-[14px] bg-white text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                        >
                            <option value="">Exam: All</option>
                            {filters.quizzes.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="min-w-[300px] flex-1 max-w-[400px]">
                        <select
                            value={selected.userId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, userId: e.target.value }))}
                            className="w-full border border-[#D1E3FB] rounded-[16px] px-5 py-[14px] bg-white text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                        >
                            <option value="">User: All</option>
                            {filters.users.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </label>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={() => fetchReport(selected)}
                            className="h-[42px] px-5 rounded-[10px] bg-[#687EFF] text-white text-[14px] font-medium hover:bg-[#5A6FE0] disabled:opacity-60"
                        >
                            {loading ? 'Loading...' : 'View'}
                        </button>
                        <button
                            onClick={handleExport}
                            className="h-[42px] px-5 rounded-[10px] border border-[#687EFF] bg-white text-[#687EFF] text-[14px] font-medium hover:bg-[#EEF1FF]"
                        >
                            Export
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-[10px] mt-2">
                    <h2 className="text-[22px] font-medium text-[#052143]">Course Category: {meta.categoryName}</h2>
                    <h2 className="text-[22px] font-medium text-[#052143]">Course: {meta.courseName}</h2>
                    <h2 className="text-[22px] font-medium text-[#052143]">Exam: {meta.quizName}</h2>
                </div>

                <div className="w-full max-w-[900px] mx-auto mt-6 mb-10 relative">
                    <span className="absolute -top-10 left-0 text-[16px] font-medium text-[#052143]">Users Count</span>

                    <div className="w-full h-[400px]">
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

                    <span className="absolute -bottom-8 right-0 text-[16px] font-medium text-[#052143]">Score ranges</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 py-2 mt-4">
                    <div className="flex items-center gap-4">
                        <label className="min-w-[200px]">
                            <select
                                value={selected.scoreRange}
                                onChange={(e) => setSelected((prev) => ({ ...prev, scoreRange: e.target.value }))}
                                className="w-full border border-[#D1E3FB] rounded-[16px] px-5 py-[12px] bg-white text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                {filters.scoreRanges.map((item) => (
                                    <option key={item.id} value={item.id}>{`Score: ${item.name}`}</option>
                                ))}
                            </select>
                        </label>
                        <div className="flex items-center justify-between border border-[#D1E3FB] rounded-[16px] px-5 py-[12px] bg-white min-w-[200px]">
                            <div className="flex items-center gap-2">
                                <span className="text-[14px] text-[#052143]">Show:</span>
                                <select
                                    value={entries}
                                    onChange={(e) => setEntries(Number(e.target.value))}
                                    className="text-[14px] text-[#6B778B] bg-transparent outline-none"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span className="text-[14px] text-[#6B778B]">records</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center border border-[#D1E3FB] rounded-full pl-5 pr-2 py-2 bg-white min-w-[340px]">
                        <input
                            type="text"
                            value={selected.q}
                            onChange={(e) => setSelected((prev) => ({ ...prev, q: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') fetchReport(selected);
                            }}
                            placeholder="Search"
                            className="flex-1 outline-none text-[15px] text-[#052143] placeholder-[#6B778B] bg-transparent"
                        />
                        <button onClick={() => fetchReport(selected)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors mr-1">
                            <SearchIcon />
                        </button>
                    </div>
                </div>

                <div className="w-full overflow-x-auto pb-12">
                    <table className="w-full table-fixed text-left">
                        <thead>
                            <tr className="bg-[#687EFF] text-white">
                                <th className="py-3 px-3 text-[14px] font-medium rounded-tl-[16px] w-[64px]">No.</th>
                                <th className="py-3 px-3 text-[14px] font-medium w-[20%]">Username</th>
                                <th className="py-3 px-3 text-[14px] font-medium w-[13%]">First Name</th>
                                <th className="py-3 px-3 text-[14px] font-medium w-[13%]">Last Name</th>
                                <th className="py-3 px-3 text-[14px] font-medium text-center w-[13%]">Score</th>
                                <th className="py-3 px-3 text-[14px] font-medium text-center w-[9%]">%</th>
                                <th className="py-3 px-3 text-[14px] font-medium text-center w-[10%]">Result</th>
                                <th className="py-3 px-3 text-[14px] font-medium text-center w-[9%]">Attempt</th>
                                <th className="py-3 px-3 text-[14px] font-medium rounded-tr-[16px] text-center w-[13%]">Time (mins)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedRows.map((row, index) => {
                                const isLast = index === pagedRows.length - 1;
                                return (
                                    <tr key={`${row.username}-${row.no}-${index}`} className="bg-white hover:bg-blue-50/30 transition-colors">
                                        <td className={`py-3 px-3 text-[14px] text-[#052143] ${isLast ? 'rounded-bl-[16px]' : ''}`}>{row.no}.</td>
                                        <td className="py-3 px-3 text-[14px] text-[#052143] break-all">{row.username}</td>
                                        <td className="py-3 px-3 text-[14px] text-[#052143] break-words">{row.firstName}</td>
                                        <td className="py-3 px-3 text-[14px] text-[#052143] break-words">{row.lastName}</td>
                                        <td className="py-3 px-3 text-[14px] text-[#052143] text-center break-words">{row.score}</td>
                                        <td className="py-3 px-3 text-[14px] text-[#052143] text-center break-words">{row.percent}</td>
                                        <td className="py-3 px-3 text-[14px] text-center font-medium">
                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${resultChipClass(row.result)}`}>
                                                {row.result}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-[14px] text-[#052143] text-center">{row.attempt}</td>
                                        <td className={`py-3 px-3 text-[14px] text-[#052143] text-center break-words ${isLast ? 'rounded-br-[16px]' : ''}`}>{row.timeSpent}</td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && (
                                <tr className="bg-white">
                                    <td colSpan="9" className="py-10 px-8 text-center text-[#6B778B] text-[16px]">
                                        {loading ? 'Loading examination results...' : 'No examination result found'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 mb-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-[13px] text-[#64748B]">
                        Showing {pagedRows.length} of {rows.length} entries | Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1}
                            className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] disabled:opacity-50"
                        >
                            Prev
                        </button>
                        {pageNumbers.map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setPage(n)}
                                className={`h-[34px] min-w-[34px] px-2 rounded-[8px] border text-[13px] font-medium transition-colors ${
                                    n === page
                                        ? 'border-[#687EFF] bg-[#687EFF] text-white'
                                        : 'border-[#D1D9EE] bg-white text-[#334155] hover:bg-[#F8FAFF]'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={page >= totalPages}
                            className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </AdminLmsDashboard>
    );
}
