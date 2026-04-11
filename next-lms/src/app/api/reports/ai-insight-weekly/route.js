import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { buildWeeklyChatFeedbackInsights } from '@/lib/server/chat-feedback';

function toPositiveInt(value, fallback = 8) {
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
        const weeks = toPositiveInt(searchParams.get('weeks'), 8);
        const result = await buildWeeklyChatFeedbackInsights({ organizationId, weeks });
        return NextResponse.json(result);
    } catch (err) {
        console.error('[reports/ai-insight-weekly][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
