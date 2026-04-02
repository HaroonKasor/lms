'use client';

import React from 'react';
import GroupFormScreen from '@/components/admin/features/group/GroupFormScreen';
import { setAdminFlash } from '@/lib/admin/flash';
import { createGroup } from '@/services/admin/groupService';

export default function GroupCreatePage() {
    return (
        <GroupFormScreen
            mode="create"
            initialValues={{
                code: '',
                name: '',
                description: '',
                roleCode: 'LEARNER',
                isActive: true,
                roles: [],
            }}
            onSubmit={async (form) => {
                await createGroup(form);
                setAdminFlash({
                    tone: 'success',
                    title: 'Created',
                    message: `Created ${String(form?.name || 'group').trim()} successfully.`,
                });
            }}
        />
    );
}
