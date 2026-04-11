import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function AuditLogAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/report/audit-log' });
    return children;
}
