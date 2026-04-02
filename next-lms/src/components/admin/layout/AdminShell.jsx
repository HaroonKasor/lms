'use client';

import React from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

export default function AdminShell({ children }) {
    return <AdminLmsDashboard>{children}</AdminLmsDashboard>;
}
