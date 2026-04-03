import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCookieStoreSession } from '@/lib/server/auth';
import { canAccessAdminAudit } from '@/lib/server/admin-audit-access';
import AuditLogScreen from './screen';

export default async function AuditLogPage() {
    const cookieStore = await cookies();
    const session = await getCookieStoreSession(cookieStore);
    if (!session?.isAdmin) {
        redirect('/login?next=/admin-dashboard/report/audit-log');
    }
    if (!canAccessAdminAudit(session)) {
        redirect('/admin-dashboard');
    }

    return <AuditLogScreen />;
}

