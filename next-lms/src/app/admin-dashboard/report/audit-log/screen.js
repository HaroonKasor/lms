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

function SeverityPill({ severity = 'info' }) {
    const key = String(severity || '').toLowerCase();
    const styleMap = {
        info: 'bg-[#EEF4FF] text-[#1E4ED8] border-[#C9DBFF]',
        warning: 'bg-[#FFF7ED] text-[#B45309] border-[#FED7AA]',
        critical: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
    };
    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[12px] font-semibold ${styleMap[key] || styleMap.info}`}>
            {key.toUpperCase()}
        </span>
    );
}

export default function AuditLogScreen() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [rows, setRows] = React.useState([]);
    const [entries, setEntries] = React.useState(20);
    const [page, setPage] = React.useState(1);
    const [totalCount, setTotalCount] = React.useState(0);
    const [action, setAction] = React.useState('');
    const [entity, setEntity] = React.useState('');
    const [search, setSearch] = React.useState('');
    const [searchInput, setSearchInput] = React.useState('');

    const loadLogs = React.useCallback(async ({
        targetPage = page,
        targetEntries = entries,
        targetAction = action,
        targetEntity = entity,
        targetSearch = search,
    } = {}) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('page', String(targetPage));
            params.set('limit', String(targetEntries));
            if (targetAction) params.set('action', targetAction);
            if (targetEntity) params.set('entity', targetEntity);
            if (targetSearch) params.set('search', targetSearch);

            const res = await fetch(`/api/admin/audit?${params.toString()}`, {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load audit logs');
            }
            setRows(Array.isArray(data?.items) ? data.items : []);
            setTotalCount(Number(data?.totalCount || 0));
        } catch (err) {
            setRows([]);
            setTotalCount(0);
            setError(String(err?.message || 'Failed to load audit logs'));
        } finally {
            setLoading(false);
        }
    }, [page, entries, action, entity, search]);

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
            targetAction: action,
            targetEntity: entity,
            targetSearch: nextSearch,
        });
    };

    return (
        <AdminShell>
            <div className="w-full relative z-10 pb-20">
                <AdminPageHeader
                    title="Report: Audit Log"
                    description="Track who changed what, when, and from which action path."
                />

                <AdminCard title="Audit Timeline" contentClassName="space-y-6 mt-2">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <select
                            value={action}
                            onChange={(e) => {
                                const next = e.target.value;
                                setAction(next);
                                setPage(1);
                                loadLogs({ targetPage: 1, targetAction: next });
                            }}
                            className={adminSelectClass}
                        >
                            <option value="">Action: ALL</option>
                            <option value="CREATE">CREATE</option>
                            <option value="UPDATE">UPDATE</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PASSWORD_RESET">PASSWORD_RESET</option>
                            <option value="MANUAL_NOTE">MANUAL_NOTE</option>
                        </select>

                        <select
                            value={entity}
                            onChange={(e) => {
                                const next = e.target.value;
                                setEntity(next);
                                setPage(1);
                                loadLogs({ targetPage: 1, targetEntity: next });
                            }}
                            className={adminSelectClass}
                        >
                            <option value="">Entity: ALL</option>
                            <option value="USER">USER</option>
                            <option value="GROUP">GROUP</option>
                            <option value="COURSE">COURSE</option>
                            <option value="SECTION">SECTION</option>
                            <option value="SYSTEM">SYSTEM</option>
                        </select>

                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSearchSubmit();
                            }}
                            placeholder="Search message / actor / entity id"
                            className="h-[42px] rounded-xl border border-[#DDE4FF] bg-white px-3 text-[14px] text-[#334155] outline-none focus:border-[#8EA7FF]"
                        />

                        <div className="flex gap-2">
                            <button type="button" className={adminPrimaryButtonClass} onClick={handleSearchSubmit}>Search</button>
                            <button
                                type="button"
                                className={adminSecondaryButtonClass}
                                onClick={() => {
                                    setAction('');
                                    setEntity('');
                                    setSearch('');
                                    setSearchInput('');
                                    setPage(1);
                                    loadLogs({
                                        targetPage: 1,
                                        targetAction: '',
                                        targetEntity: '',
                                        targetSearch: '',
                                    });
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <AdminToolbar
                        left={<AdminEntriesControl value={entries} onChange={(next) => {
                            setEntries(next);
                            setPage(1);
                            loadLogs({ targetPage: 1, targetEntries: next });
                        }} />}
                    />

                    <AdminTableWrap>
                        <AdminTable className="min-w-[980px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[180px]">Date/Time</AdminTh>
                                    <AdminTh className="w-[180px]">Actor</AdminTh>
                                    <AdminTh className="w-[120px]">Action</AdminTh>
                                    <AdminTh className="w-[120px]">Entity</AdminTh>
                                    <AdminTh>Message</AdminTh>
                                    <AdminTh className="w-[110px]">Severity</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd>{toDateTime(row.createdAt)}</AdminTd>
                                        <AdminTd>
                                            <div className="font-medium text-[#0F2243]">{row.actorUsername || '-'}</div>
                                            <div className="text-[12px] text-[#64748B]">{row.actorEmail || '-'}</div>
                                        </AdminTd>
                                        <AdminTd>{row.action || '-'}</AdminTd>
                                        <AdminTd>
                                            <div>{row.entity || '-'}</div>
                                            <div className="text-[12px] text-[#64748B]">#{row.entityId ?? '-'}</div>
                                        </AdminTd>
                                        <AdminTd>
                                            <div>{row.message || '-'}</div>
                                        </AdminTd>
                                        <AdminTd>
                                            <SeverityPill severity={row.severity} />
                                        </AdminTd>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <AdminBodyStateRow colSpan={6}>
                                        {loading ? 'Loading audit logs...' : (error || 'No audit records found')}
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

