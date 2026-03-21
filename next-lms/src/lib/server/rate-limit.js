const RATE_LIMIT_BUCKETS = new Map();
const MAX_BUCKETS = 10000;
const CLEANUP_INTERVAL_MS = 30 * 1000;
let lastCleanupAt = 0;

function cleanupExpired(nowMs, force = false) {
    if (!force && (nowMs - lastCleanupAt) < CLEANUP_INTERVAL_MS) {
        return;
    }
    lastCleanupAt = nowMs;
    for (const [key, bucket] of RATE_LIMIT_BUCKETS.entries()) {
        if (!bucket || bucket.expiresAt <= nowMs) {
            RATE_LIMIT_BUCKETS.delete(key);
        }
    }
}

function ensureCapacity() {
    if (RATE_LIMIT_BUCKETS.size < MAX_BUCKETS) return;
    const firstKey = RATE_LIMIT_BUCKETS.keys().next().value;
    if (firstKey) RATE_LIMIT_BUCKETS.delete(firstKey);
}

export function takeRateLimitToken({
    key,
    windowMs = 10 * 60 * 1000,
    maxAttempts = 10,
    nowMs = Date.now(),
} = {}) {
    const safeKey = String(key || '').trim();
    if (!safeKey) {
        return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
    }

    cleanupExpired(nowMs);
    ensureCapacity();

    const bucket = RATE_LIMIT_BUCKETS.get(safeKey);
    if (!bucket || bucket.expiresAt <= nowMs) {
        RATE_LIMIT_BUCKETS.set(safeKey, {
            count: 1,
            expiresAt: nowMs + windowMs,
        });
        return {
            allowed: true,
            remaining: Math.max(0, maxAttempts - 1),
            retryAfterSeconds: 0,
        };
    }

    if (bucket.count >= maxAttempts) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - nowMs) / 1000)),
        };
    }

    bucket.count += 1;
    RATE_LIMIT_BUCKETS.set(safeKey, bucket);
    return {
        allowed: true,
        remaining: Math.max(0, maxAttempts - bucket.count),
        retryAfterSeconds: 0,
    };
}

export function clearRateLimitKey(key) {
    const safeKey = String(key || '').trim();
    if (!safeKey) return;
    RATE_LIMIT_BUCKETS.delete(safeKey);
}
