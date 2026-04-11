import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { createChatFeedback } from '@/lib/server/chat-feedback';

function sanitizePayload(body = {}) {
    return {
        messageId: String(body?.messageId || '').trim(),
        rating: String(body?.rating || '').trim().toLowerCase(),
        reason: String(body?.reason || '').trim(),
        assistantMessage: String(body?.assistantMessage || '').trim(),
        conversation: Array.isArray(body?.conversation) ? body.conversation : [],
        pagePath: String(body?.pagePath || '').trim(),
    };
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const rawBody = await request.json();
        const payload = sanitizePayload(rawBody);
        if (!payload.rating || !payload.assistantMessage) {
            return NextResponse.json(
                { error: 'rating and assistantMessage are required' },
                { status: 400 }
            );
        }

        const created = await createChatFeedback({
            request,
            session,
            messageId: payload.messageId,
            rating: payload.rating,
            reason: payload.reason,
            assistantMessage: payload.assistantMessage,
            conversation: payload.conversation,
            pagePath: payload.pagePath,
        });
        return NextResponse.json({
            ok: true,
            ...created,
        });
    } catch (err) {
        const message = String(err?.message || '');
        if (message === 'Invalid rating') {
            return NextResponse.json({ error: 'rating must be up or down' }, { status: 400 });
        }
        if (message === 'assistantMessage is required') {
            return NextResponse.json({ error: 'assistantMessage is required' }, { status: 400 });
        }
        console.error('[chat-feedback/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
