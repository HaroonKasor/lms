'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminFlash } from '@/lib/admin/flash';

export default function GroupCreatePage() {
    const router = useRouter();

    useEffect(() => {
        setAdminFlash({
            tone: 'info',
            title: 'System Roles Only',
            message: 'Group creation is disabled. Administrator, Instructor, and Learner are fixed default groups.',
        });
        router.replace('/admin-dashboard/group');
    }, [router]);

    return null;
}
