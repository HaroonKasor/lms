'use client';

import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';
import React, { useEffect, useMemo, useState } from 'react';

function flattenSectionsToCsv(sections = []) {
    const header = ['Section', 'No', 'Date and Time', 'Study Duration (Minutes)'];
    const rows = [];
    for (const section of sections) {
        for (const record of section.records || []) {
            rows.push([section.title, record.id, record.date, record.duration]);
        }
    }
    return [header, ...rows]
        .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

export default function AttemptReport() {
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        categories: [],
        courses: [],
        users: [],
    });
    const [selected, setSelected] = useState({
        categoryId: '',
        courseId: '',
        userId: '',
    });
    const [meta, setMeta] = useState({
        userName: '-',
        categoryName: '-',
        courseName: '-',
        sessionName: '-',
    });
    const [sections, setSections] = useState([]);
    const [entries, setEntries] = useState(10);
    const [sectionPages, setSectionPages] = useState({});

    const getPageNumbers = (page, totalPages, windowSize = 5) => {
        if (totalPages <= windowSize) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const half = Math.floor(windowSize / 2);
        let start = Math.max(1, page - half);
        let end = Math.min(totalPages, start + windowSize - 1);
        if (end - start + 1 < windowSize) {
            start = Math.max(1, end - windowSize + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    };

    const fetchReport = async (nextSelected = selected) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (nextSelected.categoryId) params.set('categoryId', String(nextSelected.categoryId));
            if (nextSelected.courseId) params.set('courseId', String(nextSelected.courseId));
            if (nextSelected.userId) params.set('userId', String(nextSelected.userId));

            const res = await fetch(`/api/reports/attempt-report?${params.toString()}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load attempt report');
            }

            setFilters({
                categories: Array.isArray(data?.filters?.categories) ? data.filters.categories : [],
                courses: Array.isArray(data?.filters?.courses) ? data.filters.courses : [],
                users: Array.isArray(data?.filters?.users) ? data.filters.users : [],
            });
            setMeta({
                userName: data?.selected?.userName || '-',
                categoryName: data?.selected?.categoryName || '-',
                courseName: data?.selected?.courseName || '-',
                sessionName: data?.selected?.sessionName || '-',
            });
            setSections(Array.isArray(data?.sections) ? data.sections : []);

            setSelected({
                categoryId: data?.selected?.categoryId ? String(data.selected.categoryId) : '',
                courseId: data?.selected?.courseId ? String(data.selected.courseId) : '',
                userId: data?.selected?.userId ? String(data.selected.userId) : '',
            });
        } catch (error) {
            console.error(error);
            setSections([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setSectionPages({});
    }, [sections, entries]);

    const selectedCourses = useMemo(() => {
        if (!selected.categoryId) return filters.courses;
        const category = filters.categories.find((item) => String(item.id) === String(selected.categoryId));
        if (!category) return filters.courses;
        return filters.courses.filter((course) => {
            const match = String(course.categoryId || '') === String(category.id);
            return match || !course.categoryId;
        });
    }, [filters.courses, filters.categories, selected.categoryId]);

    const handleExport = () => {
        const csv = flattenSectionsToCsv(sections);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attempt-report-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <AdminLmsDashboard>
            <div className="w-full relative z-10 pb-20">
                <h1 className="text-[28px] md:text-[32px] font-semibold text-[#052143] leading-[150%] mb-10">Report: Attempt Report</h1>

                <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 mb-10 w-full">
                    <div className="flex flex-wrap items-center gap-4 w-full">
                        <label className="min-w-[200px] flex-1 max-w-[260px]">
                            <select
                                value={selected.categoryId}
                                onChange={(e) => setSelected((prev) => ({ ...prev, categoryId: e.target.value, courseId: '' }))}
                                className="w-full bg-white border border-[#E1E5EC] rounded-[10px] px-4 h-[44px] text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                <option value="">Course Category: All</option>
                                {filters.categories.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="min-w-[200px] flex-1 max-w-[260px]">
                            <select
                                value={selected.courseId}
                                onChange={(e) => setSelected((prev) => ({ ...prev, courseId: e.target.value }))}
                                className="w-full bg-white border border-[#E1E5EC] rounded-[10px] px-4 h-[44px] text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                <option value="">Course: All</option>
                                {selectedCourses.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>

                        <div className="min-w-[150px] flex-1 max-w-[220px] bg-white border border-[#E1E5EC] rounded-[10px] px-4 h-[44px] shadow-sm flex items-center text-[12px] 2xl:text-[14px] text-[#052143]">
                            <span className="font-medium mr-1">Session:</span>
                            <span className="text-[#6B778B] truncate">{meta.sessionName || '-'}</span>
                        </div>

                        <label className="min-w-[220px] flex-1 max-w-[300px]">
                            <select
                                value={selected.userId}
                                onChange={(e) => setSelected((prev) => ({ ...prev, userId: e.target.value }))}
                                className="w-full bg-white border border-[#E1E5EC] rounded-[10px] px-4 h-[44px] text-[14px] text-[#052143] outline-none focus:border-[#687EFF]"
                            >
                                <option value="">User: All</option>
                                {filters.users.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>

                        <div className="flex items-center gap-2 shrink-0 xl:ml-auto">
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
                </div>

                <div className="flex flex-col gap-4 mb-16 max-w-[900px]">
                    <div className="text-[18px] md:text-[20px] text-[#052143] leading-none"><span className="font-semibold mr-2">User:</span>{meta.userName}</div>
                    <div className="text-[18px] md:text-[20px] text-[#052143] leading-none"><span className="font-semibold mr-2">Course Category:</span>{meta.categoryName}</div>
                    <div className="text-[18px] md:text-[20px] text-[#052143] leading-none"><span className="font-semibold mr-2">Course:</span>{meta.courseName}</div>
                    <div className="text-[18px] md:text-[20px] text-[#052143] leading-none"><span className="font-semibold mr-2">Session:</span>{meta.sessionName}</div>
                </div>

                <div className="flex flex-col gap-14">
                    <div className="flex items-center gap-2 text-[14px] text-[#64748B]">
                        <select
                            value={entries}
                            onChange={(e) => setEntries(Number(e.target.value))}
                            className="h-[38px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF] bg-white"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span>records per section</span>
                    </div>
                    {sections.map((section, idx) => (
                        <div key={idx} className="w-full flex flex-col gap-4">
                            {(() => {
                                const sectionKey = `${section.title || 'section'}-${idx}`;
                                const records = Array.isArray(section.records) ? section.records : [];
                                const totalPages = Math.max(1, Math.ceil(records.length / entries));
                                const currentPage = Math.min(sectionPages[sectionKey] || 1, totalPages);
                                const start = (currentPage - 1) * entries;
                                const pagedRecords = records.slice(start, start + entries);
                                const pageNumbers = getPageNumbers(currentPage, totalPages);

                                return (
                                    <>
                            <h2 className="text-[20px] md:text-[22px] font-semibold text-[#052143] mb-2">{section.title}</h2>
                            <div className="w-full bg-white rounded-[10px] overflow-hidden shadow-sm border border-[#E1E5EC]">
                                <div className="w-full overflow-x-auto">
                                    <table className="w-full table-fixed text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#687EFF] text-white">
                                                <th className="py-3 px-4 font-medium text-[14px] md:text-[15px] w-[90px]">No.</th>
                                                <th className="py-3 px-4 font-medium text-[14px] md:text-[15px] w-[55%]">Date and Time</th>
                                                <th className="py-3 px-4 font-medium text-[14px] md:text-[15px] w-[45%]">Study Duration (Minutes)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedRecords.map((row) => (
                                                <tr key={`${section.title}-${row.id}`} className="border-b border-[#E1E5EC] last:border-none hover:bg-gray-50 transition-colors">
                                                    <td className="py-4 px-4 text-[#052143] text-[14px]">{row.id}.</td>
                                                    <td className="py-4 px-4 text-[#052143] text-[14px] break-words">{row.date}</td>
                                                    <td className="py-4 px-4 text-[#052143] text-[14px] break-words">{row.duration}</td>
                                                </tr>
                                            ))}
                                            {records.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="py-5 px-4 text-[#6B778B] text-[14px]">No attempt records</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="text-[13px] text-[#64748B]">
                                    Showing {pagedRecords.length} of {records.length} entries | Page {currentPage} of {totalPages}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => setSectionPages((prev) => ({ ...prev, [sectionKey]: Math.max(1, currentPage - 1) }))}
                                        disabled={currentPage <= 1}
                                        className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] disabled:opacity-50"
                                    >
                                        Prev
                                    </button>
                                    {pageNumbers.map((n) => (
                                        <button
                                            key={`${sectionKey}-${n}`}
                                            type="button"
                                            onClick={() => setSectionPages((prev) => ({ ...prev, [sectionKey]: n }))}
                                            className={`h-[34px] min-w-[34px] px-2 rounded-[8px] border text-[13px] font-medium transition-colors ${
                                                n === currentPage
                                                    ? 'border-[#687EFF] bg-[#687EFF] text-white'
                                                    : 'border-[#D1D9EE] bg-white text-[#334155] hover:bg-[#F8FAFF]'
                                            }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setSectionPages((prev) => ({ ...prev, [sectionKey]: Math.min(totalPages, currentPage + 1) }))}
                                        disabled={currentPage >= totalPages}
                                        className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                                    </>
                                );
                            })()}
                        </div>
                    ))}
                    {sections.length === 0 && (
                        <div className="w-full bg-white rounded-[10px] border border-[#E1E5EC] p-8 text-center text-[#6B778B]">
                            {loading ? 'Loading attempt data...' : 'No attempt data found'}
                        </div>
                    )}
                </div>
            </div>
        </AdminLmsDashboard>
    );
}
