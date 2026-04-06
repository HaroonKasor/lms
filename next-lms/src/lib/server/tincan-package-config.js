import fs from 'fs';
import path from 'path';

const ASSESSMENT_NAME_REGEX = /quiz|test|exam|assessment|post[\s-_]?test|pre[\s-_]?test|แบบทดสอบ|ทดสอบ/i;

function findFile(dir, filename) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const found = findFile(fullPath, filename);
            if (found) return found;
        } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
            return fullPath;
        }
    }
    return null;
}

function splitLaunchTarget(launch) {
    const value = String(launch || '').replace(/\\/g, '/').trim();
    const qIndex = value.indexOf('?');
    const hIndex = value.indexOf('#');
    const cutIndex = [qIndex, hIndex].filter((x) => x >= 0).sort((a, b) => a - b)[0];
    if (cutIndex === undefined) return { pathPart: value, suffix: '' };
    return { pathPart: value.slice(0, cutIndex), suffix: value.slice(cutIndex) };
}

function resolveCaseInsensitivePath(baseDir, relPath) {
    const parts = String(relPath || '').split('/').filter(Boolean);
    let currentDir = baseDir;
    const resolvedParts = [];

    for (const part of parts) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        const exact = entries.find((entry) => entry.name === part);
        const match = exact || entries.find((entry) => entry.name.toLowerCase() === part.toLowerCase());
        if (!match) return null;
        resolvedParts.push(match.name);
        currentDir = path.join(currentDir, match.name);
    }

    return resolvedParts.join('/');
}

