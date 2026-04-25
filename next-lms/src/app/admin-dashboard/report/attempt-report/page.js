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

function rowsToCsv(rows = []) {
    const header = ['No', 'User', 'Email', 'Course Category', 'Course', 'Section / Activity', 'Date and Time', 'Study Duration (Minutes)'];
    const body = rows.map((row) => [
        row.no,
        row.userName,
        row.userEmail,
        row.categoryName,
        row.courseName,
        row.sectionTitle,
        row.date,
        row.duration,
    ]);
    return [header, ...body]
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
        userName: 'All',
        categoryName: 'All',
        courseName: 'All',
        enrollmentCount: 0,
        totalCount: 0,
    });
    const [rows, setRows] = useState([]);
    const [entries, setEntries] = useState(20);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

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
                userName: data?.selected?.userName || 'All',
                categoryName: data?.selected?.categoryName || 'All',
                courseName: data?.selected?.courseName || 'All',
                enrollmentCount: Number(data?.enrollmentCount || 0),
                totalCount: Number(data?.totalCount || 0),
            });
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setPage(1);
        } catch (error) {
            console.error(error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport({ categoryId: '', courseId: '', userId: '' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedCourses = useMemo(() => {
        if (!selected.categoryId) return filters.courses;
        return filters.courses.filter((course) => String(course.categoryId || '') === String(selected.categoryId));
    }, [filters.courses, selected.categoryId]);

    const filteredRows = useMemo(() => {
        const q = String(search || '').trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((row) => {
            const haystack = [
                row.userName,
                row.userEmail,
                row.username,
                row.courseName,
                row.categoryName,
                row.sectionTitle,
                row.date,
            ].map((value) => String(value || '').toLowerCase()).join(' ');
            return haystack.includes(q);
        });
    }, [rows, search]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / entries));
    const startRow = filteredRows.length === 0 ? 0 : (page - 1) * entries + 1;
    const endRow = Math.min(page * entries, filteredRows.length);
    const pagedRows = useMemo(
        () => filteredRows.slice((page - 1) * entries, (page - 1) * entries + entries),
        [filteredRows, page, entries],
    );

    useEffect(() => {
        setPage(1);
    }, [filteredRows.length, entries]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const handleExport = () => {
        const csv = rowsToCsv(filteredRows);
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

    const handleClear = () => {
        const cleared = { categoryId: '', courseId: '', userId: '' };
        setSelected(cleared);
        setSearch('');
        fetchReport(cleared);
    };

    return (
        <AdminShell>
            <div className="w-full relative z-10 pb-20">
                <AdminPageHeader
                    title="Report: Attempt Report"
                    description="Review learner attempt history across courses and export it for follow-up."
                />

                <AdminCard title="Attempt Report" contentClassName="space-y-6 mt-2">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <select
                            value={selected.categoryId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, categoryId: e.target.value, courseId: '' }))}
                            className={adminSelectClass}
                        >
                            <option value="">Course Category: All</option>
                            {filters.categories.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>

                        <select
                            value={selected.courseId}
                            onChange={(e) => setSelected((prev) => ({ ...prev, courseId: e.target.value }))}
                            className={adminSelectClass}
                        >
                            <option value="">Course: All</option>
                            {selectedCourses.map((item) => (
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
                        <button onClick={handleClear} className={adminSecondaryButtonClass}>Clear</button>
                        <button onClick={handleExport} className={adminSecondaryButtonClass}>Export</button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-4">
                        {[
                            ['User', meta.userName],
                            ['Course Category', meta.categoryName],
                            ['Course', meta.courseName],
                            ['Records', `${meta.totalCount} from ${meta.enrollmentCount} enrollment${meta.enrollmentCount === 1 ? '' : 's'}`],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border border-[#E8EEFF] bg-[#FBFCFF] px-4 py-3">
                                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A94B2]">{label}</div>
                                <div className="mt-1 text-[16px] font-semibold text-[#0F2243]">{value}</div>
                            </div>
                        ))}
                    </div>
                </AdminCard>

                <AdminCard title="Attempts" headerTone="secondary" contentClassName="mt-2">
                    <AdminToolbar
                        left={<AdminEntriesControl value={entries} onChange={setEntries} label="records" />}
                        right={(
                            <AdminSearchInput
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search user / course / section"
                            />
                        )}
                    />

                    <AdminTableWrap>
                        <AdminTable className="min-w-[1080px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[64px]">No.</AdminTh>
                                    <AdminTh className="w-[200px]">User</AdminTh>
                                    <AdminTh className="w-[160px]">Category</AdminTh>
                                    <AdminTh>Course</AdminTh>
                                    <AdminTh>Section / Activity</AdminTh>
                                    <AdminTh className="w-[200px]">Date and Time</AdminTh>
                                    <AdminTh className="w-[150px] text-center">Duration (mins)</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {pagedRows.map((row) => (
                                    <tr key={`${row.enrollmentId}-${row.no}`} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd className="font-medium text-[#0F2243]">{row.no}.</AdminTd>
                                        <AdminTd>
                                            <div className="font-medium text-[#0F2243]">{row.userName}</div>
                                            <div className="text-[12px] text-[#64748B]">{row.userEmail || row.username || '-'}</div>
                                        </AdminTd>
                                        <AdminTd>{row.categoryName}</AdminTd>
                                        <AdminTd>{row.courseName}</AdminTd>
                                        <AdminTd>{row.sectionTitle}</AdminTd>
                                        <AdminTd>{row.date}</AdminTd>
                                        <AdminTd className="text-center">{row.duration}</AdminTd>
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && (
                                    <AdminBodyStateRow colSpan={7}>
                                        {loading ? 'Loading attempt data...' : 'No attempt data found'}
                                    </AdminBodyStateRow>
                                )}
                            </tbody>
                        </AdminTable>
                    </AdminTableWrap>

                    <AdminPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalItems={filteredRows.length}
                        startRow={startRow}
                        endRow={endRow}
                    />
                </AdminCard>
            </div>
        </AdminShell>
    );
}
