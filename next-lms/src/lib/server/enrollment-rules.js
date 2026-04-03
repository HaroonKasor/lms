import prisma from '@/lib/prisma';

function normalizeTokenList(input) {
    const source = Array.isArray(input)
        ? input
        : String(input || '')
            .split(/[|,]/g)
            .map((item) => item.trim())
            .filter(Boolean);

    return Array.from(
        new Set(
            source
                .map((item) => String(item || '').trim())
                .filter(Boolean)
        )
    );
}

function toLowerKey(value) {
    return String(value || '').trim().toLowerCase();
}

function toNumericId(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

function toDisplayCourseName(course) {
    const title = String(course?.title || '').trim();
    if (title) return title;
    const code = String(course?.courseCode || '').trim();
    if (code) return code;
    const id = Number(course?.id || 0);
    return id > 0 ? `Course ${id}` : 'Course';
}

async function resolvePrerequisiteCourses({
    organizationId,
    prerequisites = [],
    excludeCourseId = null,
} = {}) {
    const normalizedTokens = normalizeTokenList(prerequisites);
    if (!Number.isInteger(Number(organizationId)) || Number(organizationId) <= 0 || normalizedTokens.length === 0) {
        return [];
    }

    const courses = await prisma.course.findMany({
        where: {
            organization_id: Number(organizationId),
        },
        select: {
            id: true,
            title: true,
            courseCode: true,
        },
    });

    if (!Array.isArray(courses) || courses.length === 0) return [];

    const byId = new Map();
    const byTitle = new Map();
    const byCode = new Map();

    for (const course of courses) {
        const id = Number(course?.id || 0);
        if (!Number.isInteger(id) || id <= 0) continue;
        byId.set(id, course);

        const titleKey = toLowerKey(course?.title);
        if (titleKey && !byTitle.has(titleKey)) byTitle.set(titleKey, course);

        const codeKey = toLowerKey(course?.courseCode);
        if (codeKey && !byCode.has(codeKey)) byCode.set(codeKey, course);
    }

    const excludedId = toNumericId(excludeCourseId);
    const matched = [];
    const seenIds = new Set();

    for (const token of normalizedTokens) {
        const numeric = toNumericId(token);
        const key = toLowerKey(token);
        const course = (numeric ? byId.get(numeric) : null) || byTitle.get(key) || byCode.get(key) || null;
        if (!course) continue;

        const courseId = Number(course?.id || 0);
        if (!Number.isInteger(courseId) || courseId <= 0) continue;
        if (excludedId && courseId === excludedId) continue;
        if (seenIds.has(courseId)) continue;

        seenIds.add(courseId);
        matched.push(course);
    }

    return matched;
}

async function findMissingPrerequisites({
    userId,
    organizationId,
    prerequisiteCourses = [],
} = {}) {
    const numericUserId = Number(userId);
    const numericOrganizationId = Number(organizationId);
    const prerequisiteIds = Array.from(
        new Set(
            (prerequisiteCourses || [])
                .map((course) => Number(course?.id || 0))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );

    if (!Number.isInteger(numericUserId) || numericUserId <= 0) return [];
    if (!Number.isInteger(numericOrganizationId) || numericOrganizationId <= 0) return [];
    if (prerequisiteIds.length === 0) return [];

    const completed = await prisma.enrollment.findMany({
        where: {
            userId: numericUserId,
            organization_id: numericOrganizationId,
            courseId: { in: prerequisiteIds },
            status: 'completed',
        },
        select: {
            courseId: true,
        },
    });

    const completedSet = new Set(
        completed
            .map((row) => Number(row?.courseId || 0))
            .filter((id) => Number.isInteger(id) && id > 0)
    );

    return prerequisiteCourses.filter((course) => !completedSet.has(Number(course?.id || 0)));
}

function buildPrerequisiteBlockedMessage(missingCourses = []) {
    const names = (missingCourses || [])
        .map((course) => toDisplayCourseName(course))
        .filter(Boolean);
    if (names.length === 0) return 'ยังไม่ผ่านเงื่อนไข prerequisite ของหลักสูตรนี้';
    return `ต้องจบคอร์ส ${names.join(', ')} ก่อน`;
}

export {
    buildPrerequisiteBlockedMessage,
    findMissingPrerequisites,
    resolvePrerequisiteCourses,
    toDisplayCourseName,
};
