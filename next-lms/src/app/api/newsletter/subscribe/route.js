import { NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/server/auth';
import { hasMailConfig, sendNewsletterSubscriptionNotification } from '@/lib/server/mailer';
import { subscribeNewsletter } from '@/lib/server/newsletter';
import { takeRateLimitToken } from '@/lib/server/rate-limit';
import { readJsonBody } from '@/lib/server/request-validation';

const SUBSCRIBE_WINDOW_MS = 15 * 60 * 1000;
const SUBSCRIBE_MAX_ATTEMPTS = 8;
const DEFAULT_NOTIFY_TO = '6651630466@rumail.ru.ac.th';

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export async function POST(request) {
    try {
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const email = String(body?.email || '').trim().toLowerCase();
        const source = String(body?.source || 'footer').trim() || 'footer';

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }
        if (!isValidEmail(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        const ip = getRequestIp(request);
        const limiterKey = `newsletter:${ip}`;
        const rate = takeRateLimitToken({
            key: limiterKey,
            windowMs: SUBSCRIBE_WINDOW_MS,
            maxAttempts: SUBSCRIBE_MAX_ATTEMPTS,
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

        const result = await subscribeNewsletter({
            email,
            source,
            requestedIp: ip,
            userAgent: request?.headers?.get('user-agent') || '',
        });

        if (hasMailConfig()) {
            const notifyTo = String(process.env.NEWSLETTER_NOTIFY_TO || process.env.CONTACT_FORM_TO || DEFAULT_NOTIFY_TO).trim() || DEFAULT_NOTIFY_TO;
            sendNewsletterSubscriptionNotification({
                notifyTo,
                subscriberEmail: email,
                source,
            }).catch((mailErr) => {
                console.error('[newsletter/subscribe] notify email failed', mailErr);
            });
        }

        if (result.state === 'already_subscribed') {
            return NextResponse.json({
                success: true,
                state: result.state,
                message: 'Email is already subscribed.',
            });
        }

        return NextResponse.json({
            success: true,
            state: result.state,
            message: 'Subscription successful.',
        });
    } catch (err) {
        console.error('[newsletter/subscribe] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

