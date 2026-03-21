import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { listContents } from '@/lib/server/compat-db';
import { requireSession } from '@/lib/server/auth';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const CONTENT_DIR = path.join(PUBLIC_DIR, 'content');

function normalizeLocalSrc(src) {
    const raw = String(src || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const noOrigin = raw.replace(/^https?:\/\/[^/]+/i, '');
    const [pathOnly, suffix = ''] = noOrigin.split(/(?=[?#])/);
    const safePath = String(pathOnly || '')
        .replace(/\\/g, '/')
        .split('/')
        .filter((segment) => segment && segment !== '.' && segment !== '..')
        .join('/');

    if (!safePath) return '';
    return `/${safePath.replace(/^content\//i, 'content/')}${suffix}`;
}

function resolveCaseInsensitivePath(baseDir, relPath) {
    const parts = String(relPath || '')
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean);

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

function fileExistsInPublic(publicRelativePath) {
    const rel = String(publicRelativePath || '').replace(/^\/+/, '');
    if (!rel) return false;
    const abs = path.join(PUBLIC_DIR, rel);
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request);
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const srcParam = searchParams.get('src') || '';
        const normalizedSrc = normalizeLocalSrc(srcParam);

        if (!normalizedSrc) {
            return NextResponse.json({ error: 'Missing src' }, { status: 400 });
        }

        if (/^https?:\/\//i.test(normalizedSrc)) {
            return NextResponse.json({ resolvedSrc: normalizedSrc });
        }

        if (fileExistsInPublic(normalizedSrc)) {
            return NextResponse.json({ resolvedSrc: normalizedSrc });
        }

        const cleanRelative = normalizedSrc.replace(/^\/+/, '').split(/[?#]/)[0];
        const match = cleanRelative.match(/^content\/([^/]+)\/?(.*)$/i);
        if (!match) {
            return NextResponse.json({ resolvedSrc: '', requestedSrc: normalizedSrc }, { status: 404 });
        }

        const contentId = match[1];
        const rest = String(match[2] || '');
        const contentRoot = path.join(CONTENT_DIR, contentId);

        if (fs.existsSync(contentRoot) && fs.statSync(contentRoot).isDirectory()) {
            if (rest) {
                const caseInsensitive = resolveCaseInsensitivePath(contentRoot, rest);
                if (caseInsensitive) {
                    const resolved = `/content/${contentId}/${caseInsensitive}`;
                    if (fileExistsInPublic(resolved)) {
                        return NextResponse.json({ resolvedSrc: resolved });
                    }
                }

                const bySuffix = findFilesBySuffix(contentRoot, rest)[0];
                if (bySuffix) {
                    const resolved = `/content/${contentId}/${bySuffix}`;
                    if (fileExistsInPublic(resolved)) {
                        return NextResponse.json({ resolvedSrc: resolved });
                    }
                }
            }

            // Generic launch fallback: pick the first playable/launchable file when requested path is stale.
            const launchFallbacks = [
                findFilesBySuffix(contentRoot, 'index.html')[0],
                findFilesBySuffix(contentRoot, 'index.htm')[0],
                findFilesByExtensions(contentRoot, ['.html', '.htm'])[0],
                findFilesByExtensions(contentRoot, ['.mp4', '.webm', '.ogg', '.mov', '.m3u8'])[0],
            ].filter(Boolean);

            for (const candidate of launchFallbacks) {
                const resolved = `/content/${contentId}/${candidate}`;
                if (fileExistsInPublic(resolved)) {
                    return NextResponse.json({ resolvedSrc: resolved });
                }
            }
        }

        const contentRows = await listContents();
        const contentMeta = contentRows.find((item) => String(item?.id) === String(contentId));
        const entryPoint = String(contentMeta?.entryPoint || '').replace(/^\/+/, '');
        if (entryPoint) {
            const resolved = `/${entryPoint}`;
            if (fileExistsInPublic(resolved)) {
                return NextResponse.json({ resolvedSrc: resolved });
            }
        }

        return NextResponse.json({ resolvedSrc: '', requestedSrc: normalizedSrc }, { status: 404 });
    } catch (err) {
        console.error('[content/resolve] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
