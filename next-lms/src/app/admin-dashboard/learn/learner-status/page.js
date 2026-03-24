'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

const DEFAULT_FILTERS = { categoryId: '', courseId: '', sectionId: '', username: '', status: 'ALL' };

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'All Status' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'LEARNING', label: 'Learning' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

const ACTION_OPTIONS = [
    { value: 'APPROVED', label: 'Approved', color: '#687EFF', bg: '#F0EDFF', border: '#C4B5FD' },
    { value: 'LEARNING', label: 'Learning', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    { value: 'COMPLETED', label: 'Completed', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
    { value: 'FAILED', label: 'Failed', color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' },
];

function toSafeString(value) { return String(value || '').trim(); }

function formatDateTime(value) {
    if (!value) return '-';
    try { return new Date(value).toLocaleString('th-TH'); } catch { return String(value); }
}

function StatusBadge({ status }) {
    const key = toSafeString(status).toUpperCase();
    const cfg = {
        COMPLETED: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'Completed' },
        LEARNING:  { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'Learning' },
        APPROVED:  { bg: '#F0EDFF', text: '#687EFF', border: '#C4B5FD', label: 'Approved' },
        FAILED:    { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3', label: 'Failed' },
        CANCELLED: { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: 'Cancelled' },
    }[key] || { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: key || '-' };
    return (
        <span style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap">
            {cfg.label}
        </span>
    );
}

function ProgressBar({ value }) {
    const pct = Math.min(100, Math.max(0, Number(value || 0)));
    const color = pct >= 100 ? '#059669' : pct > 0 ? '#687EFF' : '#E2E8F0';
    return (
        <div className="flex items-center gap-2 min-w-[80px]">
            <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
            </div>
            <span className="text-[12px] text-[#64748B] w-8 text-right">{pct}%</span>
        </div>
    );
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
        if (!catRes.ok || !courseRes.ok) throw new Error('Failed to load setup data');
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
                setLoading(true); setError('');
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
        return courses.filter((c) => String(c?.categoryId || '') === String(filters.categoryId));
    }, [courses, filters.categoryId]);

    const sectionOptions = useMemo(() => {
        const map = new Map();
        enrollments.forEach((row) => {
            const section = row?.section || {};
            const id = String(section?.id || row?.sectionId || '');
            if (!id || map.has(id)) return;
            map.set(id, { id, name: section?.name || section?.title || `Section ${id}` });
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
            return [uname, toSafeString(learner?.fullName).toLowerCase(), toSafeString(course?.name).toLowerCase(), toSafeString(row?.status).toLowerCase()].join(' ').includes(keyword);
        });
    }, [enrollments, appliedFilters, searchTerm]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / entries)), [filteredRows.length, entries]);
    const pagedRows = useMemo(() => { const s = (page - 1) * entries; return filteredRows.slice(s, s + entries); }, [filteredRows, page, entries]);
    const pageNumbers = useMemo(() => {
        const w = 7;
        if (totalPages <= w) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const half = Math.floor(w / 2);
        let start = Math.max(1, page - half);
        let end = Math.min(totalPages, start + w - 1);
        if (end - start + 1 < w) start = Math.max(1, end - w + 1);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [page, totalPages]);

    useEffect(() => { setPage(1); }, [entries, appliedFilters, searchTerm]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const applyFilters = async (event) => {
        event.preventDefault();
        try { setError(''); setSuccess(''); setPage(1); setAppliedFilters(filters); await loadEnrollments(filters.courseId); }
        catch (err) { setError(err?.message || 'Failed to apply filters'); }
    };

    const resetFilters = async () => {
        try { setFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); setSearchTerm(''); setPage(1); setError(''); setSuccess(''); await loadEnrollments(''); }
        catch (err) { setError(err?.message || 'Failed to reset'); }
    };

    const updateStatus = async (row, nextStatus) => {
        const enrollmentId = Number(row?.id || 0);
        if (!enrollmentId) return;
        try {
            setUpdatingId(String(enrollmentId)); setError(''); setSuccess('');
            const payload = { id: enrollmentId, status: nextStatus };
            if (nextStatus === 'COMPLETED') payload.progress = 100;
            const res = await fetch('/api/enrollments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Update status failed');
            setEnrollments((prev) => prev.map((item) => Number(item?.id || 0) === enrollmentId
                ? { ...item, status: nextStatus, progress: nextStatus === 'COMPLETED' ? 100 : Number(item?.progress || 0), completedAt: nextStatus === 'COMPLETED' ? new Date().toISOString() : item?.completedAt, startedAt: nextStatus === 'LEARNING' ? (item?.startedAt || new Date().toISOString()) : item?.startedAt }
                : item
            ));
            setSuccess('อัปเดตสถานะสำเร็จ!');
        } catch (err) { setError(err?.message || 'Update status failed'); }
        finally { setUpdatingId(''); }
    };

    const inputCls = 'h-[42px] w-full rounded-xl border border-[#DDE4FF] bg-white px-3 text-[14px] text-[#1E293B] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 transition';

    // Summary stats
    const statsTotal = enrollments.length;
    const statsLearning = enrollments.filter((r) => toSafeString(r?.status).toUpperCase() === 'LEARNING').length;
    const statsCompleted = enrollments.filter((r) => toSafeString(r?.status).toUpperCase() === 'COMPLETED').length;
    const statsPending = enrollments.filter((r) => toSafeString(r?.status).toUpperCase() === 'APPROVED').length;

    return (
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-6" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1E293B]">สถานะผู้เรียน</h1>
                        <p className="text-[13px] text-[#64748B] mt-0.5">แอดมินสามารถอัปเดตสถานะผู้เรียนได้โดยตรงจากปุ่ม Action</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#687EFF] flex items-center justify-center shadow-md shadow-[#687EFF]/30">
                        <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'ผู้เรียนทั้งหมด', value: statsTotal, color: '#687EFF', icon: <svg width="22" height="22" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                        { label: 'กำลังเรียน', value: statsLearning, color: '#2563EB', icon: <svg width="22" height="22" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
                        { label: 'เรียนจบแล้ว', value: statsCompleted, color: '#059669', icon: <svg width="22" height="22" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
                        { label: 'รออนุมัติ', value: statsPending, color: '#D97706', icon: <svg width="22" height="22" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                    ].map((card) => (
                        <div key={card.label} className="bg-white rounded-2xl border border-[#EEF1FF] p-5 flex items-center gap-4 shadow-sm">
                            <div style={{ background: `${card.color}18` }} className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
                                {card.icon}
                            </div>
                            <div>
                                <div className="text-[28px] font-bold" style={{ color: card.color }}>{card.value}</div>
                                <div className="text-[13px] text-[#64748B]">{card.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filter Card */}
                <div className="bg-white rounded-2xl border border-[#EEF1FF] shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EEF1FF]" style={{ background: 'linear-gradient(90deg,#687EFF,#8A9CFF)' }}>
                        <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        <span className="text-white font-semibold text-[16px]">ค้นหาและกรองผู้เรียน</span>
                    </div>
                    <form onSubmit={applyFilters} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">หมวดหมู่</label>
                                <select value={filters.categoryId}
                                    onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value, courseId: '', sectionId: '' }))}
                                    className={inputCls}>
                                    <option value="">ทั้งหมด</option>
                                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">คอร์สเรียน</label>
                                <select value={filters.courseId}
                                    onChange={(e) => setFilters((p) => ({ ...p, courseId: e.target.value, sectionId: '' }))}
                                    className={inputCls}>
                                    <option value="">ทุกคอร์ส</option>
                                    {filteredCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">Section</label>
                                <select value={filters.sectionId}
                                    onChange={(e) => setFilters((p) => ({ ...p, sectionId: e.target.value }))}
                                    className={inputCls}>
                                    <option value="">ทุก Section</option>
                                    {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">สถานะ</label>
                                <select value={filters.status}
                                    onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                                    className={inputCls}>
                                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">Username</label>
                                <input value={filters.username}
                                    onChange={(e) => setFilters((p) => ({ ...p, username: e.target.value }))}
                                    placeholder="กรองตาม username"
                                    className={inputCls} />
                            </div>
                            <div className="flex items-end gap-2">
                                <button type="submit"
                                    className="flex-1 h-[42px] rounded-xl text-white text-[14px] font-semibold transition-all"
                                    style={{ background: '#687EFF' }}>
                                    ค้นหา
                                </button>
                                <button type="button" onClick={resetFilters}
                                    className="h-[42px] px-4 rounded-xl border border-[#DDE4FF] text-[#687EFF] text-[14px] font-medium hover:bg-[#F0EDFF] transition-all">
                                    รีเซ็ต
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                        <span className="mt-0.5">
                            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </span>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
                        <span className="mt-0.5">
                            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </span>
                        <span>{success}</span>
                    </div>
                )}

                {/* Table Card */}
                <div className="bg-white rounded-2xl border border-[#EEF1FF] shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EEF1FF]">
                        <svg width="16" height="16" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                        <span className="font-semibold text-[16px] text-[#1E293B]">รายการผู้เรียน</span>
                        <span className="ml-auto text-[13px] text-[#64748B]">{filteredRows.length} รายการ</span>
                    </div>

                    {/* Toolbar */}
                    <div className="px-6 py-4 border-b border-[#F1F5F9] bg-[#FAFBFF] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
                            <span>แสดง</span>
                            <select value={entries} onChange={(e) => setEntries(Number(e.target.value))}
                                className="h-[36px] rounded-lg border border-[#DDE4FF] px-2 text-[13px] outline-none focus:border-[#687EFF]">
                                {[10, 20, 50, 100].map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                            <span>รายการ</span>
                        </div>
                        <input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            placeholder="ค้นหาในผลลัพธ์..."
                            className="w-full lg:w-[280px] h-[36px] rounded-lg border border-[#DDE4FF] px-3 text-[13px] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 transition" />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-left text-[13px]">
                            <thead>
                                <tr className="bg-[#F0EDFF] text-[#687EFF]">
                                    <th className="px-4 py-3 font-semibold">การดำเนินการ</th>
                                    <th className="px-4 py-3 font-semibold">สถานะ</th>
                                    <th className="px-4 py-3 font-semibold">คอร์ส</th>
                                    <th className="px-4 py-3 font-semibold">Section</th>
                                    <th className="px-4 py-3 font-semibold">Username</th>
                                    <th className="px-4 py-3 font-semibold">ชื่อ-สกุล</th>
                                    <th className="px-4 py-3 font-semibold">ความคืบหน้า</th>
                                    <th className="px-4 py-3 font-semibold whitespace-nowrap">วันที่ลงทะเบียน</th>
                                    <th className="px-4 py-3 font-semibold whitespace-nowrap">กิจกรรมล่าสุด</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={9} className="px-4 py-10 text-center text-[#687EFF]">
                                        <div className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#687EFF" strokeWidth="4"/><path className="opacity-75" fill="#687EFF" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                            กำลังโหลดข้อมูล...
                                        </div>
                                    </td></tr>
                                )}
                                {!loading && pagedRows.length === 0 && (
                                    <tr><td colSpan={9} className="px-4 py-10 text-center text-[#94A3B8]">ไม่พบข้อมูลผู้เรียน</td></tr>
                                )}
                                {!loading && pagedRows.map((row) => {
                                    const learner = row?.learner || {};
                                    const course = row?.course || {};
                                    const section = row?.section || {};
                                    const isRowUpdating = String(updatingId) === String(row?.id || '');
                                    return (
                                        <tr key={row.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFBFF] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {ACTION_OPTIONS.map((action) => (
                                                        <button key={`${row.id}-${action.value}`} type="button"
                                                            disabled={isRowUpdating}
                                                            onClick={() => updateStatus(row, action.value)}
                                                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 whitespace-nowrap"
                                                            style={{ background: action.bg, color: action.color, border: `1px solid ${action.border}` }}>
                                                            {action.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><StatusBadge status={row?.status} /></td>
                                            <td className="px-4 py-3 max-w-[160px]">
                                                <div className="truncate font-medium text-[#334155]">{course?.name || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-[#64748B]">{section?.name || section?.title || '-'}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-[#1E293B]">{learner?.username || learner?.email || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-[#64748B]">{learner?.fullName || '-'}</td>
                                            <td className="px-4 py-3"><ProgressBar value={row?.progress} /></td>
                                            <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{formatDateTime(row?.enrolledAt)}</td>
                                            <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{formatDateTime(row?.lastActivityAt)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-[#F1F5F9] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="text-[13px] text-[#64748B]">
                            แสดง {pagedRows.length} จาก {filteredRows.length} รายการ &nbsp;|&nbsp; หน้า {page} / {totalPages}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                                className="h-[34px] px-3 rounded-lg border border-[#DDE4FF] text-[13px] text-[#334155] hover:bg-[#F0EDFF] disabled:opacity-40 transition">
                                ← ก่อนหน้า
                            </button>
                            {pageNumbers.map((n) => (
                                <button key={n} type="button" onClick={() => setPage(n)}
                                    className="h-[34px] min-w-[34px] px-2 rounded-lg border text-[13px] font-semibold transition-all"
                                    style={n === page
                                        ? { background: '#687EFF', borderColor: '#687EFF', color: '#fff', boxShadow: '0 2px 8px #687EFF44' }
                                        : { background: '#fff', borderColor: '#DDE4FF', color: '#64748B' }}>
                                    {n}
                                </button>
                            ))}
                            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                className="h-[34px] px-3 rounded-lg border border-[#DDE4FF] text-[13px] text-[#334155] hover:bg-[#F0EDFF] disabled:opacity-40 transition">
                                ถัดไป →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLmsDashboard>
    );
}
