import { requireAdminOnlyAccess } from '@/lib/server/admin-role-guard';

export default async function CookieConsentReportLayout({ children }) {
    await requireAdminOnlyAccess({ nextPath: '/admin-dashboard/report/cookie-consent' });
    return children;
}
