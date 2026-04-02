'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { consumeAdminFlash } from '@/lib/admin/flash';
import {
    changeUserPassword,
    deleteUser as deleteUserRecord,
    listUsers,
    updateUser,
} from '@/services/admin/userService';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminEntriesControl,
    AdminInlineAlert,
    AdminModal,
    AdminPageHeader,
    AdminPagination,
    AdminSearchInput,
    AdminStatusPill,
    AdminTable,
    AdminTableHead,
    AdminTableWrap,
    AdminTd,
    AdminTh,
    AdminToastStack,
    AdminToolbar,
    adminInputClass,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
} from '@/components/admin/ui/AdminPrimitives';
import {
    roleLabelFromEnterpriseRoleCode,
    toUiRoleFromEnterpriseRoleCode,
} from '@/lib/shared/role-directory';

const emptyEditForm = {
    id: null,
    username: '',
    email: '',
    fullName: '',
    phone: '',
    role: 'learner',
    avatar: '',
    status: 'active',
    selectedGroups: [],
};

export default function UserManagementPage() {
    const searchParams = useSearchParams();
    const [entries, setEntries] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [users, setUsers] = useState([]);
    const [groupOptions, setGroupOptions] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [toasts, setToasts] = useState([]);

    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [savingEdit, setSavingEdit] = useState(false);

    const [passwordOpen, setPasswordOpen] = useState(false);
    const [passwordUserId, setPasswordUserId] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const toastTimersRef = React.useRef(new Map());
    const normalizePhoneInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 20);
    const groupCodeFilter = String(searchParams.get('groupCode') || '').trim().toUpperCase();
    const groupNameFilter = String(searchParams.get('groupName') || '').trim();

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
        setToasts((prev) => [...prev, { id, tone, message, title }]);
        const timer = setTimeout(() => dismissToast(id), 3200);
        toastTimersRef.current.set(id, timer);
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError('');
            setUsers(await listUsers({ groupCode: groupCodeFilter }));
        } catch (err) {
            setUsers([]);
            setError(err.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async () => {
        try {
            setLoadingGroups(true);
            const response = await fetch('/api/groups', { cache: 'no-store' });
            const payload = await response.json().catch(() => []);
            if (!response.ok) return;
            const normalized = Array.isArray(payload)
                ? payload
                    .map((row) => ({
                        code: String(row?.code || '').trim().toUpperCase(),
                        name: String(row?.name || '').trim(),
                        roleCode: String(row?.roleCode || 'LEARNER').trim().toUpperCase(),
                    }))
                    .filter((row) => row.code)
                : [];
            setGroupOptions(normalized);
        } catch (groupErr) {
            console.error('[UsersPage] load groups failed', groupErr);
            setGroupOptions([]);
        } finally {
            setLoadingGroups(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchGroups();
        const flash = consumeAdminFlash();
        if (flash?.message) pushToast(flash.tone || 'success', flash.message, flash.title || '');
    }, [groupCodeFilter]);

    const resolveUiRoleFromGroupCode = (groupCode, fallback = 'learner') => {
        const normalizedCode = String(groupCode || '').trim().toUpperCase();
        if (!normalizedCode) return fallback;
        const found = groupOptions.find((item) => item.code === normalizedCode);
        if (!found) return fallback;
        return toUiRoleFromEnterpriseRoleCode(found.roleCode || 'LEARNER');
    };

    const filteredUsers = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return users.filter((u) => {
            const assignedGroups = Array.isArray(u?.groups) ? u.groups : [];
            const matchesGroup = !groupCodeFilter || assignedGroups.includes(groupCodeFilter);
            if (!matchesGroup) return false;
            if (!keyword) return true;
            return [u.username, u.email, u.fullName, u.phone, u.role, ...(u.groups || [])]
                .concat(u.status || '')
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(keyword));
        });
    }, [users, search, groupCodeFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, entries]);

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(filteredUsers.length / entries));
    }, [filteredUsers.length, entries]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const filteredRows = useMemo(() => {
        const startIndex = (currentPage - 1) * entries;
        return filteredUsers.slice(startIndex, startIndex + entries);
    }, [filteredUsers, currentPage, entries]);

    const startRow = filteredUsers.length === 0 ? 0 : (currentPage - 1) * entries + 1;
    const endRow = Math.min(currentPage * entries, filteredUsers.length);

    const openEdit = (user) => {
        const selectedGroups = Array.isArray(user.groups) ? user.groups.slice(0, 1) : [];
        const selectedGroupCode = selectedGroups[0] || '';
        setEditForm({
            id: user.id,
            username: user.username || '',
            email: user.email || '',
            fullName: user.fullName || '',
            phone: user.phone || '',
            role: resolveUiRoleFromGroupCode(selectedGroupCode, user.role || 'learner'),
            avatar: user.avatar || '',
            status: String(user.status || (user.isActive ? 'active' : 'inactive')).toLowerCase(),
            selectedGroups,
        });
        setEditOpen(true);
    };

    const handleEditGroupChange = (groupCode) => {
        const normalized = String(groupCode || '').trim().toUpperCase();
        setEditForm((prev) => ({
            ...prev,
            selectedGroups: normalized ? [normalized] : [],
            role: resolveUiRoleFromGroupCode(normalized, prev.role || 'learner'),
        }));
    };

    const submitEdit = async () => {
        setSavingEdit(true);
        try {
            await updateUser(editForm.id, editForm);
            setEditOpen(false);
            setEditForm(emptyEditForm);
            await fetchUsers();
            pushToast('success', `Updated ${editForm.username} successfully.`, 'Updated');
        } catch (err) {
            pushToast('error', err?.message || 'Update failed', 'Save failed');
        }
        setSavingEdit(false);
    };

    const openChangePassword = (userId) => {
        setPasswordUserId(userId);
        setNewPassword('');
        setPasswordOpen(true);
    };

    const submitPassword = async () => {
        if (newPassword.length < 6) {
            pushToast('error', 'Password must be at least 6 characters.', 'Validation');
            return;
        }
        setSavingPassword(true);
        try {
            await changeUserPassword(passwordUserId, newPassword);
            setPasswordOpen(false);
            setPasswordUserId(null);
            setNewPassword('');
            pushToast('success', 'Password updated successfully.', 'Password updated');
        } catch (err) {
            pushToast('error', err?.message || 'Change password failed', 'Password failed');
        }
        setSavingPassword(false);
    };

    const deleteUser = async (user) => {
        if (!confirm(`Delete user ${user.username}?`)) return;
        try {
            await deleteUserRecord(user.id);
            await fetchUsers();
            pushToast('success', `Deleted ${user.username} successfully.`, 'Deleted');
        } catch (err) {
            pushToast('error', err?.message || 'Delete failed', 'Delete failed');
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        try {
            return new Date(date).toLocaleString('en-US');
        } catch {
            return String(date);
        }
    };

    const getUserStatusLabel = (status, isActive) => {
        const normalized = String(status || '').trim().toLowerCase();
        if (normalized === 'suspended') return 'Suspended';
        if (normalized === 'pending') return 'Pending';
        if (normalized === 'inactive') return 'Inactive';
        if (normalized === 'active') return 'Active';
        return isActive ? 'Active' : 'Inactive';
    };

    return (
        <AdminShell>
            <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
            <div className="w-full flex flex-col gap-6 font-outfit">
                <AdminPageHeader
                    title="User Management"
                    description="Manage users, activation status, and password updates."
                />

                <AdminCard
                    title="Users"
                    action={<Link href="/admin-dashboard/manage-user/create" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-[22px] text-white transition hover:bg-white/20">+</Link>}
                >
                    {error ? (
                        <div className="mb-4">
                            <AdminInlineAlert>{error}</AdminInlineAlert>
                        </div>
                    ) : null}

                    {groupCodeFilter && (
                        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#DDE4FF] bg-[#F8FAFF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-[12px] uppercase tracking-[0.08em] text-[#94A3B8]">Filtered By Group</div>
                                <div className="mt-1 text-[15px] font-semibold text-[#1E293B]">
                                    {groupNameFilter || groupCodeFilter}
                                    <span className="ml-2 text-[12px] font-medium text-[#687EFF]">{groupCodeFilter}</span>
                                </div>
                            </div>
                            <Link
                                href="/admin-dashboard/manage-user/users"
                                className="inline-flex h-[36px] items-center justify-center rounded-lg border border-[#DDE4FF] bg-white px-4 text-[13px] font-medium text-[#687EFF] hover:bg-[#F0EDFF]"
                            >
                                Clear group filter
                            </Link>
                        </div>
                    )}

                    <AdminToolbar
                        left={<AdminEntriesControl value={entries} onChange={setEntries} />}
                        right={(
                            <AdminSearchInput
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search username, email, full name, phone, or role"
                                className="lg:w-[360px]"
                            />
                        )}
                    />

                    <AdminTableWrap>
                        <AdminTable className="min-w-[1180px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[70px]">ID</AdminTh>
                                    <AdminTh className="w-[130px]">Username</AdminTh>
                                    <AdminTh className="w-[220px]">Email</AdminTh>
                                    <AdminTh className="w-[170px]">Full Name</AdminTh>
                                    <AdminTh className="w-[140px]">Phone</AdminTh>
                                    <AdminTh className="w-[110px]">Role</AdminTh>
                                    <AdminTh className="w-[110px] text-center">Status</AdminTh>
                                    <AdminTh className="w-[190px]">Created At</AdminTh>
                                    <AdminTh className="w-[190px]">Updated At</AdminTh>
                                    <AdminTh className="w-[130px] text-center">Tools</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {loading && <AdminBodyStateRow colSpan={10}>Loading users...</AdminBodyStateRow>}
                                {!loading && error && <AdminBodyStateRow colSpan={10} tone="error">{error}</AdminBodyStateRow>}
                                {!loading && !error && filteredRows.length === 0 && (
                                    <AdminBodyStateRow colSpan={10}>
                                        {search || groupCodeFilter ? 'No users matched the current filters.' : 'No users found. Create your first user to get started.'}
                                    </AdminBodyStateRow>
                                )}
                                {!loading && !error && filteredRows.map((row) => (
                                    <tr key={row.id} className="border-b border-[#EEF2FF] transition-colors hover:bg-[#FBFCFF]">
                                        <AdminTd>{row.id}</AdminTd>
                                        <AdminTd className="font-medium text-[#22304A]">{row.username}</AdminTd>
                                        <AdminTd className="break-all">{row.email}</AdminTd>
                                        <AdminTd>{row.fullName || '-'}</AdminTd>
                                        <AdminTd>{row.phone || '-'}</AdminTd>
                                        <AdminTd className="capitalize">{row.role}</AdminTd>
                                        <AdminTd className="text-center">
                                            <AdminStatusPill
                                                active={String(row.status || '').toLowerCase() === 'active'}
                                                inactiveLabel={getUserStatusLabel(row.status, row.isActive)}
                                            />
                                        </AdminTd>
                                        <AdminTd className="whitespace-nowrap">{formatDate(row.createdAt)}</AdminTd>
                                        <AdminTd className="whitespace-nowrap">{formatDate(row.updatedAt)}</AdminTd>
                                        <AdminTd>
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => openChangePassword(row.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-white text-[#5BC0DE] transition hover:bg-sky-50 hover:text-[#46b8da]" title="Change Password">
                                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" /></svg>
                                                </button>
                                                <button onClick={() => openEdit(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE4FF] bg-white text-[#687EFF] transition hover:bg-[#F3F5FF] hover:text-[#5A6FE0]" title="Edit">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                                <button onClick={() => deleteUser(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50 hover:text-rose-700" title="Delete">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        </AdminTd>
                                    </tr>
                                ))}
                            </tbody>
                        </AdminTable>
                    </AdminTableWrap>

                    {!loading && !error && filteredUsers.length > 0 && (
                        <AdminPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={filteredUsers.length}
                            startRow={startRow}
                            endRow={endRow}
                        />
                    )}
                </AdminCard>

                <AdminModal
                    open={editOpen}
                    title="Edit User"
                    footer={(
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditOpen(false)} className={adminSecondaryButtonClass}>Cancel</button>
                            <button onClick={submitEdit} disabled={savingEdit} className={adminPrimaryButtonClass}>
                                {savingEdit ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    )}
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className={adminInputClass} placeholder="Username" />
                        <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={adminInputClass} placeholder="Email" />
                        <input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className={adminInputClass} placeholder="Full Name" />
                        <input
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: normalizePhoneInput(e.target.value) })}
                            className={adminInputClass}
                            placeholder="Phone"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={20}
                        />
                        <select
                            value={editForm.selectedGroups?.[0] || ''}
                            onChange={(e) => handleEditGroupChange(e.target.value)}
                            className={adminInputClass}
                            disabled={loadingGroups}
                        >
                            <option value="">Select Group</option>
                            {groupOptions.map((group) => (
                                <option key={group.code} value={group.code}>
                                    {group.name || group.code} ({roleLabelFromEnterpriseRoleCode(group.roleCode)})
                                </option>
                            ))}
                        </select>
                        <input value={editForm.role} readOnly className={adminInputClass} placeholder="Role" />
                        <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={adminInputClass}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                            <option value="pending">Pending</option>
                        </select>
                        <input value={editForm.avatar} onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })} className={`sm:col-span-2 ${adminInputClass}`} placeholder="Avatar URL" />
                    </div>
                </AdminModal>

                <AdminModal
                    open={passwordOpen}
                    title="Change Password"
                    width="max-w-[440px]"
                    footer={(
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setPasswordOpen(false)} className={adminSecondaryButtonClass}>Cancel</button>
                            <button onClick={submitPassword} disabled={savingPassword} className={adminPrimaryButtonClass}>
                                {savingPassword ? 'Saving...' : 'Update Password'}
                            </button>
                        </div>
                    )}
                >
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={adminInputClass}
                        placeholder="New password (minimum 6 characters)"
                    />
                </AdminModal>
            </div>
        </AdminShell>
    );
}


