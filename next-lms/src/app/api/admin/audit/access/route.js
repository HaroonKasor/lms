import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { canAccessAdminAudit, shouldShowAdminAuditInMenu } from '@/lib/server/admin-audit-access';

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const allowed = canAccessAdminAudit(session);
        return NextResponse.json({
            allowed,
            showInMenu: shouldShowAdminAuditInMenu(session),
        });
    } catch (err) {
        console.error('[admin/audit/access] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

