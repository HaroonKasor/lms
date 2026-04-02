'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminEntriesControl,
    AdminInlineAlert,
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
import {
    CERTIFICATE_ASPECT_RATIO,
    CERTIFICATE_HOLDER_RATIO,
    CERTIFICATE_LAYOUT,
    CERTIFICATE_SIGNATURE_IMAGE,
    CERTIFICATE_TEMPLATE_IMAGE,
    formatCertificateDate,
} from '@/lib/certificate-layout';

const DEFAULT_FILTERS = {
    categoryId: '',
    courseId: '',
    certificateStatus: 'ALL',
    userStatus: 'ALL',
    fromDate: '',
    toDate: '',
    q: '',
};

function toSafeText(value) {
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

function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toCsv(rows = []) {
    const header = [
        'No',
        'Course Category',
        'Course',
        'Section',
        'Username',
        'First Name',
        'Last Name',
        'User Status',
        'Certificate Status',
        'Certificate No',
        'Issued At',
        'Response By',
    ];
    const body = rows.map((row) => [
        row.no,
        row.categoryName,
        row.courseName,
        row.sectionName,
        row.username,
        row.firstName,
        row.lastName,
        row.userStatusLabel,
        row.certificateStatusLabel,
        row.certificateNo,
        formatDateTime(row.issuedAt),
        row.responseBy,
    ]);
    return [header, ...body].map((line) => line.map(csvEscape).join(',')).join('\n');
}

function statusBadgeClass(status) {
    const key = toSafeText(status).toUpperCase();
    if (key === 'ISSUED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (key === 'REVOKED') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (key === 'EXPIRED') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
}

function learnerBadgeClass(status) {
    const key = toSafeText(status).toUpperCase();
    if (key === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (key === 'LEARNING') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (key === 'FAILED') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (key === 'CANCELLED') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
}

const ACTION_BUTTONS = {
    APPROVE: 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200',
    NOT_APPROVE: 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200',
    REGENERATE: 'bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-200',
    PRINT: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
    VIEW_SCORE: 'bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200',
};

export default function CertificateReportPage() {
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        categories: [],
        courses: [],
        certificateStatuses: [],
        userStatuses: [],
    });
    const [selected, setSelected] = useState(DEFAULT_FILTERS);
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({
        totalRows: 0,
        issued: 0,
        revoked: 0,
        expired: 0,
        pending: 0,
    });
    const [entries, setEntries] = useState(10);
    const [page, setPage] = useState(1);
    const [actionLoadingId, setActionLoadingId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchReport = async (nextSelected = selected) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (nextSelected.categoryId) params.set('categoryId', String(nextSelected.categoryId));
            if (nextSelected.courseId) params.set('courseId', String(nextSelected.courseId));
            if (nextSelected.certificateStatus) params.set('certificateStatus', String(nextSelected.certificateStatus));
            if (nextSelected.userStatus) params.set('userStatus', String(nextSelected.userStatus));
            if (nextSelected.fromDate) params.set('fromDate', String(nextSelected.fromDate));
            if (nextSelected.toDate) params.set('toDate', String(nextSelected.toDate));
            if (nextSelected.q) params.set('q', String(nextSelected.q));

            const res = await fetch(`/api/reports/certificate-report?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Failed to load certificate report');

            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setSummary(data?.summary || { totalRows: 0, issued: 0, revoked: 0, expired: 0, pending: 0 });
            setFilters({
                categories: Array.isArray(data?.filters?.categories) ? data.filters.categories : [],
                courses: Array.isArray(data?.filters?.courses) ? data.filters.courses : [],
                certificateStatuses: Array.isArray(data?.filters?.certificateStatuses) ? data.filters.certificateStatuses : [],
                userStatuses: Array.isArray(data?.filters?.userStatuses) ? data.filters.userStatuses : [],
            });
            setSelected((prev) => ({
                ...prev,
                categoryId: data?.selected?.categoryId ? String(data.selected.categoryId) : '',
                courseId: data?.selected?.courseId ? String(data.selected.courseId) : '',
                certificateStatus: String(data?.selected?.certificateStatus || 'ALL'),
                userStatus: String(data?.selected?.userStatus || 'ALL'),
                fromDate: String(data?.selected?.fromDate || ''),
                toDate: String(data?.selected?.toDate || ''),
                q: String(data?.selected?.q || ''),
            }));
        } catch (err) {
            setError(err?.message || 'Failed to load certificate report');
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport(DEFAULT_FILTERS);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredCourseOptions = useMemo(() => {
        if (!selected.categoryId) return filters.courses;
        return filters.courses.filter((item) => String(item.categoryId || '') === String(selected.categoryId));
    }, [filters.courses, selected.categoryId]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / entries)), [rows.length, entries]);
    const pagedRows = useMemo(() => {
        const start = (page - 1) * entries;
        return rows.slice(start, start + entries);
    }, [rows, page, entries]);
    useEffect(() => {
        setPage(1);
    }, [entries, rows.length]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const handleExport = () => {
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate-report-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const printRowCertificate = (row) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const issuedAt = row?.issuedAt ? new Date(row.issuedAt) : new Date();
        const templateUrl = `${window.location.origin}${CERTIFICATE_TEMPLATE_IMAGE}`;
        const signatureUrl = `${window.location.origin}${CERTIFICATE_SIGNATURE_IMAGE}`;
        const recipient = toSafeText(row.fullName || row.username || '-')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;') || '-';
        const courseName = toSafeText(row.courseName || '-')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;') || '-';
        const certNo = toSafeText(row.certificateNo || '-')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;') || '-';
        printWindow.document.write(`
            <!DOCTYPE html>
            <html><head><title>Certificate</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Noto+Serif+Thai:wght@500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
                @page { size: A4 landscape; margin: 0; }
                html, body { margin: 0; padding: 0; background: #eef2ff; }
                body {
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: 'Noto Sans Thai', 'Outfit', sans-serif;
                    overflow: hidden;
                }
                .viewer {
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 10px;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                .holder {
                    position: relative;
                    width: min(96vw, calc(96vh * ${CERTIFICATE_HOLDER_RATIO}));
                    aspect-ratio: ${CERTIFICATE_ASPECT_RATIO};
                }
                .cert {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    container-type: inline-size;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                .template {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: fill;
                }
                .field {
                    position: absolute;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: #22304a;
                    text-rendering: optimizeLegibility;
                    -webkit-font-smoothing: antialiased;
                }
                .name {
                    left: ${CERTIFICATE_LAYOUT.recipient.left};
                    top: ${CERTIFICATE_LAYOUT.recipient.top};
                    width: ${CERTIFICATE_LAYOUT.recipient.width};
                    min-height: 132px;
                    font-family: 'Noto Serif Thai', 'Noto Sans Thai', serif;
                    font-size: ${CERTIFICATE_LAYOUT.recipient.fontSizePrint};
                    line-height: 1.12;
                    font-weight: 600;
                    color: #2e3e76;
                    letter-spacing: 0.2px;
                    word-break: break-word;
                }
                .course {
                    left: ${CERTIFICATE_LAYOUT.course.left};
                    top: ${CERTIFICATE_LAYOUT.course.top};
                    width: ${CERTIFICATE_LAYOUT.course.width};
                    min-height: 120px;
                    font-family: 'Noto Serif Thai', 'Noto Sans Thai', serif;
                    font-size: ${CERTIFICATE_LAYOUT.course.fontSizePrint};
                    line-height: 1.18;
                    font-weight: 600;
                    color: #2e3e76;
                    word-break: break-word;
                }
                .date {
                    left: ${CERTIFICATE_LAYOUT.date.left};
                    top: ${CERTIFICATE_LAYOUT.date.top};
                    width: ${CERTIFICATE_LAYOUT.date.width};
                    font-size: ${CERTIFICATE_LAYOUT.date.fontSizePrint};
                    line-height: 1.18;
                    font-weight: 500;
                    color: #5a6781;
                }
                .signature {
                    position: absolute;
                    left: ${CERTIFICATE_LAYOUT.signature.left};
                    top: ${CERTIFICATE_LAYOUT.signature.top};
                    transform: translate(-50%, -50%);
                    width: ${CERTIFICATE_LAYOUT.signature.width};
                    max-height: ${CERTIFICATE_LAYOUT.signature.maxHeight};
                    object-fit: contain;
                }
                .no {
                    position: absolute;
                    left: ${CERTIFICATE_LAYOUT.certificateNo.left};
                    bottom: ${CERTIFICATE_LAYOUT.certificateNo.bottom};
                    font-size: ${CERTIFICATE_LAYOUT.certificateNo.fontSizePrint};
                    letter-spacing: 0.6px;
                    color: #5a6781;
                    font-family: 'Noto Sans Thai', 'Outfit', sans-serif;
                }
                @media print {
                    html, body { background: white; overflow: visible; }
                    .viewer { width: auto; height: auto; overflow: visible; padding: 0; }
                    .holder {
                        width: 297mm !important;
                        height: 210mm !important;
                        aspect-ratio: auto;
                    }
                    .cert { box-shadow: none; }
                }
            </style>
            </head><body>
              <div class="viewer">
                <div class="holder">
                  <div class="cert">
                    <img class="template" src="${templateUrl}" alt="Certificate template" />
                    <div class="field name">${recipient}</div>
                    <div class="field course">${courseName}</div>
                    <div class="field date">${formatCertificateDate(issuedAt)}</div>
                    <img class="signature" src="${signatureUrl}" alt="Signature" />
                    <div class="no">No. ${certNo}</div>
                  </div>
                </div>
              </div>
              <script>
                (function () {
                  if (document.fonts && document.fonts.ready) {
                    document.fonts.ready.then(function () {
                      setTimeout(function () { window.print(); }, 350);
                    });
                  } else {
                    setTimeout(function () { window.print(); }, 350);
                  }
                })();
              </script>
            </body></html>
        `);
        printWindow.document.close();
    };

    const runAction = async (row, action) => {
        setActionLoadingId(`${row.enrollmentId}:${action}`);
        setError('');
        setSuccess('');
        try {
            if (action === 'PRINT') {
                printRowCertificate(row);
                return;
            }
            if (action === 'VIEW_SCORE') {
                window.location.href = '/admin-dashboard/report/examination-score';
                return;
            }

            const res = await fetch('/api/reports/certificate-report', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enrollmentId: row.enrollmentId,
                    action,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Action failed');
            setSuccess(`Action ${action} completed`);
            await fetchReport(selected);
        } catch (err) {
            setError(err?.message || 'Action failed');
        } finally {
            setActionLoadingId('');
        }
    };

    return (
        <AdminShell>
            <div className="w-full flex flex-col gap-6 font-outfit">
                <AdminPageHeader
                    title="Report: Certificate Report"
                    description="Review certificate issuance, approval actions, and exportable certificate records."
                />

                <AdminCard title="Certificate Report" contentClassName="space-y-6 mt-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                            {filteredCourseOptions.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>

                        <select
                            value={selected.certificateStatus}
                            onChange={(e) => setSelected((prev) => ({ ...prev, certificateStatus: e.target.value }))}
                            className={adminSelectClass}
                        >
                            {filters.certificateStatuses.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>

                        <select
                            value={selected.userStatus}
                            onChange={(e) => setSelected((prev) => ({ ...prev, userStatus: e.target.value }))}
                            className={adminSelectClass}
                        >
                            {filters.userStatuses.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>

                        <input
                            type="date"
                            value={selected.fromDate}
                            onChange={(e) => setSelected((prev) => ({ ...prev, fromDate: e.target.value }))}
                            className={adminSelectClass}
                        />
                        <input
                            type="date"
                            value={selected.toDate}
                            onChange={(e) => setSelected((prev) => ({ ...prev, toDate: e.target.value }))}
                            className={adminSelectClass}
                        />
                    </div>
                    <AdminSearchInput
                        value={selected.q}
                        onChange={(e) => setSelected((prev) => ({ ...prev, q: e.target.value }))}
                        placeholder="Search user / course / cert no"
                        className="w-full lg:w-[360px]"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => fetchReport(selected)}
                            className={adminPrimaryButtonClass}
                        >
                            {loading ? 'Loading...' : 'View'}
                        </button>
                        <button
                            onClick={handleExport}
                            className={adminSecondaryButtonClass}
                        >
                            Export
                        </button>
                        <button
                            onClick={() => {
                                setSelected(DEFAULT_FILTERS);
                                fetchReport(DEFAULT_FILTERS);
                            }}
                            className={adminSecondaryButtonClass}
                        >
                            Reset
                        </button>
                    </div>
                </AdminCard>

                {(error || success) && (
                    <div className="flex flex-col gap-2">
                        {error && <AdminInlineAlert tone="error">{error}</AdminInlineAlert>}
                        {success && <AdminInlineAlert tone="success">{success}</AdminInlineAlert>}
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="rounded-[10px] border border-[#E6ECFF] bg-white p-3"><div className="text-[11px] text-[#64748B]">Total</div><div className="text-[20px] font-semibold text-[#052143]">{summary.totalRows}</div></div>
                    <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-3"><div className="text-[11px] text-emerald-700">Issued</div><div className="text-[20px] font-semibold text-emerald-700">{summary.issued}</div></div>
                    <div className="rounded-[10px] border border-rose-200 bg-rose-50 p-3"><div className="text-[11px] text-rose-700">Revoked</div><div className="text-[20px] font-semibold text-rose-700">{summary.revoked}</div></div>
                    <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3"><div className="text-[11px] text-amber-700">Expired</div><div className="text-[20px] font-semibold text-amber-700">{summary.expired}</div></div>
                    <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] text-slate-700">Pending</div><div className="text-[20px] font-semibold text-slate-700">{summary.pending}</div></div>
                </div>

                <AdminCard title="Certificate Records" headerTone="secondary">
                    <AdminToolbar left={<AdminEntriesControl value={entries} onChange={setEntries} label="records" />} />

                    <AdminTableWrap>
                        <AdminTable className="min-w-[1320px] text-[12px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[50px]">No.</AdminTh>
                                    <AdminTh className="w-[16%]">Course</AdminTh>
                                    <AdminTh className="w-[10%]">Section</AdminTh>
                                    <AdminTh className="w-[14%]">Username</AdminTh>
                                    <AdminTh className="w-[8%]">First Name</AdminTh>
                                    <AdminTh className="w-[8%]">Last Name</AdminTh>
                                    <AdminTh className="w-[8%]">User Status</AdminTh>
                                    <AdminTh className="w-[8%]">Certificate</AdminTh>
                                    <AdminTh className="w-[10%]">Certificate No</AdminTh>
                                    <AdminTh className="w-[9%]">Issued At</AdminTh>
                                    <AdminTh className="w-[9%]">Response By</AdminTh>
                                    <AdminTh className="w-[12%]">Action</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody className="text-[#334155]">
                                {loading && (
                                    <AdminBodyStateRow colSpan={12}>Loading certificate report...</AdminBodyStateRow>
                                )}
                                {!loading && pagedRows.length === 0 && (
                                    <AdminBodyStateRow colSpan={12}>No data found</AdminBodyStateRow>
                                )}
                                {!loading && pagedRows.map((row, index) => (
                                    <tr key={row.enrollmentId} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd>{(page - 1) * entries + index + 1}</AdminTd>
                                        <AdminTd>
                                            <div className="font-medium">{row.courseName || '-'}</div>
                                            <div className="text-[10px] text-[#64748B] break-words">{row.categoryName || '-'}</div>
                                        </AdminTd>
                                        <AdminTd>{row.sectionName || '-'}</AdminTd>
                                        <AdminTd className="break-all">{row.username || '-'}</AdminTd>
                                        <AdminTd>{row.firstName || '-'}</AdminTd>
                                        <AdminTd>{row.lastName || '-'}</AdminTd>
                                        <AdminTd>
                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${learnerBadgeClass(row.userStatus)}`}>
                                                {row.userStatusLabel || '-'}
                                            </span>
                                        </AdminTd>
                                        <AdminTd>
                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(row.certificateStatus)}`}>
                                                {row.certificateStatusLabel || '-'}
                                            </span>
                                        </AdminTd>
                                        <AdminTd className="font-mono text-[10px] break-all">{row.certificateNo || '-'}</AdminTd>
                                        <AdminTd>{formatDateTime(row.issuedAt)}</AdminTd>
                                        <AdminTd>{row.responseBy || '-'}</AdminTd>
                                        <AdminTd>
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    type="button"
                                                    disabled={Boolean(actionLoadingId)}
                                                    onClick={() => runAction(row, 'VIEW_SCORE')}
                                                    className={`inline-flex items-center justify-center rounded-[8px] border px-2 py-1 text-[11px] font-medium ${ACTION_BUTTONS.VIEW_SCORE}`}
                                                >
                                                    View Score
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={Boolean(actionLoadingId)}
                                                    onClick={() => runAction(row, 'APPROVE')}
                                                    className={`inline-flex items-center justify-center rounded-[8px] border px-2 py-1 text-[11px] font-medium ${ACTION_BUTTONS.APPROVE}`}
                                                >
                                                    {actionLoadingId === `${row.enrollmentId}:APPROVE` ? 'Working...' : 'Approve'}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={Boolean(actionLoadingId)}
                                                    onClick={() => runAction(row, 'NOT_APPROVE')}
                                                    className={`inline-flex items-center justify-center rounded-[8px] border px-2 py-1 text-[11px] font-medium ${ACTION_BUTTONS.NOT_APPROVE}`}
                                                >
                                                    {actionLoadingId === `${row.enrollmentId}:NOT_APPROVE` ? 'Working...' : 'Not Approve'}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={Boolean(actionLoadingId)}
                                                    onClick={() => runAction(row, 'REGENERATE')}
                                                    className={`inline-flex items-center justify-center rounded-[8px] border px-2 py-1 text-[11px] font-medium ${ACTION_BUTTONS.REGENERATE}`}
                                                >
                                                    {actionLoadingId === `${row.enrollmentId}:REGENERATE` ? 'Working...' : 'Regenerate'}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={Boolean(actionLoadingId)}
                                                    onClick={() => runAction(row, 'PRINT')}
                                                    className={`inline-flex items-center justify-center rounded-[8px] border px-2 py-1 text-[11px] font-medium ${ACTION_BUTTONS.PRINT}`}
                                                >
                                                    Print
                                                </button>
                                            </div>
                                        </AdminTd>
                                    </tr>
                                ))}
                            </tbody>
                        </AdminTable>
                    </AdminTableWrap>

                    <AdminPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalItems={rows.length}
                        startRow={rows.length === 0 ? 0 : (page - 1) * entries + 1}
                        endRow={Math.min(page * entries, rows.length)}
                    />
                </AdminCard>
            </div>
        </AdminShell>
    );
}

