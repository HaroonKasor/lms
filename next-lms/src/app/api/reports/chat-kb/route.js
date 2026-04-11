import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import {
    listChatKnowledgeBase,
    removeChatKnowledgeItem,
    upsertChatKnowledgeItem,
} from '@/lib/server/chat-kb';

function toPositiveInt(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.floor(n);
    return int > 0 ? int : fallback;
}

function normalizePayload(body = {}) {
    return {
        itemId: toPositiveInt(body?.itemId, 0),
        title: String(body?.title || '').trim(),
        content: String(body?.content || '').trim(),
        tags: Array.isArray(body?.tags) ? body.tags : [],
        intents: Array.isArray(body?.intents) ? body.intents : [],
        isActive: body?.isActive !== false,
    };
}

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;
        const organizationId = Number(session?.organizationId || 0);
        const { searchParams } = new URL(request.url);
        const q = String(searchParams.get('q') || '').trim();
        const items = await listChatKnowledgeBase({ organizationId, q });
        return NextResponse.json({ items });
    } catch (err) {
        console.error('[reports/chat-kb][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;
        const organizationId = Number(session?.organizationId || 0);
        const payload = normalizePayload(await request.json());
        if (!payload.title || !payload.content) {
            return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
        }
        const result = await upsertChatKnowledgeItem({
            organizationId,
            actorUserId: Number(session?.uid || 0) || null,
            itemId: payload.itemId || null,
            title: payload.title,
            content: payload.content,
            tags: payload.tags,
            intents: payload.intents,
            isActive: payload.isActive,
        });
        return NextResponse.json({ ok: true, id: result.id });
    } catch (err) {
        const message = String(err?.message || '');
        if (message.includes('required')) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        console.error('[reports/chat-kb][POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;
        const organizationId = Number(session?.organizationId || 0);
        const { searchParams } = new URL(request.url);
        const itemId = toPositiveInt(searchParams.get('itemId'), 0);
        if (!itemId) {
            return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }
        await removeChatKnowledgeItem({ organizationId, itemId });
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[reports/chat-kb][DELETE] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