function resolveLaunchAbsolutePath(baseDir, launch) {
    const { pathPart } = splitLaunchTarget(launch);
    const cleanPath = String(pathPart || '').replace(/^\/+/, '').replace(/^\.\//, '').trim();
    if (!cleanPath || /^https?:\/\//i.test(cleanPath)) return '';
    if (/^content\//i.test(cleanPath)) {
        return path.resolve(path.join(process.cwd(), 'public'), cleanPath.replace(/^content\//i, 'content/'));
    }
    return path.resolve(baseDir, cleanPath);
}

function normalizeLaunchPath(launch, baseDir) {
    const { pathPart, suffix } = splitLaunchTarget(launch);
    const cleanPath = String(pathPart || '').replace(/^\/+/, '').replace(/^\.\//, '').trim();
    if (!cleanPath) return '';

    const exactAbs = path.resolve(baseDir, cleanPath);
    if (fs.existsSync(exactAbs)) {
        return `${cleanPath}${suffix}`;
    }

    const safeDecoded = (() => {
        try {
            return decodeURIComponent(cleanPath);
        } catch {
            return cleanPath;
        }
    })();
    const decodedAbs = path.resolve(baseDir, safeDecoded);
    if (safeDecoded !== cleanPath && fs.existsSync(decodedAbs)) {
        return `${safeDecoded.replace(/\\/g, '/')}${suffix}`;
    }

    try {
        const caseInsensitive = resolveCaseInsensitivePath(baseDir, safeDecoded);
        if (caseInsensitive) {
            return `${caseInsensitive.replace(/\\/g, '/')}${suffix}`;
        }
    } catch {
        // ignore fs traversal errors and keep original launch path
    }

    return `${safeDecoded.replace(/\\/g, '/')}${suffix}`;
}

function normalizePathKey(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';

    let normalized = raw;
    if (/^https?:\/\//i.test(normalized)) {
        try {
            const url = new URL(normalized);
            normalized = `${url.pathname}${url.search}${url.hash}`;
        } catch {
            // keep raw string on invalid URL format
        }
    }

    normalized = normalized
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^\.\//, '')
        .replace(/^content\/[^/]+\//i, '')
        .trim();

    return splitLaunchTarget(normalized).pathPart.toLowerCase();
}

function extractActivityPathFromId(activityId = '') {
    const raw = String(activityId || '').trim();
    if (!raw) return '';
    const normalized = normalizePathKey(raw);
    if (!normalized) return '';

    const dataMatch = normalized.match(/(data\/[^?#]+)$/i);
    if (dataMatch?.[1]) return dataMatch[1];

    const testMatch = normalized.match(/((?:post|pre)?test[^?#]*\/index\.html)$/i);
    if (testMatch?.[1]) return testMatch[1];

    return normalized;
}

function parseBooleanLiteral(value) {
    if (typeof value === 'boolean') return value;
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
}

function extractVarLiteral(source, varName) {
    const escaped = String(varName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\s*=\\s*([^;\\n\\r]+)\\s*(?:;|$)`, 'im');
    const match = String(source || '').match(regex);
    return match ? String(match[1] || '').trim() : '';
}

function extractArrayLiteral(source, varName) {
    const escaped = String(varName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\s*=\\s*\\[`, 'i');
    const match = pattern.exec(String(source || ''));
    if (!match) return '';

    const start = String(source).indexOf('[', match.index);
    if (start < 0) return '';

    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let escapedChar = false;

    for (let i = start; i < source.length; i += 1) {
        const ch = source[i];
        if (escapedChar) {
            escapedChar = false;
            continue;
        }
        if (ch === '\\') {
            escapedChar = true;
            continue;
        }
        if (!inDouble && ch === '\'') {
            inSingle = !inSingle;
            continue;
        }
        if (!inSingle && ch === '"') {
            inDouble = !inDouble;
            continue;
        }
        if (inSingle || inDouble) continue;

        if (ch === '[') depth += 1;
        if (ch === ']') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start + 1, i);
            }
        }
    }

    return '';
}

function splitTopLevelObjects(arrayLiteral = '') {
    const source = String(arrayLiteral || '');
    const objects = [];
    let start = -1;
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let escapedChar = false;

    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (escapedChar) {
            escapedChar = false;
            continue;
        }
        if (ch === '\\') {
            escapedChar = true;
            continue;
        }
        if (!inDouble && ch === '\'') {
            inSingle = !inSingle;
            continue;
        }
        if (!inSingle && ch === '"') {
            inDouble = !inDouble;
            continue;
        }
        if (inSingle || inDouble) continue;

        if (ch === '{') {
            if (depth === 0) start = i;
            depth += 1;
            continue;
        }
        if (ch === '}') {
            depth -= 1;
            if (depth === 0 && start >= 0) {
                objects.push(source.slice(start, i + 1));
                start = -1;
            }
        }
    }

    return objects;
}

function extractStringField(objectLiteral, fieldName) {
    const escaped = String(fieldName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*:\\s*(?:\"([^\"]*)\"|'([^']*)')`, 'i');
    const match = String(objectLiteral || '').match(regex);
    if (!match) return '';
    return String(match[1] ?? match[2] ?? '').trim();
}

function extractNumberField(objectLiteral, fieldName) {
    const escaped = String(fieldName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*:\\s*['"]?(-?\\d+(?:\\.\\d+)?)['"]?`, 'i');
    const match = String(objectLiteral || '').match(regex);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
}

function extractBooleanField(objectLiteral, fieldName) {
    const escaped = String(fieldName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*:\\s*(true|false)`, 'i');
    const match = String(objectLiteral || '').match(regex);
    if (!match) return null;
    return parseBooleanLiteral(match[1]);
}

function getTinCanConfigCandidates(contentDir) {
    const candidates = [];
    const seen = new Set();
    const pushCandidate = (candidatePath) => {
        const normalized = String(candidatePath || '').trim();
        if (!normalized || seen.has(normalized)) return;
        try {
            if (!fs.existsSync(normalized)) return;
            if (!fs.statSync(normalized).isFile()) return;
            seen.add(normalized);
            candidates.push(normalized);
        } catch {
            // ignore unreadable path
        }
    };

    pushCandidate(path.join(contentDir, 'scripts', 'config.js'));
    pushCandidate(path.join(contentDir, 'scripts', 'script.js'));
    pushCandidate(path.join(contentDir, 'config.js'));
    pushCandidate(path.join(contentDir, 'script.js'));
    pushCandidate(findFile(contentDir, 'config.js'));
    pushCandidate(findFile(contentDir, 'script.js'));

    return candidates;
}

function parseTinCanConfigFile(configPath, contentDir) {
    let source = '';
    try {
        source = fs.readFileSync(configPath, 'utf-8');
    } catch {
        return null;
    }
    if (!source) return null;

    const isLinear = parseBooleanLiteral(extractVarLiteral(source, 'islinear'));
    const isResume = parseBooleanLiteral(extractVarLiteral(source, 'isResume'));
    const completedWhenDoAllMasteryscore = parseBooleanLiteral(extractVarLiteral(source, 'completedWhenDoAllMasteryscore'));
    const treeArraySource = extractArrayLiteral(source, 'treeArray');
    const objectLiterals = splitTopLevelObjects(treeArraySource);

    const activities = objectLiterals
        .map((chunk, index) => {
            const isPage = extractBooleanField(chunk, 'ispage');
            const url = extractStringField(chunk, 'url') || extractStringField(chunk, 'urlOffline');
            const text = extractStringField(chunk, 'text');
            const nodeId = extractStringField(chunk, 'id');
            const masteryScore = extractNumberField(chunk, 'masteryscore');
            const limitQuizzed = extractNumberField(chunk, 'limitquizzed');
            const calculateScore = extractBooleanField(chunk, 'calculatescore');
            const playIcon = extractBooleanField(chunk, 'playicon');
            const identityText = `${nodeId} ${text} ${url}`.trim();
            const fuzzyAssessment = ASSESSMENT_NAME_REGEX.test(identityText);
            const isAssessment =
                (Number.isFinite(masteryScore) && masteryScore > 0)
                || (Number.isFinite(limitQuizzed) && limitQuizzed > 0)
                || calculateScore === true
                || fuzzyAssessment;

            return {
                index,
                id: nodeId || `node-${index}`,
                text,
                url,
                normalizedUrl: normalizePathKey(url),
                isPage: isPage === null ? Boolean(url) : Boolean(isPage),
                masteryScore: Number.isFinite(masteryScore) ? masteryScore : null,
                limitQuizzed: Number.isFinite(limitQuizzed) ? limitQuizzed : null,
                calculateScore: calculateScore === true,
                playIcon: playIcon === null ? null : Boolean(playIcon),
                isAssessment,
            };
        })
        .filter((row) => row.isPage);

    const assessmentCount = activities.filter((row) => row.isAssessment).length;
    const scoredAssessmentCount = activities.filter(
        (row) =>
            (Number.isFinite(row.masteryScore) && row.masteryScore > 0)
            || row.calculateScore
            || (Number.isFinite(row.limitQuizzed) && row.limitQuizzed > 0)
    ).length;
    const signalScore =
        (isLinear !== null ? 3 : 0)
        + (isResume !== null ? 1 : 0)
        + (completedWhenDoAllMasteryscore !== null ? 1 : 0)
        + (activities.length > 0 ? 4 : 0);

    return {
        source: path.relative(contentDir, configPath).replace(/\\/g, '/'),
        isLinear,
        isResume,
        completedWhenDoAllMasteryscore,
        activities,
        assessmentCount,
        scoredAssessmentCount,
        signalScore,
    };
}

function parseTinCanConfig(contentDir) {
    const candidates = getTinCanConfigCandidates(contentDir);
    if (candidates.length === 0) return null;

    const parsedFiles = [];
    for (const configPath of candidates) {
        const parsed = parseTinCanConfigFile(configPath, contentDir);
        if (parsed) parsedFiles.push(parsed);
    }
    if (parsedFiles.length === 0) return null;

    const sortedForScalars = [...parsedFiles].sort((a, b) => Number(b.signalScore || 0) - Number(a.signalScore || 0));
    const pickScalar = (fieldName) => {
        for (const row of sortedForScalars) {
            if (row?.[fieldName] !== null && row?.[fieldName] !== undefined) return row[fieldName];
        }
        return null;
    };

    const mergedActivities = [];
    const seen = new Set();
    for (const row of parsedFiles) {
        const list = Array.isArray(row?.activities) ? row.activities : [];
        for (const activity of list) {
            const dedupeKey = String(activity?.normalizedUrl || activity?.id || '').trim().toLowerCase();
            if (!dedupeKey || seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            mergedActivities.push(activity);
        }
    }

    const assessmentCount = mergedActivities.filter((row) => row?.isAssessment).length;
    const scoredAssessmentCount = mergedActivities.filter(
        (row) =>
            (Number.isFinite(row?.masteryScore) && row.masteryScore > 0)
            || row?.calculateScore
            || (Number.isFinite(row?.limitQuizzed) && row.limitQuizzed > 0)
    ).length;
    const mergedSource = parsedFiles
        .map((row) => String(row?.source || '').trim())
        .filter(Boolean)
        .join(',');

    return {
        source: mergedSource || sortedForScalars[0]?.source || '',
        isLinear: pickScalar('isLinear'),
        isResume: pickScalar('isResume'),
        completedWhenDoAllMasteryscore: pickScalar('completedWhenDoAllMasteryscore'),
        activities: mergedActivities,
        assessmentCount,
        scoredAssessmentCount,
    };
}

function findConfigActivityForActivity(activity, configActivities) {
    const configRows = Array.isArray(configActivities) ? configActivities : [];
    if (configRows.length === 0) return null;

    const launchKey = normalizePathKey(activity?.launch || '');
    const idPathKey = extractActivityPathFromId(activity?.id || activity?.activityId || '');
    const idKey = normalizePathKey(activity?.id || activity?.activityId || '');
    const candidates = [launchKey, idPathKey, idKey].filter(Boolean);

    for (const key of candidates) {
        const exact = configRows.find((row) => row.normalizedUrl && row.normalizedUrl === key);
        if (exact) return exact;
    }
    for (const key of candidates) {
        const bySuffix = configRows.find(
            (row) => row.normalizedUrl && (row.normalizedUrl.endsWith(key) || key.endsWith(row.normalizedUrl))
        );
        if (bySuffix) return bySuffix;
    }
    return null;
}

function resolveSafeConfigLaunch(contentDir, launchValue) {
    const rawLaunch = String(launchValue || '').trim();
    if (!rawLaunch) return '';
    if (/^https?:\/\//i.test(rawLaunch)) return rawLaunch;

    const normalizedLaunch = normalizeLaunchPath(rawLaunch, contentDir);
    if (!normalizedLaunch) return '';

    const launchPath = resolveLaunchAbsolutePath(contentDir, normalizedLaunch);
    if (!launchPath || !fs.existsSync(launchPath)) return '';

    const publicDir = path.join(process.cwd(), 'public');
    const launchRel = path.relative(publicDir, launchPath).replace(/\\/g, '/');
    const { suffix } = splitLaunchTarget(normalizedLaunch);
    return `${launchRel}${suffix}`;
}

function mergeActivitiesWithConfig(activities, configActivities, contentDir = '') {
    const rows = Array.isArray(activities) ? activities : [];
    if (!Array.isArray(configActivities) || configActivities.length === 0) return rows;

    return rows.map((activity, index) => {
        const activityLaunch = resolveSafeConfigLaunch(contentDir, activity?.launch || '');
        const matched = findConfigActivityForActivity(activity, configActivities);
        if (!matched) {
            return {
                ...activity,
                launch: activityLaunch,
            };
        }

        return {
            ...activity,
            launch: activityLaunch || resolveSafeConfigLaunch(contentDir, matched.url) || '',
            assessment: Boolean(matched.isAssessment),
            masteryScore: Number.isFinite(matched.masteryScore) ? Number(matched.masteryScore) : null,
            attemptLimit: Number.isFinite(matched.limitQuizzed) ? Number(matched.limitQuizzed) : null,
            calculatescore: Boolean(matched.calculateScore),
            configNodeId: matched.id || `config-${index}`,
            configNodeText: matched.text || '',
            configNodeIndex: Number.isFinite(Number(matched.index)) ? Number(matched.index) : index,
            configNodeUrl: String(matched.url || '').trim(),
            configNormalizedUrl: String(matched.normalizedUrl || '').trim(),
        };
    });
}

function buildCompletionPolicy(configMeta) {
    if (!configMeta) return null;
    const hasAssessments = Number(configMeta.assessmentCount || 0) > 0;
    const completedWhenDoAll = configMeta.completedWhenDoAllMasteryscore;
    const requireAssessmentPass = hasAssessments && completedWhenDoAll !== false;

    return {
        source: 'tincan-config',
        hasAssessments,
        hasScoredAssessments: Number(configMeta.scoredAssessmentCount || 0) > 0,
        requireAssessmentPass,
        completedWhenDoAllMasteryscore: completedWhenDoAll,
    };
}

export function hydrateContentWithConfig(content) {
    if (!content || content.type !== 'tincan') {
        return { content, changed: false };
    }

    const contentId = String(content.id || '').trim();
    if (!contentId) return { content, changed: false };

    const contentDir = path.join(process.cwd(), 'public', 'content', contentId);
    if (!fs.existsSync(contentDir) || !fs.statSync(contentDir).isDirectory()) {
        return { content, changed: false };
    }

    const configMeta = parseTinCanConfig(contentDir);
    if (!configMeta) {
        return { content, changed: false };
    }

    const mergedActivities = mergeActivitiesWithConfig(content.activities, configMeta.activities, contentDir);
    const completionPolicy = buildCompletionPolicy(configMeta);
    const packageConfig = {
        source: configMeta.source || '',
        isLinear: configMeta.isLinear,
        isResume: configMeta.isResume,
        completedWhenDoAllMasteryscore: configMeta.completedWhenDoAllMasteryscore,
        assessmentCount: Number(configMeta.assessmentCount || 0),
        scoredAssessmentCount: Number(configMeta.scoredAssessmentCount || 0),
    };

    const next = {
        ...content,
        activities: mergedActivities,
        completionPolicy,
        packageConfig,
    };

    const changed =
        JSON.stringify(content.activities || []) !== JSON.stringify(next.activities || [])
        || JSON.stringify(content.completionPolicy || null) !== JSON.stringify(next.completionPolicy || null)
        || JSON.stringify(content.packageConfig || null) !== JSON.stringify(next.packageConfig || null);

    return { content: next, changed };
}
