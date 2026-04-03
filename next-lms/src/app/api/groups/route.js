import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import {
    createGroupInDb,
    deleteGroupFromDb,
    getGroupByIdFromDb,
    listGroupsFromDb,
    updateGroupInDb,
} from '@/lib/server/group-directory-db';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { writeAdminAudit } from '@/lib/server/admin-audit';

function errorResponse(err, fallbackMessage = 'Internal server error') {
    const status = Number(err?.status || 0);
    if (status >= 400 && status < 600) {
        return NextResponse.json({ error: err?.message || fallbackMessage }, { status });
    }
    return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get('id') || 0);
        if (Number.isInteger(id) && id > 0) {
            const result = await getGroupByIdFromDb(id);
            if (!result?.group) {
                return NextResponse.json({ error: 'Group not found' }, { status: 404 });
            }
            return NextResponse.json({ group: result.group });
        }

        const { groups } = await listGroupsFromDb();
        return NextResponse.json(groups);
    } catch (err) {
        console.error('[groups/GET] failed', err);
        return errorResponse(err);
    }
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const group = await createGroupInDb(body || {});
        const organizationId = await ensureDefaultOrganization();
        await writeAdminAudit({
            organizationId,
            actorUserId: session.uid,
            actorUsername: session.user?.username || '',
            actorEmail: session.user?.email || '',
            action: 'CREATE',
            entity: 'GROUP',
            entityId: group?.id ?? null,
            message: 'Created access group',
            severity: 'info',
            details: {
                groupCode: group?.code || '',
                groupName: group?.name || '',
            },
            request: { path: '/api/groups', method: 'POST' },
        });
        return NextResponse.json({ success: true, group });
    } catch (err) {
        if (Number(err?.status || 0) < 500) {
            return errorResponse(err);
        }
        console.error('[groups/POST] failed', err);
        return errorResponse(err);
    }
}

export async function PUT(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const id = Number(searchParams.get('id') || body?.id || 0);
        const group = await updateGroupInDb(id, body || {});
        const organizationId = await ensureDefaultOrganization();
        await writeAdminAudit({
            organizationId,
            actorUserId: session.uid,
            actorUsername: session.user?.username || '',
            actorEmail: session.user?.email || '',
            action: 'UPDATE',
            entity: 'GROUP',
            entityId: group?.id ?? id,
            message: 'Updated access group',
            severity: 'info',
            details: {
                groupCode: group?.code || '',
                groupName: group?.name || '',
            },
            request: { path: '/api/groups', method: 'PUT' },
        });
        return NextResponse.json({ success: true, group });
    } catch (err) {
        if (Number(err?.status || 0) < 500) {
            return errorResponse(err);
        }
        console.error('[groups/PUT] failed', err);
        return errorResponse(err);
    }
}

export async function DELETE(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get('id') || 0);
        const existing = await getGroupByIdFromDb(id).catch(() => null);
        await deleteGroupFromDb(id);
        const organizationId = await ensureDefaultOrganization();
        await writeAdminAudit({
            organizationId,
            actorUserId: session.uid,
            actorUsername: session.user?.username || '',
            actorEmail: session.user?.email || '',
            action: 'DELETE',
            entity: 'GROUP',
            entityId: id,
            message: 'Deleted access group',
            severity: 'warning',
            details: {
                groupCode: existing?.group?.code || '',
                groupName: existing?.group?.name || '',
            },
            request: { path: '/api/groups', method: 'DELETE' },
        });
        return NextResponse.json({ success: true });
    } catch (err) {
        if (Number(err?.status || 0) < 500) {
            return errorResponse(err);
        }
        console.error('[groups/DELETE] failed', err);
        return errorResponse(err);
    }
}
