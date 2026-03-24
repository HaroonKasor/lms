import nodemailer from 'nodemailer';

let cachedTransporter = null;

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

export function hasSmtpConfig() {
    const cfg = getSmtpConfig();
    return Boolean(cfg.host && cfg.port && cfg.user && cfg.pass);
}

function getTransporter() {
    if (cachedTransporter) return cachedTransporter;
    const cfg = getSmtpConfig();

    if (!cfg.host || !cfg.port || !cfg.user || !cfg.pass) {
        throw new Error('SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
    }

    cachedTransporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: {
            user: cfg.user,
            pass: cfg.pass,
        },
    });

    return cachedTransporter;
}

export async function sendPasswordResetEmail({ to, name, resetUrl, ttlMinutes = 30 } = {}) {
    const cfg = getSmtpConfig();
    const transporter = getTransporter();
    const safeTo = String(to || '').trim();
    if (!safeTo) {
        throw new Error('Missing recipient email');
    }

    const appName = String(process.env.APP_NAME || 'SkillUp').trim();
    const fromAddress = cfg.from || cfg.user;
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

    await transporter.sendMail({
        from: fromAddress,
        to: safeTo,
        subject,
        text,
        html,
    });
}

export async function sendRegistrationSuccessEmail({ to, name } = {}) {
    const cfg = getSmtpConfig();
    const transporter = getTransporter();
    const safeTo = String(to || '').trim();
    if (!safeTo) {
        throw new Error('Missing recipient email');
    }

    const appName = String(process.env.APP_NAME || 'SkillUp').trim();
    const fromAddress = cfg.from || cfg.user;
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

    await transporter.sendMail({
        from: fromAddress,
        to: safeTo,
        subject,
        text,
        html,
    });
}
