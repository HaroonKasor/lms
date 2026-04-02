'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';

const DEFAULT_FILTERS = { categoryId: '', courseId: '', username: '', status: 'ALL' };
const DEFAULT_ENROLL_FORM = { categoryId: '', courseId: '', userId: '' };
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'LEARNING', label: 'Learning' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const toSafeString = (v) => String(v || '').trim();

function formatDateTime(value) {
  if (!value) return '-';
  try { return new Date(value).toLocaleString('en-US'); } catch { return String(value); }
}

function statusConfig(status) {
  const key = toSafeString(status).toUpperCase();
  if (key === 'PENDING') return { bg: '#FFF7E6', text: '#D97706', border: '#FDE68A', label: 'Pending' };
  if (key === 'COMPLETED') return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'Completed' };
  if (key === 'LEARNING') return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'Learning' };
  if (key === 'APPROVED') return { bg: '#F0EDFF', text: '#687EFF', border: '#C4B5FD', label: 'Approved' };
  if (key === 'FAILED') return { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3', label: 'Failed' };
  if (key === 'CANCELLED') return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: 'Cancelled' };
  return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: key || '-' };
}

function StatusBadge({ status }) {
  const cfg = statusConfig(status);
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

function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EEF1FF] p-5 flex items-center gap-4 shadow-sm">
      <div style={{ background: `${color}18` }} className="w-12 h-12 rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-[28px] font-bold" style={{ color }}>{value}</div>
        <div className="text-[13px] text-[#64748B]">{label}</div>
      </div>
    </div>
  );
}

