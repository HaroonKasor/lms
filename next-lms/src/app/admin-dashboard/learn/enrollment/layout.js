import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function EnrollmentAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/learn/enrollment' });
    return children;
}
