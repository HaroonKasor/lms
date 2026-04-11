import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { listChatFeedback } from '@/lib/server/chat-feedback';

function toPositiveInt(value, fallback = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.floor(n);
    return int > 0 ? int : fallback;
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { searchParams } = new URL(request.url);

        const page = toPositiveInt(searchParams.get('page'), 1);
        const limit = toPositiveInt(searchParams.get('limit'), 20);
        const rating = String(searchParams.get('rating') || 'all').trim().toLowerCase();
        const fromDate = String(searchParams.get('fromDate') || '').trim();
        const toDate = String(searchParams.get('toDate') || '').trim();
        const course = String(searchParams.get('course') || '').trim();
        const q = String(searchParams.get('q') || '').trim();

        const result = await listChatFeedback({
            organizationId,
            page,
            limit,
            rating,
            fromDate,
            toDate,
            course,
            q,
        });
        return NextResponse.json(result);
    } catch (err) {
        console.error('[reports/ai-feedback][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
