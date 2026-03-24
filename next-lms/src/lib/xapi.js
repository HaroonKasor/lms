/**
 * xAPI Helper Library
 * Builds and sends xAPI statements to the mock LRS endpoint
 */

const XAPI_ENDPOINT = '/api/xapi/statements';
function resolveObjectBaseUrl() {
    const candidates = [
        process.env.NEXT_PUBLIC_XAPI_OBJECT_BASE_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        typeof window !== 'undefined' ? window.location.origin : '',
    ];

    for (const candidate of candidates) {
        const raw = String(candidate || '').trim();
        if (!raw) continue;
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
            return new URL(withProtocol).origin;
        } catch {
            // Try next candidate.
        }
    }
    return 'https://example.invalid';
}

const OBJECT_BASE_URL = resolveObjectBaseUrl();
const ACTOR_EMAIL_DOMAIN = (() => {
    try {
        const host = new URL(OBJECT_BASE_URL).hostname;
        return host || 'example.invalid';
    } catch {
        return 'example.invalid';
    }
})();

// ADL standard verb IRIs
export const VERBS = {
    initialized: { id: 'http://adlnet.gov/expapi/verbs/initialized', display: { 'en-US': 'initialized' } },
    played: { id: 'https://w3id.org/xapi/video/verbs/played', display: { 'en-US': 'played' } },
    paused: { id: 'https://w3id.org/xapi/video/verbs/paused', display: { 'en-US': 'paused' } },
    seeked: { id: 'https://w3id.org/xapi/video/verbs/seeked', display: { 'en-US': 'seeked' } },
    completed: { id: 'http://adlnet.gov/expapi/verbs/completed', display: { 'en-US': 'completed' } },
    progressed: { id: 'http://adlnet.gov/expapi/verbs/progressed', display: { 'en-US': 'progressed' } },
    terminated: { id: 'http://adlnet.gov/expapi/verbs/terminated', display: { 'en-US': 'terminated' } },
    experienced: { id: 'http://adlnet.gov/expapi/verbs/experienced', display: { 'en-US': 'experienced' } },
};

/**
 * Build a standard xAPI statement
 */
export function buildStatement({ actor, verb, objectId, objectName, objectType = 'Activity', result = {}, context = {} }) {
    return {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        actor: {
            mbox: `mailto:${actor?.email || `anonymous@${ACTOR_EMAIL_DOMAIN}`}`,
            name: actor?.name || 'Anonymous Learner',
            objectType: 'Agent',
        },
        verb: typeof verb === 'string' ? VERBS[verb] : verb,
        object: {
            id: objectId,
            objectType,
            definition: {
                name: { 'en-US': objectName || 'Unknown Activity' },
                type: 'http://adlnet.gov/expapi/activities/media',
            },
        },
        result: Object.keys(result).length > 0 ? result : undefined,
        context: Object.keys(context).length > 0 ? context : undefined,
    };
}

/**
 * Build a video progress statement with duration and progress
 */
export function buildVideoProgressStatement({ actor, contentId, contentName, currentTime, duration }) {
    const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
    return buildStatement({
        actor,
        verb: 'progressed',
        objectId: `${OBJECT_BASE_URL}/content/${contentId}`,
        objectName: contentName,
        result: {
            extensions: {
                'https://w3id.org/xapi/video/extensions/time': currentTime,
                'https://w3id.org/xapi/video/extensions/progress': Math.round(progress * 100),
                'https://w3id.org/xapi/video/extensions/length': duration,
            },
        },
    });
}

/**
 * Build a video event statement (played, paused, seeked, etc.)
 */
export function buildVideoEventStatement({ actor, contentId, contentName, verb, currentTime, duration }) {
    return buildStatement({
        actor,
        verb,
        objectId: `${OBJECT_BASE_URL}/content/${contentId}`,
        objectName: contentName,
        result: {
            extensions: {
                'https://w3id.org/xapi/video/extensions/time': currentTime,
                ...(duration ? { 'https://w3id.org/xapi/video/extensions/length': duration } : {}),
            },
        },
    });
}

/**
 * Build a completion statement
 */
export function buildCompletionStatement({ actor, contentId, contentName, duration, success = true }) {
    return buildStatement({
        actor,
        verb: 'completed',
        objectId: `${OBJECT_BASE_URL}/content/${contentId}`,
        objectName: contentName,
        result: {
            completion: true,
            success,
            duration: `PT${Math.round(duration)}S`,
        },
    });
}

/**
 * Send an xAPI statement to the mock LRS
 */
export async function sendStatement(statement) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const res = await fetch(XAPI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(statement),
            });
            if (!res.ok) throw new Error(`Failed to send statement: ${res.statusText}`);
            return await res.json();
        } catch (err) {
            const networkError = err instanceof TypeError || String(err?.message || '').toLowerCase().includes('failed to fetch');
            if (attempt === 0 && networkError) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                continue;
            }
            if (process.env.NODE_ENV !== 'production') {
                console.error('[xAPI] Error sending statement:', err);
            }
            return null;
        }
    }
}

/**
 * Get learning progress for a specific content/user
 */
export async function getProgress(contentId, userId, sectionId) {
    const params = new URLSearchParams({ contentId });
    if (userId) params.set('userId', userId);
    const numericSectionId = Number(sectionId);
    if (Number.isInteger(numericSectionId) && numericSectionId > 0) {
        params.set('sectionId', String(numericSectionId));
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const res = await fetch(`/api/content/progress?${params.toString()}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            const networkError = err instanceof TypeError || String(err?.message || '').toLowerCase().includes('failed to fetch');
            if (attempt === 0 && networkError) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                continue;
            }
            if (process.env.NODE_ENV !== 'production') {
                console.error('[xAPI] Error getting progress:', err);
            }
            return null;
        }
    }
}

/**
 * Update learning progress/status
 */
export async function updateProgress({
    contentId,
    userId,
    sectionId,
    status,
    progress,
    currentTime,
    duration,
    scoreRaw,
    scoreScaled,
    success,
    completion,
}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const res = await fetch('/api/content/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId,
                    userId,
                    sectionId,
                    status,
                    progress,
                    currentTime,
                    duration,
                    scoreRaw,
                    scoreScaled,
                    success,
                    completion,
                }),
            });
            const payload = await res.json().catch(() => null);
            if (!res.ok) {
                return {
                    success: false,
                    reason: payload?.reason || null,
                    error: payload?.error || `Failed to update progress: ${res.statusText}`,
                    status: res.status,
                };
            }
            if (payload && payload.success === false) {
                return {
                    ...payload,
                    status: res.status,
                };
            }
            return payload || { success: true };
        } catch (err) {
            const networkError = err instanceof TypeError || String(err?.message || '').toLowerCase().includes('failed to fetch');
            if (attempt === 0 && networkError) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                continue;
            }
            if (process.env.NODE_ENV !== 'production') {
                console.error('[xAPI] Error updating progress:', err);
            }
            return {
                success: false,
                error: String(err?.message || 'Failed to update progress'),
                status: null,
            };
        }
    }
}
