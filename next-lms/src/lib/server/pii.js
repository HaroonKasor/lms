import crypto from 'crypto';

const MAX_TEXT_LENGTH = 4000;

function sanitizeText(value, maxLength = MAX_TEXT_LENGTH) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function hashPiiValue(value) {
    const text = sanitizeText(value, 512);
    if (!text) return '';
    const salt = String(process.env.PII_HASH_SALT || process.env.SESSION_SECRET || 'skillup-pii-salt');
    return crypto.createHash('sha256').update(`${salt}:${text}`).digest('hex').slice(0, 16);
}

export function maskEmail(value) {
    const email = sanitizeText(value, 255).toLowerCase();
    if (!email || !email.includes('@')) return '';
    const [local = '', domain = ''] = email.split('@');
    if (!domain) return '';
    const lead = local.slice(0, Math.min(2, local.length));
    return `${lead || '*'}***@${domain}`;
}

export function maskUsername(value) {
    const username = sanitizeText(value, 120);
    if (!username) return '';
    const lead = username.slice(0, Math.min(2, username.length));
    return `${lead || '*'}***`;
}

export function maskIp(value) {
    const ip = sanitizeText(value, 80);
    if (!ip) return '';
    return `ip_${hashPiiValue(ip)}`;
}

export function redactPiiText(value, maxLength = MAX_TEXT_LENGTH) {
    let text = sanitizeText(value, maxLength);
    if (!text) return '';

    // Email
    text = text.replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        '[email]'
    );
    // Phone numbers (broad pattern)
    text = text.replace(
        /(?<!\w)(?:\+?\d[\d\s\-()]{7,}\d)(?!\w)/g,
        '[phone]'
    );
    // Thai national ID / long sensitive numeric identifiers
    text = text.replace(/\b\d{13,16}\b/g, '[id-number]');

    return text.slice(0, maxLength);
}

