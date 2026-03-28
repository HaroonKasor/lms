'use client';

import React, { useMemo, useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';
import { useRouter } from 'next/navigation';

const GROUP_OPTIONS = ['ADMINISTRATOR', 'INSTRUCTOR', 'LEARNER'];

function mapGroupsToRole(groups = []) {
    if (groups.includes('ADMINISTRATOR')) return 'admin';
    if (groups.includes('INSTRUCTOR')) return 'instructor';
    return 'user';
}

export default function CreateUserPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
        status: 'Active',
        selectedGroups: ['LEARNER'],
    });

    const groupSummary = useMemo(() => {
        if (formData.selectedGroups.length === 0) return 'No group selected';
        return formData.selectedGroups.join(', ');
    }, [formData.selectedGroups]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const normalizePhoneInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 20);

    const handleToggleGroup = (group) => {
        setFormData((prev) => {
            const exists = prev.selectedGroups.includes(group);
            if (exists) {
                const remaining = prev.selectedGroups.filter((item) => item !== group);
                return { ...prev, selectedGroups: remaining };
            }
            return { ...prev, selectedGroups: [...prev.selectedGroups, group] };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.username.trim() || !formData.email.trim() || !formData.password) {
            setError('กรุณากรอก Username, Email และ Password');
            return;
        }
        if (formData.phoneNumber && !/^\d{8,20}$/.test(formData.phoneNumber)) {
            setError('Phone Number ต้องเป็นตัวเลข 8-20 หลัก');
            return;
        }
        if (formData.password.length < 6) {
            setError('Password ต้องอย่างน้อย 6 ตัวอักษร');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Confirm Password ไม่ตรงกัน');
            return;
        }
        if (formData.selectedGroups.length === 0) {
            setError('กรุณาเลือก Group อย่างน้อย 1 รายการ');
            return;
        }

        const role = mapGroupsToRole(formData.selectedGroups);
        const isActive = formData.status === 'Active';

        setSaving(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username.trim(),
                    email: formData.email.trim(),
                    password: formData.password,
                    fullName: formData.fullName.trim(),
                    phone: formData.phoneNumber.trim(),
                    role,
                    isActive,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || 'Create user failed');
                return;
            }

            setSuccess('สร้างผู้ใช้สำเร็จ');
            setTimeout(() => {
                router.push('/admin-dashboard/manage-user/users');
            }, 500);
        } catch (err) {
            setError(err?.message || 'Create user failed');
        } finally {
            setSaving(false);
        }
    };

    const labelClass = 'text-[14px] text-[#052143] font-medium';
    const inputClass = 'w-full h-[42px] rounded-[6px] border border-[#D1D9EE] px-3 text-[14px] text-[#334155] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 bg-white';
    const boxClass = 'w-full min-h-[120px] rounded-[6px] border border-[#D1D9EE] px-3 py-2 text-[14px] text-[#334155] outline-none focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 bg-white';

    return (
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-6 font-outfit">
                <h1 className="text-[40px] leading-none font-medium text-[#052143]">User</h1>

                <div className="bg-white border border-[#D1E3FB] rounded-[8px] overflow-hidden shadow-sm">
                    <div className="bg-[#687EFF] px-4 py-3 flex items-center gap-2 text-white font-medium text-[22px]">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                        User
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4">
                        {error && (
                            <div className="rounded-[6px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="rounded-[6px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
                                {success}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className={labelClass}>Username</label>
                            <input
                                type="text"
                                placeholder="Username"
                                value={formData.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                                className={inputClass}
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
                                    className={`${inputClass} pr-10`}
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
                                    className={`${inputClass} pr-10`}
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
                                className={inputClass}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Email</label>
                            <input
                                type="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className={inputClass}
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
                                className={inputClass}
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
                                className={inputClass}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Suspended">Suspended</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className={labelClass}>Group List</label>
                            <div className={`${boxClass} overflow-y-auto`}>
                                <div className="space-y-2">
                                    {GROUP_OPTIONS.map((group) => (
                                        <label key={group} className="flex items-center gap-2 cursor-pointer text-[#334155]">
                                            <input
                                                type="checkbox"
                                                checked={formData.selectedGroups.includes(group)}
                                                onChange={() => handleToggleGroup(group)}
                                                className="h-4 w-4 rounded border-[#CBD5E1] text-[#687EFF] focus:ring-[#687EFF]"
                                            />
                                            <span>{group}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="text-[12px] text-[#6B778B]">Selected: {groupSummary}</div>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="h-[42px] px-6 rounded-[6px] bg-[#687EFF] hover:bg-[#5A6FE0] text-white text-[14px] font-medium transition-colors disabled:opacity-60"
                            >
                                {saving ? 'Submitting...' : 'Submit'}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/admin-dashboard/manage-user/users')}
                                className="h-[42px] px-6 rounded-[6px] border border-[#D1D9EE] bg-white text-[#334155] text-[14px] font-medium hover:bg-[#F8FAFF]"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLmsDashboard>
    );
}
