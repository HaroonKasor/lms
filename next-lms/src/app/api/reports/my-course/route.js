import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/server/auth';
import { ensureDefaultOrganization } from '@/lib/server/enterprise-context';
import { getCourseCompatMaps, listContents } from '@/lib/server/compat-db';
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

function getExtensionValueByKeySuffix(extensions = {}, suffix = '') {
    const target = String(suffix || '').trim().toLowerCase();
    if (!target) return '';
    for (const [key, value] of Object.entries(extensions || {})) {
        const normalizedKey = String(key || '').trim().toLowerCase();
        if (!normalizedKey) continue;
        if (normalizedKey.endsWith(target)) {
            const text = String(value || '').trim();
            if (text) return text;
        }
    }
    return '';
}

function inferActivityNameFromId(activityId = '') {
    const raw = String(activityId || '').trim();
    if (!raw) return '';
    let path = raw;
    try {
        if (/^https?:\/\//i.test(raw)) {
            path = new URL(raw).pathname || raw;
        }
    } catch {
        path = raw;
    }

    const cleaned = String(path)
        .replace(/\\/g, '/')
        .split('?')[0]
        .split('#')[0]
        .replace(/\/+$/, '');
    if (!cleaned) return '';

    const lastSegment = cleaned.split('/').filter(Boolean).pop() || '';
    if (!lastSegment) return '';
    const decoded = (() => {
        try {
            return decodeURIComponent(lastSegment);
        } catch {
            return lastSegment;
        }
    })();
    const withoutExt = decoded.replace(/\.(html?|xhtml|xml|js|json)$/i, '');
    return String(withoutExt || decoded).replace(/[-_]+/g, ' ').trim();
}

