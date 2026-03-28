import nodemailer from 'nodemailer';

let cachedTransporter = null;
const DEFAULT_RESEND_BASE_URL = 'https://api.resend.com';
const MAIL_TIMEOUT_MS = 15000;

function parseBoolean(value, fallback = false) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return fallback;
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function getSmtpConfig() {
    const host = String(process.env.SMTP_HOST || '').trim();
    const portRaw = String(process.env.SMTP_PORT || '').trim();
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || '').trim();
    const from = String(process.env.SMTP_FROM || '').trim();
    const secure = parseBoolean(process.env.SMTP_SECURE, Number(portRaw || '0') === 465);

    return {
        host,
        port: Number(portRaw || '587'),
        user,
        pass,
        from,
        secure,
    };
}

function getResendConfig() {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.RESEND_FROM || process.env.SMTP_FROM || '').trim();
    const baseUrl = String(process.env.RESEND_BASE_URL || DEFAULT_RESEND_BASE_URL).trim() || DEFAULT_RESEND_BASE_URL;
    return {
        apiKey,
        from,
        baseUrl,
    };
}

function hasResendConfig() {
    const cfg = getResendConfig();
    return Boolean(cfg.apiKey && cfg.from);
}

function hasStrictSmtpConfig() {
    const cfg = getSmtpConfig();
    return Boolean(cfg.host && cfg.port && cfg.user && cfg.pass);
}

export function hasMailConfig() {
    return hasResendConfig() || hasStrictSmtpConfig();
}

// Backward-compatible export name used by existing callers.
export function hasSmtpConfig() {
    return hasMailConfig();
}

function getTransporter() {
    if (cachedTransporter) return cachedTransporter;
    const cfg = getSmtpConfig();

    if (!cfg.host || !cfg.port || !cfg.user || !cfg.pass) {
        throw new Error('Email service is not configured. Set RESEND_API_KEY/RESEND_FROM or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.');
    }

    cachedTransporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        connectionTimeout: MAIL_TIMEOUT_MS,
        greetingTimeout: MAIL_TIMEOUT_MS,
        socketTimeout: MAIL_TIMEOUT_MS,
        auth: {
            user: cfg.user,
            pass: cfg.pass,
        },
    });

    return cachedTransporter;
}

function createTimeoutSignal(timeoutMs = MAIL_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        clear: () => clearTimeout(timer),
    };
}

async function sendViaResend({ to, subject, text, html }) {
    const cfg = getResendConfig();
    if (!cfg.apiKey || !cfg.from) {
        throw new Error('Email service is not configured. Missing RESEND_API_KEY or RESEND_FROM.');
    }

    const { signal, clear } = createTimeoutSignal();
    try {
        const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/emails`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cfg.apiKey}`,
            },
            body: JSON.stringify({
                from: cfg.from,
                to: [to],
                subject,
                text,
                html,
            }),
            signal,
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            const msg = String(payload?.message || payload?.error || res.statusText || 'Resend request failed');
            throw new Error(`Resend send failed (${res.status}): ${msg}`);
        }
    } finally {
        clear();
    }
}

async function sendViaSmtp({ to, subject, text, html }) {
    const cfg = getSmtpConfig();
    const transporter = getTransporter();
    const fromAddress = cfg.from || cfg.user;
    await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html,
    });
}

async function sendEmail({ to, subject, text, html }) {
    if (hasResendConfig()) {
        await sendViaResend({ to, subject, text, html });
        return;
    }
    await sendViaSmtp({ to, subject, text, html });
}

export async function sendPasswordResetEmail({ to, name, resetUrl, ttlMinutes = 30 } = {}) {
    const safeTo = String(to || '').trim();
    if (!safeTo) {
        throw new Error('Missing recipient email');
    }

    const appName = String(process.env.APP_NAME || 'SkillUp').trim();
    const displayName = String(name || '').trim() || 'Learner';

    const subject = `[${appName}] Password reset request`;
    const text = [
        `Hi ${displayName},`,
        '',
        'We received a request to reset your password.',
        `Use this link within ${ttlMinutes} minutes:`,
        resetUrl,
        '',
        'If you did not request this, please ignore this email.',
    ].join('\n');

    const html = `
        <div style="font-family: 'Noto Sans Thai', 'Segoe UI', Tahoma, Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <p>Hi ${displayName},</p>
          <p>We received a request to reset your password.</p>
          <p>Please click the button below within <strong>${ttlMinutes} minutes</strong>:</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; padding: 10px 18px; border-radius: 999px; background: #F87A53; color: #fff; text-decoration: none; font-weight: 600;">
              Reset Password
            </a>
          </p>
          <p>If the button does not work, copy this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
    `;

    await sendEmail({
        to: safeTo,
        subject,
        text,
        html,
    });
}

