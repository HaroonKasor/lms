function toOptionalNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function parseBooleanLike(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'y', 'pass', 'passed', 'success', 'completed', 'done'].includes(normalized)) {
        return true;
    }
    if (['false', '0', 'no', 'n', 'fail', 'failed', 'incomplete', 'not completed'].includes(normalized)) {
        return false;
    }
    return null;
}

function readExtensionValueBySuffix(extensions = {}, suffixes = []) {
    const normalizedSuffixes = Array.isArray(suffixes)
        ? suffixes
            .map((suffix) => String(suffix || '').trim().toLowerCase())
            .filter(Boolean)
        : [];
    if (normalizedSuffixes.length === 0) return '';

    for (const [rawKey, rawValue] of Object.entries(extensions || {})) {
        const key = String(rawKey || '').trim().toLowerCase();
        if (!key) continue;
        for (const suffix of normalizedSuffixes) {
            if (!key.endsWith(suffix)) continue;
            if (rawValue === undefined || rawValue === null) continue;
            const text = String(rawValue).trim();
            if (!text) continue;
            return text;
        }
    }
    return '';
}

function computeScorePercent({ raw, max, scaled }) {
    if (scaled !== null) {
        return scaled <= 1 ? scaled * 100 : scaled;
    }
    if (raw !== null && max !== null && max > 0) {
        return (raw / max) * 100;
    }
    if (raw !== null) {
        return raw <= 1 ? raw * 100 : raw;
    }
    return null;
}

function parseXapiResultSnapshot(result = {}, options = {}) {
    const optionExtensions = options?.extensions && typeof options.extensions === 'object'
        ? options.extensions
        : {};
    const resultExtensions = result?.extensions && typeof result.extensions === 'object'
        ? result.extensions
        : {};
    const mergedExtensions = {
        ...optionExtensions,
        ...resultExtensions,
    };

    const raw = toOptionalNumber(
        result?.score?.raw
        ?? readExtensionValueBySuffix(mergedExtensions, ['/score/raw', '/score-raw', '/raw-score', '/score_raw', '/rawscore', '/score'])
    );
    const max = toOptionalNumber(
        result?.score?.max
        ?? readExtensionValueBySuffix(mergedExtensions, ['/score/max', '/score-max', '/max-score', '/score_max', '/maxscore'])
    );
    const scaled = toOptionalNumber(
        result?.score?.scaled
        ?? readExtensionValueBySuffix(mergedExtensions, ['/score/scaled', '/score-scaled', '/scaled-score', '/score_scaled', '/scaledscore'])
    );

    const successFromResult = parseBooleanLike(result?.success);
    const completionFromResult = parseBooleanLike(result?.completion);
    const passedFromResult = parseBooleanLike(
        result?.passed
        ?? readExtensionValueBySuffix(mergedExtensions, ['/passed', '/is-passed', '/pass', '/success'])
    );
    const completionFromExtensions = parseBooleanLike(
        readExtensionValueBySuffix(mergedExtensions, ['/completion', '/completed', '/is-completed'])
    );
    const statusText = String(
        readExtensionValueBySuffix(mergedExtensions, ['/status', '/result-status', '/completion-status'])
        || ''
    ).trim().toLowerCase();

    let success = successFromResult;
    if (success === null) success = passedFromResult;
    if (success === null && statusText) {
        if (statusText.includes('pass') || statusText.includes('success') || statusText.includes('ผ่าน')) success = true;
        if (statusText.includes('fail') || statusText.includes('failed') || statusText.includes('ไม่ผ่าน')) success = false;
    }

    let completion = completionFromResult;
    if (completion === null) completion = completionFromExtensions;
    if (completion === null && statusText) {
        if (statusText.includes('complete') || statusText.includes('completed') || statusText.includes('เสร็จ')) completion = true;
        if (statusText.includes('incomplete') || statusText.includes('not completed')) completion = false;
    }

    const percent = computeScorePercent({ raw, max, scaled });
    const hasScore = raw !== null || max !== null || scaled !== null;
    const hasResultFlag = success !== null || completion !== null || passedFromResult !== null;

    return {
        raw,
        max,
        scaled,
        percent,
        success,
        completion,
        passed: passedFromResult,
        hasScore,
        hasResultFlag,
    };
}

function hasPassingAssessmentScoreSnapshot(snapshot = {}, passingPercent = 80) {
    const threshold = Number.isFinite(Number(passingPercent))
        ? Math.max(1, Math.min(100, Number(passingPercent)))
        : 80;
    const raw = toOptionalNumber(snapshot?.raw);
    const scaled = toOptionalNumber(snapshot?.scaled);
    const max = toOptionalNumber(snapshot?.max);
    const percent = toOptionalNumber(snapshot?.percent);

    const normalizedScaled = scaled !== null
        ? (scaled <= 1 ? scaled * 100 : scaled)
        : null;
    const normalizedRaw = raw !== null
        ? (raw <= 1 ? raw * 100 : raw)
        : null;
    const normalizedRawMax =
        raw !== null && max !== null && max > 0
            ? (raw / max) * 100
            : null;

    return Boolean(
        (percent !== null && percent >= threshold)
        || (normalizedScaled !== null && normalizedScaled >= threshold)
        || (normalizedRawMax !== null && normalizedRawMax >= threshold)
        || (normalizedRaw !== null && normalizedRaw >= threshold)
    );
}

export {
    toOptionalNumber,
    parseBooleanLike,
    readExtensionValueBySuffix,
    parseXapiResultSnapshot,
    hasPassingAssessmentScoreSnapshot,
};
