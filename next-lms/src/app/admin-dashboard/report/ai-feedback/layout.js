import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function AiFeedbackAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/report/ai-feedback' });
    return children;
}
