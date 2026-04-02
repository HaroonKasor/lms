'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GroupFormScreen from '@/components/admin/features/group/GroupFormScreen';
import AdminShell from '@/components/admin/layout/AdminShell';
import { AdminInlineAlert, AdminPageHeader } from '@/components/admin/ui/AdminPrimitives';
import { setAdminFlash } from '@/lib/admin/flash';
import { getGroupById, updateGroup } from '@/services/admin/groupService';

export default function GroupEditPage() {
    const params = useParams();
    const router = useRouter();
    const [group, setGroup] = useState(null);
    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        const loadGroup = async () => {
            try {
                setLoadError('');
                const target = await getGroupById(params?.id);
                if (!target) {
                    router.replace('/admin-dashboard/group');
                    return;
                }
                setGroup(target);
                setReady(true);
            } catch (error) {
                console.error(error);
                setLoadError(error?.message || 'Unable to load group');
                setReady(true);
            }
        };

        loadGroup();
    }, [params?.id, router]);

    if (!ready) return null;

    if (loadError || !group) {
        return (
            <AdminShell>
                <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 pb-8">
                    <AdminPageHeader title="Group Edit" description="Update group details and assigned permissions." />
                    <AdminInlineAlert>{loadError || 'Unable to load group'}</AdminInlineAlert>
                </div>
            </AdminShell>
        );
    }

    return (
        <GroupFormScreen
            mode="edit"
            initialValues={{
                code: group.code,
                name: group.name,
                description: group.description,
                roleCode: String(group.roleCode || 'LEARNER').toUpperCase(),
                isActive: group.isActive,
                roles: group.roles,
            }}
            onSubmit={async (form) => {
                await updateGroup(params?.id, form);
                setAdminFlash({
                    tone: 'success',
                    title: 'Updated',
                    message: `Updated ${String(form?.name || 'group').trim()} successfully.`,
                });
            }}
        />
    );
}
