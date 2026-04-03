import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { getCourseCompatMaps } from '@/lib/server/compat-db';
import { resolveEnrollmentSectionId } from '@/lib/server/section-runtime';

const ENROLLMENT_STATUS_RANK = {
    COMPLETED: 5,
    LEARNING: 4,
    IN_PROGRESS: 4,
    APPROVED: 3,
    PENDING: 2,
    FAILED: 1,
    CANCELLED: 0,
};

function toSafeTime(value) {
    const ms = new Date(value || 0).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toProgressNumber(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, n));
}

function toDateTimeText(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return (
        date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }) +
        ' at ' +
        date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        })
    );
}

function parseIsoDurationToMinutes(value) {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw) / 60;

    const match = raw.match(/^P(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)$/i);
    if (!match) return 0;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    if (![hours, minutes, seconds].every(Number.isFinite)) return 0;
    return hours * 60 + minutes + seconds / 60;
}

function normalizeThumbnail(thumbnail) {
    const value = String(thumbnail || '').trim();
    if (!value) return '/course.png';
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.startsWith('/api/uploads/image?file=')) return value;
    if (value.startsWith('api/uploads/image?file=')) return `/${value}`;
    const uploadPathMatch = value.match(/(?:^https?:\/\/[^/]+)?\/?uploads\/courses\/([^/?#]+)/i);
    if (uploadPathMatch?.[1]) {
        return `/api/uploads/image?file=${encodeURIComponent(uploadPathMatch[1])}`;
    }
    if (value.startsWith('/')) return value;
    if (value.startsWith('uploads/')) return `/${value}`;
    return '/course.png';
}

function pickBestEnrollment(enrollments = []) {
    if (!Array.isArray(enrollments) || enrollments.length === 0) return null;

    const sorted = [...enrollments].sort((a, b) => {
        const rankA = ENROLLMENT_STATUS_RANK[String(a?.status || '').toUpperCase()] ?? -1;
        const rankB = ENROLLMENT_STATUS_RANK[String(b?.status || '').toUpperCase()] ?? -1;
        if (rankB !== rankA) return rankB - rankA;

        const progressA = toSafeNumber(a?.progressPercent, 0);
        const progressB = toSafeNumber(b?.progressPercent, 0);
        if (progressB !== progressA) return progressB - progressA;

        const timeA = toSafeTime(a?.lastActivityAt || a?.updatedAt || a?.enrolledAt);
        const timeB = toSafeTime(b?.lastActivityAt || b?.updatedAt || b?.enrolledAt);
        if (timeB !== timeA) return timeB - timeA;

        return Number(b?.id || 0) - Number(a?.id || 0);
    });

    return sorted[0] || null;
}

function buildRowsFromStatements(statements = [], fallbackCourseName = 'Activity') {
    const byTimeAsc = [...statements].sort((a, b) => {
        const ta = toSafeTime(a?.timestamp || a?.storedAt || a?.receivedAt);
        const tb = toSafeTime(b?.timestamp || b?.storedAt || b?.receivedAt);
        return ta - tb;
    });

    return byTimeAsc.map((row, idx) => {
        const payload = row?.statement_json && typeof row.statement_json === 'object'
            ? row.statement_json
            : {};
        const result = payload?.result || {};
        const extensions = result?.extensions || {};
        const currentTs = toSafeTime(payload?.timestamp || payload?.storedAt || row?.receivedAt);

        const explicitDurationMinutes =
            parseIsoDurationToMinutes(result?.duration) ||
            (toSafeNumber(extensions['https://w3id.org/xapi/video/extensions/length'], 0) / 60) ||
            (toSafeNumber(extensions.length, 0) / 60);

        let fallbackDeltaMinutes = 0;
        if (idx > 0) {
            const prevRow = byTimeAsc[idx - 1];
            const prevPayload = prevRow?.statement_json && typeof prevRow.statement_json === 'object'
                ? prevRow.statement_json
                : {};
            const prevTs = toSafeTime(prevPayload?.timestamp || prevPayload?.storedAt || prevRow?.receivedAt);
            const gapMinutes = (currentTs - prevTs) / 60000;
            if (Number.isFinite(gapMinutes) && gapMinutes > 0 && gapMinutes <= 45) {
                fallbackDeltaMinutes = gapMinutes;
            }
        }

        const activityName = String(
            payload?.object?.definition?.name?.['en-US']
            || payload?.object?.definition?.name?.en
            || payload?.object?.definition?.name?.th
            || payload?.object?.id
            || fallbackCourseName
        ).trim() || fallbackCourseName;

        return {
            activity: activityName,
            dateTime: toDateTimeText(payload?.timestamp || payload?.storedAt || row?.receivedAt),
            timestampMs: currentTs,
            durationMinutes: explicitDurationMinutes > 0 ? explicitDurationMinutes : fallbackDeltaMinutes,
        };
    });
}

function hydrateDurationFromProgress(rows = [], latestProgress = null) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;
    const statementMinutes = rows.reduce((sum, row) => sum + Number(row?.durationMinutes || 0), 0);
    if (statementMinutes > 0) return rows;

    const trackedSeconds = toSafeNumber(latestProgress?.scoreRaw, 0);
    const byTrackedProgress = trackedSeconds > 0 ? (trackedSeconds / 60) : 0;
    const progressCurrent = toSafeNumber(latestProgress?.currentTime, 0);
    const progressDuration = toSafeNumber(latestProgress?.duration, 0);
    const shouldUseProgressAsSeconds =
        progressCurrent > 0
        && (progressCurrent >= 60 || progressDuration >= 60);
    const byProgress = shouldUseProgressAsSeconds ? (progressCurrent / 60) : 0;
    const fallbackMinutes = Math.max(byTrackedProgress, byProgress, 0);
    if (fallbackMinutes <= 0) return rows;

    let latestIdx = 0;
    for (let i = 1; i < rows.length; i += 1) {
        if (toSafeNumber(rows[i]?.timestampMs, 0) > toSafeNumber(rows[latestIdx]?.timestampMs, 0)) {
            latestIdx = i;
        }
    }

    return rows.map((row, idx) => (
        idx === latestIdx
            ? { ...row, durationMinutes: fallbackMinutes }
            : row
    ));
}

function toGroupedSections(rows = [], lessonCount = 0, fallbackTitle = 'Activity') {
    const sortedRows = [...rows]
        .sort((a, b) => toSafeNumber(b?.timestampMs, 0) - toSafeNumber(a?.timestampMs, 0));

    if (sortedRows.length === 0) return [];

    if (lessonCount <= 1) {
        return [
            {
                title: fallbackTitle,
                records: sortedRows.map((row, idx) => ({
                    id: idx + 1,
                    dateTime: row.dateTime,
                    durationMinutes: toSafeNumber(row.durationMinutes, 0),
                })),
            },
        ];
    }

    const grouped = new Map();
    for (const row of sortedRows) {
        const key = String(row?.activity || fallbackTitle).trim() || fallbackTitle;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    }

    return Array.from(grouped.entries()).map(([title, records]) => ({
        title,
        records: records.map((row, idx) => ({
            id: idx + 1,
            dateTime: row.dateTime,
            durationMinutes: toSafeNumber(row.durationMinutes, 0),
        })),
    }));
}

export async function GET(request) {
    try {
        const { session, response } = await requireSession(request);
        if (response) return response;

        const organizationId = await ensureDefaultOrganization();
        const { searchParams } = new URL(request.url);
        const courseId = Number(searchParams.get('courseId'));
        if (!Number.isInteger(courseId) || courseId <= 0) {
            return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
        }

        const enrollments = await prisma.enrollment.findMany({
            where: {
                organization_id: organizationId,
                userId: Number(session.uid),
                courseId,
            },
            include: {
                courses: {
                    select: {
                        id: true,
                        title: true,
                        categoryId: true,
                        categories: { select: { name: true } },
                        sections: {
                            select: {
                                id: true,
                                title: true,
                                orderNo: true,
                                isActive: true,
                            },
                            orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                        },
                    },
                },
                learning_progress: {
                    select: {
                        id: true,
                        sectionId: true,
                        status: true,
                        progressPercent: true,
                        currentTime: true,
                        duration: true,
                        scoreRaw: true,
                    },
                    orderBy: [{ id: 'desc' }],
                },
            },
            orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
        });

        const selectedEnrollment = pickBestEnrollment(enrollments);
        if (!selectedEnrollment) {
            return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
        }

        const availableSections = Array.isArray(selectedEnrollment?.courses?.sections)
            ? selectedEnrollment.courses.sections
            : [];
        const learningProgressRows = Array.isArray(selectedEnrollment?.learning_progress)
            ? selectedEnrollment.learning_progress
            : [];
        const selectedSectionId = resolveEnrollmentSectionId({
            explicitSectionId: selectedEnrollment?.sectionId,
            learningProgressRows,
            availableSections,
        });
        const selectedSection = selectedSectionId
            ? availableSections.find((item) => Number(item?.id || 0) === Number(selectedSectionId))
            : null;
        const latestProgress = learningProgressRows[0] || null;

        const courseCompatMaps = await getCourseCompatMaps([Number(selectedEnrollment.courseId)]);
        const courseThumbnail = courseCompatMaps?.thumbnailByCourseId?.[String(selectedEnrollment.courseId)] || '';

        const statements = await prisma.xapiStatement.findMany({
            where: { enrollmentId: Number(selectedEnrollment.id) },
            select: {
                id: true,
                receivedAt: true,
                statement_json: true,
            },
            orderBy: { receivedAt: 'asc' },
            take: 1000,
        });

        let rows = buildRowsFromStatements(statements, String(selectedEnrollment?.courses?.title || 'Activity'));
        rows = hydrateDurationFromProgress(rows, latestProgress);

        const statementMinutes = rows.reduce((sum, row) => sum + toSafeNumber(row?.durationMinutes, 0), 0);
        const trackedSeconds = toSafeNumber(latestProgress?.scoreRaw, 0);
        const byTrackedProgress = trackedSeconds > 0 ? (trackedSeconds / 60) : 0;
        const progressCurrent = toSafeNumber(latestProgress?.currentTime, 0);
        const progressDuration = toSafeNumber(latestProgress?.duration, 0);
        const shouldUseProgressAsSeconds =
            progressCurrent > 0
            && (progressCurrent >= 60 || progressDuration >= 60);
        const byProgress = shouldUseProgressAsSeconds ? (progressCurrent / 60) : 0;
        const fallbackMinutes = Math.max(byTrackedProgress, byProgress, 0);

        if (rows.length === 0 && fallbackMinutes > 0) {
            rows = [{
                activity: String(selectedSection?.title || selectedEnrollment?.courses?.title || 'Activity').trim() || 'Activity',
                dateTime: toDateTimeText(selectedEnrollment?.lastActivityAt || selectedEnrollment?.startedAt || selectedEnrollment?.enrolledAt),
                timestampMs: toSafeTime(selectedEnrollment?.lastActivityAt || selectedEnrollment?.startedAt || selectedEnrollment?.enrolledAt),
                durationMinutes: fallbackMinutes,
            }];
        }

        const totalStudyMinutes = Math.max(statementMinutes, fallbackMinutes, 0);
        const groupedSections = toGroupedSections(
            rows,
            Number(availableSections.length || 0),
            String(selectedEnrollment?.courses?.title || 'Activity').trim() || 'Activity'
        );

        return NextResponse.json({
            course: {
                id: Number(selectedEnrollment?.courses?.id || selectedEnrollment?.courseId || 0),
                name: String(selectedEnrollment?.courses?.title || '').trim(),
                category: String(selectedEnrollment?.courses?.categories?.name || '').trim(),
                thumbnail: normalizeThumbnail(courseThumbnail),
                sectionName: String(selectedSection?.title || '').trim(),
                enrollmentStatus: String(selectedEnrollment?.status || '').toUpperCase(),
                progressPercent: toProgressNumber(selectedEnrollment?.progressPercent, 0),
            },
            summary: {
                totalStudyMinutes,
                statementCount: Array.isArray(statements) ? statements.length : 0,
            },
            sections: groupedSections,
        });
    } catch (err) {
        console.error('[reports/my-course][GET] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
