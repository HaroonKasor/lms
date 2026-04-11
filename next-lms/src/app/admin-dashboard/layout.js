import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCookieStoreSession } from '@/lib/server/auth';

export default async function AdminDashboardLayout({ children }) {
    const cookieStore = await cookies();
    const session = await getCookieStoreSession(cookieStore);

    if (!session) {
        redirect('/login?next=/admin-dashboard');
    }
    const role = String(session?.role || '').toLowerCase();
    if (!(session.isAdmin || role === 'instructor')) {
        redirect('/dashboard');
    }

    return children;
}
