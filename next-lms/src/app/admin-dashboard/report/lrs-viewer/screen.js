'use client';

import React from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminEntriesControl,
    AdminModal,
    AdminPageHeader,
    AdminPagination,
    AdminTable,
    AdminTableHead,
    AdminTableWrap,
    AdminTd,
    AdminTh,
    AdminToolbar,
    adminInputClass,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
    adminSelectClass,
} from '@/components/admin/ui/AdminPrimitives';

const VERB_OPTIONS = [
    { value: '', label: 'Verb: ALL' },
    { value: 'initialized', label: 'initialized' },
    { value: 'played', label: 'played' },
    { value: 'paused', label: 'paused' },
    { value: 'seeked', label: 'seeked' },
    { value: 'progressed', label: 'progressed' },
    { value: 'experienced', label: 'experienced' },
    { value: 'attempted', label: 'attempted' },
    { value: 'completed', label: 'completed' },
    { value: 'passed', label: 'passed' },
    { value: 'failed', label: 'failed' },
    { value: 'terminated', label: 'terminated' },
    { value: 'exited', label: 'exited' },
    { value: 'answered', label: 'answered' },
    { value: 'abandoned', label: 'abandoned' },
];

function toDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function VerbPill({ verb }) {
    const label = String(verb || 'unknown').toLowerCase();
    const tone = (() => {
        if (['completed', 'passed'].includes(label)) return 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]';
        if (['failed', 'abandoned'].includes(label)) return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]';
        if (['attempted', 'experienced', 'initialized'].includes(label)) return 'bg-[#EEF4FF] text-[#1E4ED8] border-[#C9DBFF]';
        if (['terminated', 'exited'].includes(label)) return 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]';
        return 'bg-[#FFF7ED] text-[#B45309] border-[#FED7AA]';
    })();
    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[12px] font-semibold ${tone}`}>
            {label}
        </span>
    );
}

export default function LrsViewerScreen() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [rows, setRows] = React.useState([]);
    const [entries, setEntries] = React.useState(25);
    const [page, setPage] = React.useState(1);
    const [totalCount, setTotalCount] = React.useState(0);

    const [actorInput, setActorInput] = React.useState('');
    const [actor, setActor] = React.useState('');
    const [verb, setVerb] = React.useState('');
    const [activityInput, setActivityInput] = React.useState('');
    const [activity, setActivity] = React.useState('');
    const [since, setSince] = React.useState('');
    const [until, setUntil] = React.useState('');

    const [detail, setDetail] = React.useState(null);

    const loadStatements = React.useCallback(async ({
        targetPage = page,
        targetEntries = entries,
        targetActor = actor,
        targetVerb = verb,
        targetActivity = activity,
        targetSince = since,
        targetUntil = until,
    } = {}) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('page', String(targetPage));
            params.set('limit', String(targetEntries));
            if (targetActor) params.set('actor', targetActor);
            if (targetVerb) params.set('verb', targetVerb);
            if (targetActivity) params.set('activity', targetActivity);
            if (targetSince) params.set('since', targetSince);
            if (targetUntil) params.set('until', targetUntil);

            const res = await fetch(`/api/admin/lrs/statements?${params.toString()}`, {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load LRS statements');
            }
            setRows(Array.isArray(data?.items) ? data.items : []);
            setTotalCount(Number(data?.totalCount || 0));
        } catch (err) {
            setRows([]);
            setTotalCount(0);
            setError(String(err?.message || 'Failed to load LRS statements'));
        } finally {
            setLoading(false);
        }
    }, [page, entries, actor, verb, activity, since, until]);

    React.useEffect(() => {
        loadStatements();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totalPages = Math.max(1, Math.ceil(totalCount / entries));
    const startRow = totalCount === 0 ? 0 : ((page - 1) * entries) + 1;
    const endRow = Math.min(page * entries, totalCount);

    const applyFilters = () => {
        const nextActor = String(actorInput || '').trim();
        const nextActivity = String(activityInput || '').trim();
        setActor(nextActor);
        setActivity(nextActivity);
        setPage(1);
        loadStatements({
            targetPage: 1,
            targetActor: nextActor,
            targetActivity: nextActivity,
        });
    };

    const clearFilters = () => {
        setActorInput('');
        setActor('');
        setVerb('');
        setActivityInput('');
        setActivity('');
        setSince('');
        setUntil('');
        setPage(1);
        loadStatements({
            targetPage: 1,
            targetActor: '',
            targetVerb: '',
            targetActivity: '',
            targetSince: '',
            targetUntil: '',
        });
    };

    return (
        <AdminShell>
            <div className="w-full relative z-10 pb-20">
                <AdminPageHeader
                    title="Report: LRS Viewer"
                    description="Browse raw xAPI / TinCan statements stored in the LRS for debugging learner activity."
                />

                <AdminCard title="LRS Statements" contentClassName="space-y-6 mt-2">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <input
                            value={actorInput}
                            onChange={(e) => setActorInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                            placeholder="Actor email or username"
                            className={adminInputClass}
                        />

                        <select
                            value={verb}
                            onChange={(e) => {
                                const next = e.target.value;
                                setVerb(next);
                                setPage(1);
                                loadStatements({ targetPage: 1, targetVerb: next });
                            }}
                            className={adminSelectClass}
                        >
                            {VERB_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>

                        <input
                            value={activityInput}
                            onChange={(e) => setActivityInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                            placeholder="Activity ID contains..."
                            className={adminInputClass}
                        />

                        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#475569]">
                            <span>Since</span>
                            <input
                                type="datetime-local"
                                value={since}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setSince(next);
                                    setPage(1);
                                    loadStatements({ targetPage: 1, targetSince: next });
                                }}
                                className={adminInputClass}
                            />
                        </label>

                        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#475569]">
                            <span>Until</span>
                            <input
                                type="datetime-local"
                                value={until}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setUntil(next);
                                    setPage(1);
                                    loadStatements({ targetPage: 1, targetUntil: next });
                                }}
                                className={adminInputClass}
                            />
                        </label>

                        <div className="flex items-end gap-2">
                            <button type="button" className={adminPrimaryButtonClass} onClick={applyFilters}>Search</button>
                            <button type="button" className={adminSecondaryButtonClass} onClick={clearFilters}>Clear</button>
                        </div>
                    </div>

                    <AdminToolbar
                        left={(
                            <AdminEntriesControl
                                value={entries}
                                onChange={(next) => {
                                    setEntries(next);
                                    setPage(1);
                                    loadStatements({ targetPage: 1, targetEntries: next });
                                }}
                            />
                        )}
                        right={(
                            <button
                                type="button"
                                className={adminSecondaryButtonClass}
                                onClick={() => loadStatements({ targetPage: page })}
                            >
                                Refresh
                            </button>
                        )}
                    />

                    <AdminTableWrap>
                        <AdminTable className="min-w-[1080px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[180px]">Timestamp</AdminTh>
                                    <AdminTh className="w-[220px]">Actor</AdminTh>
                                    <AdminTh className="w-[120px]">Verb</AdminTh>
                                    <AdminTh>Activity</AdminTh>
                                    <AdminTh className="w-[110px]">Detail</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd>{toDateTime(row.timestamp || row.receivedAt)}</AdminTd>
                                        <AdminTd>
                                            <div className="font-medium text-[#0F2243]">{row.actorName || '-'}</div>
                                            <div className="text-[12px] text-[#64748B]">{row.actorEmail || '-'}</div>
                                        </AdminTd>
                                        <AdminTd>
                                            <VerbPill verb={row.verbDisplay || row.verbId} />
                                            <div className="mt-1 text-[11px] text-[#94A3B8] break-all">{row.verbId || '-'}</div>
                                        </AdminTd>
                                        <AdminTd>
                                            <div className="text-[#0F2243]">{row.objectName || '-'}</div>
                                            <div className="text-[11px] text-[#94A3B8] break-all">{row.objectId || '-'}</div>
                                        </AdminTd>
                                        <AdminTd>
                                            <button
                                                type="button"
                                                className="text-[12px] font-semibold text-[#687EFF] hover:underline"
                                                onClick={() => setDetail(row)}
                                            >
                                                View JSON
                                            </button>
                                        </AdminTd>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <AdminBodyStateRow colSpan={5}>
                                        {loading ? 'Loading statements...' : (error || 'No statements found')}
                                    </AdminBodyStateRow>
                                )}
                            </tbody>
                        </AdminTable>
                    </AdminTableWrap>

                    <AdminPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={(nextPage) => {
                            setPage(nextPage);
                            loadStatements({ targetPage: nextPage });
                        }}
                        totalItems={totalCount}
                        startRow={startRow}
                        endRow={endRow}
                    />
                </AdminCard>
            </div>

            <AdminModal
                open={Boolean(detail)}
                title={detail ? `Statement ${detail.statementId || ''}` : 'Statement'}
                width="max-w-[820px]"
                footer={(
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            className={adminSecondaryButtonClass}
                            onClick={() => {
                                if (!detail) return;
                                try {
                                    navigator.clipboard?.writeText(JSON.stringify(detail.payload || detail, null, 2));
                                } catch {
                                    // ignore copy errors
                                }
                            }}
                        >
                            Copy JSON
                        </button>
                        <button type="button" className={adminPrimaryButtonClass} onClick={() => setDetail(null)}>
                            Close
                        </button>
                    </div>
                )}
            >
                {detail && (
                    <div className="space-y-3">
                        <div className="grid gap-2 text-[13px] text-[#475569] sm:grid-cols-2">
                            <div><span className="font-semibold text-[#0F2243]">Actor:</span> {detail.actorName} ({detail.actorEmail || '-'})</div>
                            <div><span className="font-semibold text-[#0F2243]">Timestamp:</span> {toDateTime(detail.timestamp || detail.receivedAt)}</div>
                            <div><span className="font-semibold text-[#0F2243]">Verb:</span> {detail.verbDisplay} <span className="text-[#94A3B8]">({detail.verbId || '-'})</span></div>
                            <div className="break-all"><span className="font-semibold text-[#0F2243]">Activity:</span> {detail.objectName || '-'}</div>
                        </div>
                        <pre className="max-h-[420px] overflow-auto rounded-xl border border-[#E2E8F0] bg-[#0F172A] p-4 text-[12px] leading-relaxed text-[#E2E8F0]">
                            {JSON.stringify(detail.payload || detail, null, 2)}
                        </pre>
                    </div>
                )}
            </AdminModal>
        </AdminShell>
    );
}
