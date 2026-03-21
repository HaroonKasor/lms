import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
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
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'courses');

function extensionFromMime(mimeType = '') {
    const mime = String(mimeType || '').toLowerCase();
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'image/gif') return '.gif';
    if (mime === 'image/avif') return '.avif';
    return '.jpg';
}

function buildAvatarUrl(fileName) {
    return `/api/uploads/image?file=${encodeURIComponent(fileName)}`;
}

export async function POST(request) {
    try {
        const { session, response } = await requireSession(request);
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

        const ext = extensionFromMime(file.type);
        const fileName = `avatar-${session.uid}-${Date.now()}-${crypto.randomUUID()}${ext}`;
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);

        const avatarUrl = buildAvatarUrl(fileName);

        await prisma.userProfile.upsert({
            where: { userId: Number(session.uid) },
            update: { avatarUrl },
            create: {
                userId: Number(session.uid),
                avatarUrl,
            },
        });

        return NextResponse.json({
            success: true,
            avatar: avatarUrl,
            fileName,
        });
    } catch (error) {
        console.error('[users/profile/avatar][POST] failed', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}

