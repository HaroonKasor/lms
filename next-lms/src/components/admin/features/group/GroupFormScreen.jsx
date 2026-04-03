'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/admin/layout/AdminShell';
import {
    GROUP_ROLE_OPTIONS,
    normalizeEnterpriseRoleCode,
    roleLabelFromEnterpriseRoleCode,
} from '@/lib/shared/role-directory';
import {
    AdminCard,
    AdminInlineAlert,
    AdminPageHeader,
    adminInputClass,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
    adminTextareaClass,
} from '@/components/admin/ui/AdminPrimitives';

export default function GroupFormScreen({
    mode,
    initialValues,
    onSubmit,
}) {
    const router = useRouter();
    const [form, setForm] = useState(initialValues);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const pageTitle = mode === 'edit' ? 'Group Edit' : 'Group Create';
    const pageDescription = mode === 'edit'
        ? 'Update group details and role mapping for User Management.'
        : 'Create a role group (Administrator, Instructor, or Learner).';
    const cardTitle = mode === 'edit' ? 'Edit Group' : 'Create Group';
    const submitLabel = mode === 'edit' ? 'Update Group' : 'Submit';

    const normalizedRoleCode = normalizeEnterpriseRoleCode(form?.roleCode);
    const roleName = roleLabelFromEnterpriseRoleCode(normalizedRoleCode);
    const roleGroupCode = GROUP_ROLE_OPTIONS.find((item) => item.code === normalizedRoleCode)?.groupCode || normalizedRoleCode;
    const isSystemDefault = Boolean(form?.isSystemDefault);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await onSubmit({
                ...form,
                roleCode: normalizedRoleCode,
                roles: [roleName],
                code: String(form?.code || roleGroupCode).trim().toUpperCase(),
            });
            router.push('/admin-dashboard/group');
        } catch (submitError) {
            setError(submitError?.message || 'Unable to save group');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AdminShell>
            <div className="flex w-full flex-col gap-6 pb-8 font-outfit">
                <AdminPageHeader title={pageTitle} description={pageDescription} />

                <AdminCard title={cardTitle}>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error ? <AdminInlineAlert>{error}</AdminInlineAlert> : null}

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="block text-[14px] font-medium text-[#22304A]">Group Name</label>
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, code: event.target.value || current.code }))}
                                    placeholder="Group Name"
                                    className={adminInputClass}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[14px] font-medium text-[#22304A]">Code</label>
                                <input
                                    value={form.code || ''}
                                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                                    placeholder="GROUP_CODE"
                                    className={adminInputClass}
                                    disabled={isSystemDefault}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[14px] font-medium text-[#22304A]">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                placeholder="Describe the purpose of this group"
                                rows={4}
                                className={adminTextareaClass}
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[14px] font-medium text-[#22304A]">Status</label>
                            <div className="flex flex-wrap gap-6 rounded-xl border border-[#EEF2FF] bg-[#FBFCFF] px-4 py-3">
                                {[
                                    { value: true, label: 'Active' },
                                    { value: false, label: 'Inactive' },
                                ].map((option) => (
                                    <label key={String(option.value)} className="inline-flex items-center gap-3 text-[14px] text-[#334155]">
                                        <input
                                            type="radio"
                                            checked={form.isActive === option.value}
                                            onChange={() => setForm((current) => ({ ...current, isActive: option.value }))}
                                            className="h-4 w-4 border-[#B8C4EE] text-[#687EFF] focus:ring-[#687EFF]"
                                            disabled={isSystemDefault}
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                            {isSystemDefault ? <div className="text-[12px] text-[#64748B]">System role groups are always active.</div> : null}
                        </div>

                        <div className="space-y-2">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <label className="block text-[14px] font-medium text-[#22304A]">Role Type</label>
                                <div className="text-[12px] text-[#64748B]">This role will be applied in User Management.</div>
                            </div>
                            <div className="rounded-xl border border-[#DDE4FF] bg-white p-4">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    {GROUP_ROLE_OPTIONS.map((option) => (
                                        <label key={option.code} className="flex items-center gap-3 rounded-xl border border-[#E5EAFE] bg-[#FBFCFF] px-3 py-3 text-[14px] text-[#1F2937]">
                                            <input
                                                type="radio"
                                                checked={normalizedRoleCode === option.code}
                                                onChange={() => setForm((current) => ({ ...current, roleCode: option.code, code: option.groupCode, roles: [option.label] }))}
                                                className="h-4 w-4 border-[#B8C4EE] text-[#687EFF] focus:ring-[#687EFF]"
                                                disabled={isSystemDefault}
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{option.label}</span>
                                                <span className="text-[12px] text-[#64748B]">{option.groupCode}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <div className="mt-3 rounded-lg border border-[#E5EAFE] bg-[#F8FAFF] px-3 py-2 text-[12px] text-[#475569]">
                                    Selected role: <span className="font-semibold text-[#1F2937]">{roleName}</span> ({roleGroupCode})
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 border-t border-[#EEF2FF] pt-5">
                            <button
                                type="submit"
                                disabled={submitting}
                                className={adminPrimaryButtonClass}
                            >
                                {submitting ? 'Saving...' : submitLabel}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/admin-dashboard/group')}
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
