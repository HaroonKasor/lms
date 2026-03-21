'use client';

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

const DEFAULT_FORM = { categoryId: '', courseId: '', status: 'APPROVED' };
const BATCH_STATUS_OPTIONS = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'LEARNING', label: 'Learning' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const KEY_HEADERS = new Set(['username', 'user', 'userid', 'user_id', 'email', 'mail']);
const toSafeString = (value) => String(value || '').trim();

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[-.()]/g, '');
}

function getPageNumbers(page, totalPages, windowSize = 5) {
  if (totalPages <= windowSize) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
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

function downloadTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['username'],
    ['learner1'],
    ['learner2'],
    ['user@example.com'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BatchEnrollment');
  XLSX.writeFile(workbook, 'batch-enrollment-template.xlsx');
}

export default function BatchEnrollmentPage() {
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [parseInfo, setParseInfo] = useState({ totalRows: 0, validRows: 0, duplicateRows: 0, usedColumn: '' });
  const [batchResult, setBatchResult] = useState(null);
  const [previewEntries, setPreviewEntries] = useState(20);
  const [previewPage, setPreviewPage] = useState(1);
  const [resultEntries, setResultEntries] = useState(10);
  const [resultPage, setResultPage] = useState(1);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [categoryRes, courseRes] = await Promise.all([
          fetch('/api/categories', { cache: 'no-store' }),
          fetch('/api/courses', { cache: 'no-store' }),
        ]);
        if (!categoryRes.ok || !courseRes.ok) throw new Error('Failed to load setup data');
        const [categoryData, courseData] = await Promise.all([categoryRes.json(), courseRes.json()]);
        if (!active) return;
        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setCourses(Array.isArray(courseData) ? courseData : []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Unable to load form data');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filteredCourses = useMemo(() => {
    if (!form.categoryId) return courses;
    return courses.filter((course) => String(course?.categoryId || '') === String(form.categoryId));
  }, [courses, form.categoryId]);

  const parseRawRows = (rawRows, usedColumnLabel) => {
    const trimmedRows = rawRows.map((value) => toSafeString(value)).filter(Boolean);
    const seen = new Set();
    let duplicateRows = 0;
    const uniqueRows = [];
    for (const value of trimmedRows) {
      const key = value.toLowerCase();
      if (seen.has(key)) { duplicateRows += 1; continue; }
      seen.add(key);
      uniqueRows.push(value);
    }
    setParsedRows(uniqueRows);
    setParseInfo({
      totalRows: trimmedRows.length,
      validRows: uniqueRows.length,
      duplicateRows,
      usedColumn: usedColumnLabel,
    });
  };

  const parseExcelFile = async (file) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) throw new Error('No sheet found in file');

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    if (!Array.isArray(matrix) || matrix.length === 0) throw new Error('No data found in file');

    const firstRow = Array.isArray(matrix[0]) ? matrix[0] : [];
    const normalizedHeaders = firstRow.map(normalizeHeader);
    const keyColIndex = normalizedHeaders.findIndex((header) => KEY_HEADERS.has(header));
    const hasKnownHeader = keyColIndex >= 0;
    const colIndex = hasKnownHeader ? keyColIndex : 0;
    const startRow = hasKnownHeader ? 1 : 0;
    const extracted = matrix.slice(startRow).map((row) => toSafeString(Array.isArray(row) ? row[colIndex] : ''));

    parseRawRows(extracted, hasKnownHeader ? String(firstRow[colIndex] || '').trim() || `Column ${colIndex + 1}` : `Column ${colIndex + 1}`);
  };

  const parseManualInput = () => {
    const lines = manualInput
      .split(/\r?\n/)
      .map((line) => toSafeString(line))
      .filter(Boolean);
    if (lines.length === 0) {
      setError('Please input at least one username/email');
      return;
    }
    setFileName('manual-input.txt');
    parseRawRows(lines, 'Manual Input');
    setError('');
    setSuccess('Manual list parsed successfully');
  };

  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    setError('');
    setSuccess('');
    setBatchResult(null);
    setParsedRows([]);
    setParseInfo({ totalRows: 0, validRows: 0, duplicateRows: 0, usedColumn: '' });

    if (!file) { setFileName(''); return; }
    setFileName(file.name);
    try {
      await parseExcelFile(file);
      setSuccess('File parsed successfully');
    } catch (err) {
      setParsedRows([]);
      setError(err?.message || 'Cannot parse file');
    }
  };

  const submitBatchEnrollment = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setBatchResult(null);

    if (!form.courseId) { setError('Please select course'); return; }
    if (parsedRows.length === 0) { setError('Please upload/parse file first'); return; }

    try {
      setSubmitting(true);
      const res = await fetch('/api/enrollments/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: Number(form.courseId), status: form.status, userKeys: parsedRows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Batch enrollment failed');
      setBatchResult(data);
      const s = data?.summary || {};
      setSuccess(`Completed: ${s.successCount || 0} success, ${s.failedCount || 0} failed, ${s.skippedCount || 0} skipped`);
    } catch (err) {
      setError(err?.message || 'Batch enrollment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setFileName('');
    setManualInput('');
    setParsedRows([]);
    setParseInfo({ totalRows: 0, validRows: 0, duplicateRows: 0, usedColumn: '' });
    setBatchResult(null);
    setError('');
    setSuccess('');
  };

  const previewTotalPages = useMemo(() => Math.max(1, Math.ceil(parsedRows.length / previewEntries)), [parsedRows.length, previewEntries]);
  const previewRows = useMemo(() => {
    const start = (previewPage - 1) * previewEntries;
    return parsedRows.slice(start, start + previewEntries);
  }, [parsedRows, previewPage, previewEntries]);
  const previewPageNumbers = useMemo(() => getPageNumbers(previewPage, previewTotalPages), [previewPage, previewTotalPages]);

  const resultRows = useMemo(() => (Array.isArray(batchResult?.results) ? batchResult.results : []), [batchResult]);
  const resultTotalPages = useMemo(() => Math.max(1, Math.ceil(resultRows.length / resultEntries)), [resultRows.length, resultEntries]);
  const pagedResultRows = useMemo(() => {
    const start = (resultPage - 1) * resultEntries;
    return resultRows.slice(start, start + resultEntries);
  }, [resultRows, resultPage, resultEntries]);
  const resultPageNumbers = useMemo(() => getPageNumbers(resultPage, resultTotalPages), [resultPage, resultTotalPages]);

  React.useEffect(() => {
    setPreviewPage(1);
  }, [parsedRows, previewEntries]);

  React.useEffect(() => {
    if (previewPage > previewTotalPages) setPreviewPage(previewTotalPages);
  }, [previewPage, previewTotalPages]);

  React.useEffect(() => {
    setResultPage(1);
  }, [batchResult, resultEntries]);

  React.useEffect(() => {
    if (resultPage > resultTotalPages) setResultPage(resultTotalPages);
  }, [resultPage, resultTotalPages]);

  return (
    <AdminLmsDashboard>
      <div className="w-full flex flex-col gap-6 font-outfit">
        <div>
          <h1 className="text-[30px] font-semibold text-[#052143]">Batch Enrollment</h1>
          <div className="text-[13px] text-[#64748B] mt-1">UI ปรับให้ง่าย: เลือกคอร์ส {'>'} ใส่รายชื่อ {'>'} ยืนยันลงทะเบียนกลุ่ม</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StepPill step={1} title="Select Course" detail="Choose category, course and status." />
          <StepPill step={2} title="Upload or Paste" detail="Use Excel/CSV file or paste list." />
          <StepPill step={3} title="Submit Batch" detail="Review preview then click Submit." />
        </div>

        <div className="bg-white border border-[#D1E3FB] rounded-[12px] overflow-hidden shadow-sm">
          <div className="bg-[#687EFF] text-white px-5 py-3 flex items-center justify-between gap-3">
            <div className="text-[18px] font-semibold">Group Enrollment</div>
            <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] border border-white/60 text-white text-[12px] hover:bg-white/15 transition-colors">Download Template</button>
          </div>

          <form onSubmit={submitBatchEnrollment} className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <select value={form.categoryId} onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value, courseId: '' }))} className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]" disabled={loading || submitting}>
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select value={form.courseId} onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))} className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]" disabled={loading || submitting} required>
              <option value="">Select course</option>
              {filteredCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="h-[42px] rounded-[10px] border border-[#D1D9EE] px-3 text-[14px] outline-none focus:border-[#687EFF]" disabled={loading || submitting}>
              {BATCH_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="w-full border border-dashed border-[#687EFF] bg-[#F6F8FF] rounded-[12px] p-4 cursor-pointer block hover:bg-[#EEF1FF] transition-colors">
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} disabled={loading || submitting} />
                <div className="text-[14px] text-[#475569]">{fileName ? `Selected: ${fileName}` : 'Click to upload .xls .xlsx .csv'}</div>
                <div className="text-[12px] text-[#64748B] mt-1">Column recommended: username / email / user_id</div>
              </label>
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="text-[13px] font-medium text-[#334155] mb-1 block">Or paste usernames/emails (one per line)</label>
              <textarea value={manualInput} onChange={(event) => setManualInput(event.target.value)} rows={4} placeholder="learner01&#10;learner02&#10;user@example.com" className="w-full rounded-[10px] border border-[#D1D9EE] px-3 py-2 text-[14px] outline-none focus:border-[#687EFF]" />
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={parseManualInput} className="h-[38px] px-4 rounded-[10px] border border-[#687EFF] text-[#687EFF] bg-white text-[13px] font-medium hover:bg-[#EEF1FF]">Parse Manual List</button>
              </div>
            </div>

            <div className="md:col-span-2 xl:col-span-3 flex items-center gap-2">
              <button type="submit" disabled={loading || submitting || parsedRows.length === 0} className="h-[42px] px-5 rounded-[10px] bg-[#687EFF] text-white text-[14px] font-medium hover:bg-[#5A6FE0] disabled:opacity-60">{submitting ? 'Submitting...' : 'Submit Batch Enrollment'}</button>
              <button type="button" onClick={resetForm} disabled={loading || submitting} className="h-[42px] px-5 rounded-[10px] border border-[#D1D9EE] bg-white text-[#334155] text-[14px] font-medium hover:bg-[#F8FAFF]">Reset</button>
            </div>
          </form>
        </div>

        {error && <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}
        {success && <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">{success}</div>}

        <div className="bg-white border border-[#D1E3FB] rounded-[12px] p-5 shadow-sm">
          <div className="text-[16px] font-semibold text-[#1E293B] mb-3">Preview Before Submit</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-[10px] border border-[#E6ECFF] bg-[#F8FAFF] p-3"><div className="text-[11px] text-[#64748B]">Total Rows</div><div className="text-[18px] font-semibold text-[#052143]">{parseInfo.totalRows}</div></div>
            <div className="rounded-[10px] border border-[#E6ECFF] bg-[#F8FAFF] p-3"><div className="text-[11px] text-[#64748B]">Valid Users</div><div className="text-[18px] font-semibold text-[#052143]">{parseInfo.validRows}</div></div>
            <div className="rounded-[10px] border border-[#E6ECFF] bg-[#F8FAFF] p-3"><div className="text-[11px] text-[#64748B]">Duplicates</div><div className="text-[18px] font-semibold text-[#052143]">{parseInfo.duplicateRows}</div></div>
            <div className="rounded-[10px] border border-[#E6ECFF] bg-[#F8FAFF] p-3"><div className="text-[11px] text-[#64748B]">Source</div><div className="text-[14px] font-semibold text-[#052143]">{parseInfo.usedColumn || '-'}</div></div>
          </div>

          <div className="overflow-x-auto border border-[#E2E8F0] rounded-[10px]">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <thead className="bg-[#EEF1FF] text-[#1E293B] border-b border-[#E2E8F0]"><tr><th className="px-3 py-2 font-semibold">No.</th><th className="px-3 py-2 font-semibold">User Key</th></tr></thead>
              <tbody>
                {previewRows.length === 0 && <tr><td colSpan={2} className="px-3 py-8 text-center text-[#64748B]">No parsed data yet</td></tr>}
                {previewRows.map((row, index) => <tr key={`${row}-${index}`} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]"><td className="px-3 py-2">{(previewPage - 1) * previewEntries + index + 1}</td><td className="px-3 py-2">{row}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
              <select value={previewEntries} onChange={(event) => setPreviewEntries(Number(event.target.value))} className="h-[34px] rounded-[8px] border border-[#D1D9EE] px-2 text-[13px] outline-none focus:border-[#687EFF]">
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>rows per page</span>
              <span>| Showing {previewRows.length} of {parsedRows.length}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <button type="button" onClick={() => setPreviewPage((prev) => Math.max(1, prev - 1))} disabled={previewPage <= 1} className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] disabled:opacity-50">Prev</button>
              {previewPageNumbers.map((n) => (
                <button key={n} type="button" onClick={() => setPreviewPage(n)} className={`h-[34px] min-w-[34px] px-2 rounded-[8px] border text-[13px] font-medium ${n === previewPage ? 'border-[#687EFF] bg-[#687EFF] text-white' : 'border-[#D1D9EE] bg-white text-[#334155] hover:bg-[#F8FAFF]'}`}>{n}</button>
              ))}
              <button type="button" onClick={() => setPreviewPage((prev) => Math.min(previewTotalPages, prev + 1))} disabled={previewPage >= previewTotalPages} className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>

        {batchResult && (
          <div className="bg-white border border-[#D1E3FB] rounded-[12px] p-5 shadow-sm">
            <div className="text-[16px] font-semibold text-[#1E293B] mb-3">Batch Result</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-[10px] border border-[#E6ECFF] bg-[#F8FAFF] p-3"><div className="text-[11px] text-[#64748B]">Total Rows</div><div className="text-[18px] font-semibold text-[#052143]">{batchResult?.summary?.totalRows || 0}</div></div>
              <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-3"><div className="text-[11px] text-emerald-700">Success</div><div className="text-[18px] font-semibold text-emerald-700">{batchResult?.summary?.successCount || 0}</div></div>
              <div className="rounded-[10px] border border-rose-200 bg-rose-50 p-3"><div className="text-[11px] text-rose-700">Failed</div><div className="text-[18px] font-semibold text-rose-700">{batchResult?.summary?.failedCount || 0}</div></div>
              <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3"><div className="text-[11px] text-amber-700">Skipped</div><div className="text-[18px] font-semibold text-amber-700">{batchResult?.summary?.skippedCount || 0}</div></div>
            </div>

            <div className="overflow-x-auto border border-[#E2E8F0] rounded-[10px]">
              <table className="w-full min-w-[940px] text-left text-[13px]">
                <thead className="bg-[#EEF1FF] text-[#1E293B] border-b border-[#E2E8F0]"><tr><th className="px-3 py-2 font-semibold">Row</th><th className="px-3 py-2 font-semibold">Input</th><th className="px-3 py-2 font-semibold">Username</th><th className="px-3 py-2 font-semibold">Name</th><th className="px-3 py-2 font-semibold">Result</th><th className="px-3 py-2 font-semibold">Message</th></tr></thead>
                <tbody>
                  {pagedResultRows.map((row, index) => (
                    <tr key={`${row?.rowNo || index}-${index}`} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                      <td className="px-3 py-2">{row?.rowNo || '-'}</td>
                      <td className="px-3 py-2">{row?.input || '-'}</td>
                      <td className="px-3 py-2">{row?.username || '-'}</td>
                      <td className="px-3 py-2">{row?.fullName || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${row?.success ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                          {row?.success ? (row?.skipped ? 'SKIPPED' : 'SUCCESS') : 'FAILED'}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row?.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
                <select value={resultEntries} onChange={(event) => setResultEntries(Number(event.target.value))} className="h-[34px] rounded-[8px] border border-[#D1D9EE] px-2 text-[13px] outline-none focus:border-[#687EFF]">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>rows per page</span>
                <span>| Showing {pagedResultRows.length} of {resultRows.length}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button type="button" onClick={() => setResultPage((prev) => Math.max(1, prev - 1))} disabled={resultPage <= 1} className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] disabled:opacity-50">Prev</button>
                {resultPageNumbers.map((n) => (
                  <button key={n} type="button" onClick={() => setResultPage(n)} className={`h-[34px] min-w-[34px] px-2 rounded-[8px] border text-[13px] font-medium ${n === resultPage ? 'border-[#687EFF] bg-[#687EFF] text-white' : 'border-[#D1D9EE] bg-white text-[#334155] hover:bg-[#F8FAFF]'}`}>{n}</button>
                ))}
                <button type="button" onClick={() => setResultPage((prev) => Math.min(resultTotalPages, prev + 1))} disabled={resultPage >= resultTotalPages} className="h-[34px] px-3 rounded-[8px] border border-[#D1D9EE] text-[13px] text-[#334155] disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLmsDashboard>
  );
}
