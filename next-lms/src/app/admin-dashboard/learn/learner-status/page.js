'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

const DEFAULT_FILTERS = {
    categoryId: '',
    courseId: '',
    sectionId: '',
    username: '',
    status: 'ALL',
};

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'All Status' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'LEARNING', label: 'Learning' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

const ACTION_OPTIONS = [
    { value: 'APPROVED', label: 'Approve', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { value: 'LEARNING', label: 'Learning', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'COMPLETED', label: 'Complete', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { value: 'FAILED', label: 'Failed', className: 'bg-rose-100 text-rose-700 border-rose-200' },
];

function toSafeString(value) {
    return String(value || '').trim();
}

function formatDateTime(value) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString('th-TH');
    } catch {
        return String(value);
    }
}

function statusChipClass(status) {
    const key = toSafeString(status).toUpperCase();
    if (key === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (key === 'LEARNING') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (key === 'APPROVED') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (key === 'FAILED') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (key === 'CANCELLED') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function LearnerStatusManagePage() {
    const [categories, setCategories] = useState([]);
    const [courses, setCourses] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
    const [searchTerm, setSearchTerm] = useState('');
    const [entries, setEntries] = useState(20);
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [updatingId, setUpdatingId] = useState('');

    const loadSetup = async () => {
        const [catRes, courseRes] = await Promise.all([
            fetch('/api/categories', { cache: 'no-store' }),
            fetch('/api/courses', { cache: 'no-store' }),
        ]);
        if (!catRes.ok || !courseRes.ok) {
            throw new Error('Failed to load setup data');
        }
        const [catData, courseData] = await Promise.all([catRes.json(), courseRes.json()]);
        setCategories(Array.isArray(catData) ? catData : []);
        setCourses(Array.isArray(courseData) ? courseData : []);
    };

    const loadEnrollments = async (courseId = '') => {
        const params = new URLSearchParams({ raw: '1' });
        if (courseId) params.set('courseId', String(courseId));
        const res = await fetch(`/api/enrollments?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load enrollments');
        const data = await res.json();
        setEnrollments(Array.isArray(data) ? data : []);
    };

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                setLoading(true);
                setError('');
                await loadSetup();
                if (!active) return;
                await loadEnrollments('');
            } catch (err) {
                if (!active) return;
                setError(err?.message || 'Unable to load data');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const filteredCourses = useMemo(() => {
        if (!filters.categoryId) return courses;
        return courses.filter((course) => String(course?.categoryId || '') === String(filters.categoryId));
    }, [courses, filters.categoryId]);

    const sectionOptions = useMemo(() => {
        const map = new Map();
        enrollments.forEach((row) => {
            const section = row?.section || {};
            const id = String(section?.id || row?.sectionId || '');
            if (!id) return;
            if (map.has(id)) return;
            map.set(id, {
                id,
                name: section?.name || section?.title || `Section ${id}`,
            });
        });
        return Array.from(map.values());
    }, [enrollments]);

    const filteredRows = useMemo(() => {
        const categoryId = String(appliedFilters.categoryId || '');
        const courseId = String(appliedFilters.courseId || '');
        const sectionId = String(appliedFilters.sectionId || '');
        const username = toSafeString(appliedFilters.username).toLowerCase();
        const status = toSafeString(appliedFilters.status).toUpperCase();
        const keyword = toSafeString(searchTerm).toLowerCase();

        return enrollments.filter((row) => {
            const learner = row?.learner || {};
            const course = row?.course || {};
            const section = row?.section || {};

            if (categoryId && String(course?.categoryId || '') !== categoryId) return false;
            if (courseId && String(row?.courseId || course?.id || '') !== courseId) return false;
            if (sectionId && String(row?.sectionId || section?.id || '') !== sectionId) return false;
            if (status !== 'ALL' && toSafeString(row?.status).toUpperCase() !== status) return false;

            const uname = toSafeString(learner?.username || learner?.email).toLowerCase();
            if (username && !uname.includes(username)) return false;

            if (!keyword) return true;
            const haystack = [
                uname,
                toSafeString(learner?.fullName).toLowerCase(),
                toSafeString(course?.name).toLowerCase(),
                toSafeString(section?.name || section?.title).toLowerCase(),
                toSafeString(row?.status).toLowerCase(),
            ].join(' ');
            return haystack.includes(keyword);
        });
    }, [enrollments, appliedFilters, searchTerm]);

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(filteredRows.length / entries));
    }, [filteredRows.length, entries]);

    const pagedRows = useMemo(() => {
        const start = (page - 1) * entries;
        return filteredRows.slice(start, start + entries);
    }, [filteredRows, page, entries]);

    const pageNumbers = useMemo(() => {
        const maxButtons = 7;
        if (totalPages <= maxButtons) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const half = Math.floor(maxButtons / 2);
        let start = Math.max(1, page - half);
        let end = Math.min(totalPages, start + maxButtons - 1);
        if (end - start + 1 < maxButtons) {
            start = Math.max(1, end - maxButtons + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [page, totalPages]);

    useEffect(() => {
        setPage(1);
    }, [entries, appliedFilters, searchTerm]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const applyFilters = async (event) => {
        event.preventDefault();
        try {
            setError('');
            setSuccess('');
            setPage(1);
            setAppliedFilters(filters);
            await loadEnrollments(filters.courseId);
        } catch (err) {
            setError(err?.message || 'Failed to apply filters');
        }
    };

    const resetFilters = async () => {
        try {
            setFilters(DEFAULT_FILTERS);
            setAppliedFilters(DEFAULT_FILTERS);
            setSearchTerm('');
            setPage(1);
            setError('');
            setSuccess('');
            await loadEnrollments('');
        } catch (err) {
            setError(err?.message || 'Failed to reset');
        }
    };

    const updateStatus = async (row, nextStatus) => {
        const enrollmentId = Number(row?.id || 0);
        if (!enrollmentId) return;
        try {
            setUpdatingId(String(enrollmentId));
            setError('');
            setSuccess('');
            const payload = { id: enrollmentId, status: nextStatus };
            if (nextStatus === 'COMPLETED') payload.progress = 100;

            const res = await fetch('/api/enrollments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Update status failed');

            setEnrollments((prev) => prev.map((item) => (
                Number(item?.id || 0) === enrollmentId
                    ? {
                        ...item,
                        status: nextStatus,
                        progress: nextStatus === 'COMPLETED' ? 100 : Number(item?.progress || 0),
                        completedAt: nextStatus === 'COMPLETED' ? new Date().toISOString() : item?.completedAt,
                        startedAt: nextStatus === 'LEARNING' ? (item?.startedAt || new Date().toISOString()) : item?.startedAt,
                    }
                    : item
            )));
            setSuccess('Learner status updated successfully');
        } catch (err) {
            setError(err?.message || 'Update status failed');
        } finally {
            setUpdatingId('');
        }
    };

    return (
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-6 font-outfit">
                <div>
                    <h1 className="text-[30px] font-semibold text-[#052143] leading-[120%]">Learner Status</h1>
                    <div className="text-[13px] text-[#64748B] mt-1">Admin can update learner status directly from Action.</div>
                </div>

                <div className="bg-white border border-[#D1E3FB] rounded-[12px] overflow-hidden shadow-sm">
                    <div className="bg-[#687EFF] text-white px-5 py-3 text-[18px] font-semibold">Manage Learner Status</div>
                    <form onSubmit={applyFilters} className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                        <select
                            value={filters.categoryId}
                            onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value, courseId: '', sectionId: '' }))}
                            className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                        >
                            <option value="">All Categories</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </select>

                        <select
                            value={filters.courseId}
                            onChange={(e) => setFilters((prev) => ({ ...prev, courseId: e.target.value, sectionId: '' }))}
                            className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                        >
                            <option value="">All Courses</option>
                            {filteredCourses.map((course) => (
                                <option key={course.id} value={course.id}>{course.name}</option>
                            ))}
                        </select>

                        <select
                            value={filters.sectionId}
                            onChange={(e) => setFilters((prev) => ({ ...prev, sectionId: e.target.value }))}
                            className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                        >
                            <option value="">All Sections</option>
                            {sectionOptions.map((section) => (
                                <option key={section.id} value={section.id}>{section.name}</option>
                            ))}
                        </select>

                        <select
                            value={filters.status}
                            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                            className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                        </select>

                        <input
                            value={filters.username}
                            onChange={(e) => setFilters((prev) => ({ ...prev, username: e.target.value }))}
                            placeholder="Username filter"
                            className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                        />

                        <div className="flex items-center gap-2">
                            <button type="submit" className="h-[42px] px-5 rounded-[10px] bg-[#687EFF] text-white text-[14px] font-medium hover:bg-[#5A6FE0]">Submit</button>
                            <button type="button" onClick={resetFilters} className="h-[42px] px-5 rounded-[10px] border border-[#D1D9EE] bg-white text-[#334155] text-[14px] font-medium hover:bg-[#F8FAFF]">Cancel</button>
                        </div>
                    </form>
                </div>

                {error && <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}
                {success && <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">{success}</div>}

                <div className="bg-white border border-[#D1E3FB] rounded-[12px] overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-[#E6ECFF] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="text-[14px] text-[#64748B]">
                            <span className="font-medium text-[#334155]">Total:</span> {filteredRows.length} rows
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={entries}
                                onChange={(e) => setEntries(Number(e.target.value))}
                                className="h-[38px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <input
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search in table"
                                className="h-[38px] w-[280px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1160px] text-left text-[13px]">
                            <thead className="bg-[#EEF1FF] text-[#1E293B] border-b border-[#E2E8F0]">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">Action</th>
                                    <th className="px-3 py-2 font-semibold">Status</th>
                                    <th className="px-3 py-2 font-semibold">Course</th>
                                    <th className="px-3 py-2 font-semibold">Section</th>
                                    <th className="px-3 py-2 font-semibold">UserName</th>
                                    <th className="px-3 py-2 font-semibold">Name</th>
                                    <th className="px-3 py-2 font-semibold">Progress</th>
                                    <th className="px-3 py-2 font-semibold">Enrolled At</th>
                                    <th className="px-3 py-2 font-semibold">Last Activity</th>
                                </tr>
                            </thead>
                            <tbody className="text-[#334155]">
                                {loading && (
                                    <tr>
                                        <td colSpan={9} className="px-3 py-8 text-center text-[#64748B]">Loading...</td>
                                    </tr>
                                )}
                                {!loading && pagedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-3 py-8 text-center text-[#64748B]">No learner status found</td>
                                    </tr>
                                )}
                                {!loading && pagedRows.map((row) => {
                                    const learner = row?.learner || {};
                                    const course = row?.course || {};
                                    const section = row?.section || {};
                                    const isRowUpdating = String(updatingId) === String(row?.id || '');

                                    return (
                                        <tr key={row.id} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {ACTION_OPTIONS.map((action) => (
                                                        <button
                                                            key={`${row.id}-${action.value}`}
                                                            type="button"
                                                            disabled={isRowUpdating}
                                                            onClick={() => updateStatus(row, action.value)}
                                                            className={`px-2.5 py-1 rounded-[7px] border text-[11px] font-semibold transition-colors ${action.className} ${isRowUpdating ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-95'}`}
                                                        >
                                                            {action.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusChipClass(row?.status)}`}>
                                                    {toSafeString(row?.status).toUpperCase() || '-'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">{course?.name || '-'}</td>
                                            <td className="px-3 py-2">{section?.name || section?.title || '-'}</td>
                                            <td className="px-3 py-2">{learner?.username || learner?.email || '-'}</td>
                                            <td className="px-3 py-2">{learner?.fullName || '-'}</td>
                                            <td className="px-3 py-2">{Number(row?.progress || 0)}%</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row?.enrolledAt)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row?.lastActivityAt)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-5 py-4 border-t border-[#E6ECFF] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="text-[13px] text-[#64748B]">
                            Page {page} of {totalPages}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={page <= 1}
                                className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] bg-white hover:bg-[#F8FAFF] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Prev
                            </button>
                            {pageNumbers.map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setPage(n)}
                                    className={`h-[34px] min-w-[34px] px-2 rounded-[8px] border text-[13px] font-medium transition-colors ${n === page
                                        ? 'bg-[#687EFF] border-[#687EFF] text-white'
                                        : 'bg-white border-[#D1D9EE] text-[#334155] hover:bg-[#F8FAFF]'
                                        }`}
                                >
                                    {n}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={page >= totalPages}
                                className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] bg-white hover:bg-[#F8FAFF] disabled:opacity-50 disabled:cursor-not-allowed"
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
