import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasMailConfig } from '@/lib/server/mailer';

export const dynamic = 'force-dynamic';

function noStoreJson(payload, status = 200) {
    return NextResponse.json(payload, {
        status,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}

export async function GET() {
    const startedAt = Date.now();
    const responsePayload = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        checks: {
            database: {
                ok: false,
                latencyMs: null,
                error: null,
            },
            mail: {
                configured: hasMailConfig(),
            },
            appUrl: String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim() || null,
        },
    };

    try {
        const dbStartedAt = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        responsePayload.checks.database.ok = true;
        responsePayload.checks.database.latencyMs = Date.now() - dbStartedAt;
    } catch (err) {
        responsePayload.status = 'degraded';
        responsePayload.checks.database.ok = false;
        responsePayload.checks.database.error = String(err?.message || err || 'Database check failed');
    }

    responsePayload.totalLatencyMs = Date.now() - startedAt;
    return noStoreJson(responsePayload, responsePayload.status === 'ok' ? 200 : 503);
}

