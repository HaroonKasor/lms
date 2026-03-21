'use client';

import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';
import React, { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

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

    const pageNumbers = useMemo(() => {
        const windowSize = 5;
        if (totalPages <= windowSize) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
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
        <AdminLmsDashboard>
            <div className="w-full relative z-10 pb-20">
                <h1 className="text-[28px] md:text-[32px] font-semibold text-[#052143] leading-[150%] mb-10">Report: Learner Status</h1>

                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-16">
                    <div className="flex flex-wrap items-center gap-4 flex-1">
                        <label className="min-w-[180px] flex-1 max-w-[240px]">
                            <select
                                value={selected.categoryId}
                                onChange={(e) => setSelected((prev) => ({ ...prev, categoryId: e.target.value, courseId: '', sectionId: '' }))}
                                className="w-full bg-white border border-[#E1E5EC] rounded-[10px] px-4 h-[44px] text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                <option value="">Course Category: All</option>
                                {filters.categories.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="min-w-[180px] flex-1 max-w-[240px]">
                            <select
                                value={selected.courseId}
                                onChange={(e) => setSelected((prev) => ({ ...prev, courseId: e.target.value, sectionId: '' }))}
                                className="w-full bg-white border border-[#E1E5EC] rounded-[10px] px-4 h-[44px] text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                <option value="">Course: All</option>
                                {filters.courses.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="min-w-[180px] flex-1 max-w-[240px]">
                            <select
                                value={selected.sectionId}
                                onChange={(e) => setSelected((prev) => ({ ...prev, sectionId: e.target.value }))}
                                className="w-full bg-white border border-[#E1E5EC] rounded-[10px] px-4 h-[44px] text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                <option value="">Session: All</option>
                                {filters.sections.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="min-w-[180px] flex-1 max-w-[240px]">
                            <select
                                value={selected.userStatus}
                                onChange={(e) => setSelected((prev) => ({ ...prev, userStatus: e.target.value }))}
                                className="w-full bg-white border border-[#E1E5EC] rounded-[10px] px-4 h-[44px] text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                {filters.statuses.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <button
                            onClick={() => fetchReport(selected)}
                            className="bg-[#F87A53] text-white px-8 py-2.5 rounded-full font-medium text-[16px] shadow-sm hover:bg-[#e66c46] hover:shadow-md transition-all w-[120px]"
                        >
                            {loading ? 'Loading...' : 'View'}
                        </button>
                        <button
                            onClick={handleExport}
                            className="bg-white border text-[#F87A53] border-[#F87A53] px-8 py-2.5 rounded-full font-medium text-[16px] shadow-sm hover:bg-orange-50 hover:shadow-md transition-all w-[120px]"
                        >
                            Export
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-32 mb-20 relative">
                    <div className="absolute top-1/2 right-0 w-32 h-32 rounded-full filter blur-[40px] opacity-40 mix-blend-multiply pointer-events-none" style={{ background: 'linear-gradient(134.15deg, #F70DC5 15.4%, rgba(247, 13, 197, 0) 73.27%)' }}></div>

                    <div className="w-[300px] h-[300px] relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={180}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={75}
                                    outerRadius={150}
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
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[32px] font-bold text-[#052143] leading-none mb-1">{totalLearners}</span>
                            <span className="text-[16px] font-medium text-[#052143]">Total Learners</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 w-[240px]">
                        {pieData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[14px]">
                                <div className="flex items-center gap-3">
                                    <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: item.color }}></div>
                                    <span className="text-[#052143] font-medium">{item.name}</span>
                                </div>
                                <span className="text-[#6B778B] font-medium">{item.value} ({item.percentage})</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center justify-between bg-white border border-[#E1E5EC] rounded-[10px] px-3 h-[40px] shadow-sm w-[160px]">
                            <span className="text-[14px] text-[#052143]"><span className="font-medium">Status:</span> {statusText(selected.userStatus)}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-[#E1E5EC] rounded-[10px] px-3 h-[40px] shadow-sm">
                            <span className="text-[14px] text-[#052143]"><span className="font-medium">Show:</span></span>
                            <select
                                value={entries}
                                onChange={(e) => setEntries(Number(e.target.value))}
                                className="outline-none text-[14px] text-[#052143] bg-transparent"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-[14px] text-[#052143]">records</span>
                        </div>
                    </div>

                    <div className="flex items-center bg-white border border-[#E1E5EC] rounded-full px-5 h-[44px] shadow-sm w-full md:w-[350px]">
                        <input
                            type="text"
                            value={selected.q}
                            onChange={(e) => setSelected((prev) => ({ ...prev, q: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') fetchReport(selected);
                            }}
                            placeholder="Search"
                            className="flex-1 outline-none text-[15px] bg-transparent text-[#052143] placeholder-[#6B778B]"
                        />
                        <button onClick={() => fetchReport(selected)} className="ml-2">
                            <svg className="w-5 h-5 text-[#687EFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </button>
                    </div>
                </div>

                <div className="w-full bg-white rounded-[10px] overflow-hidden shadow-sm border border-[#E1E5EC]">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full table-fixed text-left border-collapse">
                            <thead>
                                <tr className="bg-[#687EFF] text-white">
                                    <th className="py-4 px-6 font-medium text-[16px] w-[80px]">No.</th>
                                    <th className="py-4 px-6 font-medium text-[16px] w-[22%]">Course Category</th>
                                    <th className="py-4 px-6 font-medium text-[16px] w-[22%]">Course</th>
                                    <th className="py-4 px-6 font-medium text-[16px] w-[24%]">Username</th>
                                    <th className="py-4 px-6 font-medium text-[16px] w-[16%]">First Name</th>
                                    <th className="py-4 px-6 font-medium text-[16px] w-[16%]">Last Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedRows.map((row) => (
                                    <tr key={row.id} className="border-b border-[#E1E5EC] last:border-none hover:bg-gray-50 transition-colors">
                                        <td className="py-5 px-6 text-[#052143] text-[15px] font-medium">{row.no}.</td>
                                        <td className="py-5 px-6 text-[#052143] text-[15px] break-words">{row.category}</td>
                                        <td className="py-5 px-6 text-[#052143] text-[15px] break-words">{row.course}</td>
                                        <td className="py-5 px-6 text-[#052143] text-[15px] break-all">{row.username}</td>
                                        <td className="py-5 px-6 text-[#052143] text-[15px] break-words">{row.firstName}</td>
                                        <td className="py-5 px-6 text-[#052143] text-[15px] break-words">{row.lastName}</td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-8 px-6 text-center text-[#6B778B]">
                                            {loading ? 'Loading...' : 'No data found'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-[#E1E5EC]">
                        <div className="text-[13px] text-[#6B778B]">
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
            </div>
        </AdminLmsDashboard>
    );
}
