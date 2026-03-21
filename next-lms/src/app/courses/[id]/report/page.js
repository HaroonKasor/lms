'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Header from '@/components/layout/Header';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';
import { clearUser, getRememberMePreference, getUser, saveUser } from '@/lib/auth';

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

function toFixedNumber(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(digits);
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
        })
    );
}

function toTimestampMs(value) {
    const date = new Date(value || 0);
    const ms = date.getTime();
    return Number.isFinite(ms) ? ms : 0;
}

function normalizeActorFilter(user) {
    const username = String(user?.username || '').trim();
    const email = String(user?.email || '').trim();
    if (email) return email;
    if (username) return username;
    return 'anonymous';
}

function toSafeTime(value) {
    const ms = new Date(value || 0).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

const ENROLLMENT_STATUS_RANK = {
    COMPLETED: 5,
    LEARNING: 4,
    IN_PROGRESS: 4,
    APPROVED: 3,
    PENDING: 2,
    FAILED: 1,
    CANCELLED: 0,
};

function pickBestEnrollment(enrollments = []) {
    if (!Array.isArray(enrollments) || enrollments.length === 0) return null;

    const sorted = [...enrollments].sort((a, b) => {
        const rankA = ENROLLMENT_STATUS_RANK[String(a?.status || '').toUpperCase()] ?? -1;
        const rankB = ENROLLMENT_STATUS_RANK[String(b?.status || '').toUpperCase()] ?? -1;
        if (rankB !== rankA) return rankB - rankA;

        const progressA = Number(a?.progress ?? a?.progressPercent ?? 0);
        const progressB = Number(b?.progress ?? b?.progressPercent ?? 0);
        if (progressB !== progressA) return progressB - progressA;

        const timeA = toSafeTime(a?.updatedAt || a?.lastActivityAt || a?.enrolledAt);
        const timeB = toSafeTime(b?.updatedAt || b?.lastActivityAt || b?.enrolledAt);
        if (timeB !== timeA) return timeB - timeA;

        return Number(b?.id || 0) - Number(a?.id || 0);
    });

    return sorted[0] || null;
}

function extractContentIdFromEnrollment(enrollment, fallbackCourseId = '') {
    const section = enrollment?.section || null;
    const metadata = (section?.asset?.metadataJson && typeof section.asset.metadataJson === 'object')
        ? section.asset.metadataJson
        : {};

    const fromMetadata = String(metadata?.contentId || '').trim();
    if (fromMetadata) return fromMetadata;

    const fromCourseTinCan = String(enrollment?.course?.tincanId || '').trim();
    if (fromCourseTinCan) return fromCourseTinCan;

    const fromCourseId = String(enrollment?.course?.id || enrollment?.courseId || '').trim();
    if (fromCourseId) return fromCourseId;

    return String(fallbackCourseId || '').trim();
}

function dedupeByKey(rows = [], keyResolver) {
    const map = new Map();
    for (const row of rows) {
        const key = keyResolver(row);
        if (!key) continue;
        if (!map.has(key)) map.set(key, row);
    }
    return Array.from(map.values());
}

function isLikelyNumericId(value) {
    return /^\d+$/.test(String(value || '').trim());
}

export default function CourseReportPage() {
    const params = useParams();
    const courseId = params.id;

    const [course, setCourse] = useState(null);
    const [statements, setStatements] = useState([]);
    const [progressRows, setProgressRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userResolved, setUserResolved] = useState(false);

    useEffect(() => {
        const resolveUser = async () => {
            try {
                const profileRes = await fetch('/api/users/profile', { cache: 'no-store' });
                if (profileRes.status === 401) {
                    clearUser();
                    if (typeof window !== 'undefined') {
                        const next = encodeURIComponent(window.location.pathname + window.location.search);
                        window.location.href = `/login?next=${next}`;
                    }
                    return;
                }
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    setUser(profile || null);
                    try {
                        if (profile && typeof window !== 'undefined') {
                            const fallbackRemember = Boolean(localStorage.getItem('lms_user'));
                            const remember = getRememberMePreference(fallbackRemember);
                            saveUser(profile, { remember });
                        }
                    } catch {}
                    return;
                }

                // Fallback: keep backward compatibility if profile endpoint is temporarily unavailable.
                setUser(getUser());
            } catch {
                setUser(getUser());
            } finally {
                setUserResolved(true);
            }
        };
        resolveUser();
    }, []);

    useEffect(() => {
        if (!userResolved) return;

        const load = async () => {
            try {
                let resolvedCourse = null;
                let primaryContentId = String(courseId || '').trim();

                const enrollmentRes = await fetch(`/api/enrollments?courseId=${encodeURIComponent(courseId)}&raw=1`, { cache: 'no-store' });
                if (enrollmentRes.status === 401) {
                    clearUser();
                    if (typeof window !== 'undefined') {
                        const next = encodeURIComponent(window.location.pathname + window.location.search);
                        window.location.href = `/login?next=${next}`;
                    }
                    return;
                }
                if (enrollmentRes.ok) {
                    const enrollments = await enrollmentRes.json();
                    const selectedEnrollment = pickBestEnrollment(enrollments);
                    if (selectedEnrollment) {
                        resolvedCourse = selectedEnrollment.course || null;
                        const candidate = extractContentIdFromEnrollment(selectedEnrollment, courseId);
                        if (candidate) primaryContentId = candidate;
                    }
                }

                if (!resolvedCourse) {
                    const [adminCoursesRes, publicCoursesRes] = await Promise.all([
                        fetch('/api/courses', { cache: 'no-store' }),
                        fetch('/api/courses?public=true', { cache: 'no-store' }),
                    ]);
                    if (adminCoursesRes.status === 401 && publicCoursesRes.status === 401) {
                        clearUser();
                        if (typeof window !== 'undefined') {
                            const next = encodeURIComponent(window.location.pathname + window.location.search);
                            window.location.href = `/login?next=${next}`;
                        }
                        return;
                    }

                    const adminCourses = adminCoursesRes.ok ? await adminCoursesRes.json() : [];
                    const publicCourses = publicCoursesRes.ok ? await publicCoursesRes.json() : [];
                    const source = Array.isArray(adminCourses) && adminCourses.length > 0
                        ? adminCourses
                        : (Array.isArray(publicCourses) ? publicCourses : []);

                    const found = source.find((item) => Number(item?.id) === Number(courseId)) || null;
                    if (found) {
                        resolvedCourse = found;
                        const candidate = String(found?.tincanId || found?.id || courseId || '').trim();
                        if (candidate) primaryContentId = candidate;
                    }
                }

                setCourse(resolvedCourse || null);

                const uniqueCandidates = Array.from(
                    new Set([
                        primaryContentId,
                        String(resolvedCourse?.tincanId || '').trim(),
                        String(resolvedCourse?.id || '').trim(),
                        String(courseId || '').trim(),
                    ].filter(Boolean))
                );
                const routeCourseId = String(courseId || '').trim();
                const statementContentIds = uniqueCandidates.filter((candidate) => {
                    const value = String(candidate || '').trim();
                    if (!value) return false;
                    if (!routeCourseId) return true;
                    if (value !== routeCourseId) return true;
                    // Avoid overly broad DB contains-query on short numeric courseId
                    // when we already know a better content id candidate.
                    const hasStrongerCandidate = uniqueCandidates.some((item) => {
                        const current = String(item || '').trim();
                        return current && current !== routeCourseId;
                    });
                    return !hasStrongerCandidate;
                });
                const progressContentIds = uniqueCandidates.filter((candidate) => String(candidate || '').trim());

                if (
                    statementContentIds.length === 1
                    && routeCourseId
                    && String(statementContentIds[0]) === routeCourseId
                    && isLikelyNumericId(routeCourseId)
                ) {
                    // For legacy/no-map courses we still keep numeric fallback for progress,
                    // but skip statement query to prevent false positives.
                    statementContentIds.length = 0;
                }
                const actorFilter = normalizeActorFilter(user);
                const userFilter = String(user?.username || user?.email || 'anonymous').trim() || 'anonymous';

                if (statementContentIds.length === 0 && progressContentIds.length === 0) {
                    setStatements([]);
                    setProgressRows([]);
                    return;
                }

                const [statementResponses, progressResponses] = await Promise.all([
                    Promise.all(
                        statementContentIds.map((contentId) => fetch(
                            `/api/xapi/statements?contentId=${encodeURIComponent(contentId)}&actor=${encodeURIComponent(actorFilter)}&limit=500`,
                            { cache: 'no-store' }
                        ))
                    ),
                    Promise.all(
                        progressContentIds.map((contentId) => fetch(
                            `/api/content/progress?contentId=${encodeURIComponent(contentId)}&userId=${encodeURIComponent(userFilter)}`,
                            { cache: 'no-store' }
                        ))
                    ),
                ]);

                const statementRowsByContent = await Promise.all(
                    statementResponses.map(async (res) => (res.ok ? await res.json() : []))
                );
                const progressRowsByContent = await Promise.all(
                    progressResponses.map(async (res) => (res.ok ? await res.json() : []))
                );

                const mergedStatements = dedupeByKey(
                    statementRowsByContent.flat().filter((row) => row && typeof row === 'object'),
                    (row) => String(row?.id || `${row?.timestamp || row?.storedAt || ''}:${row?.verb?.id || ''}:${row?.object?.id || ''}`)
                );
                const mergedProgress = dedupeByKey(
                    progressRowsByContent.flat().filter((row) => row && typeof row === 'object'),
                    (row) => String(row?.id || `${row?.enrollmentId || ''}:${row?.sectionId || ''}:${row?.updatedAt || ''}`)
                );

                setStatements(mergedStatements);
                setProgressRows(mergedProgress);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [courseId, user, userResolved]);

    const latestProgress = useMemo(() => {
        if (!Array.isArray(progressRows) || progressRows.length === 0) return null;
        const sorted = [...progressRows].sort((a, b) => {
            const aTime = new Date(a?.updatedAt || 0).getTime();
            const bTime = new Date(b?.updatedAt || 0).getTime();
            return bTime - aTime;
        });
        return sorted[0] || null;
    }, [progressRows]);

    const statementRows = useMemo(() => {
        if (!Array.isArray(statements)) return [];
        const byTimeAsc = [...statements].sort((a, b) => {
            const ta = toTimestampMs(a?.timestamp || a?.storedAt);
            const tb = toTimestampMs(b?.timestamp || b?.storedAt);
            return ta - tb;
        });

        let enriched = byTimeAsc.map((stmt, idx) => {
            const result = stmt?.result || {};
            const extensions = result?.extensions || {};

            const explicitDurationMinutes =
                parseIsoDurationToMinutes(result?.duration) ||
                (Number(extensions['https://w3id.org/xapi/video/extensions/length']) || Number(extensions.length) || 0) / 60;
            const currentTs = toTimestampMs(stmt?.timestamp || stmt?.storedAt);

            let fallbackDeltaMinutes = 0;
            if (idx > 0) {
                const prev = byTimeAsc[idx - 1];
                const prevTs = toTimestampMs(prev?.timestamp || prev?.storedAt);
                const gapMinutes = (currentTs - prevTs) / 60000;
                // Count only realistic active-study gaps.
                if (Number.isFinite(gapMinutes) && gapMinutes > 0 && gapMinutes <= 45) {
                    fallbackDeltaMinutes = gapMinutes;
                }
            }

            const durationMinutes = explicitDurationMinutes > 0 ? explicitDurationMinutes : fallbackDeltaMinutes;

            const activityName =
                stmt?.object?.definition?.name?.['en-US'] ||
                stmt?.object?.definition?.name?.en ||
                stmt?.object?.id ||
                'Activity';

            return {
                id: idx + 1,
                activity: activityName,
                dateTime: toDateTimeText(stmt?.timestamp || stmt?.storedAt),
                durationMinutes,
                timestampMs: currentTs,
            };
        });

        const statementMinutes = enriched.reduce((sum, row) => sum + Number(row.durationMinutes || 0), 0);
        if (statementMinutes <= 0 && enriched.length > 0) {
            const trackedSeconds = Number(latestProgress?.scoreRaw || 0);
            const byTrackedProgress = Number.isFinite(trackedSeconds) && trackedSeconds > 0
                ? trackedSeconds / 60
                : 0;
            const progressCurrent = Number(latestProgress?.currentTime || 0);
            const progressDuration = Number(latestProgress?.duration || 0);
            const shouldUseProgressAsSeconds = Number.isFinite(progressCurrent)
                && progressCurrent > 0
                && (
                    progressCurrent >= 60
                    || (Number.isFinite(progressDuration) && progressDuration >= 60)
                );
            const byProgress = shouldUseProgressAsSeconds ? (progressCurrent / 60) : 0;
            const fallbackMinutes = Math.max(byTrackedProgress, byProgress, 0);

            if (fallbackMinutes > 0) {
                let latestIdx = 0;
                for (let i = 1; i < enriched.length; i += 1) {
                    if (Number(enriched[i]?.timestampMs || 0) > Number(enriched[latestIdx]?.timestampMs || 0)) {
                        latestIdx = i;
                    }
                }
                enriched = enriched.map((row, idx) => (
                    idx === latestIdx
                        ? { ...row, durationMinutes: fallbackMinutes }
                        : row
                ));
            }
        }

        return enriched
            .sort((a, b) => b.timestampMs - a.timestampMs)
            .map((row, idx) => ({ ...row, id: idx + 1 }));
    }, [statements, latestProgress]);

    const groupedSections = useMemo(() => {
        if (!Array.isArray(statementRows) || statementRows.length === 0) return [];

        const lessonCount = Number(course?.lessons || 0);
        if (lessonCount <= 1) {
            return [
                {
                    title: course?.name || 'Activity',
                    records: statementRows,
                },
            ];
        }

        const groups = new Map();
        for (const row of statementRows) {
            const key = String(row.activity || 'Activity');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
        }
        return Array.from(groups.entries()).map(([title, records]) => ({ title, records }));
    }, [statementRows, course?.lessons, course?.name]);

    const totalStudyMinutes = useMemo(() => {
        const byStatements = statementRows.reduce((sum, row) => sum + Number(row.durationMinutes || 0), 0);
        const trackedSeconds = Number(latestProgress?.scoreRaw || 0);
        const byTrackedProgress = Number.isFinite(trackedSeconds) && trackedSeconds > 0
            ? trackedSeconds / 60
            : 0;
        const progressCurrent = Number(latestProgress?.currentTime || 0);
        const progressDuration = Number(latestProgress?.duration || 0);
        // For some legacy TinCan/Web packages currentTime stores page/chapter index, not seconds.
        const shouldUseProgressAsSeconds = Number.isFinite(progressCurrent)
            && progressCurrent > 0
            && (
                progressCurrent >= 60
                || (Number.isFinite(progressDuration) && progressDuration >= 60)
            );
        const byProgress = shouldUseProgressAsSeconds ? (progressCurrent / 60) : 0;
        return Math.max(byStatements, byTrackedProgress, byProgress, 0);
    }, [statementRows, latestProgress]);

    if (loading) {
        return <LoadScreen text="Loading report..." />;
    }

    return (
        <div className="min-h-screen font-['Outfit',sans-serif]" style={{ background: '#FCFCFC' }}>
            {user ? <Navbar /> : <Header />}

            <main className="max-w-[1240px] mx-auto px-6 pt-16 pb-24">
                <FadeIn direction="up">
                    <div className="w-full h-[340px] rounded-[16px] overflow-hidden mb-10 relative bg-[#D9D9D9]">
                        {course?.thumbnail ? (
                            <img src={course.thumbnail} alt={course?.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <img src="/skillup_logo.png" alt="Logo" className="w-[80px] h-[80px] opacity-20" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 text-[#052143] text-[42px] leading-[150%] mb-14">
                        <div><span className="font-semibold">Course:</span> {course?.name || '-'}</div>
                        <div><span className="font-semibold">Category:</span> {course?.category || '-'}</div>
                        <div><span className="font-semibold">Total Study Time:</span> {toFixedNumber(totalStudyMinutes, 2)} Minutes</div>
                    </div>

                    <div className="flex flex-col gap-10">
                        {groupedSections.length === 0 ? (
                            <div className="rounded-[14px] border border-[#E4E8FF] bg-white p-8 text-[#6B778B] text-[16px]">
                                No xAPI statements found for this learner/course.
                            </div>
                        ) : (
                            groupedSections.map((section, sectionIdx) => (
                                <div key={`${section.title}-${sectionIdx}`} className="flex flex-col gap-4">
                                    <h3 className="text-[#052143] text-[22px] font-semibold leading-[140%]">{section.title}</h3>
                                    <div className="w-full overflow-x-auto">
                                        <table className="w-full border-collapse min-w-[1180px]">
                                            <thead>
                                                <tr>
                                                    <th className="text-white text-[16px] font-medium py-[10px] px-[14px] text-left border border-white bg-[#687EFF]">No.</th>
                                                    <th className="text-white text-[16px] font-medium py-[10px] px-[14px] text-left border border-white bg-[#687EFF]">Date and Time</th>
                                                    <th className="text-white text-[16px] font-medium py-[10px] px-[14px] text-left border border-white bg-[#687EFF]">Study Duration (Minutes)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.records.map((row, rowIdx) => (
                                                    <tr key={`${row.id}-${row.dateTime}-${rowIdx}`}>
                                                        <td
                                                            className="text-[#052143] text-[15px] font-medium py-[10px] px-[14px] border border-white"
                                                            style={{ background: rowIdx % 2 === 0 ? '#F2F3FF' : '#FFFFFF' }}
                                                        >
                                                            {row.id}.
                                                        </td>
                                                        <td
                                                            className="text-[#052143] text-[15px] font-medium py-[10px] px-[14px] border border-white"
                                                            style={{ background: rowIdx % 2 === 0 ? '#F2F3FF' : '#FFFFFF' }}
                                                        >
                                                            {row.dateTime}
                                                        </td>
                                                        <td
                                                            className="text-[#052143] text-[15px] font-medium py-[10px] px-[14px] border border-white"
                                                            style={{ background: rowIdx % 2 === 0 ? '#F2F3FF' : '#FFFFFF' }}
                                                        >
                                                            {toFixedNumber(row.durationMinutes, 2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-14 flex justify-start">
                        <Link
                            href="/my-learning"
                            className="bg-[#687EFF] text-white px-8 py-3 rounded-full text-[16px] font-medium hover:bg-[#5a6fe0] transition-colors shadow-sm"
                        >
                            ← Back to My Learning
                        </Link>
                    </div>
                </FadeIn>
            </main>
        </div>
    );
}
