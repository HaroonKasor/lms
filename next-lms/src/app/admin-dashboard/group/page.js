'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/layout/AdminShell';
import { consumeAdminFlash } from '@/lib/admin/flash';
import { listGroups, deleteGroup } from '@/services/admin/groupService';
import {
    AdminCard,
    AdminEntriesControl,
    AdminInlineAlert,
    AdminPageHeader,
    AdminPagination,
    AdminSearchInput,
    AdminStatusPill,
    AdminTable,
    AdminTableHead,
    AdminTableWrap,
    AdminTd,
    AdminTh,
    AdminToolbar,
    AdminBodyStateRow,
    AdminToastStack,
} from '@/components/admin/ui/AdminPrimitives';
import { roleLabelFromEnterpriseRoleCode } from '@/lib/shared/role-directory';

export default function GroupPage() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [entries, setEntries] = useState(10);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [toasts, setToasts] = useState([]);

    const toastTimersRef = useRef(new Map());

    useEffect(() => {
        return () => {
            for (const timer of toastTimersRef.current.values()) clearTimeout(timer);
            toastTimersRef.current.clear();
        };
    }, []);

    const dismissToast = (id) => {
        const timer = toastTimersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            toastTimersRef.current.delete(id);
        }
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    const pushToast = (tone, message, title = '') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, tone, title, message }]);
        const timer = setTimeout(() => dismissToast(id), 3200);
        toastTimersRef.current.set(id, timer);
    };

    const loadGroupDirectory = async () => {
        try {
            setLoading(true);
            setLoadError('');
            setGroups(await listGroups());
        } catch (error) {
            console.error(error);
            setGroups([]);
            setLoadError(error?.message || 'Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGroupDirectory();
        const flash = consumeAdminFlash();
        if (flash?.message) pushToast(flash.tone || 'success', flash.message, flash.title || '');
    }, []);

    const filteredGroups = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return groups.filter((group) => {
            if (!keyword) return true;
            return [
                group.name,
                group.description,
                group.code,
                group.roleCode,
                ...(group.roles || []),
            ]
                .join(' ')
                .toLowerCase()
                .includes(keyword);
        });
    }, [groups, search]);

    useEffect(() => {
        setCurrentPage(1);
    }, [entries, search]);

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(filteredGroups.length / entries));
    }, [filteredGroups.length, entries]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const currentRows = useMemo(() => {
        const startIndex = (currentPage - 1) * entries;
        return filteredGroups.slice(startIndex, startIndex + entries);
    }, [filteredGroups, currentPage, entries]);

    const startRow = filteredGroups.length === 0 ? 0 : (currentPage - 1) * entries + 1;
    const endRow = Math.min(currentPage * entries, filteredGroups.length);

    const handleDelete = async (groupId) => {
        const target = groups.find((group) => group.id === groupId);
        if (!target) return;
        if (target.isSystemDefault) {
            pushToast('error', 'Default role groups cannot be deleted.', 'Protected');
            return;
        }
        if (!window.confirm(`Delete group ${target.name}?`)) return;
        try {
            await deleteGroup(groupId);
            pushToast('success', `Deleted ${target.name} successfully.`, 'Deleted');
            await loadGroupDirectory();
        } catch (error) {
            console.error(error);
            pushToast('error', error?.message || 'Unable to delete group.', 'Delete failed');
        }
    };

    return (
        <AdminShell>
            <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
            <div className="flex w-full flex-col gap-6 font-outfit">
                <AdminPageHeader
                    title="Group Management"
                    description="Manage role groups and connect them with User Management."
                />

                <AdminCard
                    title="Access Groups"
                    action={<span className="text-[12px] font-medium text-white/90">Default role groups are protected</span>}
                >
                    {loadError ? (
                        <div className="mb-4">
                            <AdminInlineAlert>{loadError}</AdminInlineAlert>
                        </div>
                    ) : null}

                    <AdminToolbar
                        left={<AdminEntriesControl value={entries} onChange={setEntries} />}
                        right={(
                            <AdminSearchInput
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search group, description, or role"
                            />
                        )}
                    />

                    <AdminTableWrap>
                        <AdminTable>
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[80px]">ID</AdminTh>
                                    <AdminTh className="w-[220px]">Group Name</AdminTh>
                                    <AdminTh className="w-[220px]">Description</AdminTh>
                                    <AdminTh className="w-[120px] text-center">Status</AdminTh>
                                    <AdminTh className="w-[200px]">Role</AdminTh>
                                    <AdminTh className="w-[140px] text-center">Tools</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {loading && (
                                    <AdminBodyStateRow colSpan={6}>Loading access groups...</AdminBodyStateRow>
                                )}
                                {!loading && currentRows.length === 0 && (
                                    <AdminBodyStateRow colSpan={6}>
                                        {search ? 'No groups matched the current search.' : 'No groups found. Create your first access group to get started.'}
                                    </AdminBodyStateRow>
                                )}
                                {!loading && currentRows.map((row) => (
                                    <tr key={row.id} className="border-b border-[#EEF2FF] align-top transition-colors hover:bg-[#FBFCFF]">
                                        <AdminTd>{row.id}</AdminTd>
                                        <AdminTd className="font-medium text-[#22304A]">{row.name}</AdminTd>
                                        <AdminTd>{row.description}</AdminTd>
                                        <AdminTd className="text-center">
                                            <AdminStatusPill active={row.isActive} />
                                        </AdminTd>
                                        <AdminTd>
                                            <div className="inline-flex items-center rounded-full border border-[#DDE4FF] bg-[#F8FAFF] px-3 py-1 text-[12px] font-semibold text-[#334155]">
                                                {roleLabelFromEnterpriseRoleCode(row.roleCode)}
                                            </div>
                                        </AdminTd>
                                        <AdminTd>
                                            <div className="flex items-center justify-center gap-2">
                                                <Link
                                                    href={`/admin-dashboard/manage-user/users?groupCode=${encodeURIComponent(row.code)}&groupName=${encodeURIComponent(row.name)}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-white text-[#5BC0DE] transition hover:bg-sky-50 hover:text-[#46b8da]"
                                                    title="View Users"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                        <circle cx="9" cy="7" r="4" />
                                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                    </svg>
                                                </Link>
                                                <Link
                                                    href={`/admin-dashboard/group/edit/${row.id}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE4FF] bg-white text-[#687EFF] transition hover:bg-[#F3F5FF] hover:text-[#5A6FE0]"
                                                    title="Edit"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(row.id)}
                                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                                        row.isSystemDefault
                                                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                                                            : 'border-rose-200 bg-white text-rose-500 hover:bg-rose-50 hover:text-rose-700'
                                                    }`}
                                                    title={row.isSystemDefault ? 'Default role groups cannot be deleted' : 'Delete'}
                                                    disabled={row.isSystemDefault}
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                                </button>
                                            </div>
                                        </AdminTd>
                                    </tr>
                                ))}
                            </tbody>
                        </AdminTable>
                    </AdminTableWrap>

                    {!loading && filteredGroups.length > 0 && (
                        <AdminPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={filteredGroups.length}
                            startRow={startRow}
                            endRow={endRow}
                        />
                    )}
                </AdminCard>
            </div>
        </AdminShell>
    );
}
