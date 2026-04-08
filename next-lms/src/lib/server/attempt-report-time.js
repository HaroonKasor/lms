const OVER_TIME_LIMIT_SECONDS = 60 * 60;
const HARD_START_VERB_HINTS = ['experienced', 'initialized', 'launched', 'resumed'];
const SOFT_ACTIVITY_VERB_HINTS = ['played', 'progressed', 'paused', 'seeked', 'interacted'];
const END_VERB_HINTS = ['exited', 'terminated', 'completed', 'attempted'];

function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toSafeTime(value) {
    const ms = new Date(value || 0).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

function extractActivityTitle(payload = {}, fallback = 'Activity') {
    return String(
        payload?.object?.definition?.name?.['en-US']
        || payload?.object?.definition?.name?.th
        || payload?.object?.definition?.name?.en
        || payload?.object?.id
        || fallback
    ).trim() || fallback;
}

function toDisplayDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).replace(',', ' at');
}

function normalizeVerbId(payload = {}) {
    return String(payload?.verb?.id || '')
        .trim()
        .toLowerCase();
}

function hasVerbHint(verbId = '', hints = []) {
    const normalized = String(verbId || '').trim().toLowerCase();
    if (!normalized) return false;
    return hints.some((hint) => normalized.includes(String(hint || '').toLowerCase()));
}

function readContextExtensionBySuffix(payload = {}, suffix = '') {
    const normalizedSuffix = String(suffix || '').trim().toLowerCase();
    if (!normalizedSuffix) return '';
    const extensions = payload?.context?.extensions || {};
    for (const [key, value] of Object.entries(extensions)) {
        const normalizedKey = String(key || '').trim().toLowerCase();
        if (!normalizedKey.endsWith(normalizedSuffix)) continue;
        const text = String(value || '').trim();
        if (text) return text;
    }
    return '';
}

function extractActivityMeta(payload = {}) {
    const titled = extractActivityTitle(payload);
    const contextActivityId = readContextExtensionBySuffix(payload, '/activity-id');
    const contextActivityName = readContextExtensionBySuffix(payload, '/activity-name');
    const objectId = String(payload?.object?.id || '').trim();
    const activityKey = String(contextActivityId || objectId || titled || 'activity').trim() || 'activity';
    const activityTitle = String(contextActivityName || titled || 'Activity').trim() || 'Activity';
    return { activityKey, activityTitle };
}

function buildAttemptSectionsFromStatements(statements = []) {
    const sortedRows = [...(Array.isArray(statements) ? statements : [])]
        .map((row) => {
            const payload = row?.statement_json && typeof row.statement_json === 'object'
                ? row.statement_json
                : {};
            const timestampRaw = payload?.timestamp || payload?.storedAt || row?.receivedAt;
            const timestampMs = toSafeTime(timestampRaw);
            return { payload, timestampRaw, timestampMs };
        })
        .filter((item) => item.timestampMs > 0)
        .sort((a, b) => a.timestampMs - b.timestampMs);

    const buckets = new Map();
    const ensureBucket = (activityKey, activityTitle) => {
        if (!buckets.has(activityKey)) {
            buckets.set(activityKey, {
                title: activityTitle,
                attempts: [],
                current: null,
            });
        }
        const bucket = buckets.get(activityKey);
        if (!bucket.title || bucket.title === 'Activity') {
            bucket.title = activityTitle || bucket.title || 'Activity';
        }
        return bucket;
    };

    const closeCurrentAttempt = (bucket) => {
        if (!bucket?.current) return;
        bucket.attempts.push(bucket.current);
        bucket.current = null;
    };

    for (const item of sortedRows) {
        const { payload, timestampRaw, timestampMs } = item;
        const { activityKey, activityTitle } = extractActivityMeta(payload);
        const verbId = normalizeVerbId(payload);
        const isHardStart = hasVerbHint(verbId, HARD_START_VERB_HINTS);
        const isSoftActivity = hasVerbHint(verbId, SOFT_ACTIVITY_VERB_HINTS);
        const isEnd = hasVerbHint(verbId, END_VERB_HINTS);
        const shouldTrackEvent = isHardStart || isSoftActivity || isEnd;
        if (!shouldTrackEvent) continue;

        const bucket = ensureBucket(activityKey, activityTitle);

        if (!bucket.current) {
            if (isEnd) continue;
            bucket.current = {
                startedAt: timestampRaw,
                lastTimestampMs: timestampMs,
                durationSeconds: 0,
            };
            continue;
        }

        const gapSeconds = Math.floor((timestampMs - bucket.current.lastTimestampMs) / 1000);
        if (Number.isFinite(gapSeconds) && gapSeconds > 0) {
            bucket.current.durationSeconds += Math.min(gapSeconds, OVER_TIME_LIMIT_SECONDS);
        }
        bucket.current.lastTimestampMs = timestampMs;

        if (isHardStart) {
            closeCurrentAttempt(bucket);
            bucket.current = {
                startedAt: timestampRaw,
                lastTimestampMs: timestampMs,
                durationSeconds: 0,
            };
            continue;
        }

        if (isEnd) {
            closeCurrentAttempt(bucket);
        }
    }

    for (const bucket of buckets.values()) {
        closeCurrentAttempt(bucket);
    }

    return Array.from(buckets.values()).map((bucket) => ({
        title: bucket.title || 'Activity',
        records: bucket.attempts.map((attempt, index) => ({
            id: index + 1,
            date: toDisplayDate(attempt?.startedAt || Date.now()),
            duration: (Math.max(0, toSafeNumber(attempt?.durationSeconds, 0)) / 60).toFixed(2),
        })),
    }));
}

export {
    buildAttemptSectionsFromStatements,
};
