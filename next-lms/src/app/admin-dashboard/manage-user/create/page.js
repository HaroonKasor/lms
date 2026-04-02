'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import { useRouter } from 'next/navigation';
import {
    AdminCard,
    AdminInlineAlert,
    AdminPageHeader,
    adminInputClass,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
} from '@/components/admin/ui/AdminPrimitives';
import { setAdminFlash } from '@/lib/admin/flash';
import { createUser } from '@/services/admin/userService';
import {
    GROUP_ROLE_OPTIONS,
    roleLabelFromEnterpriseRoleCode,
    toUiRoleFromEnterpriseRoleCode,
} from '@/lib/shared/role-directory';

export default function CreateUserPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [groupOptions, setGroupOptions] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
        status: 'Active',
        roleCode: 'LEARNER',
    });

    useEffect(() => {
        let active = true;
        const loadGroups = async () => {
            try {
                setLoadingGroups(true);
                const response = await fetch('/api/groups', { cache: 'no-store' });
                const payload = await response.json().catch(() => []);
                if (!response.ok || !active) return;
                const normalized = Array.isArray(payload)
                    ? payload
                        .map((row) => ({
                            code: String(row?.code || '').trim().toUpperCase(),
                            name: String(row?.name || '').trim(),
                            roleCode: String(row?.roleCode || 'LEARNER').trim().toUpperCase(),
                            isSystemDefault: Boolean(row?.isSystemDefault),
                        }))
                        .filter((row) => row.code)
                    : [];
                setGroupOptions(normalized);
                setFormData((prev) => {
                    if (prev.roleCode) return prev;
                    const fallbackRole = normalized[0]?.roleCode || 'LEARNER';
                    return {
                        ...prev,
                        roleCode: fallbackRole,
                    };
                });
            } catch (loadErr) {
                console.error('[CreateUser] load groups failed', loadErr);
            } finally {
                if (active) setLoadingGroups(false);
            }
        };

        loadGroups();
        return () => { active = false; };
    }, []);

    const assignedGroup = useMemo(() => {
        const roleCode = String(formData.roleCode || '').trim().toUpperCase() || 'LEARNER';
        return groupOptions.find((item) => item.roleCode === roleCode && item.isSystemDefault)
            || groupOptions.find((item) => item.roleCode === roleCode)
            || null;
    }, [formData.roleCode, groupOptions]);

    const selectedRoleLabel = useMemo(() => {
        return roleLabelFromEnterpriseRoleCode(formData.roleCode || 'LEARNER');
    }, [formData.roleCode]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const normalizePhoneInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 20);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.username.trim() || !formData.email.trim() || !formData.password) {
            setError('Please enter username, email, and password.');
            return;
        }
        if (formData.phoneNumber && !/^\d{8,20}$/.test(formData.phoneNumber)) {
            setError('Phone number must contain 8 to 20 digits.');
            return;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Confirm password does not match.');
            return;
        }
        if (!assignedGroup?.code) {
            setError('Role group is not ready yet. Please check Group Management first.');
            return;
        }

        setSaving(true);
        try {
            const role = toUiRoleFromEnterpriseRoleCode(formData.roleCode || 'LEARNER');
            await createUser({
                ...formData,
                role,
                selectedGroups: [assignedGroup.code],
            });
            setAdminFlash({
                tone: 'success',
                title: 'Created',
                message: `Created ${formData.username.trim()} successfully.`,
            });
            router.push('/admin-dashboard/manage-user/users');
        } catch (err) {
            setError(err?.message || 'Create user failed');
        } finally {
            setSaving(false);
        }
    };

    const labelClass = 'text-[14px] text-[#052143] font-medium';
    const boxClass = 'w-full min-h-[120px] rounded-xl border border-[#DDE4FF] px-3 py-3 text-[14px] text-[#334155] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 bg-white';

    return (
        <AdminShell>
            <div className="w-full flex flex-col gap-6 font-outfit">
                <AdminPageHeader
                    title="Create User"
                    description="Set login credentials, profile information, and default group access."
                />

                <AdminCard title="User Details">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <AdminInlineAlert>{error}</AdminInlineAlert>}

                        <div className="space-y-1.5">
                            <label className={labelClass}>Username</label>
                            <input
                                type="text"
                                placeholder="Username"
                                value={formData.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                                className={adminInputClass}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    className={`${adminInputClass} pr-10`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#687EFF]"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6.5 0-10-8-10-8a21.77 21.77 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 8 10 8a21.67 21.67 0 0 1-2.16 3.19" />
                                            <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
                                            <path d="M1 1l22 22" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Confirm Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="Confirm Password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                    className={`${adminInputClass} pr-10`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#687EFF]"
                                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                    title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                >
                                    {showConfirmPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6.5 0-10-8-10-8a21.77 21.77 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 8 10 8a21.67 21.67 0 0 1-2.16 3.19" />
                                            <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
                                            <path d="M1 1l22 22" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Full Name</label>
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={formData.fullName}
                                onChange={(e) => handleChange('fullName', e.target.value)}
                                className={adminInputClass}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Email</label>
                            <input
                                type="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className={adminInputClass}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Phone Number</label>
                            <input
                                type="tel"
                                placeholder="Phone Number"
                                value={formData.phoneNumber}
                                onChange={(e) => handleChange('phoneNumber', normalizePhoneInput(e.target.value))}
                                className={adminInputClass}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={20}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className={adminInputClass}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Suspended">Suspended</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Role</label>
                            <select
                                value={formData.roleCode}
                                onChange={(e) => handleChange('roleCode', String(e.target.value || 'LEARNER').toUpperCase())}
                                className={adminInputClass}
                                disabled={loadingGroups}
                            >
                                {GROUP_ROLE_OPTIONS.map((option) => (
                                    <option key={option.code} value={option.code}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Assigned Group (Auto)</label>
                            <div className={boxClass}>
                                {loadingGroups && <div className="text-[13px] text-[#64748B]">Loading groups...</div>}
                                {!loadingGroups && !assignedGroup && (
                                    <div className="text-[13px] text-rose-500">No default group found for {selectedRoleLabel}.</div>
                                )}
                                {!loadingGroups && assignedGroup && (
                                    <div className="space-y-1">
                                        <div className="text-[14px] font-semibold text-[#1F2937]">
                                            {assignedGroup.name || assignedGroup.code}
                                        </div>
                                        <div className="text-[12px] text-[#64748B]">Code: {assignedGroup.code}</div>
                                        <div className="text-[12px] text-[#64748B]">Role: {selectedRoleLabel}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className={adminPrimaryButtonClass}
                            >
                                {saving ? 'Submitting...' : 'Submit'}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/admin-dashboard/manage-user/users')}
                                className={adminSecondaryButtonClass}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </AdminCard>
            </div>
        </AdminShell>
    );
}

