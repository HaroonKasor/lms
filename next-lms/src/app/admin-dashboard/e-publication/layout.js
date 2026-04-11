import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function EPublicationAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/e-publication' });
    return children;
}
