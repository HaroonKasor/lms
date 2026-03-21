'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

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
  try { return new Date(value).toLocaleString('th-TH'); } catch { return String(value); }
}

function statusClass(status) {
  const key = toSafeString(status).toUpperCase();
  if (key === 'PENDING') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (key === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (key === 'LEARNING') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (key === 'APPROVED') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  if (key === 'FAILED') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (key === 'CANCELLED') return 'bg-gray-100 text-gray-700 border-gray-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function StepPill({ step, title, detail }) {
  return (
    <div className="rounded-[12px] border border-[#DDE4FF] bg-[#F8FAFF] p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-full bg-[#687EFF] text-white text-[12px] font-semibold flex items-center justify-center">{step}</span>
        <span className="text-[14px] font-semibold text-[#1E293B]">{title}</span>
      </div>
      <div className="text-[12px] text-[#64748B]">{detail}</div>
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
    return courses.filter((course) => String(course?.categoryId || '') === String(enrollForm.categoryId));
  }, [courses, enrollForm.categoryId]);

  const filterCourseOptions = useMemo(() => {
    if (!draftFilters.categoryId) return courses;
    return courses.filter((course) => String(course?.categoryId || '') === String(draftFilters.categoryId));
  }, [courses, draftFilters.categoryId]);

  const enrollUserOptions = useMemo(() => {
    const keyword = toSafeString(enrollUserSearch).toLowerCase();
    const activeUsers = users.filter((user) => user?.isActive);
    const learners = activeUsers.filter((user) => String(user?.role || '').toLowerCase() !== 'admin');
    const source = learners.length > 0 ? learners : activeUsers;
    if (!keyword) return source;
    return source.filter((user) => [user?.username, user?.email, user?.fullName].map((v) => toSafeString(v).toLowerCase()).join(' ').includes(keyword));
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
      const section = row?.section || {};
      if (categoryId && String(course?.categoryId || '') !== categoryId) return false;
      if (courseId && String(row?.courseId || course?.id || '') !== courseId) return false;
      if (status !== 'ALL' && toSafeString(row?.status).toUpperCase() !== status) return false;
      const usernameValue = toSafeString(learner?.username || learner?.email).toLowerCase();
      if (username && !usernameValue.includes(username)) return false;
      if (!search) return true;
      const haystack = [
        usernameValue,
        toSafeString(learner?.fullName).toLowerCase(),
        toSafeString(course?.name).toLowerCase(),
        toSafeString(section?.name || section?.title).toLowerCase(),
      ].join(' ');
      return haystack.includes(search);
    });
  }, [enrollments, appliedFilters, searchTerm]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / entries)), [filteredRows.length, entries]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * entries;
    return filteredRows.slice(start, start + entries);
  }, [filteredRows, page, entries]);

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
  }, [searchTerm, entries, appliedFilters.categoryId, appliedFilters.courseId, appliedFilters.status, appliedFilters.username]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleEnrollSubmit = async (event) => {
    event.preventDefault();
    setSuccess('');
    setError('');
    if (!enrollForm.courseId || !enrollForm.userId) {
      setError('Please select course and learner');
      return;
    }
    try {
      setEnrolling(true);
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: Number(enrollForm.courseId), userId: String(enrollForm.userId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Enroll failed');
      setSuccess('Enroll success');
      setEnrollForm((prev) => ({ ...prev, userId: '' }));
      await loadEnrollments(appliedFilters.courseId || '');
    } catch (err) {
      setError(err?.message || 'Enroll failed');
    } finally {
      setEnrolling(false);
    }
  };

  const handleApplyFilter = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      setAppliedFilters(draftFilters);
      await loadEnrollments(draftFilters.courseId);
    } catch (err) {
      setError(err?.message || 'Unable to apply filters');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (row) => {
    const enrollmentId = Number(row?.id || 0);
    if (!enrollmentId) return;
    try {
      setUpdatingId(String(enrollmentId));
      setError('');
      setSuccess('');
      const res = await fetch('/api/enrollments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: enrollmentId, status: 'APPROVED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Approve failed');

      setEnrollments((prev) => prev.map((item) => (
        Number(item?.id || 0) === enrollmentId
          ? { ...item, status: 'APPROVED' }
          : item
      )));
      setSuccess('Approved successfully');
    } catch (err) {
      setError(err?.message || 'Approve failed');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <AdminLmsDashboard>
      <div className="w-full flex flex-col gap-6 font-outfit">
        <div>
          <h1 className="text-[30px] font-semibold text-[#052143]">Enrollment</h1>
          <div className="text-[13px] text-[#64748B] mt-1">UI ปรับให้ง่าย: เลือกคอร์ส {'>'} ค้นหาผู้ใช้ {'>'} ลงทะเบียน</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StepPill step={1} title="Select Course" detail="Choose category and course." />
          <StepPill step={2} title="Find Learner" detail="Search by username/email/full name." />
          <StepPill step={3} title="Enroll" detail="Click Enroll User to finish." />
        </div>

        <div className="bg-white border border-[#D1E3FB] rounded-[12px] overflow-hidden shadow-sm">
          <div className="bg-[#687EFF] text-white px-5 py-3 text-[18px] font-semibold">Manual Enrollment</div>
          <form onSubmit={handleEnrollSubmit} className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3 flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#334155]">Category</label>
              <select
                value={enrollForm.categoryId}
                onChange={(event) => setEnrollForm((prev) => ({ ...prev, categoryId: event.target.value, courseId: '', userId: '' }))}
                className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
              >
                <option value="">All</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#334155]">Course</label>
              <select
                value={enrollForm.courseId}
                onChange={(event) => setEnrollForm((prev) => ({ ...prev, courseId: event.target.value, userId: '' }))}
                className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                required
              >
                <option value="">Select course</option>
                {enrollCourseOptions.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-5 flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#334155]">Search Learner</label>
              <input
                value={enrollUserSearch}
                onChange={(event) => { setEnrollUserSearch(event.target.value); setEnrollForm((prev) => ({ ...prev, userId: '' })); }}
                placeholder="Type to filter learners"
                className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
              />
            </div>
            <div className="lg:col-span-9 flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#334155]">Learner</label>
              <select
                value={enrollForm.userId}
                onChange={(event) => setEnrollForm((prev) => ({ ...prev, userId: event.target.value }))}
                className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]"
                required
              >
                <option value="">Select learner</option>
                {enrollUserOptions.map((user) => (
                  <option key={user.id} value={user.id}>{user.username} | {user.fullName || '-'} | {user.email || '-'}</option>
                ))}
              </select>
              <div className="text-[12px] text-[#64748B]">Matching users: {enrollUserOptions.length}</div>
            </div>
            <div className="lg:col-span-3 flex items-end gap-2">
              <button type="submit" disabled={loading || enrolling} className="h-[42px] px-5 rounded-[10px] bg-[#687EFF] text-white text-[14px] font-medium hover:bg-[#5A6FE0] disabled:opacity-60">
                {enrolling ? 'Enrolling...' : 'Enroll User'}
              </button>
              <button
                type="button"
                onClick={() => { setEnrollForm(DEFAULT_ENROLL_FORM); setEnrollUserSearch(''); }}
                className="h-[42px] px-5 rounded-[10px] border border-[#D1D9EE] bg-white text-[#334155] text-[14px] font-medium hover:bg-[#F8FAFF]"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {error && <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}
        {success && <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">{success}</div>}

        <div className="bg-white border border-[#D1E3FB] rounded-[12px] overflow-hidden shadow-sm">
          <div className="bg-[#EEF1FF] px-5 py-3 border-b border-[#E6ECFF]">
            <div className="text-[16px] font-semibold text-[#1E293B]">Enrollment List</div>
          </div>

          <form onSubmit={handleApplyFilter} className="p-5 border-b border-[#E6ECFF]">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <select value={draftFilters.categoryId} onChange={(event) => setDraftFilters((prev) => ({ ...prev, categoryId: event.target.value, courseId: '' }))} className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]">
                <option value="">All Categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select value={draftFilters.courseId} onChange={(event) => setDraftFilters((prev) => ({ ...prev, courseId: event.target.value }))} className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]">
                <option value="">All Courses</option>
                {filterCourseOptions.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
              <select value={draftFilters.status} onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value }))} className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]">
                {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
              <input value={draftFilters.username} onChange={(event) => setDraftFilters((prev) => ({ ...prev, username: event.target.value }))} placeholder="Username filter" className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]" />
              <div className="flex items-center gap-2">
                <button type="submit" disabled={submitting} className="h-[42px] px-5 rounded-[10px] bg-[#687EFF] text-white text-[14px] font-medium hover:bg-[#5A6FE0] disabled:opacity-60">Apply</button>
                <button type="button" onClick={() => { setDraftFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); setSearchTerm(''); loadEnrollments(''); }} className="h-[42px] px-5 rounded-[10px] border border-[#D1D9EE] bg-white text-[#334155] text-[14px] font-medium hover:bg-[#F8FAFF]">Reset</button>
              </div>
            </div>
          </form>

          <div className="p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-[14px] text-[#64748B]">
                <select value={entries} onChange={(event) => setEntries(Number(event.target.value))} className="h-[38px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>records</span>
              </div>
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search in result" className="w-full lg:w-[340px] h-[38px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]" />
            </div>
            <div className="overflow-x-auto border border-[#E2E8F0] rounded-[10px]">
              <table className="w-full min-w-[1040px] text-left text-[13px]">
                <thead className="bg-[#EEF1FF] text-[#1E293B] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">No.</th>
                    <th className="px-3 py-2 font-semibold">Action</th>
                    <th className="px-3 py-2 font-semibold">Username</th>
                    <th className="px-3 py-2 font-semibold">Full Name</th>
                    <th className="px-3 py-2 font-semibold">Course</th>
                    <th className="px-3 py-2 font-semibold">Section</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Progress</th>
                    <th className="px-3 py-2 font-semibold">Enrolled At</th>
                  </tr>
                </thead>
                <tbody className="text-[#334155]">
                  {loading && <tr><td colSpan={9} className="px-3 py-8 text-center text-[#64748B]">Loading enrollment data...</td></tr>}
                  {!loading && pagedRows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-[#64748B]">No enrollment data found</td></tr>}
                  {!loading && pagedRows.map((row, index) => {
                    const learner = row?.learner || {};
                    const course = row?.course || {};
                    const section = row?.section || {};
                    const isPending = toSafeString(row?.status).toUpperCase() === 'PENDING';
                    const isUpdating = String(updatingId) === String(row?.id || '');
                    return (
                      <tr key={row.id} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                        <td className="px-3 py-2">{(page - 1) * entries + index + 1}</td>
                        <td className="px-3 py-2">
                          {isPending ? (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleApprove(row)}
                              className="inline-flex items-center rounded-[7px] border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {isUpdating ? 'Approving...' : 'Approve'}
                            </button>
                          ) : (
                            <span className="inline-flex items-center rounded-[7px] border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{learner?.username || learner?.email || '-'}</td>
                        <td className="px-3 py-2">{learner?.fullName || '-'}</td>
                        <td className="px-3 py-2">{course?.name || '-'}</td>
                        <td className="px-3 py-2">{section?.name || section?.title || '-'}</td>
                        <td className="px-3 py-2"><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(row?.status)}`}>{toSafeString(row?.status).toUpperCase() || '-'}</span></td>
                        <td className="px-3 py-2">{Number(row?.progress || 0)}%</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row?.enrolledAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-[13px] text-[#64748B]">
                Showing {pagedRows.length} of {filteredRows.length} entries | Page {page} of {totalPages}
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
      </div>
    </AdminLmsDashboard>
  );
}
