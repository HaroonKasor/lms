import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function ChatKnowledgeAdminLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/report/chat-kb' });
    return children;
}
