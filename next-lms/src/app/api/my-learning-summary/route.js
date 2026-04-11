import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { buildMyLearningSummary } from '@/lib/server/my-learning-summary';
import { logMyLearningSummaryAccess } from '@/lib/server/my-learning-summary-audit';

function resolveSummaryCacheTtlMs() {
    const raw = Number(process.env.MY_LEARNING_SUMMARY_CACHE_TTL_MS || '');
    if (!Number.isFinite(raw) || raw <= 0) return 45 * 1000;
    return Math.max(30 * 1000, Math.min(60 * 1000, Math.floor(raw)));
}

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const courseQuery = String(searchParams.get('course') || '').trim();
        const summary = await buildMyLearningSummary({
            session,
            courseQuery,
            cacheTtlMs: resolveSummaryCacheTtlMs(),
        });

        const status = Number(summary?.totals?.totalCourses || 0) > 0
            ? 'ok'
            : (courseQuery ? 'course_not_found' : 'no_course');
        await logMyLearningSummaryAccess({
            request,
            session,
            source: 'api',
            courseQuery,
            totalCourses: Number(summary?.totals?.totalCourses || 0),
            status,
        });
        return NextResponse.json(summary);
    } catch (err) {
        console.error('[my-learning-summary/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
