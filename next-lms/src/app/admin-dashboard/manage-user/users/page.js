'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';
import Link from 'next/link';

const emptyEditForm = {
    id: null,
    username: '',
    email: '',
    fullName: '',
    phone: '',
    role: 'user',
    avatar: '',
    isActive: true,
};

export default function UserManagementPage() {
    const [entries, setEntries] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [savingEdit, setSavingEdit] = useState(false);

    const [passwordOpen, setPasswordOpen] = useState(false);
    const [passwordUserId, setPasswordUserId] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch('/api/users', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const filteredUsers = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return !keyword
            ? users
            : users.filter((u) =>
                [u.username, u.email, u.fullName, u.phone, u.role]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(keyword))
            );
    }, [users, search]);

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

    const pageNumbers = useMemo(() => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, 5];
        if (currentPage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
    }, [currentPage, totalPages]);

    const openEdit = (user) => {
        setEditForm({
            id: user.id,
            username: user.username || '',
            email: user.email || '',
            fullName: user.fullName || '',
            phone: user.phone || '',
            role: user.role || 'user',
            avatar: user.avatar || '',
            isActive: !!user.isActive,
        });
        setEditOpen(true);
    };

    const submitEdit = async () => {
        setSavingEdit(true);
        try {
            const res = await fetch(`/api/users?id=${editForm.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || 'Update failed');
                return;
            }
            setEditOpen(false);
            setEditForm(emptyEditForm);
            await fetchUsers();
        } catch (err) {
            alert(err.message);
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
            alert('Password ต้องอย่างน้อย 6 ตัวอักษร');
            return;
        }
        setSavingPassword(true);
        try {
            const res = await fetch(`/api/users?id=${passwordUserId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || 'Change password failed');
                return;
            }
            setPasswordOpen(false);
            setPasswordUserId(null);
            setNewPassword('');
            alert('เปลี่ยนรหัสผ่านสำเร็จ');
        } catch (err) {
            alert(err.message);
        }
        setSavingPassword(false);
    };

    const deleteUser = async (user) => {
        if (!confirm(`ลบผู้ใช้ ${user.username}?`)) return;
        try {
            const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || 'Delete failed');
                return;
            }
            await fetchUsers();
        } catch (err) {
            alert(err.message);
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        try {
            return new Date(date).toLocaleString('th-TH');
        } catch {
            return String(date);
        }
    };

    return (
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-6 font-outfit">
                <div className="bg-white border border-[#D1E3FB] rounded-[8px] overflow-hidden shadow-sm">
                    <div className="bg-[#687EFF] px-4 py-3 flex items-center justify-between text-white">
                        <div className="font-medium text-[16px]">User</div>
                        <Link href="/admin-dashboard/manage-user/create" className="text-white hover:bg-white/20 px-3 py-1 rounded text-xl leading-none">+</Link>
                    </div>

                    <div className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2 text-[14px] text-[#6B778B]">
                                <select
                                    className="border border-gray-300 rounded px-2 py-1 outline-none"
                                    value={entries}
                                    onChange={(e) => setEntries(Number(e.target.value))}
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span>records</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Search username/email/name/phone/role"
                                className="w-full sm:w-[360px] border border-gray-300 rounded px-3 py-1.5 outline-none focus:border-[#687EFF] text-[13px]"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="overflow-x-auto border border-gray-200 rounded">
                            <table className="w-full text-left text-[13px]">
                                <thead className="bg-[#F8FAFC] border-b border-gray-200 text-[#334155]">
                                    <tr>
                                        <th className="p-2 border-r border-gray-200">ID</th>
                                        <th className="p-2 border-r border-gray-200">Username</th>
                                        <th className="p-2 border-r border-gray-200">Email</th>
                                        <th className="p-2 border-r border-gray-200">Full Name</th>
                                        <th className="p-2 border-r border-gray-200">Phone</th>
                                        <th className="p-2 border-r border-gray-200">Role</th>
                                        <th className="p-2 border-r border-gray-200">isActive</th>
                                        <th className="p-2 border-r border-gray-200">createdAt</th>
                                        <th className="p-2 border-r border-gray-200">updatedAt</th>
                                        <th className="p-2 text-center">Tools</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && (
                                        <tr><td colSpan={11} className="p-6 text-center text-[#6B778B]">Loading users...</td></tr>
                                    )}
                                    {!loading && error && (
                                        <tr><td colSpan={11} className="p-6 text-center text-red-500">{error}</td></tr>
                                    )}
                                    {!loading && !error && filteredRows.length === 0 && (
                                        <tr><td colSpan={11} className="p-6 text-center text-[#6B778B]">No users found</td></tr>
                                    )}
                                    {!loading && !error && filteredRows.map((row) => (
                                        <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50 text-[#475569]">
                                            <td className="p-2 border-r border-gray-200">{row.id}</td>
                                            <td className="p-2 border-r border-gray-200">{row.username}</td>
                                            <td className="p-2 border-r border-gray-200 break-all">{row.email}</td>
                                            <td className="p-2 border-r border-gray-200">{row.fullName || '-'}</td>
                                            <td className="p-2 border-r border-gray-200">{row.phone || '-'}</td>
                                            <td className="p-2 border-r border-gray-200">{row.role}</td>
                                            <td className="p-2 border-r border-gray-200 text-center">
                                                <span className={`px-2 py-0.5 rounded text-white text-[11px] ${row.isActive ? 'bg-green-500' : 'bg-gray-500'}`}>
                                                    {row.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="p-2 border-r border-gray-200 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                                            <td className="p-2 border-r border-gray-200 whitespace-nowrap">{formatDate(row.updatedAt)}</td>
                                            <td className="p-2">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => openChangePassword(row.id)} className="text-[#5BC0DE] hover:text-[#46b8da]" title="Change Password">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" /></svg>
                                                    </button>
                                                    <button onClick={() => openEdit(row)} className="text-[#687EFF] hover:text-[#5A6FE0]" title="Edit">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    </button>
                                                    <button onClick={() => deleteUser(row)} className="text-red-500 hover:text-red-700" title="Delete">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {!loading && !error && filteredUsers.length > 0 && (
                            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="text-[13px] text-[#6B778B]">
                                    Showing {startRow} to {endRow} of {filteredUsers.length} entries
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="h-8 px-3 rounded border border-[#D1D9EE] text-[13px] text-[#334155] bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F8FAFF]"
                                    >
                                        Prev
                                    </button>
                                    {pageNumbers.map((page) => (
                                        <button
                                            key={page}
                                            type="button"
                                            onClick={() => setCurrentPage(page)}
                                            className={`h-8 min-w-8 px-2 rounded border text-[13px] ${
                                                currentPage === page
                                                    ? 'bg-[#687EFF] border-[#687EFF] text-white'
                                                    : 'bg-white border-[#D1D9EE] text-[#334155] hover:bg-[#F8FAFF]'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="h-8 px-3 rounded border border-[#D1D9EE] text-[13px] text-[#334155] bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F8FAFF]"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {editOpen && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg w-full max-w-[560px] p-5">
                            <h2 className="text-[18px] font-medium text-[#052143] mb-4">Edit User</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className="border border-gray-300 rounded px-3 py-2 text-[14px]" placeholder="Username" />
                                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="border border-gray-300 rounded px-3 py-2 text-[14px]" placeholder="Email" />
                                <input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="border border-gray-300 rounded px-3 py-2 text-[14px]" placeholder="Full Name" />
                                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="border border-gray-300 rounded px-3 py-2 text-[14px]" placeholder="Phone" />
                                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="border border-gray-300 rounded px-3 py-2 text-[14px]">
                                    <option value="user">user</option>
                                    <option value="admin">admin</option>
                                </select>
                                <select value={editForm.isActive ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'true' })} className="border border-gray-300 rounded px-3 py-2 text-[14px]">
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                                <input value={editForm.avatar} onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })} className="sm:col-span-2 border border-gray-300 rounded px-3 py-2 text-[14px]" placeholder="Avatar URL" />
                            </div>
                            <div className="flex justify-end gap-2 mt-5">
                                <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded border border-gray-300 text-[#334155]">Cancel</button>
                                <button onClick={submitEdit} disabled={savingEdit} className="px-4 py-2 rounded bg-[#687EFF] text-white disabled:opacity-50">{savingEdit ? 'Saving...' : 'Save'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {passwordOpen && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg w-full max-w-[420px] p-5">
                            <h2 className="text-[18px] font-medium text-[#052143] mb-4">Change Password</h2>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-[14px]"
                                placeholder="New password (min 6 chars)"
                            />
                            <div className="flex justify-end gap-2 mt-5">
                                <button onClick={() => setPasswordOpen(false)} className="px-4 py-2 rounded border border-gray-300 text-[#334155]">Cancel</button>
                                <button onClick={submitPassword} disabled={savingPassword} className="px-4 py-2 rounded bg-[#5BC0DE] text-white disabled:opacity-50">{savingPassword ? 'Saving...' : 'Update Password'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLmsDashboard>
    );
}