export async function sendRegistrationSuccessEmail({ to, name } = {}) {
    const safeTo = String(to || '').trim();
    if (!safeTo) {
        throw new Error('Missing recipient email');
    }

    const appName = String(process.env.APP_NAME || 'SkillUp').trim();
    const displayName = String(name || '').trim() || 'Learner';
    const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || '').trim() || 'http://localhost:8080';

    const subject = `[${appName}] Registration successful`;
    const text = [
        `Hi ${displayName},`,
        '',
        `Your account has been created successfully on ${appName}.`,
        `You can sign in here: ${appUrl}/login`,
        '',
        'If this was not you, please contact support immediately.',
    ].join('\n');

    const html = `
        <div style="font-family: 'Noto Sans Thai', 'Segoe UI', Tahoma, Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <p>Hi ${displayName},</p>
          <p>Your account has been created successfully on <strong>${appName}</strong>.</p>
          <p>
            <a href="${appUrl}/login" style="display: inline-block; padding: 10px 18px; border-radius: 999px; background: #687EFF; color: #fff; text-decoration: none; font-weight: 600;">
              Sign In
            </a>
          </p>
          <p>If this was not you, please contact support immediately.</p>
        </div>
    `;

    await sendEmail({
        to: safeTo,
        subject,
        text,
        html,
    });
}

export async function sendContactFormEmail({
    to,
    fullName,
    email,
    subject,
    message,
} = {}) {
    const safeTo = String(to || '').trim();
    if (!safeTo) {
        throw new Error('Missing recipient email');
    }

    const safeName = String(fullName || '').trim() || 'Anonymous';
    const safeFromEmail = String(email || '').trim();
    const safeSubject = String(subject || '').trim() || 'Contact form message';
    const safeMessage = String(message || '').trim();
    if (!safeMessage) {
        throw new Error('Missing message');
    }

    const appName = String(process.env.APP_NAME || 'SkillUp').trim();
    const mailSubject = `[${appName}] Contact: ${safeSubject}`;

    const text = [
        `Name: ${safeName}`,
        `Email: ${safeFromEmail || '-'}`,
        `Subject: ${safeSubject}`,
        '',
        safeMessage,
    ].join('\n');

    const html = `
        <div style="font-family: 'Noto Sans Thai', 'Segoe UI', Tahoma, Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2 style="margin: 0 0 10px 0;">New contact form message</h2>
          <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${safeName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${safeFromEmail || '-'}</p>
          <p style="margin: 0 0 14px 0;"><strong>Subject:</strong> ${safeSubject}</p>
          <div style="padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e5e7eb; white-space: pre-wrap;">${safeMessage}</div>
        </div>
    `;

    await sendEmail({
        to: safeTo,
        subject: mailSubject,
        text,
        html,
    });
}

export async function sendNewsletterSubscriptionNotification({
    notifyTo,
    subscriberEmail,
    source = 'footer',
} = {}) {
    const safeTo = String(notifyTo || '').trim();
    const safeSubscriberEmail = String(subscriberEmail || '').trim();
    if (!safeTo) {
        throw new Error('Missing newsletter notification recipient');
    }
    if (!safeSubscriberEmail) {
        throw new Error('Missing subscriber email');
    }

    const appName = String(process.env.APP_NAME || 'SkillUp').trim();
    const safeSource = String(source || '').trim() || 'footer';
    const subject = `[${appName}] New newsletter subscriber`;
    const text = [
        `A new newsletter subscription was received.`,
        '',
        `Email: ${safeSubscriberEmail}`,
        `Source: ${safeSource}`,
    ].join('\n');

    const html = `
        <div style="font-family: 'Noto Sans Thai', 'Segoe UI', Tahoma, Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2 style="margin: 0 0 10px 0;">New newsletter subscription</h2>
          <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${safeSubscriberEmail}</p>
          <p style="margin: 0;"><strong>Source:</strong> ${safeSource}</p>
        </div>
    `;

    await sendEmail({
        to: safeTo,
        subject,
        text,
        html,
    });
}
