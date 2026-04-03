import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { readJsonBody } from '@/lib/server/request-validation';
import { listAdminAuditLogs, writeAdminAudit } from '@/lib/server/admin-audit';
import { canAccessAdminAudit } from '@/lib/server/admin-audit-access';

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;
        if (!canAccessAdminAudit(session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const organizationId = await ensureDefaultOrganization();
        const { searchParams } = new URL(request.url);
        const limit = Number(searchParams.get('limit') || 50);
        const page = Number(searchParams.get('page') || 1);
        const action = String(searchParams.get('action') || '');
        const entity = String(searchParams.get('entity') || '');
        const search = String(searchParams.get('search') || '');

        const result = await listAdminAuditLogs({
            organizationId,
            limit,
            page,
            action,
            entity,
            search,
        });
        return NextResponse.json(result);
    } catch (err) {
        console.error('[admin/audit/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;
        if (!canAccessAdminAudit(session)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const organizationId = await ensureDefaultOrganization();
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const row = await writeAdminAudit({
            organizationId,
            actorUserId: session.uid,
            actorUsername: session.user?.username || '',
            actorEmail: session.user?.email || '',
            action: String(body?.action || 'MANUAL_NOTE'),
            entity: String(body?.entity || 'SYSTEM'),
            entityId: body?.entityId ?? null,
            message: String(body?.message || 'Manual admin audit note'),
            severity: String(body?.severity || 'info'),
            details: body?.details && typeof body.details === 'object' ? body.details : null,
            request: {
                path: '/api/admin/audit',
                method: 'POST',
            },
        });

        return NextResponse.json({ success: true, item: row });
    } catch (err) {
        console.error('[admin/audit/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
