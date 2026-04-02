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
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const group = await createGroupInDb(body || {});
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
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const id = Number(searchParams.get('id') || body?.id || 0);
        const group = await updateGroupInDb(id, body || {});
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
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get('id') || 0);
        await deleteGroupFromDb(id);
        return NextResponse.json({ success: true });
    } catch (err) {
        if (Number(err?.status || 0) < 500) {
            return errorResponse(err);
        }
        console.error('[groups/DELETE] failed', err);
        return errorResponse(err);
    }
}
