import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function GroupAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/group' });
    return children;
}
