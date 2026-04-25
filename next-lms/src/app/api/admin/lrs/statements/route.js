import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 25;

function parseDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function buildVerbDisplay(verbId) {
    const raw = String(verbId || '').trim();
    if (!raw) return 'unknown';
    return raw.split('/').pop() || raw;
}

function pickActorEmail(row) {
    return String(row?.actor?.email || '').trim();
}

function pickActorName(row) {
    return String(row?.actor?.username || row?.actor?.email || 'Anonymous').trim();
}

function pickObjectName(payload) {
    const def = payload?.object?.definition || {};
    const name = def?.name || {};
    return String(
        name['en-US']
        || name.en
        || name.th
        || payload?.object?.id
        || ''
    ).trim();
}

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;
        if (!session?.isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const actorRaw = String(searchParams.get('actor') || '').trim();
        const verbRaw = String(searchParams.get('verb') || '').trim();
        const activityRaw = String(searchParams.get('activity') || '').trim();
        const since = parseDate(searchParams.get('since'));
        const until = parseDate(searchParams.get('until'));
        const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT));
        const page = Math.max(1, Number(searchParams.get('page')) || 1);

        const where = {};
        if (verbRaw) {
            where.verbId = { contains: verbRaw };
        }
        if (activityRaw) {
            where.objectId = { contains: activityRaw };
        }
        if (since || until) {
            where.receivedAt = {};
            if (since) where.receivedAt.gte = since;
            if (until) where.receivedAt.lte = until;
        }
        if (actorRaw) {
            where.actor = {
                OR: [
                    { email: { contains: actorRaw } },
                    { username: { contains: actorRaw } },
                ],
            };
        }

        const totalCount = await prisma.xapiStatement.count({ where });
        const rows = await prisma.xapiStatement.findMany({
            where,
            include: {
                actor: { select: { username: true, email: true } },
            },
            orderBy: { receivedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        });

        const items = rows.map((row) => {
            const payload = row?.statement_json && typeof row.statement_json === 'object' ? row.statement_json : {};
            const verbId = String(row?.verbId || payload?.verb?.id || '');
            const verbDisplay = String(
                payload?.verb?.display?.['en-US']
                || payload?.verb?.display?.en
                || payload?.verb?.display?.th
                || ''
            ).trim() || buildVerbDisplay(verbId);
            const objectId = String(row?.objectId || payload?.object?.id || '');
            const objectName = pickObjectName(payload) || objectId;

            return {
                id: row.id,
                statementId: payload?.id || row?.statementId || `db-${row.id}`,
                receivedAt: row?.receivedAt ? new Date(row.receivedAt).toISOString() : null,
                timestamp: payload?.timestamp || (row?.receivedAt ? new Date(row.receivedAt).toISOString() : null),
                actorEmail: pickActorEmail(row),
                actorName: pickActorName(row),
                verbId,
                verbDisplay,
                objectId,
                objectName,
                payload,
            };
        });

        return NextResponse.json({
            items,
            totalCount,
            page,
            limit,
        });
    } catch (err) {
        console.error('[admin/lrs/statements][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
