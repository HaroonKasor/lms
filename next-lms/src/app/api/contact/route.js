import { NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/server/auth';
import { hasMailConfig, sendContactFormEmail } from '@/lib/server/mailer';
import { takeRateLimitToken } from '@/lib/server/rate-limit';
import { readJsonBody } from '@/lib/server/request-validation';

const CONTACT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_MAX_ATTEMPTS = 5;
const CONTACT_DEFAULT_TO = '6651630466@rumail.ru.ac.th';

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export async function POST(request) {
    try {
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const fullName = String(body?.fullName || '').trim();
        const email = String(body?.email || '').trim().toLowerCase();
        const subject = String(body?.subject || '').trim();
        const message = String(body?.message || '').trim();

        if (!fullName || !email || !subject || !message) {
            return NextResponse.json(
                { error: 'Full name, email, subject, and message are required' },
                { status: 400 }
            );
        }
        if (!isValidEmail(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }
        if (fullName.length > 100) {
            return NextResponse.json({ error: 'Full name is too long' }, { status: 400 });
        }
        if (subject.length > 200) {
            return NextResponse.json({ error: 'Subject is too long' }, { status: 400 });
        }
        if (message.length < 5 || message.length > 5000) {
            return NextResponse.json(
                { error: 'Message must be between 5 and 5000 characters' },
                { status: 400 }
            );
        }

        const ip = getRequestIp(request);
        const limiterKey = `contact:${ip}`;
        const rate = takeRateLimitToken({
            key: limiterKey,
            windowMs: CONTACT_WINDOW_MS,
            maxAttempts: CONTACT_MAX_ATTEMPTS,
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

        if (!hasMailConfig()) {
            return NextResponse.json(
                { error: 'Email service is not configured yet. Please contact administrator.' },
                { status: 503 }
            );
        }

        const contactTo = String(process.env.CONTACT_FORM_TO || CONTACT_DEFAULT_TO).trim() || CONTACT_DEFAULT_TO;
        await sendContactFormEmail({
            to: contactTo,
            fullName,
            email,
            subject,
            message,
        });

        return NextResponse.json({
            success: true,
            message: 'Message sent successfully',
        });
    } catch (err) {
        console.error('[contact] failed', err);
        const rawMessage = String(err?.message || '');
        const normalizedMessage = rawMessage.toLowerCase();
        if (normalizedMessage.includes('invalid api key') || normalizedMessage.includes('unauthorized')) {
            return NextResponse.json({ error: 'Email service authentication failed' }, { status: 502 });
        }
        if (String(err?.code || '').toUpperCase() === 'ETIMEDOUT' || normalizedMessage.includes('timeout')) {
            return NextResponse.json({ error: 'Email service timeout. Please try again.' }, { status: 504 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

