import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRequestIp } from '@/lib/server/auth';
import { takeRateLimitToken } from '@/lib/server/rate-limit';
import { readJsonBody } from '@/lib/server/request-validation';
import { cleanupPasswordResetTokens, createPasswordResetToken } from '@/lib/server/password-reset';
import { sendPasswordResetEmail } from '@/lib/server/mailer';

const FORGOT_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MINUTES = 30;

function buildResetUrl(request, token) {
    const explicitBase = String(process.env.PASSWORD_RESET_BASE_URL || '').trim();
    const fallbackBase = String(process.env.NEXT_PUBLIC_APP_URL || '').trim();
    const origin = request?.nextUrl?.origin || fallbackBase || 'http://localhost:8080';

    let base = origin;
    if (explicitBase) {
        try {
            // eslint-disable-next-line no-new
            new URL(explicitBase);
            base = explicitBase;
        } catch {
            base = origin;
        }
    }

    const url = new URL('/reset-password', base);
    url.searchParams.set('token', token);
    return url.toString();
}

export async function POST(request) {
    try {
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const email = String(body?.email || '').trim().toLowerCase();
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        const ip = getRequestIp(request);
        const limiterKey = `forgot-password:${ip}:${email}`;
        const rate = takeRateLimitToken({
            key: limiterKey,
            windowMs: FORGOT_WINDOW_MS,
            maxAttempts: FORGOT_MAX_ATTEMPTS,
        });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(rate.retryAfterSeconds),
                    },
                }
            );
        }

        const user = await prisma.user.findFirst({
            where: {
                email,
                status: 'active',
            },
            include: { profile: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'This email is not registered' }, { status: 404 });
        }

        await cleanupPasswordResetTokens(user.id);
        const { token } = await createPasswordResetToken({
            userId: user.id,
            requestedIp: ip,
            ttlMinutes: RESET_TOKEN_TTL_MINUTES,
        });

        const resetUrl = buildResetUrl(request, token);
        const fullName = `${String(user.profile?.firstName || '').trim()} ${String(user.profile?.lastName || '').trim()}`.trim();

        await sendPasswordResetEmail({
            to: user.email,
            name: fullName || user.username || user.email,
            resetUrl,
            ttlMinutes: RESET_TOKEN_TTL_MINUTES,
        });

        return NextResponse.json({
            success: true,
            message: 'Password reset email sent successfully',
        });
    } catch (err) {
        console.error('[auth/forgot-password] failed', err);
        const message = String(err?.message || '');
        if (message.includes('Email service is not configured')) {
            return NextResponse.json(
                { error: 'Email service is not configured yet. Please contact administrator.' },
                { status: 503 }
            );
        }
        if (String(err?.code || '').toUpperCase() === 'ETIMEDOUT' || message.toLowerCase().includes('timeout')) {
            return NextResponse.json(
                { error: 'Email service timeout. Please try again in a moment.' },
                { status: 504 }
            );
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
