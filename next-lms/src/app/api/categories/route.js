import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { readJsonBody } from '@/lib/server/request-validation';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import {
    deleteCategoryDetail,
    getCategoryDetailMapByIds,
    setCategoryDetail,
} from '@/lib/server/category-detail-db';

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
}

function mapCategory(category, detail = '') {
    return {
        ...category,
        codeName: category.code || '',
        detail: String(detail || '').trim(),
        categoryDetail: String(detail || '').trim(),
        isPublic: Boolean(category.isActive),
    };
}

export async function GET(request) {
    try {
        const { response } = await requireSession(request);
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const categories = await prisma.category.findMany({
            where: { organization_id: organizationId },
            orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
        });
        const detailMap = await getCategoryDetailMapByIds(
            categories.map((item) => item.id),
            organizationId
        );
        return NextResponse.json(
            categories.map((category) => mapCategory(category, detailMap.get(Number(category.id)) || ''))
        );
    } catch (err) {
        console.error('[categories/GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const name = (body.categoryName || body.name || '').trim();

        if (!name) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
        }

        const parentId = body.mainCategory ? parseInt(body.mainCategory, 10) : null;
        if (body.mainCategory && Number.isNaN(parentId)) {
            return NextResponse.json({ error: 'Invalid main category id' }, { status: 400 });
        }

        const category = await prisma.category.create({
            data: {
                organization_id: organizationId,
                name,
                code: String(body.codeName || body.code || slugify(name).toUpperCase().slice(0, 50)),
                slug: String(body.slug || slugify(name) || `category-${Date.now()}`),
                isActive: body.isPublic ?? body.isActive ?? true,
                parentId,
            },
        });
        await setCategoryDetail(prisma, {
            organizationId,
            categoryId: category.id,
            detail: body.categoryDetail || body.detail || '',
        });

        return NextResponse.json({
            success: true,
            category: mapCategory(category, body.categoryDetail || body.detail || ''),
        });
    } catch (err) {
        const isUniqueViolation = err?.code === 'P2002';
        if (!isUniqueViolation) {
            console.error('[categories/POST] failed', err);
        }
        return NextResponse.json(
            { error: isUniqueViolation ? 'Category name already exists' : 'Internal server error' },
            { status: isUniqueViolation ? 409 : 500 }
        );
    }
}

export async function DELETE(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get('id'), 10);
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const usingCount = await prisma.course.count({
            where: {
                organization_id: organizationId,
                categoryId: id,
            },
        });
        if (usingCount > 0) {
            return NextResponse.json({ error: 'Cannot delete category in use by courses' }, { status: 400 });
        }

        await prisma.category.delete({
            where: {
                id_organization_id: {
                    id,
                    organization_id: organizationId,
                },
            },
        });
        await deleteCategoryDetail(prisma, {
            organizationId,
            categoryId: id,
        });
        return NextResponse.json({ success: true });
    } catch (err) {
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }
        if (err?.code === 'P2003') {
            return NextResponse.json({ error: 'Cannot delete category in use by courses' }, { status: 400 });
        }
        console.error('[categories/DELETE] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const { response } = await requireSession(request, { requireAdmin: true, allowInstructor: true });
        if (response) return response;
        const organizationId = await ensureDefaultOrganization();

        const { searchParams } = new URL(request.url);
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;
        const id = parseInt(searchParams.get('id') || body.id, 10);
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const name = (body.categoryName || body.name || '').trim();
        if (!name) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
        }

        const parentId = body.mainCategory ? parseInt(body.mainCategory, 10) : null;
        if (body.mainCategory && Number.isNaN(parentId)) {
            return NextResponse.json({ error: 'Invalid main category id' }, { status: 400 });
        }
        if (parentId === id) {
            return NextResponse.json({ error: 'Category cannot be parent of itself' }, { status: 400 });
        }

        const category = await prisma.category.update({
            where: {
                id_organization_id: {
                    id,
                    organization_id: organizationId,
                },
            },
            data: {
                name,
                code: String(body.codeName || body.code || slugify(name).toUpperCase().slice(0, 50)),
                slug: String(body.slug || slugify(name) || `category-${id}`),
                isActive: body.isPublic ?? body.isActive ?? true,
                parentId,
            },
        });
        await setCategoryDetail(prisma, {
            organizationId,
            categoryId: category.id,
            detail: body.categoryDetail || body.detail || '',
        });

        return NextResponse.json({
            success: true,
            category: mapCategory(category, body.categoryDetail || body.detail || ''),
        });
    } catch (err) {
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }
        const isUniqueViolation = err?.code === 'P2002';
        if (!isUniqueViolation) {
            console.error('[categories/PUT] failed', err);
        }
        return NextResponse.json(
            { error: isUniqueViolation ? 'Category name already exists' : 'Internal server error' },
            { status: isUniqueViolation ? 409 : 500 }
        );
    }
}
