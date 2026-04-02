'use client';

import AdminShell from '@/components/admin/layout/AdminShell';
import React, { useEffect, useMemo, useState } from 'react';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminEntriesControl,
    AdminPageHeader,
    AdminPagination,
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
        <AdminShell>
            <div className="w-full relative z-10 pb-20">
                <AdminPageHeader
                    title="Report: Attempt Report"
                    description="Review learner attempt history by section and export it for follow-up."
                />

                <AdminCard title="Attempt Report" contentClassName="space-y-6 mt-2">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

                        <div className="flex h-[42px] items-center rounded-xl border border-[#DDE4FF] bg-[#F8FAFF] px-3 text-[13px] text-[#334155]">
                            <span className="mr-1 font-semibold text-[#0F2243]">Session:</span>
                            <span className="truncate text-[#64748B]">{meta.sessionName || '-'}</span>
                        </div>

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

                    <div className="grid gap-3 lg:grid-cols-2">
                        {[
                            ['User', meta.userName],
                            ['Course Category', meta.categoryName],
                            ['Course', meta.courseName],
                            ['Session', meta.sessionName],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl border border-[#E8EEFF] bg-[#FBFCFF] px-4 py-3">
                                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A94B2]">{label}</div>
                                <div className="mt-1 text-[16px] font-semibold text-[#0F2243]">{value}</div>
                            </div>
                        ))}
                    </div>
                </AdminCard>

                <div className="mt-8 flex flex-col gap-6">
                    {sections.map((section, idx) => (
                        <AdminCard key={idx} title={section.title || `Section ${idx + 1}`} headerTone="secondary">
                            {(() => {
                                const sectionKey = `${section.title || 'section'}-${idx}`;
                                const records = Array.isArray(section.records) ? section.records : [];
                                const totalPages = Math.max(1, Math.ceil(records.length / entries));
                                const currentPage = Math.min(sectionPages[sectionKey] || 1, totalPages);
                                const start = (currentPage - 1) * entries;
                                const pagedRecords = records.slice(start, start + entries);

                                return (
                                    <>
                                        <AdminToolbar
                                            left={<AdminEntriesControl value={entries} onChange={setEntries} label="records per section" />}
                                        />
                                        <AdminTableWrap>
                                            <AdminTable className="min-w-[640px]">
                                                <AdminTableHead>
                                                    <tr>
                                                        <AdminTh className="w-[80px]">No.</AdminTh>
                                                        <AdminTh>Date and Time</AdminTh>
                                                        <AdminTh className="w-[220px]">Study Duration (Minutes)</AdminTh>
                                                    </tr>
                                                </AdminTableHead>
                                                <tbody>
                                                    {pagedRecords.map((row) => (
                                                        <tr key={`${section.title}-${row.id}`} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                                            <AdminTd className="font-medium text-[#0F2243]">{row.id}.</AdminTd>
                                                            <AdminTd>{row.date}</AdminTd>
                                                            <AdminTd>{row.duration}</AdminTd>
                                                        </tr>
                                                    ))}
                                                    {records.length === 0 && (
                                                        <AdminBodyStateRow colSpan={3}>
                                                            {loading ? 'Loading attempt data...' : 'No attempt records'}
                                                        </AdminBodyStateRow>
                                                    )}
                                                </tbody>
                                            </AdminTable>
                                        </AdminTableWrap>
                                        <AdminPagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={(nextPage) => setSectionPages((prev) => ({ ...prev, [sectionKey]: nextPage }))}
                                            totalItems={records.length}
                                            startRow={records.length === 0 ? 0 : start + 1}
                                            endRow={Math.min(start + entries, records.length)}
                                        />
                                    </>
                                );
                            })()}
                        </AdminCard>
                    ))}
                    {sections.length === 0 && (
                        <AdminCard headerTone="secondary">
                            <div className="py-8 text-center text-[13px] text-[#64748B]">
                                {loading ? 'Loading attempt data...' : 'No attempt data found'}
                            </div>
                        </AdminCard>
                    )}
                </div>
            </div>
        </AdminShell>
    );
}

