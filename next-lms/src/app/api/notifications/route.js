import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { readJsonBody } from '@/lib/server/request-validation';
import {
    listUserNotifications,
    markAllUserNotificationsRead,
    markUserNotificationRead,
} from '@/lib/server/notifications';

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { searchParams } = new URL(request.url);
        const limit = Number(searchParams.get('limit') || 20);
        const data = await listUserNotifications({
            organizationId,
            userId: session.uid,
            limit,
        });

        return NextResponse.json(data);
    } catch (err) {
        console.error('[notifications/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const action = String(body?.action || '').trim().toUpperCase();

        if (action === 'MARK_ALL_READ') {
            const count = await markAllUserNotificationsRead({
                organizationId,
                userId: session.uid,
            });
            return NextResponse.json({ success: true, count });
        }

        if (action === 'MARK_READ') {
            const ok = await markUserNotificationRead({
                organizationId,
                userId: session.uid,
                notificationId: body?.notificationId,
            });
            if (!ok) {
                return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    } catch (err) {
        console.error('[notifications/PATCH] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
