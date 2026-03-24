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
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function downloadTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([['username'], ['learner1'], ['learner2'], ['user@example.com']]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BatchEnrollment');
  XLSX.writeFile(workbook, 'batch-enrollment-template.xlsx');
}

function StatMiniCard({ label, value, color, bg, border }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="text-[12px] font-medium" style={{ color }}>{label}</div>
      <div className="text-[26px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function Pagination({ page, totalPages, pageNumbers, setPage }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
        className="h-[32px] px-3 rounded-lg border border-[#DDE4FF] text-[12px] text-[#334155] hover:bg-[#F0EDFF] disabled:opacity-40 transition">
        ← ก่อนหน้า
      </button>
      {pageNumbers.map((n) => (
        <button key={n} type="button" onClick={() => setPage(n)}
          className="h-[32px] min-w-[32px] px-2 rounded-lg border text-[12px] font-semibold transition-all"
          style={n === page
            ? { background: '#687EFF', borderColor: '#687EFF', color: '#fff', boxShadow: '0 2px 8px #687EFF44' }
            : { background: '#fff', borderColor: '#DDE4FF', color: '#64748B' }}>
          {n}
        </button>
      ))}
      <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
        className="h-[32px] px-3 rounded-lg border border-[#DDE4FF] text-[12px] text-[#334155] hover:bg-[#F0EDFF] disabled:opacity-40 transition">
        ถัดไป →
      </button>
    </div>
  );
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
        setLoading(true); setError('');
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
    return courses.filter((c) => String(c?.categoryId || '') === String(form.categoryId));
  }, [courses, form.categoryId]);

  const parseRawRows = (rawRows, usedColumnLabel) => {
    const trimmedRows = rawRows.map(toSafeString).filter(Boolean);
    const seen = new Set(); let duplicateRows = 0; const uniqueRows = [];
    for (const v of trimmedRows) {
      const key = v.toLowerCase();
      if (seen.has(key)) { duplicateRows += 1; continue; }
      seen.add(key); uniqueRows.push(v);
    }
    setParsedRows(uniqueRows);
    setParseInfo({ totalRows: trimmedRows.length, validRows: uniqueRows.length, duplicateRows, usedColumn: usedColumnLabel });
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
    const keyColIndex = normalizedHeaders.findIndex((h) => KEY_HEADERS.has(h));
    const hasKnownHeader = keyColIndex >= 0;
    const colIndex = hasKnownHeader ? keyColIndex : 0;
    const startRow = hasKnownHeader ? 1 : 0;
    const extracted = matrix.slice(startRow).map((row) => toSafeString(Array.isArray(row) ? row[colIndex] : ''));
    parseRawRows(extracted, hasKnownHeader ? String(firstRow[colIndex] || '').trim() || `Column ${colIndex + 1}` : `Column ${colIndex + 1}`);
  };

  const parseManualInput = () => {
    const lines = manualInput.split(/\r?\n/).map(toSafeString).filter(Boolean);
    if (lines.length === 0) { setError('กรุณาใส่อย่างน้อย 1 username/email'); return; }
    setFileName('manual-input.txt');
    parseRawRows(lines, 'Manual Input');
    setError(''); setSuccess('พาร์สรายชื่อสำเร็จ!');
  };

  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    setError(''); setSuccess(''); setBatchResult(null); setParsedRows([]);
    setParseInfo({ totalRows: 0, validRows: 0, duplicateRows: 0, usedColumn: '' });
    if (!file) { setFileName(''); return; }
    setFileName(file.name);
    try { await parseExcelFile(file); setSuccess('พาร์สไฟล์สำเร็จ!'); }
    catch (err) { setParsedRows([]); setError(err?.message || 'Cannot parse file'); }
  };

  const submitBatchEnrollment = async (event) => {
    event.preventDefault(); setError(''); setSuccess(''); setBatchResult(null);
    if (!form.courseId) { setError('กรุณาเลือกคอร์สเรียน'); return; }
    if (parsedRows.length === 0) { setError('กรุณาอัปโหลดหรือพาร์สไฟล์ก่อน'); return; }
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
      setSuccess(`เสร็จสิ้น: สำเร็จ ${s.successCount || 0} | ล้มเหลว ${s.failedCount || 0} | ข้ามไป ${s.skippedCount || 0}`);
    } catch (err) {
      setError(err?.message || 'Batch enrollment failed');
    } finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM); setFileName(''); setManualInput(''); setParsedRows([]);
    setParseInfo({ totalRows: 0, validRows: 0, duplicateRows: 0, usedColumn: '' });
    setBatchResult(null); setError(''); setSuccess('');
  };

  const previewTotalPages = useMemo(() => Math.max(1, Math.ceil(parsedRows.length / previewEntries)), [parsedRows.length, previewEntries]);
  const previewRows = useMemo(() => { const s = (previewPage - 1) * previewEntries; return parsedRows.slice(s, s + previewEntries); }, [parsedRows, previewPage, previewEntries]);
  const previewPageNumbers = useMemo(() => getPageNumbers(previewPage, previewTotalPages), [previewPage, previewTotalPages]);

  const resultRows = useMemo(() => (Array.isArray(batchResult?.results) ? batchResult.results : []), [batchResult]);
  const resultTotalPages = useMemo(() => Math.max(1, Math.ceil(resultRows.length / resultEntries)), [resultRows.length, resultEntries]);
  const pagedResultRows = useMemo(() => { const s = (resultPage - 1) * resultEntries; return resultRows.slice(s, s + resultEntries); }, [resultRows, resultPage, resultEntries]);
  const resultPageNumbers = useMemo(() => getPageNumbers(resultPage, resultTotalPages), [resultPage, resultTotalPages]);

  React.useEffect(() => { setPreviewPage(1); }, [parsedRows, previewEntries]);
  React.useEffect(() => { if (previewPage > previewTotalPages) setPreviewPage(previewTotalPages); }, [previewPage, previewTotalPages]);
  React.useEffect(() => { setResultPage(1); }, [batchResult, resultEntries]);
  React.useEffect(() => { if (resultPage > resultTotalPages) setResultPage(resultTotalPages); }, [resultPage, resultTotalPages]);

  const inputCls = 'h-[42px] w-full rounded-xl border border-[#DDE4FF] bg-white px-3 text-[14px] text-[#1E293B] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 transition';

  return (
    <AdminLmsDashboard>
      <div className="w-full flex flex-col gap-6" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B]">ลงทะเบียนกลุ่ม (Batch Enrollment)</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">เลือกคอร์ส → อัปโหลด/วางรายชื่อ → ยืนยันลงทะเบียนกลุ่ม</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#687EFF] flex items-center justify-center shadow-md shadow-[#687EFF]/30">
            <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>

        {/* Step Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: 1, title: 'เลือกคอร์สเรียน', detail: 'เลือกหมวดหมู่, คอร์ส และสถานะที่ต้องการตั้ง', icon: <svg width="20" height="20" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
            { step: 2, title: 'อัปโหลดรายชื่อ', detail: 'ใช้ไฟล์ Excel/CSV หรือวาง Username ทีละบรรทัด', icon: <svg width="20" height="20" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
            { step: 3, title: 'ยืนยันลงทะเบียน', detail: 'ตรวจ Preview แล้วกด Submit', icon: <svg width="20" height="20" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
          ].map(({ step, title, detail, icon }) => (
            <div key={step} className="flex items-start gap-4 bg-white rounded-2xl border border-[#EEF1FF] p-4 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F0EDFF' }}>
                {icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-5 h-5 rounded-full bg-[#687EFF] text-white text-[11px] font-bold flex items-center justify-center shrink-0">{step}</span>
                  <span className="text-[14px] font-semibold text-[#1E293B]">{title}</span>
                </div>
                <div className="text-[12px] text-[#64748B]">{detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-[#EEF1FF] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#EEF1FF]" style={{ background: 'linear-gradient(90deg,#687EFF,#8A9CFF)' }}>
            <div className="flex items-center gap-2">
              <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              <span className="text-white font-semibold text-[16px]">ตั้งค่าการลงทะเบียนกลุ่ม</span>
            </div>
            <button type="button" onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/40 text-white text-[12px] font-medium hover:bg-white/20 transition-all">
              ⬇ ดาวน์โหลด Template
            </button>
          </div>

          <form onSubmit={submitBatchEnrollment} className="p-6 flex flex-col gap-6">
            {/* Row 1: selects */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#334155]">หมวดหมู่</label>
                <select value={form.categoryId}
                  onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value, courseId: '' }))}
                  className={inputCls} disabled={loading || submitting}>
                  <option value="">ทั้งหมด</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#334155]">คอร์สเรียน <span className="text-rose-500">*</span></label>
                <select value={form.courseId}
                  onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                  className={inputCls} disabled={loading || submitting} required>
                  <option value="">เลือกคอร์ส</option>
                  {filteredCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#334155]">สถานะที่ตั้ง</label>
                <select value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className={inputCls} disabled={loading || submitting}>
                  {BATCH_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* File upload */}
            <div>
              <label className="text-[13px] font-medium text-[#334155] mb-2 block">อัปโหลดไฟล์ Excel / CSV</label>
              <label className="w-full rounded-2xl border-2 border-dashed border-[#C4B5FD] bg-[#F8F7FF] px-6 py-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#F0EDFF] transition-all group">
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} disabled={loading || submitting} />
                <div className="w-12 h-12 rounded-2xl bg-[#EEF1FF] flex items-center justify-center group-hover:bg-[#E0DAFF] transition">
                  <svg width="24" height="24" fill="none" stroke="#687EFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div className="text-[14px] font-medium text-[#687EFF]">
                  {fileName
                    ? <span className="flex items-center gap-1.5"><svg width="14" height="14" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>{fileName}</span>
                    : 'คลิกเพื่อเลือกไฟล์ .xlsx / .xls / .csv'}
                </div>
                <div className="text-[12px] text-[#94A3B8]">แนะนำให้มี column: username / email / user_id</div>
              </label>
            </div>

            {/* Manual input */}
            <div>
              <label className="text-[13px] font-medium text-[#334155] mb-2 block">หรือวาง Username/Email (1 บรรทัดต่อ 1 คน)</label>
              <textarea value={manualInput} onChange={(e) => setManualInput(e.target.value)} rows={5}
                placeholder={"learner01\nlearner02\nuser@example.com"}
                className="w-full rounded-xl border border-[#DDE4FF] px-4 py-3 text-[14px] text-[#1E293B] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 transition resize-none" />
              <button type="button" onClick={parseManualInput}
                className="mt-2 h-[36px] px-5 rounded-xl border border-[#687EFF] text-[#687EFF] bg-white text-[13px] font-medium hover:bg-[#F0EDFF] transition-all inline-flex items-center gap-1.5">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                พาร์สรายชื่อ Manual
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-[#F1F5F9]">
              <button type="submit" disabled={loading || submitting || parsedRows.length === 0}
                className="h-[42px] px-6 rounded-xl text-white text-[14px] font-semibold disabled:opacity-60 transition-all inline-flex items-center gap-2"
                style={{ background: 'linear-gradient(90deg,#687EFF,#8A9CFF)', boxShadow: '0 4px 14px #687EFF44' }}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    กำลังลงทะเบียน...
                  </span>
                ) : (
                  <><svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> ลงทะเบียนกลุ่ม ({parsedRows.length} คน)</> 
                )}
              </button>
              <button type="button" onClick={resetForm} disabled={loading || submitting}
                className="h-[42px] px-6 rounded-xl border border-[#DDE4FF] text-[14px] text-[#687EFF] font-medium hover:bg-[#F0EDFF] transition-all">
                ล้างทั้งหมด
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

        {/* Preview Card */}
        <div className="bg-white rounded-2xl border border-[#EEF1FF] shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EEF1FF]">
            <svg width="16" height="16" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span className="font-semibold text-[16px] text-[#1E293B]">Preview รายชื่อ</span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <StatMiniCard label="Total Rows" value={parseInfo.totalRows} color="#687EFF" bg="#F0EDFF" border="#C4B5FD" />
              <StatMiniCard label="Valid Users" value={parseInfo.validRows} color="#059669" bg="#ECFDF5" border="#A7F3D0" />
              <StatMiniCard label="Duplicates" value={parseInfo.duplicateRows} color="#D97706" bg="#FFF7E6" border="#FDE68A" />
              <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="text-[12px] font-medium text-[#64748B]">Source Column</div>
                <div className="text-[14px] font-bold text-[#334155] truncate">{parseInfo.usedColumn || '—'}</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#EEF1FF]">
              <table className="w-full min-w-[340px] text-left text-[13px]">
                <thead>
                  <tr className="bg-[#F0EDFF] text-[#687EFF]">
                    <th className="px-4 py-3 font-semibold w-16">#</th>
                    <th className="px-4 py-3 font-semibold">Username / Email</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-10 text-center text-[#94A3B8]">ยังไม่มีข้อมูล — อัปโหลดหรือพาร์สรายชื่อก่อน</td></tr>
                  )}
                  {previewRows.map((row, index) => (
                    <tr key={`${row}-${index}`} className="border-t border-[#F1F5F9] hover:bg-[#FAFBFF] transition-colors">
                      <td className="px-4 py-2.5 text-[#94A3B8]">{(previewPage - 1) * previewEntries + index + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-[#334155]">{row}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
                แสดง
                <select value={previewEntries} onChange={(e) => setPreviewEntries(Number(e.target.value))}
                  className="h-[30px] rounded-lg border border-[#DDE4FF] px-2 text-[12px] outline-none focus:border-[#687EFF]">
                  {[20, 50, 100].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                รายการ | {previewRows.length} / {parsedRows.length}
              </div>
              <Pagination page={previewPage} totalPages={previewTotalPages} pageNumbers={previewPageNumbers} setPage={setPreviewPage} />
            </div>
          </div>
        </div>

        {/* Result Card */}
        {batchResult && (
          <div className="bg-white rounded-2xl border border-[#EEF1FF] shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EEF1FF]">
              <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="font-semibold text-[16px] text-[#1E293B]">ผลลัพธ์การลงทะเบียน</span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <StatMiniCard label="Total Rows" value={batchResult?.summary?.totalRows || 0} color="#687EFF" bg="#F0EDFF" border="#C4B5FD" />
                <StatMiniCard label="Success" value={batchResult?.summary?.successCount || 0} color="#059669" bg="#ECFDF5" border="#A7F3D0" />
                <StatMiniCard label="Failed" value={batchResult?.summary?.failedCount || 0} color="#E11D48" bg="#FFF1F2" border="#FECDD3" />
                <StatMiniCard label="Skipped" value={batchResult?.summary?.skippedCount || 0} color="#D97706" bg="#FFF7E6" border="#FDE68A" />
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#EEF1FF]">
                <table className="w-full min-w-[700px] text-left text-[13px]">
                  <thead>
                    <tr className="bg-[#F0EDFF] text-[#687EFF]">
                      <th className="px-4 py-3 font-semibold">แถว</th>
                      <th className="px-4 py-3 font-semibold">Input</th>
                      <th className="px-4 py-3 font-semibold">Username</th>
                      <th className="px-4 py-3 font-semibold">ชื่อ</th>
                      <th className="px-4 py-3 font-semibold">ผลลัพธ์</th>
                      <th className="px-4 py-3 font-semibold">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedResultRows.map((row, index) => (
                      <tr key={`${row?.rowNo || index}-${index}`} className="border-t border-[#F1F5F9] hover:bg-[#FAFBFF] transition-colors">
                        <td className="px-4 py-2.5 text-[#94A3B8]">{row?.rowNo || '-'}</td>
                        <td className="px-4 py-2.5 text-[#334155]">{row?.input || '-'}</td>
                        <td className="px-4 py-2.5 font-medium text-[#334155]">{row?.username || '-'}</td>
                        <td className="px-4 py-2.5 text-[#64748B]">{row?.fullName || '-'}</td>
                        <td className="px-4 py-2.5">
                          {row?.success ? (
                            row?.skipped
                              ? <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#FFF7E6] text-[#D97706] border border-[#FDE68A]">SKIPPED</span>
                              : <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">SUCCESS</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3]">FAILED</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[#94A3B8]">{row?.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
                  แสดง
                  <select value={resultEntries} onChange={(e) => setResultEntries(Number(e.target.value))}
                    className="h-[30px] rounded-lg border border-[#DDE4FF] px-2 text-[12px] outline-none focus:border-[#687EFF]">
                    {[10, 20, 50, 100].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  รายการ | {pagedResultRows.length} / {resultRows.length}
                </div>
                <Pagination page={resultPage} totalPages={resultTotalPages} pageNumbers={resultPageNumbers} setPage={setResultPage} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLmsDashboard>
  );
}
