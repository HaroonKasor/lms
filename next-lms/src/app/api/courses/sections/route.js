import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSectionCompatMaps, setSectionSettings } from '@/lib/server/compat-db';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';

function isTruthyFlag(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return false;
        return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
    }
    return false;
}

function normalizeSectionType(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'lesson';
    if (raw === 'video' || raw === 'scorm' || raw === 'tincan' || raw === 'lesson') return 'lesson';
    if (raw === 'quiz') return 'quiz';
    if (raw === 'assignment') return 'assignment';
    if (raw === 'live') return 'live';
    if (raw === 'resource') return 'resource';
    if (raw === 'other') return 'other';
    return 'lesson';
}

function normalizeSection(section, sectionSettingsBySectionId = {}) {
    const sectionKey = String(section?.id || '');
    const settings = sectionSettingsBySectionId?.[sectionKey] || {};
    return {
        ...section,
        sessionCode: '',
        name: section.title || '',
        detail: '',
        registerDateFrom: String(settings?.registerDateFrom || '').trim(),
        registerDateTo: String(settings?.registerDateTo || '').trim(),
        registerUnlimit: Boolean(settings?.registerUnlimit),
        learnDateTo: String(settings?.learnDateTo || '').trim(),
        learnDateUnlimit: settings?.learnDateUnlimit !== false,
        maxLearner: section.maxLearner || 0,
        maxLearnerUnlimit: section.maxLearner == null || Boolean(settings?.maxLearnerUnlimit),
        status: section.isActive ? 'active' : 'inactive',
        autoApprove: true,
        certificate: false,
        autoCert: false,
        printCert: false,
        cohortModule: false,
        groups: '',
    };
}

/**
 * GET - Get sections for a specific course
 */
export async function GET(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const rawCourseId = searchParams.get('courseId') || searchParams.get('lrscourseid');
        const courseId = parseInt(rawCourseId, 10);

        if (!courseId) {
            return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
        }

        const sections = await prisma.section.findMany({
            where: { courseId },
            orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
        });

        const sectionCompatMaps = await getSectionCompatMaps(sections.map((section) => section?.id));
        return NextResponse.json(
            sections.map((section) => normalizeSection(section, sectionCompatMaps?.sectionSettingsBySectionId || {}))
        );
    } catch (err) {
        console.error('[courses/sections/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST - Create a new section for a course
 */
export async function POST(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const courseId = parseInt(body.courseId, 10);

        if (!courseId) {
            return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
        }

        const title = String(body.name || body.title || '').trim();
        if (!title) {
            return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
        }

        const maxOrder = await prisma.section.aggregate({
            where: { courseId },
            _max: { orderNo: true },
        });

        const nextOrder = (maxOrder?._max?.orderNo || 0) + 1;
        const sectionType = normalizeSectionType(body.sectionType);

        const section = await prisma.section.create({
            data: {
                courseId,
                title,
                orderNo: nextOrder,
                sectionType,
                maxLearner: isTruthyFlag(body.maxLearnerUnlimit) ? null : (Number(body.maxLearner) || null),
                isActive: String(body.status || 'active').toLowerCase() !== 'inactive',
                isPublic: body.isPublic ?? false,
            },
        });

        await setSectionSettings(section.id, {
            registerDateFrom: body.registerDateFrom,
            registerDateTo: body.registerDateTo,
            registerUnlimit: body.registerUnlimit,
            learnDateTo: body.learnDateTo,
            learnDateUnlimit: body.learnDateUnlimit,
            maxLearnerUnlimit: body.maxLearnerUnlimit,
        });

        const sectionCompatMaps = await getSectionCompatMaps([section.id]);
        return NextResponse.json({
            success: true,
            section: normalizeSection(section, sectionCompatMaps?.sectionSettingsBySectionId || {}),
        });
    } catch (err) {
        if (err?.code === 'P2003') {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }
        console.error('[courses/sections/POST] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT - Update an existing section
 */
export async function PUT(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const id = parseInt(body.id, 10);
        if (!id) {
            return NextResponse.json({ error: 'Section id is required' }, { status: 400 });
        }

        const existingSection = await prisma.section.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                sectionType: true,
                maxLearner: true,
                isActive: true,
                isPublic: true,
            },
        });
        if (!existingSection) {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }

        const title = String(body.name || body.title || '').trim();
        if (!title) {
            return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
        }

        const hasStatus = body.status !== undefined && body.status !== null && body.status !== '';
        const hasIsPublic = typeof body.isPublic === 'boolean';
        const hasMaxLearnerUnlimit = body.maxLearnerUnlimit !== undefined && body.maxLearnerUnlimit !== null && body.maxLearnerUnlimit !== '';
        const hasMaxLearner = body.maxLearner !== undefined && body.maxLearner !== null && body.maxLearner !== '';

        let nextMaxLearner = existingSection.maxLearner;
        if (hasMaxLearnerUnlimit && isTruthyFlag(body.maxLearnerUnlimit)) {
            nextMaxLearner = null;
        } else if (hasMaxLearnerUnlimit || hasMaxLearner) {
            nextMaxLearner = Number(body.maxLearner) || null;
        }

        const section = await prisma.section.update({
            where: { id },
            data: {
                title,
                sectionType: normalizeSectionType(body.sectionType || existingSection.sectionType),
                maxLearner: nextMaxLearner,
                isActive: hasStatus
                    ? String(body.status).toLowerCase() !== 'inactive'
                    : existingSection.isActive,
                isPublic: hasIsPublic ? body.isPublic : existingSection.isPublic,
            },
        });

        if (
            body.registerDateFrom !== undefined
            || body.registerDateTo !== undefined
            || body.registerUnlimit !== undefined
            || body.learnDateTo !== undefined
            || body.learnDateUnlimit !== undefined
            || body.maxLearnerUnlimit !== undefined
        ) {
            await setSectionSettings(section.id, {
                registerDateFrom: body.registerDateFrom,
                registerDateTo: body.registerDateTo,
                registerUnlimit: body.registerUnlimit,
                learnDateTo: body.learnDateTo,
                learnDateUnlimit: body.learnDateUnlimit,
                maxLearnerUnlimit: body.maxLearnerUnlimit,
            });
        }

        const sectionCompatMaps = await getSectionCompatMaps([section.id]);
        return NextResponse.json({
            success: true,
            section: normalizeSection(section, sectionCompatMaps?.sectionSettingsBySectionId || {}),
        });
    } catch (err) {
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }
        console.error('[courses/sections/PUT] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE - Delete a section
 */
export async function DELETE(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true });
        if (response) return response;

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get('id'), 10);
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const section = await prisma.section.findUnique({ where: { id }, select: { courseId: true } });
        if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

        const progressCount = await prisma.learningProgress.count({ where: { sectionId: id } });
        if (progressCount > 0) {
            return NextResponse.json(
                { error: 'ไม่สามารถลบ Section ได้: มีความคืบหน้าการเรียนใน Section นี้แล้ว' },
                { status: 400 }
            );
        }

        await prisma.section.delete({ where: { id } });
        await setSectionSettings(id, null);
        return NextResponse.json({ success: true });
    } catch (err) {
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }
        console.error('[courses/sections/DELETE] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
