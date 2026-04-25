import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCookieStoreSession } from '@/lib/server/auth';
import LrsViewerScreen from './screen';

export default async function LrsViewerPage() {
    const cookieStore = await cookies();
    const session = await getCookieStoreSession(cookieStore);
    if (!session?.isAdmin) {
        redirect('/login?next=/admin-dashboard/report/lrs-viewer');
    }
    return <LrsViewerScreen />;
}
