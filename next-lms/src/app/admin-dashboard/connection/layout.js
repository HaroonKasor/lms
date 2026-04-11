import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function ConnectionAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/connection' });
    return children;
}
