import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCookieStoreSession } from '@/lib/server/auth';

function buildLoginUrl(nextPath = '/admin-dashboard') {
    const safeNext = String(nextPath || '/admin-dashboard');
    return `/login?next=${encodeURIComponent(safeNext)}`;
}

export async function requireAdminOnlyAccess(options = {}) {
    const nextPath = String(options?.nextPath || '/admin-dashboard');
    const cookieStore = await cookies();
    const session = await getCookieStoreSession(cookieStore);

    if (!session) {
        redirect(buildLoginUrl(nextPath));
    }

    if (!session?.isAdmin) {
        redirect('/dashboard');
    }

    return session;
}
