import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function AiInsightWeeklyAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/report/ai-insight-weekly' });
    return children;
}
