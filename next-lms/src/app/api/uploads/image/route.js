import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireSession } from '@/lib/server/auth';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'courses');
const FALLBACK_COURSE_IMAGE = path.join(process.cwd(), 'public', 'course.png');
const FALLBACK_AVATAR_IMAGE = path.join(process.cwd(), 'public', 'images', 'default-avatar.svg');

function getUploadRoots() {
    const envRoot = String(process.env.UPLOADS_DIR || '').trim();
    const roots = [
        envRoot ? path.resolve(envRoot) : null,
        path.resolve(DEFAULT_UPLOAD_DIR),
        path.resolve(path.join(process.cwd(), 'public', 'uploads')),
        path.resolve(path.join(process.cwd(), 'uploads')),
    ].filter(Boolean);
    return Array.from(new Set(roots));
}

function sanitizeFileName(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    let decoded = raw;
    try {
        decoded = decodeURIComponent(raw);
    } catch {
        decoded = raw;
    }
    const base = path.basename(decoded);
    if (!base || base === '.' || base === '..') return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
    return base;
}

function getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.avif') return 'image/avif';
    if (ext === '.svg') return 'image/svg+xml';
    return 'application/octet-stream';
}

function toPublicImageUrl(fileName) {
    return `/api/uploads/image?file=${encodeURIComponent(fileName)}`;
}

function resolveExistingImagePath(fileName) {
    const roots = getUploadRoots();
    for (const root of roots) {
        const uploadRoot = path.resolve(root);
        const filePath = path.resolve(uploadRoot, fileName);
        if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) continue;
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}

function chooseFallbackPath(fileName) {
    const safeName = String(fileName || '').toLowerCase();
    const preferredFallback = safeName.startsWith('avatar-') ? FALLBACK_AVATAR_IMAGE : FALLBACK_COURSE_IMAGE;
    if (fs.existsSync(preferredFallback)) return preferredFallback;
    if (fs.existsSync(FALLBACK_COURSE_IMAGE)) return FALLBACK_COURSE_IMAGE;
    if (fs.existsSync(FALLBACK_AVATAR_IMAGE)) return FALLBACK_AVATAR_IMAGE;
    return null;
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request);
        if (response) return response;

        const fileName = sanitizeFileName(request.nextUrl.searchParams.get('file'));
        if (!fileName) {
            return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
        }

        const filePath = resolveExistingImagePath(fileName) || chooseFallbackPath(fileName);
        if (!filePath) return NextResponse.json({ error: 'File not found' }, { status: 404 });

        const buffer = fs.readFileSync(filePath);
        const responseFileName = path.basename(filePath);
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': getContentType(responseFileName),
                'Cache-Control': 'public, max-age=604800',
            },
        });
    } catch (error) {
        console.error('[uploads/image/GET] failed', error);
        return NextResponse.json({ error: 'Load image failed' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;

        const contentType = request.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
            return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 400 });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || typeof file === 'string') {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'Image is too large (max 5MB)' }, { status: 400 });
        }

        const ext = path.extname(file.name || '').toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : '.jpg';
        const fileName = `${Date.now()}-${crypto.randomUUID()}${safeExt}`;

        fs.mkdirSync(DEFAULT_UPLOAD_DIR, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(DEFAULT_UPLOAD_DIR, fileName), buffer);

        return NextResponse.json({
            success: true,
            fileName,
            url: toPublicImageUrl(fileName),
            legacyUrl: `/uploads/courses/${fileName}`,
        });
    } catch (error) {
        console.error('[uploads/image/POST] failed', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
