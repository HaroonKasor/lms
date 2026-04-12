import { NextResponse } from 'next/server';
import { triggerEnrollmentExpiryReminderSweep } from '@/lib/server/enrollment-email-reminders';

function getCronSecret() {
    return String(process.env.CRON_SECRET || '').trim();
}

function isAuthorized(request) {
    const secret = getCronSecret();
    if (!secret) return false;

    const authHeader = String(request.headers.get('authorization') || '').trim();
    const tokenFromHeader = String(request.headers.get('x-cron-secret') || '').trim();
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';

    return tokenFromHeader === secret || bearerToken === secret;
}

async function handle(request) {
    if (!getCronSecret()) {
        return NextResponse.json({ error: 'Cron secret is not configured' }, { status: 503 });
    }
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';
    const result = await triggerEnrollmentExpiryReminderSweep({ force });
    return NextResponse.json({
        success: true,
        force,
        ...result,
    });
}

export async function GET(request) {
    try {
        return await handle(request);
    } catch (err) {
        console.error('[cron/enrollment-expiry-reminders][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        return await handle(request);
    } catch (err) {
        console.error('[cron/enrollment-expiry-reminders][POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
