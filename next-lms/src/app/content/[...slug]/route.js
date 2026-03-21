import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';

const CONTENT_ROOT = path.join(process.cwd(), 'public', 'content');

function decodeSegment(segment = '') {
    try {
        return decodeURIComponent(String(segment || ''));
    } catch {
        return String(segment || '');
    }
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.html': return 'text/html; charset=utf-8';
        case '.js': return 'application/javascript; charset=utf-8';
        case '.mjs': return 'application/javascript; charset=utf-8';
        case '.css': return 'text/css; charset=utf-8';
        case '.json': return 'application/json; charset=utf-8';
        case '.xml': return 'application/xml; charset=utf-8';
        case '.svg': return 'image/svg+xml';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        case '.ico': return 'image/x-icon';
        case '.mp4': return 'video/mp4';
        case '.webm': return 'video/webm';
        case '.ogg': return 'video/ogg';
        case '.mov': return 'video/quicktime';
        case '.mp3': return 'audio/mpeg';
        case '.wav': return 'audio/wav';
        case '.ttf': return 'font/ttf';
        case '.otf': return 'font/otf';
        case '.woff': return 'font/woff';
        case '.woff2': return 'font/woff2';
        default: return 'application/octet-stream';
    }
}

function normalizeSegments(slug = []) {
    return []
        .concat(Array.isArray(slug) ? slug : [])
        .map((segment) => decodeSegment(segment))
        .map((segment) => segment.replace(/\\/g, '/'))
        .flatMap((segment) => segment.split('/'))
        .filter((segment) => segment && segment !== '.' && segment !== '..');
}

function extractSlugFromPathname(pathname = '') {
    const normalizedPath = normalizePathname(pathname);
    const contentPrefix = '/content/';
    if (!normalizedPath.startsWith(contentPrefix)) return [];
    const rest = normalizedPath.slice(contentPrefix.length);
    if (!rest) return [];
    return rest
        .split('/')
        .map((segment) => decodeSegment(segment))
        .map((segment) => segment.replace(/\\/g, '/'))
        .flatMap((segment) => segment.split('/'))
        .filter((segment) => segment && segment !== '.' && segment !== '..');
}

function normalizePathname(value = '') {
    const raw = String(value || '').replace(/\\/g, '/');
    const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
    const collapsed = withSlash.replace(/\/{2,}/g, '/');
    if (collapsed.length > 1 && collapsed.endsWith('/')) {
        return collapsed.slice(0, -1);
    }
    return collapsed || '/';
}

function getCanonicalPathForTarget(targetPath) {
    const rel = path.relative(CONTENT_ROOT, targetPath).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..')) return '';
    return `/content/${rel}`;
}

function findFilesBySuffix(rootDir, suffixPath) {
    const target = String(suffixPath || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
    if (!target) return [];

    const found = [];
    const walk = (dir, relBase = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(abs, rel);
                continue;
            }
            if (rel.toLowerCase().endsWith(target)) {
                found.push(rel.replace(/\\/g, '/'));
            }
        }
    };

    walk(rootDir);
    found.sort((a, b) => a.length - b.length);
    return found;
}

function findFilesByExtensions(rootDir, extensions = []) {
    const extSet = new Set(
        (Array.isArray(extensions) ? extensions : [])
            .map((ext) => String(ext || '').trim().toLowerCase())
            .filter(Boolean)
    );
    if (extSet.size === 0) return [];

    const found = [];
    const walk = (dir, relBase = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(abs, rel);
                continue;
            }
            const ext = path.extname(entry.name).toLowerCase();
            if (extSet.has(ext)) {
                found.push(rel.replace(/\\/g, '/'));
            }
        }
    };

    walk(rootDir);
    found.sort((a, b) => a.length - b.length);
    return found;
}

function resolveFallbackTargetPath(safeSegments = []) {
    if (!Array.isArray(safeSegments) || safeSegments.length === 0) return null;
    const contentId = safeSegments[0];
    const contentRoot = path.join(CONTENT_ROOT, contentId);
    if (!fs.existsSync(contentRoot) || !fs.statSync(contentRoot).isDirectory()) return null;

    const requestedRest = safeSegments.slice(1).join('/');
    if (requestedRest) {
        const suffixMatch = findFilesBySuffix(contentRoot, requestedRest)[0];
        if (suffixMatch) {
            const resolved = path.join(contentRoot, suffixMatch);
            if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
        }
    }

    const candidates = [
        findFilesBySuffix(contentRoot, 'index.html')[0],
        findFilesBySuffix(contentRoot, 'index.htm')[0],
        findFilesByExtensions(contentRoot, ['.html', '.htm'])[0],
        findFilesByExtensions(contentRoot, ['.mp4', '.webm', '.ogg', '.mov', '.m3u8'])[0],
    ].filter(Boolean);

    for (const rel of candidates) {
        const resolved = path.join(contentRoot, rel);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
    }

    return null;
}

