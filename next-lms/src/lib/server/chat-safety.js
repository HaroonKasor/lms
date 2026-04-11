import crypto from 'crypto';

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 18;
const SPAM_WINDOW_MS = 25 * 1000;
const SPAM_REPEAT_LIMIT = 3;
const MAX_USER_MESSAGE_CHARS = 2500;

const PROMPT_INJECTION_PATTERN = /(?:ignore (?:all|any|the)? ?(?:previous|prior|above)? ?instructions|reveal (?:the )?(?:system|developer) prompt|system prompt|developer message|jailbreak|bypass (?:policy|guardrail)|act as (?:system|developer)|simulate (?:admin|root)|exfiltrat|prompt leak|tool call instructions|disable safety|forget your rules|override policy|ignore your rules)/i;

function nowMs() {
    return Date.now();
}

function toSafeString(value, maxLength = 3000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function hashText(value) {
    return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 20);
}

function getRateStore() {
    if (!globalThis.__chatRateLimitStore) {
        globalThis.__chatRateLimitStore = new Map();
    }
    return globalThis.__chatRateLimitStore;
}

function getSpamStore() {
    if (!globalThis.__chatSpamStore) {
        globalThis.__chatSpamStore = new Map();
    }
    return globalThis.__chatSpamStore;
}

function cleanupStore(map, windowMs) {
    const now = nowMs();
    for (const [key, row] of map.entries()) {
        if (!row || now - Number(row.lastAt || 0) > windowMs * 2) {
            map.delete(key);
        }
    }
}

function buildActorKey({ userId = 0, ip = '' } = {}) {
    const uid = Number(userId || 0);
    if (Number.isInteger(uid) && uid > 0) return `u:${uid}`;
    const safeIp = toSafeString(ip, 120) || 'unknown';
    return `ip:${hashText(safeIp)}`;
}

export function detectPromptInjection(text = '') {
    const raw = toSafeString(text, MAX_USER_MESSAGE_CHARS);
    if (!raw) return { matched: false, reason: '' };
    if (PROMPT_INJECTION_PATTERN.test(raw)) {
        return { matched: true, reason: 'prompt_injection_pattern' };
    }
    return { matched: false, reason: '' };
}

export function evaluateRateLimit({ userId = 0, ip = '' } = {}) {
    const key = buildActorKey({ userId, ip });
    const store = getRateStore();
    const now = nowMs();
    cleanupStore(store, RATE_WINDOW_MS);

    const row = store.get(key) || { count: 0, windowStart: now, lastAt: now };
    if (now - Number(row.windowStart || 0) > RATE_WINDOW_MS) {
        row.count = 0;
        row.windowStart = now;
    }
    row.count += 1;
    row.lastAt = now;
    store.set(key, row);

    const allowed = row.count <= RATE_LIMIT_PER_WINDOW;
    return {
        allowed,
        limit: RATE_LIMIT_PER_WINDOW,
        remaining: Math.max(0, RATE_LIMIT_PER_WINDOW - row.count),
        resetInMs: Math.max(0, RATE_WINDOW_MS - (now - row.windowStart)),
    };
}

export function evaluateSpam({ userId = 0, ip = '', messageText = '' } = {}) {
    const rawText = String(messageText || '');
    if (rawText.length > MAX_USER_MESSAGE_CHARS) {
        return { blocked: true, reason: 'message_too_long' };
    }
    const text = toSafeString(rawText, MAX_USER_MESSAGE_CHARS);
    if (!text) return { blocked: false, reason: '' };
    if (/(.)\1{18,}/.test(text)) {
        return { blocked: true, reason: 'repeated_characters' };
    }

    const actorKey = buildActorKey({ userId, ip });
    const fingerprint = hashText(text.toLowerCase());
    const key = `${actorKey}:${fingerprint}`;
    const store = getSpamStore();
    const now = nowMs();
    cleanupStore(store, SPAM_WINDOW_MS);

    const row = store.get(key) || { count: 0, firstAt: now, lastAt: now };
    if (now - Number(row.firstAt || 0) > SPAM_WINDOW_MS) {
        row.count = 0;
        row.firstAt = now;
    }
    row.count += 1;
    row.lastAt = now;
    store.set(key, row);

    if (row.count >= SPAM_REPEAT_LIMIT) {
        return { blocked: true, reason: 'repeated_same_message' };
    }
    return { blocked: false, reason: '' };
}

export function buildSafetyReply(type = '') {
    const key = String(type || '').trim().toLowerCase();
    if (key === 'rate_limit') {
        return 'ส่งข้อความเร็วเกินไปนิดนึงครับ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
    }
    if (key === 'spam') {
        return 'ตรวจพบข้อความซ้ำ/ผิดปกติ กรุณาพิมพ์คำถามใหม่ให้ชัดเจนอีกครั้งครับ';
    }
    if (key === 'prompt_injection') {
        return 'ขออภัยครับ ผมไม่สามารถทำตามคำสั่งที่พยายามเปลี่ยนกฎความปลอดภัยของระบบได้ แต่ยินดีช่วยตอบคำถามการเรียนปกติครับ';
    }
    return 'ขออภัยครับ ไม่สามารถประมวลผลคำขอนี้ได้ในขณะนี้';
}
