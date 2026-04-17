import { NextResponse } from 'next/server';
import { resolveCookiePolicyVersion } from '@/lib/cookie-consent';
import { getRequestIp, getRequestSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { logCookieConsent } from '@/lib/server/cookie-consent';

export async function GET() {
    return NextResponse.json({
        success: true,
        policyVersion: resolveCookiePolicyVersion(),
    });
}

export async function POST(request) {
    try {
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const consent = body?.consent && typeof body.consent === 'object' ? body.consent : body;
        if (!consent || typeof consent !== 'object') {
            return NextResponse.json({ error: 'Missing consent payload' }, { status: 400 });
        }

        const session = await getRequestSession(request);
        const requestedIp = getRequestIp(request);
        const userAgent = request.headers.get('user-agent') || null;

        const payload = await logCookieConsent({
            consent,
            userId: session?.uid || null,
            requestedIp,
            userAgent,
        });

        return NextResponse.json({
            success: true,
            policyVersion: payload.policyVersion,
            choice: payload.choice,
            categories: payload.categories,
        });
    } catch (err) {
        console.error('[cookie-consent] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

