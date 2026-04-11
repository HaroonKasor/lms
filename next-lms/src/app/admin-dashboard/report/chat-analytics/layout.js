import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function ChatAnalyticsAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/report/chat-analytics' });
    return children;
}