export default function EnrollmentPage() {
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [enrollForm, setEnrollForm] = useState(DEFAULT_ENROLL_FORM);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [enrollUserSearch, setEnrollUserSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [entries, setEntries] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        const [catRes, courseRes, usersRes] = await Promise.all([
          fetch('/api/categories', { cache: 'no-store' }),
          fetch('/api/courses', { cache: 'no-store' }),
          fetch('/api/users', { cache: 'no-store' }),
        ]);
        if (!catRes.ok || !courseRes.ok || !usersRes.ok) throw new Error('Unable to load setup data');
        const [catData, courseData, usersData] = await Promise.all([catRes.json(), courseRes.json(), usersRes.json()]);
        if (!active) return;
        setCategories(Array.isArray(catData) ? catData : []);
        setCourses(Array.isArray(courseData) ? courseData : []);
        setUsers(Array.isArray(usersData) ? usersData : []);
        await loadEnrollments('');
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Unable to load enrollment data');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const enrollCourseOptions = useMemo(() => {
    if (!enrollForm.categoryId) return courses;
    return courses.filter((c) => String(c?.categoryId || '') === String(enrollForm.categoryId));
  }, [courses, enrollForm.categoryId]);

  const filterCourseOptions = useMemo(() => {
    if (!draftFilters.categoryId) return courses;
    return courses.filter((c) => String(c?.categoryId || '') === String(draftFilters.categoryId));
  }, [courses, draftFilters.categoryId]);

  const enrollUserOptions = useMemo(() => {
    const keyword = toSafeString(enrollUserSearch).toLowerCase();
    const activeUsers = users.filter((u) => u?.isActive);
    const learners = activeUsers.filter((u) => String(u?.role || '').toLowerCase() !== 'admin');
    const source = learners.length > 0 ? learners : activeUsers;
    if (!keyword) return source;
    return source.filter((u) =>
      [u?.username, u?.email, u?.fullName].map((v) => toSafeString(v).toLowerCase()).join(' ').includes(keyword)
    );
  }, [users, enrollUserSearch]);

  const filteredRows = useMemo(() => {
    const categoryId = String(appliedFilters.categoryId || '');
    const courseId = String(appliedFilters.courseId || '');
    const username = toSafeString(appliedFilters.username).toLowerCase();
    const status = toSafeString(appliedFilters.status).toUpperCase();
    const search = toSafeString(searchTerm).toLowerCase();
    return enrollments.filter((row) => {
      const learner = row?.learner || {};
      const course = row?.course || {};
      if (categoryId && String(course?.categoryId || '') !== categoryId) return false;
      if (courseId && String(row?.courseId || course?.id || '') !== courseId) return false;
      if (status !== 'ALL' && toSafeString(row?.status).toUpperCase() !== status) return false;
      const usernameValue = toSafeString(learner?.username || learner?.email).toLowerCase();
      if (username && !usernameValue.includes(username)) return false;
      if (!search) return true;
      const haystack = [usernameValue, toSafeString(learner?.fullName).toLowerCase(), toSafeString(course?.name).toLowerCase()].join(' ');
      return haystack.includes(search);
    });
  }, [enrollments, appliedFilters, searchTerm]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / entries)), [filteredRows.length, entries]);
  const pagedRows = useMemo(() => { const s = (page - 1) * entries; return filteredRows.slice(s, s + entries); }, [filteredRows, page, entries]);
  const pageNumbers = useMemo(() => {
    const w = 5;
    if (totalPages <= w) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const half = Math.floor(w / 2);
    let start = Math.max(1, page - half);
    const end = Math.min(totalPages, start + w - 1);
    if (end - start + 1 < w) start = Math.max(1, end - w + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  useEffect(() => { setPage(1); }, [searchTerm, entries, appliedFilters]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  // Stats
  const statsCompleted = enrollments.filter((r) => toSafeString(r?.status).toUpperCase() === 'COMPLETED').length;
  const statsLearning = enrollments.filter((r) => toSafeString(r?.status).toUpperCase() === 'LEARNING').length;
  const statsPending = enrollments.filter((r) => toSafeString(r?.status).toUpperCase() === 'PENDING').length;

  const handleEnrollSubmit = async (event) => {
    event.preventDefault();
    setSuccess(''); setError('');
    if (!enrollForm.courseId || !enrollForm.userId) { setError('Please select course and learner'); return; }
    try {
      setEnrolling(true);
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: Number(enrollForm.courseId), userId: String(enrollForm.userId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Enroll failed');
      setSuccess('Enrollment created successfully!');
      setEnrollForm((prev) => ({ ...prev, userId: '' }));
      await loadEnrollments(appliedFilters.courseId || '');
    } catch (err) {
      setError(err?.message || 'Enroll failed');
    } finally { setEnrolling(false); }
  };

  const handleApplyFilter = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true); setError('');
      setAppliedFilters(draftFilters);
      await loadEnrollments(draftFilters.courseId);
    } catch (err) {
      setError(err?.message || 'Unable to apply filters');
    } finally { setSubmitting(false); }
  };

  const handleApprove = async (row) => {
    const enrollmentId = Number(row?.id || 0);
    if (!enrollmentId) return;
    try {
      setUpdatingId(String(enrollmentId)); setError(''); setSuccess('');
      const res = await fetch('/api/enrollments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: enrollmentId, status: 'APPROVED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Approve failed');
      setEnrollments((prev) => prev.map((item) => Number(item?.id || 0) === enrollmentId ? { ...item, status: 'APPROVED' } : item));
      setSuccess('Approved successfully');
    } catch (err) {
      setError(err?.message || 'Approve failed');
    } finally { setUpdatingId(''); }
  };

  const inputCls = 'h-[42px] w-full rounded-xl border border-[#DDE4FF] bg-white px-3 text-[14px] text-[#1E293B] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 transition';

  return (
    <AdminShell>
      <div className="w-full flex flex-col gap-6" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B]">Enrollment Management</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Select course → find learner → enroll</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#687EFF] flex items-center justify-center shadow-md shadow-[#687EFF]/30">
            <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Enrollments" value={enrollments.length} color="#687EFF" icon={<svg width="22" height="22" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
          <StatCard label="Learning" value={statsLearning} color="#2563EB" icon={<svg width="22" height="22" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>} />
          <StatCard label="Completed" value={statsCompleted} color="#059669" icon={<svg width="22" height="22" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
          <StatCard label="Pending" value={statsPending} color="#D97706" icon={<svg width="22" height="22" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        </div>

        {/* --- Enroll Form Card --- */}
        <div className="bg-white rounded-2xl border border-[#EEF1FF] shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EEF1FF]" style={{ background: 'linear-gradient(90deg,#687EFF,#8A9CFF)' }}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            <span className="text-white font-semibold text-[16px]">Learner Enrollment (Manual Enrollment)</span>
          </div>
          <form onSubmit={handleEnrollSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#334155]">Category</label>
                <select value={enrollForm.categoryId}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, categoryId: e.target.value, courseId: '', userId: '' }))}
                  className={inputCls}>
                  <option value="">All</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#334155]">Course <span className="text-rose-500">*</span></label>
                <select value={enrollForm.courseId}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, courseId: e.target.value, userId: '' }))}
                  className={inputCls} required>
                  <option value="">Select course</option>
                  {enrollCourseOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#334155]">Find learner</label>
                <input value={enrollUserSearch}
                  onChange={(e) => { setEnrollUserSearch(e.target.value); setEnrollForm((p) => ({ ...p, userId: '' })); }}
                  placeholder="Type name/email"
                  className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#334155]">Learner <span className="text-rose-500">*</span></label>
                <select value={enrollForm.userId}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, userId: e.target.value }))}
                  className={inputCls} required>
                  <option value="">Select learner ({enrollUserOptions.length})</option>
                  {enrollUserOptions.map((u) => <option key={u.id} value={u.id}>{u.username} | {u.fullName || '-'}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[#F1F5F9]">
              <button type="submit" disabled={loading || enrolling}
                className="h-[42px] px-6 rounded-xl text-white text-[14px] font-semibold disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(90deg,#687EFF,#8A9CFF)', boxShadow: '0 4px 14px #687EFF44' }}>
                {enrolling ? 'Enrolling...' : '+ Enroll'}
              </button>
              <button type="button"
                onClick={() => { setEnrollForm(DEFAULT_ENROLL_FORM); setEnrollUserSearch(''); }}
                className="h-[42px] px-6 rounded-xl border border-[#DDE4FF] text-[14px] text-[#687EFF] font-medium hover:bg-[#F0EDFF] transition-all">
                Clear form
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            <span className="mt-0.5">⚠️</span><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
            <span className="mt-0.5"><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span><span>{success}</span>
          </div>
        )}

        {/* --- Enrollment Table Card --- */}
        <div className="bg-white rounded-2xl border border-[#EEF1FF] shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EEF1FF]">
            <svg width="18" height="18" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            <span className="font-semibold text-[16px] text-[#1E293B]">Enrollment List</span>
            <span className="ml-auto text-[13px] text-[#64748B]">{filteredRows.length} items</span>
          </div>

          {/* Filter Bar */}
          <form onSubmit={handleApplyFilter} className="px-6 py-4 border-b border-[#F1F5F9] bg-[#FAFBFF]">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <select value={draftFilters.categoryId}
                onChange={(e) => setDraftFilters((p) => ({ ...p, categoryId: e.target.value, courseId: '' }))}
                className={inputCls}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={draftFilters.courseId}
                onChange={(e) => setDraftFilters((p) => ({ ...p, courseId: e.target.value }))}
                className={inputCls}>
                <option value="">All courses</option>
                {filterCourseOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={draftFilters.status}
                onChange={(e) => setDraftFilters((p) => ({ ...p, status: e.target.value }))}
                className={inputCls}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input value={draftFilters.username}
                onChange={(e) => setDraftFilters((p) => ({ ...p, username: e.target.value }))}
                placeholder="Filter by username"
                className={inputCls} />
              <div className="flex gap-2">
                <button type="submit" disabled={submitting}
                  className="flex-1 h-[42px] rounded-xl text-white text-[14px] font-semibold transition-all disabled:opacity-60"
                  style={{ background: '#687EFF' }}>
                  {submitting ? 'Searching...' : 'Search'}
                </button>
                <button type="button"
                  onClick={() => { setDraftFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); setSearchTerm(''); loadEnrollments(''); }}
                  className="h-[42px] px-3 rounded-xl border border-[#DDE4FF] text-[#687EFF] text-[14px] hover:bg-[#F0EDFF] transition-all">
                  Reset
                </button>
              </div>
            </div>
          </form>

          <div className="px-6 py-4">
            {/* Table Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
                <span>Show</span>
                <select value={entries} onChange={(e) => setEntries(Number(e.target.value))}
                  className="h-[36px] rounded-lg border border-[#DDE4FF] px-2 text-[13px] outline-none focus:border-[#687EFF]">
                  {[10, 20, 50, 100].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <span>items</span>
              </div>
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search in results..."
                className="w-full lg:w-[280px] h-[36px] rounded-lg border border-[#DDE4FF] px-3 text-[13px] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 transition" />
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-[#EEF1FF]">
              <table className="w-full min-w-[900px] text-[13px] text-left">
                <thead>
                  <tr className="bg-[#F0EDFF] text-[#687EFF]">
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Learner ID/Name</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Progress</th>
                    <th className="px-4 py-3 font-semibold">Enrolled At</th>
                    <th className="px-4 py-3 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[#687EFF]">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#687EFF" strokeWidth="4"/><path className="opacity-75" fill="#687EFF" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          Loading data...
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && pagedRows.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-[#94A3B8]">No enrollment data found</td></tr>
                  )}
                  {!loading && pagedRows.map((row, idx) => {
                    const learner = row?.learner || {};
                    const course = row?.course || {};
                    const isPending = toSafeString(row?.status).toUpperCase() === 'PENDING';
                    const isUpdating = String(updatingId) === String(row?.id || '');
                    return (
                      <tr key={row.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFBFF] transition-colors">
                        <td className="px-4 py-3 text-[#94A3B8]">{(page - 1) * entries + idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#1E293B]">{learner?.username || learner?.email || '-'}</div>
                          <div className="text-[12px] text-[#94A3B8]">{learner?.fullName || '-'}</div>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="truncate font-medium text-[#334155]">{course?.name || '-'}</div>
                          <div className="text-[12px] text-[#94A3B8]">{course?.category || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row?.status} />
                        </td>
                        <td className="px-4 py-3">
                          <ProgressBar value={row?.progress} />
                        </td>
                        <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{formatDateTime(row?.enrolledAt)}</td>
                        <td className="px-4 py-3 text-center">
                          {isPending ? (
                            <button type="button" disabled={isUpdating} onClick={() => handleApprove(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-all disabled:opacity-60"
                              style={{ background: '#687EFF' }}>
                              {isUpdating ? 'Approving...' : <><svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Approve</>}
                            </button>
                          ) : (
                            <span className="text-[#CBD5E1] text-[18px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-[13px] text-[#64748B]">
                Show {pagedRows.length} of {filteredRows.length} items &nbsp;|&nbsp; Page {page} / {totalPages}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="h-[34px] px-3 rounded-lg border border-[#DDE4FF] text-[13px] text-[#334155] hover:bg-[#F0EDFF] disabled:opacity-40 transition">
                  ← Previous
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
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