function deriveActivityIdentity(payload = {}, fallbackCourseName = 'Activity') {
    const result = payload?.result || {};
    const extensions = result?.extensions || {};
    const contextExtensions = payload?.context?.extensions || {};
    const taggedActivityId =
        getExtensionValueByKeySuffix(contextExtensions, '/activity-id')
        || getExtensionValueByKeySuffix(extensions, '/activity-id');
    const taggedActivityName =
        getExtensionValueByKeySuffix(contextExtensions, '/activity-name')
        || getExtensionValueByKeySuffix(extensions, '/activity-name');
    const taggedActivityIndex =
        getExtensionValueByKeySuffix(contextExtensions, '/activity-index')
        || getExtensionValueByKeySuffix(extensions, '/activity-index');
    const originalObjectId =
        getExtensionValueByKeySuffix(contextExtensions, '/original-object-id')
        || getExtensionValueByKeySuffix(extensions, '/original-object-id');

    const objectId = String(payload?.object?.id || '').trim();
    const activityId = String(taggedActivityId || originalObjectId || objectId || '').trim();
    const activityNameFromPayload = String(
        taggedActivityName
        || payload?.object?.definition?.name?.['en-US']
        || payload?.object?.definition?.name?.en
        || payload?.object?.definition?.name?.th
        || ''
    ).trim();

    const inferredFromId = inferActivityNameFromId(activityId);
    const fallbackName = String(fallbackCourseName || 'Activity').trim() || 'Activity';
    const shouldPreferInferred =
        !activityNameFromPayload
        || activityNameFromPayload.toLowerCase() === fallbackName.toLowerCase();
    const activityName = shouldPreferInferred
        ? (inferredFromId || activityNameFromPayload || fallbackName)
        : activityNameFromPayload;
    const parsedActivityIndex = Number(taggedActivityIndex);
    const activityIndex = Number.isFinite(parsedActivityIndex)
        ? Math.max(0, Math.floor(parsedActivityIndex))
        : null;
    const baseActivityKey = activityId || activityName || fallbackName;
    const activityKey = activityIndex !== null
        ? `lesson-${activityIndex}:${baseActivityKey}`
        : baseActivityKey;

    return {
        activityName: String(activityName || fallbackName).trim() || fallbackName,
        activityKey: String(activityKey || fallbackName).trim() || fallbackName,
        activityIndex,
    };
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

function buildSessionRowsFromStatements(statements = [], fallbackCourseName = 'Activity') {
    const byTimeAsc = [...statements].sort((a, b) => {
        const ta = toSafeTime(a?.timestamp || a?.storedAt || a?.receivedAt);
        const tb = toSafeTime(b?.timestamp || b?.storedAt || b?.receivedAt);
        return ta - tb;
    });

    const normalized = byTimeAsc.map((row) => {
        const payload = row?.statement_json && typeof row.statement_json === 'object'
            ? row.statement_json
            : {};
        const result = payload?.result || {};
        const extensions = result?.extensions || {};
        const rawTimestamp = payload?.timestamp || payload?.storedAt || row?.receivedAt;
        const currentTs = toSafeTime(rawTimestamp);
        const verbId = String(payload?.verb?.id || '').trim().toLowerCase();

        const explicitDurationMinutes =
            parseIsoDurationToMinutes(result?.duration) ||
            (toSafeNumber(extensions['https://w3id.org/xapi/video/extensions/length'], 0) / 60) ||
            (toSafeNumber(extensions.length, 0) / 60);

        const { activityName, activityKey, activityIndex } = deriveActivityIdentity(payload, fallbackCourseName);

        return {
            activity: activityName,
            activityKey,
            activityIndex,
            dateTime: toDateTimeText(rawTimestamp),
            rawTimestamp,
            timestampMs: currentTs,
            explicitDurationMinutes: Math.max(0, toSafeNumber(explicitDurationMinutes, 0)),
            verbId,
        };
    });

    if (normalized.length === 0) return [];

    const sessions = [];
    let current = null;

    const flushCurrent = () => {
        if (!current) return;
        const minutesFromGap = Math.max(0, toSafeNumber(current.minutesFromGap, 0));
        const maxExplicit = Math.max(0, toSafeNumber(current.maxExplicitMinutes, 0));
        const durationMinutes = minutesFromGap > 0 ? minutesFromGap : maxExplicit;

        sessions.push({
            activity: current.activity || fallbackCourseName,
            activityKey: current.activityKey || fallbackCourseName,
            dateTime: toDateTimeText(current.startTimestampRaw),
            timestampMs: toSafeNumber(current.startTimestampMs, 0),
            durationMinutes: Math.max(0, durationMinutes),
        });
        current = null;
    };

    for (let idx = 0; idx < normalized.length; idx += 1) {
        const item = normalized[idx];
        const isInitialized = item.verbId.includes('initialized');
        if (isInitialized) {
            flushCurrent();
            current = null;
            continue;
        }

        const hasCurrent = Boolean(current);
        const gapMinutes = hasCurrent
            ? ((toSafeNumber(item.timestampMs, 0) - toSafeNumber(current.lastTimestampMs, 0)) / 60000)
            : 0;
        const shouldSplitByLongGap = hasCurrent && Number.isFinite(gapMinutes) && gapMinutes > 45;
        const activityChanged =
            hasCurrent &&
            String(item.activityKey || '').trim() !== String(current.activityKey || '').trim();
        const isNewEntryVerb =
            item.verbId.includes('experienced')
            || item.verbId.includes('launched')
            || item.verbId.includes('resumed');
        const startsNewSession = !hasCurrent || shouldSplitByLongGap || activityChanged || isNewEntryVerb;

        if (startsNewSession) {
            flushCurrent();
            current = {
                activity: item.activity || fallbackCourseName,
                activityKey: item.activityKey || fallbackCourseName,
                startTimestampRaw: item.rawTimestamp,
                startTimestampMs: item.timestampMs,
                lastTimestampMs: item.timestampMs,
                minutesFromGap: 0,
                maxExplicitMinutes: Math.max(0, toSafeNumber(item.explicitDurationMinutes, 0)),
            };
            continue;
        }

        if (Number.isFinite(gapMinutes) && gapMinutes > 0 && gapMinutes <= 45) {
            current.minutesFromGap += gapMinutes;
        }
        current.lastTimestampMs = item.timestampMs;
        current.maxExplicitMinutes = Math.max(
            Math.max(0, toSafeNumber(current.maxExplicitMinutes, 0)),
            Math.max(0, toSafeNumber(item.explicitDurationMinutes, 0))
        );
    }

    flushCurrent();
    return sessions;
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

    const uniqueActivityKeys = new Set(
        sortedRows
            .map((row) => String(row?.activityKey || row?.activity || '').trim())
            .filter(Boolean)
    );
    const shouldGroupByActivity = uniqueActivityKeys.size > 1 || lessonCount > 1;

    if (!shouldGroupByActivity) {
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
        const key = String(row?.activityKey || row?.activity || fallbackTitle).trim() || fallbackTitle;
        if (!grouped.has(key)) grouped.set(key, { title: String(row?.activity || fallbackTitle).trim() || fallbackTitle, rows: [] });
        grouped.get(key).rows.push(row);
    }

    return Array.from(grouped.values()).map((group) => ({
        title: group.title,
        records: group.rows.map((row, idx) => ({
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
            const fallbackCourse = await prisma.course.findFirst({
                where: {
                    organization_id: organizationId,
                    id: courseId,
                },
                select: {
                    id: true,
                    title: true,
                    categories: { select: { name: true } },
                },
            });
            const fallbackCompatMaps = await getCourseCompatMaps([courseId]);
            const fallbackThumbnail = fallbackCompatMaps?.thumbnailByCourseId?.[String(courseId)] || '';

            return NextResponse.json({
                enrollmentFound: false,
                message: 'Enrollment not found',
                course: {
                    id: Number(courseId),
                    name: String(fallbackCourse?.title || '').trim(),
                    category: String(fallbackCourse?.categories?.name || '').trim(),
                    thumbnail: normalizeThumbnail(fallbackThumbnail),
                    sectionName: '',
                    enrollmentStatus: '',
                    progressPercent: 0,
                },
                summary: {
                    totalStudyMinutes: 0,
                    statementCount: 0,
                },
                sections: [],
            });
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
        const mappedContentId = String(
            courseCompatMaps?.contentByCourseId?.[String(selectedEnrollment.courseId)]
            || ''
        ).trim();

        let lessonCountFromContent = 0;
        if (mappedContentId) {
            try {
                const contents = await listContents();
                const mappedContent = Array.isArray(contents)
                    ? contents.find((content) => String(content?.id || '') === mappedContentId)
                    : null;
                const activityCount = Array.isArray(mappedContent?.activities)
                    ? mappedContent.activities.length
                    : 0;
                if (activityCount > 0) {
                    lessonCountFromContent = activityCount;
                }
            } catch {
                // Ignore content-hydration failures and fallback to section count.
            }
        }

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

        let rows = buildSessionRowsFromStatements(statements, String(selectedEnrollment?.courses?.title || 'Activity'));
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
                activityKey: String(selectedSection?.id || selectedEnrollment?.courses?.id || selectedEnrollment?.courseId || 'activity'),
                dateTime: toDateTimeText(selectedEnrollment?.lastActivityAt || selectedEnrollment?.startedAt || selectedEnrollment?.enrolledAt),
                timestampMs: toSafeTime(selectedEnrollment?.lastActivityAt || selectedEnrollment?.startedAt || selectedEnrollment?.enrolledAt),
                durationMinutes: fallbackMinutes,
            }];
        }

        const totalStudyMinutes = Math.max(statementMinutes, fallbackMinutes, 0);
        const groupedSections = toGroupedSections(
            rows,
            lessonCountFromContent > 0
                ? lessonCountFromContent
                : Number(availableSections.length || 0),
            String(selectedEnrollment?.courses?.title || 'Activity').trim() || 'Activity'
        );

        return NextResponse.json({
            enrollmentFound: true,
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
