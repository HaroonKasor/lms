import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function BatchEnrollmentAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/learn/batch-enrollment' });
    return children;
}
