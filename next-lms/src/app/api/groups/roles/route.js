import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { listGroupRoleOptionsFromDb } from '@/lib/server/group-directory-db';

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const result = await listGroupRoleOptionsFromDb();
        return NextResponse.json({
            categories: result?.categories || [],
            roles: result?.roles || [],
        });
    } catch (err) {
        console.error('[groups/roles/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

