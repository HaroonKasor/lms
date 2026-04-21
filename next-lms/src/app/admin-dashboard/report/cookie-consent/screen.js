'use client';

import React from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
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
    adminInputClass,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
    adminSelectClass,
} from '@/components/admin/ui/AdminPrimitives';

function toDateTime(value) {
    const date = new Date(value || 0);
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

function ChoicePill({ choice = 'essential' }) {
    const key = String(choice || '').toLowerCase();
    const styleMap = {
        all: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        custom: 'bg-amber-50 text-amber-700 border-amber-200',
        essential: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[12px] font-semibold ${styleMap[key] || styleMap.essential}`}>
            {key.toUpperCase()}
        </span>
    );
}

function BoolPill({ enabled = false, trueLabel = 'Yes', falseLabel = 'No' }) {
    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[12px] font-semibold ${enabled ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]' : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]'}`}>
            {enabled ? trueLabel : falseLabel}
        </span>
    );
}

function formatSourceLabel(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '-';
    return normalized
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export default function CookieConsentReportScreen() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [rows, setRows] = React.useState([]);
    const [entries, setEntries] = React.useState(20);
    const [page, setPage] = React.useState(1);
    const [totalCount, setTotalCount] = React.useState(0);
    const [choice, setChoice] = React.useState('');
    const [source, setSource] = React.useState('');
    const [search, setSearch] = React.useState('');
    const [searchInput, setSearchInput] = React.useState('');
    const [filters, setFilters] = React.useState({
        choices: ['all', 'essential', 'custom'],
        sources: [],
    });

    const loadLogs = React.useCallback(async ({
        targetPage = page,
        targetEntries = entries,
        targetChoice = choice,
        targetSource = source,
        targetSearch = search,
    } = {}) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('page', String(targetPage));
            params.set('limit', String(targetEntries));
            if (targetChoice) params.set('choice', targetChoice);
            if (targetSource) params.set('source', targetSource);
            if (targetSearch) params.set('search', targetSearch);

            const res = await fetch(`/api/admin/cookie-consent-logs?${params.toString()}`, {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load cookie consent logs');
            }

            setRows(Array.isArray(data?.items) ? data.items : []);
            setTotalCount(Number(data?.totalCount || 0));
            setFilters({
                choices: Array.isArray(data?.filters?.choices) && data.filters.choices.length > 0
                    ? data.filters.choices
                    : ['all', 'essential', 'custom'],
                sources: Array.isArray(data?.filters?.sources) ? data.filters.sources : [],
            });
        } catch (err) {
            setRows([]);
            setTotalCount(0);
            setError(String(err?.message || 'Failed to load cookie consent logs'));
        } finally {
            setLoading(false);
        }
    }, [page, entries, choice, source, search]);

    React.useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const totalPages = Math.max(1, Math.ceil(totalCount / entries));
    const startRow = totalCount === 0 ? 0 : ((page - 1) * entries) + 1;
    const endRow = Math.min(page * entries, totalCount);

    const handleSearchSubmit = () => {
        const nextSearch = String(searchInput || '').trim();
        setSearch(nextSearch);
        setPage(1);
        loadLogs({
            targetPage: 1,
            targetEntries: entries,
            targetChoice: choice,
            targetSource: source,
            targetSearch: nextSearch,
        });
    };

    const handleExportCsv = () => {
        const params = new URLSearchParams();
        params.set('format', 'csv');
        params.set('all', '1');
        if (choice) params.set('choice', choice);
        if (source) params.set('source', source);
        if (search) params.set('search', search);
        window.location.href = `/api/admin/cookie-consent-logs?${params.toString()}`;
    };

    return (
        <AdminShell>
            <div className="w-full min-w-0 relative z-10 pb-20">
                <AdminPageHeader
                    title="Report: Cookie Consent"
                    description="Review consent history for Analytics and Marketing cookie preferences."
                    action={
                        <button type="button" className={adminPrimaryButtonClass} onClick={handleExportCsv}>
                            Export CSV
                        </button>
                    }
                />

                <AdminCard title="Consent Activity" contentClassName="space-y-6 mt-2 min-w-0">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <select
                            value={choice}
                            onChange={(e) => {
                                const next = e.target.value;
                                setChoice(next);
                                setPage(1);
                                loadLogs({ targetPage: 1, targetChoice: next });
                            }}
                            className={adminSelectClass}
                        >
                            <option value="">Choice: ALL</option>
                            {filters.choices.map((item) => (
                                <option key={item} value={item}>
                                    {String(item || '').toUpperCase()}
                                </option>
                            ))}
                        </select>

                        <select
                            value={source}
                            onChange={(e) => {
                                const next = e.target.value;
                                setSource(next);
                                setPage(1);
                                loadLogs({ targetPage: 1, targetSource: next });
                            }}
                            className={adminSelectClass}
                        >
                            <option value="">Source: ALL</option>
                            {filters.sources.map((item) => (
                                <option key={item} value={item}>
                                    {formatSourceLabel(item)}
                                </option>
                            ))}
                        </select>

                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSearchSubmit();
                            }}
                            placeholder="Search consent id / user / ip / user agent"
                            className={adminInputClass}
                        />

                        <div className="flex gap-2">
                            <button type="button" className={adminPrimaryButtonClass} onClick={handleSearchSubmit}>
                                Search
                            </button>
                            <button
                                type="button"
                                className={adminSecondaryButtonClass}
                                onClick={() => {
                                    setChoice('');
                                    setSource('');
                                    setSearch('');
                                    setSearchInput('');
                                    setPage(1);
                                    loadLogs({
                                        targetPage: 1,
                                        targetChoice: '',
                                        targetSource: '',
                                        targetSearch: '',
                                    });
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <AdminToolbar
                        left={(
                            <AdminEntriesControl
                                value={entries}
                                onChange={(next) => {
                                    setEntries(next);
                                    setPage(1);
                                    loadLogs({ targetPage: 1, targetEntries: next });
                                }}
                            />
                        )}
                    />

                    <AdminTableWrap>
                        <AdminTable className="min-w-[980px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[180px]">Date/Time</AdminTh>
                                    <AdminTh className="w-[160px]">Consent ID</AdminTh>
                                    <AdminTh className="w-[200px]">User</AdminTh>
                                    <AdminTh className="w-[120px]">Choice</AdminTh>
                                    <AdminTh className="w-[110px]">Analytics</AdminTh>
                                    <AdminTh className="w-[110px]">Marketing</AdminTh>
                                    <AdminTh className="w-[170px]">Source</AdminTh>
                                    <AdminTh className="w-[130px]">Policy</AdminTh>
                                    <AdminTh className="w-[150px]">IP</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd>{toDateTime(row.createdAt)}</AdminTd>
                                        <AdminTd>
                                            <span className="font-medium text-[#0F2243]">{row.consentId || '-'}</span>
                                        </AdminTd>
                                        <AdminTd>
                                            <div className="font-medium text-[#0F2243]">{row.username || '-'}</div>
                                            <div className="text-[12px] text-[#64748B]">{row.email || (row.userId ? `#${row.userId}` : 'Guest')}</div>
                                        </AdminTd>
                                        <AdminTd>
                                            <ChoicePill choice={row.choice} />
                                        </AdminTd>
                                        <AdminTd>
                                            <BoolPill enabled={Boolean(row?.categories?.analytics)} />
                                        </AdminTd>
                                        <AdminTd>
                                            <BoolPill enabled={Boolean(row?.categories?.marketing)} />
                                        </AdminTd>
                                        <AdminTd>{formatSourceLabel(row.source)}</AdminTd>
                                        <AdminTd>{row.policyVersion || '-'}</AdminTd>
                                        <AdminTd>
                                            <div>{row.requestedIp || '-'}</div>
                                            <div className="truncate max-w-[220px] text-[12px] text-[#64748B]" title={row.userAgent || ''}>
                                                {row.userAgent || '-'}
                                            </div>
                                        </AdminTd>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <AdminBodyStateRow colSpan={9} tone={error ? 'error' : 'muted'}>
                                        {loading ? 'Loading cookie consent logs...' : (error || 'No cookie consent records found')}
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
                            loadLogs({ targetPage: nextPage });
                        }}
                        totalItems={totalCount}
                        startRow={startRow}
                        endRow={endRow}
                    />
                </AdminCard>
            </div>
        </AdminShell>
    );
}
