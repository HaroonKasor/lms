import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function ManageUserAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/manage-user/users' });
    return children;
}
