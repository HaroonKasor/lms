import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { buildChatAnalytics } from '@/lib/server/chat-analytics';

function toPositiveInt(value, fallback = 4) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.floor(n);
    return int > 0 ? int : fallback;
}

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const organizationId = Number(session?.organizationId || 0);
        const { searchParams } = new URL(request.url);
        const weeks = toPositiveInt(searchParams.get('weeks'), 4);
        const result = await buildChatAnalytics({ organizationId, weeks });
        return NextResponse.json(result);
    } catch (err) {
        console.error('[reports/chat-analytics][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
