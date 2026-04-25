import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function LrsViewerAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/report/lrs-viewer' });
    return children;
}