function resolveCaseInsensitivePath(baseDir, segments) {
    let currentDir = baseDir;
    const resolvedParts = [];

    for (const seg of segments) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        const exact = entries.find((entry) => entry.name === seg);
        const found = exact || entries.find((entry) => entry.name.toLowerCase() === seg.toLowerCase());
        if (!found) return null;
        resolvedParts.push(found.name);
        currentDir = path.join(currentDir, found.name);
    }

    return path.join(baseDir, ...resolvedParts);
}

function resolveTargetFile(slug = []) {
    const safeSegments = normalizeSegments(slug);

    if (safeSegments.length === 0) return null;

    const directPath = path.resolve(CONTENT_ROOT, ...safeSegments);
    const isInsideRoot = directPath === CONTENT_ROOT || directPath.startsWith(`${CONTENT_ROOT}${path.sep}`);
    if (!isInsideRoot) return null;

    let targetPath = directPath;
    if (!fs.existsSync(targetPath)) {
        const caseInsensitive = resolveCaseInsensitivePath(CONTENT_ROOT, safeSegments);
        if (caseInsensitive && fs.existsSync(caseInsensitive)) {
            targetPath = caseInsensitive;
        } else {
            const fallback = resolveFallbackTargetPath(safeSegments);
            if (!fallback) return null;
            targetPath = fallback;
        }
    }

    let stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
        const indexPath = path.join(targetPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            targetPath = indexPath;
        } else {
            const fallback = resolveFallbackTargetPath(safeSegments);
            if (!fallback) return null;
            targetPath = fallback;
        }
        stat = fs.statSync(targetPath);
    }

    if (!stat.isFile()) return null;
    return { targetPath, stat, canonicalPath: getCanonicalPathForTarget(targetPath) };
}

function createStreamResponse(filePath, stat, request) {
    const contentType = getMimeType(filePath);
    const rangeHeader = request.headers.get('range');
    const size = stat.size;

    const commonHeaders = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    };

    if (!rangeHeader) {
        const stream = fs.createReadStream(filePath);
        return new NextResponse(Readable.toWeb(stream), {
            status: 200,
            headers: {
                ...commonHeaders,
                'Content-Length': String(size),
            },
        });
    }

    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/i);
    if (!match) {
        return new NextResponse('Invalid Range', { status: 416 });
    }

    const rawStart = match[1];
    const rawEnd = match[2];
    let start = rawStart ? Number(rawStart) : 0;
    let end = rawEnd ? Number(rawEnd) : size - 1;

    if (!Number.isFinite(start) || start < 0) start = 0;
    if (!Number.isFinite(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
        return new NextResponse('Range Not Satisfiable', {
            status: 416,
            headers: {
                'Content-Range': `bytes */${size}`,
            },
        });
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    return new NextResponse(Readable.toWeb(stream), {
        status: 206,
        headers: {
            ...commonHeaders,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${size}`,
        },
    });
}

export async function GET(request, { params }) {
    try {
        const { response } = await requireSession(request);
        if (response) return response;

        const requestUrl = new URL(request.url);
        const awaitedParams = await Promise.resolve(params);
        const paramSlugValue = awaitedParams?.slug;
        const slugFromParams = Array.isArray(paramSlugValue)
            ? paramSlugValue
            : (typeof paramSlugValue === 'string' && paramSlugValue ? [paramSlugValue] : []);
        const safeSlug = slugFromParams.length > 0
            ? slugFromParams
            : extractSlugFromPathname(requestUrl.pathname);

        const resolved = resolveTargetFile(safeSlug);
        if (!resolved) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const requestedPath = normalizePathname(requestUrl.pathname);
        const canonicalPath = normalizePathname(resolved.canonicalPath || '');
        if (canonicalPath && canonicalPath !== requestedPath) {
            const redirectUrl = new URL(requestUrl.toString());
            redirectUrl.pathname = canonicalPath;
            return NextResponse.redirect(redirectUrl, 307);
        }

        return createStreamResponse(resolved.targetPath, resolved.stat, request);
    } catch (err) {
        console.error('[content/[...slug]/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
