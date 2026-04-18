'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import LoadScreen from '@/components/ui/LoadScreen';
import LearningLessonSidebar from '@/components/learning/LearningLessonSidebar';
import LearningVideoPlayer from '@/components/learning/LearningVideoPlayer';
import LearningAiAssistant from '@/components/learning/LearningAiAssistant';
import { BarChart3, Clock3, ListChecks, Package, RadioTower, Video } from 'lucide-react';
import {
    sendStatement,
    buildVideoEventStatement,
    buildVideoProgressStatement,
    buildCompletionStatement,
    updateProgress,
    getProgress,
} from '@/lib/xapi';
import { getUser } from '@/lib/auth';
import { parseXapiResultSnapshot } from '@/lib/xapi-result';
import { toast } from 'react-toastify';

const LEARNER_TOAST = { containerId: 'global-toast' };
const renderAdminLikeToastContent = (title, message) => (
    <div className="min-w-0 py-0.5">
        {title ? <div className="text-[12px] font-semibold text-[#475569]">{title}</div> : null}
        <div className="text-[13px] text-[#6B7280]">{message || ''}</div>
    </div>
);

function normalizeTinCanActivities(content) {
    if (!content || content.type !== 'tincan' || !Array.isArray(content.activities)) {
        return content;
    }

    const normalizePath = (value = '') =>
        String(value || '')
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/\\/g, '/')
            .split('?')[0]
            .split('#')[0]
            .replace(/^\/+/, '')
            .toLowerCase();

    const entryPath = normalizePath(content.entryPoint || '');
    const entryDir = entryPath.includes('/') ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1) : '';
    const contentTitle = String(content?.title || '').trim().toLowerCase();
    const seenKeys = new Set();

    const getIdPath = (activity) => {
        const raw = String(activity?.activityId || activity?.id || '').trim();
        if (!raw) return '';
        try {
            if (/^https?:\/\//i.test(raw)) {
                const url = new URL(raw);
                return normalizePath(`${url.pathname}${url.search}${url.hash}`);
            }
        } catch {
            // ignore URL parse errors
        }
        return normalizePath(raw);
    };

    const hasLessonPathInId = (activity) => {
        const idPath = getIdPath(activity);
        if (!idPath) return false;
        return (
            /(^|\/)data\//i.test(idPath)
            || /(^|\/)(?:post|pre)?test[^/]*\/index\.html$/i.test(idPath)
            || /\.html$/i.test(idPath)
        );
    };

    const filtered = content.activities.filter((activity) => {
        const launch = String(activity?.launch || '').trim();
        const activityName = String(activity?.name || '').trim().toLowerCase();
        const activityId = String(activity?.id || '').trim().toLowerCase();
        const idLooksLikeLesson = hasLessonPathInId(activity);
        const isCourseLikeName = activityName && contentTitle && activityName === contentTitle;
        const isCourseLikeId = activityId && !activityId.includes('/data/') && !activityId.includes('.html');

        if (!launch) {
            const isPageFlag = activity?.ispage;
            if (isPageFlag === false || String(isPageFlag).toLowerCase() === 'false') {
                return false;
            }
            // Keep no-launch activities only when id clearly points to a real lesson page.
            return idLooksLikeLesson;
        }

        const launchPath = normalizePath(launch);
        const resolvedPath = launchPath.includes('/') ? launchPath : `${entryDir}${launchPath}`;

        // Drop wrapper launch page (same as TinCan entry point) to keep chapter index aligned.
        if (entryPath && resolvedPath === entryPath && (isCourseLikeName || isCourseLikeId || !idLooksLikeLesson)) {
            return false;
        }

        // Drop root course activity row (course title), keep only actual lesson activities.
        const isRootCourseByName = activityName && contentTitle && activityName === contentTitle;
        const isRootCourseById = activityId && !activityId.includes('/data/') && !activityId.includes('.html');
        const isIndexWrapper = launchPath === 'index.html' || launchPath.endsWith('/index.html');
        if (content.activities.length > 1 && isIndexWrapper && (isRootCourseByName || isRootCourseById)) {
            return false;
        }

        const dedupeKey = resolvedPath || getIdPath(activity) || `${activityId}:${activityName}`;
        if (dedupeKey) {
            if (seenKeys.has(dedupeKey)) return false;
            seenKeys.add(dedupeKey);
        }

        return true;
    });

    if (filtered.length === 0) {
        const fallback = content.activities.filter((activity) => hasLessonPathInId(activity));
        if (fallback.length > 0) {
            return { ...content, activities: fallback };
        }
        return content;
    }
    return { ...content, activities: filtered };
}

function toTimestamp(value) {
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
}

function isTruthyFlag(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return false;
        return ['1', 'true', 'yes', 'y', 'passed', 'completed', 'done', 'success'].includes(normalized);
    }
    return false;
}

function asFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function normalizeStatusText(value) {
    return String(value || '').trim().toLowerCase();
}

function hasFailureStatusSignal(value) {
    const statusText = normalizeStatusText(value);
    if (!statusText) return false;
    return (
        statusText.includes('fail')
        || statusText.includes('failed')
        || statusText.includes('incomplete')
        || statusText.includes('not complete')
        || statusText.includes('not completed')
        || statusText.includes('not passed')
        || statusText.includes('ยังไม่ผ่าน')
        || statusText.includes('ไม่ผ่าน')
        || statusText.includes('ไม่สำเร็จ')
    );
}

function hasPassStatusSignal(value) {
    const statusText = normalizeStatusText(value);
    if (!statusText) return false;
    return (
        statusText.includes('pass')
        || statusText.includes('passed')
        || statusText.includes('success')
        || statusText.includes('ผ่าน')
        || statusText.includes('สำเร็จ')
    );
}

function hasCompletionStatusSignal(value) {
    const statusText = normalizeStatusText(value);
    if (!statusText) return false;
    if (hasFailureStatusSignal(statusText)) return false;
    return (
        /\bcompleted?\b/.test(statusText)
        || statusText.includes('เสร็จสิ้น')
        || statusText.includes('สำเร็จ')
    );
}

function sanitizeStorageScope(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '_');
}

function resolvePublicAppOrigin() {
    const candidates = [
        process.env.NEXT_PUBLIC_XAPI_OBJECT_BASE_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        typeof window !== 'undefined' ? window.location.origin : '',
    ];

    for (const candidate of candidates) {
        const raw = String(candidate || '').trim();
        if (!raw) continue;
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
            return new URL(withProtocol).origin;
        } catch {
            // Try next candidate.
        }
    }

    return 'https://example.invalid';
}

function toDateOnlyTime(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function evaluateSectionLearnAccess(section) {
    if (!section) {
        return { allowed: false, reason: 'section_not_found' };
    }
    if (section?.isActive === false) {
        return { allowed: false, reason: 'section_inactive' };
    }
    const learnDateUnlimit = section?.learnDateUnlimit !== false;
    if (learnDateUnlimit) return { allowed: true, reason: null };

    const toTime = toDateOnlyTime(section?.learnDateTo);
    if (!Number.isFinite(toTime)) return { allowed: true, reason: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today.getTime() > toTime) {
        return { allowed: false, reason: 'learn_window_expired' };
    }
    return { allowed: true, reason: null };
}

function evaluateCourseLearnAccess(course) {
    const publishStatus = String(course?.publishStatus || '').trim().toLowerCase();
    if (publishStatus && publishStatus !== 'published') {
        return { allowed: false, reason: 'course_inactive' };
    }
    return { allowed: true, reason: null };
}

function getLearningAccessMessage(reason = '') {
    const normalized = String(reason || '').trim().toLowerCase();
    if (normalized === 'course_inactive') return 'หลักสูตรนี้ถูกปิดการใช้งานแล้ว ไม่สามารถเข้าเรียนได้';
    if (normalized === 'section_inactive') return 'Section นี้ถูกปิดการใช้งานแล้ว ไม่สามารถเข้าเรียนได้';
    if (normalized === 'learn_window_expired') return 'หมดระยะเวลาเรียนของ Section นี้แล้ว';
    return 'คุณยังไม่มีสิทธิ์เข้าเรียนคอร์สนี้';
}

export default function LearnPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const routeId = params.id;
    const [mounted, setMounted] = useState(false);
    const isLaunchMode = mounted && searchParams.get('launch') === '1';
    const requestedSectionId = useMemo(() => {
        const value = Number(searchParams.get('sectionId'));
        return Number.isInteger(value) && value > 0 ? value : null;
    }, [searchParams]);

    const [content, setContent] = useState(null);
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [status, setStatus] = useState('NOT_STARTED');
    const [statements, setStatements] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [userResolved, setUserResolved] = useState(false);
    const [enrollmentId, setEnrollmentId] = useState(null);
    const [resumeLoaded, setResumeLoaded] = useState(false);
    const [selectedActivityIndex, setSelectedActivityIndex] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [cohortModuleEnabled, setCohortModuleEnabled] = useState(false);
    const [iframeSrc, setIframeSrc] = useState('');
    const [isTinCanFrameReady, setIsTinCanFrameReady] = useState(false);
    const [tinCanActivityStatus, setTinCanActivityStatus] = useState([]);
    const [progressUserId, setProgressUserId] = useState('anonymous');
    const [isLearningSidebarOpen, setIsLearningSidebarOpen] = useState(false);
    const [isLearningAiOpen, setIsLearningAiOpen] = useState(false);
    const packageLinearEnabled = useMemo(() => {
        const raw = content?.packageConfig?.isLinear;
        if (raw === true) return true;
        if (typeof raw === 'number') return Number(raw) > 0;
        if (typeof raw === 'string') {
            const normalized = raw.trim().toLowerCase();
            return ['1', 'true', 'yes', 'y'].includes(normalized);
        }
        return false;
    }, [content?.packageConfig?.isLinear]);
    const chapterLockEnabled = cohortModuleEnabled || packageLinearEnabled;

    const videoRef = useRef(null);
    const iframeRef = useRef(null);
    const frameRevealTimeoutRef = useRef(null);
    const lastSentTimeRef = useRef(0);
    const lastTincanSyncRef = useRef({ position: null, status: null, progress: null, at: 0 });
    const lastTinCanStatusSigRef = useRef('');
    const tinCanActivityStatusRef = useRef([]);
    const resumeGuardUntilRef = useRef(0);
    const manualSelectionRef = useRef({ target: null, until: 0 });
    const hasShownCompletionToastRef = useRef(false);
    const tinCanSyncInFlightRef = useRef(false);
    const enrollmentSyncStateRef = useRef({
        inFlight: false,
        blockedUntil: 0,
        lastStatus: '',
        lastProgress: -1,
        lastAt: 0,
    });
    const progressRefreshStateRef = useRef({ inFlight: false, lastAt: 0 });
    const highestSeenActivityIndexRef = useRef(0);
    const selectedActivitySyncStateRef = useRef({ idx: null, status: '', at: 0 });
    const legacyWebSyncStateRef = useRef({ idx: null, status: '', at: 0 });
    const progressWriteBlockRef = useRef({ disabled: false, reason: '' });
    const trackedStudySecondsRef = useRef(0);
    const trackedStudyTickAtRef = useRef(0);
    const lastUserInteractionAtRef = useRef(0);
    const iframeInteractionCleanupRef = useRef(null);
    const iframeDeferredSyncTimeoutRef = useRef(null);
    const innerFrameLoadCleanupRef = useRef(null);
    const playerReflowTimeoutsRef = useRef([]);
    const reflowSessionRef = useRef(0);
    const completionLockRef = useRef(false);
    const initializedStatementGateRef = useRef('');
    const lessonEntryStatementGateRef = useRef('');
    const logLessonMapDebug = useCallback(() => {}, []);

    useEffect(() => {
        tinCanActivityStatusRef.current = Array.isArray(tinCanActivityStatus) ? tinCanActivityStatus : [];
    }, [tinCanActivityStatus]);

    const markLearningInteraction = useCallback(() => {
        const now = Date.now();
        // Throttle noisy events (mousemove etc.)
        if (now - Number(lastUserInteractionAtRef.current || 0) >= 300) {
            lastUserInteractionAtRef.current = now;
        }
    }, []);

    const clearIframeInteractionTracking = useCallback(() => {
        try {
            if (typeof iframeInteractionCleanupRef.current === 'function') {
                iframeInteractionCleanupRef.current();
            }
        } catch {
            // ignore cleanup errors
        } finally {
            iframeInteractionCleanupRef.current = null;
        }
    }, []);
    const clearInnerFrameLoadBinding = useCallback(() => {
        try {
            if (typeof innerFrameLoadCleanupRef.current === 'function') {
                innerFrameLoadCleanupRef.current();
            }
        } catch {
            // ignore cleanup errors
        } finally {
            innerFrameLoadCleanupRef.current = null;
        }
    }, []);
    const clearIframeDeferredSync = useCallback(() => {
        try {
            if (iframeDeferredSyncTimeoutRef.current) {
                clearTimeout(iframeDeferredSyncTimeoutRef.current);
            }
        } catch {
            // ignore cleanup errors
        } finally {
            iframeDeferredSyncTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.innerWidth >= 1024) {
            setIsLearningSidebarOpen(true);
        }
    }, []);

    // Learning player should always start with global chatbot closed.
    useEffect(() => {
        try {
            localStorage.removeItem('lms_ui_chat_open');
        } catch {
            // ignore storage errors
        }
    }, []);

    useEffect(() => {
        return () => {
            if (frameRevealTimeoutRef.current) {
                clearTimeout(frameRevealTimeoutRef.current);
            }
            const pending = Array.isArray(playerReflowTimeoutsRef.current)
                ? playerReflowTimeoutsRef.current
                : [];
            pending.forEach((timer) => clearTimeout(timer));
            playerReflowTimeoutsRef.current = [];
            clearIframeInteractionTracking();
            clearInnerFrameLoadBinding();
            clearIframeDeferredSync();
        };
    }, [clearIframeInteractionTracking, clearInnerFrameLoadBinding, clearIframeDeferredSync]);

    useEffect(() => {
        setCurrentUser(getUser());
        setUserResolved(true);
    }, []);

    const appOrigin = useMemo(() => resolvePublicAppOrigin(), []);
    const actorEmailDomain = useMemo(() => {
        try {
            return new URL(appOrigin).hostname || 'example.invalid';
        } catch {
            return 'example.invalid';
        }
    }, [appOrigin]);
    const xapiContentBase = useMemo(() => `${appOrigin}/content`, [appOrigin]);
    const xapiExtensionNamespace = useMemo(() => `${appOrigin}/extensions`, [appOrigin]);
    const xapiSkipProgressSyncKey = useMemo(() => `${xapiExtensionNamespace}/skip-progress-sync`, [xapiExtensionNamespace]);

    useEffect(() => {
        const completed = String(status || '').toUpperCase() === 'COMPLETED';
        if (completed) {
            completionLockRef.current = true;
        }
        if (completed && !hasShownCompletionToastRef.current) {
            hasShownCompletionToastRef.current = true;
            toast.success(
                renderAdminLikeToastContent('Updated', 'Course marked as completed successfully.'),
                { ...LEARNER_TOAST, toastId: 'learner-course-completed' }
            );
        }
        if (!completed) {
            hasShownCompletionToastRef.current = false;
        }
    }, [status]);

    const actor = useMemo(() => {
        const email = currentUser?.email || `${currentUser?.username || 'anonymous'}@${actorEmailDomain}`;
        return {
            name: currentUser?.fullName || currentUser?.username || 'Anonymous Learner',
            email,
        };
    }, [currentUser, actorEmailDomain]);

    const canonicalProgressUserId = useMemo(
        () => (currentUser?.username || 'anonymous').trim() || 'anonymous',
        [currentUser]
    );

    const progressUserCandidates = useMemo(() => {
        if (!userResolved) return [];
        const username = (currentUser?.username || '').trim();
        const email = (currentUser?.email || '').trim();
        const fallbackEmail = username ? `${username}@${actorEmailDomain}` : '';
        if (username) {
            // Logged-in users should not fallback to anonymous progress.
            return [username, email, fallbackEmail].filter(Boolean);
        }
        return ['anonymous'];
    }, [currentUser, userResolved, actorEmailDomain]);

    const learningUserId = actor.email;
    const resolvedContentId = content?.id || routeId;
    const progressContentId = useMemo(() => {
        const numericCourseId = Number(course?.id);
        if (Number.isInteger(numericCourseId) && numericCourseId > 0) {
            return String(numericCourseId);
        }
        const routeKey = String(routeId || '').trim();
        if (routeKey) return routeKey;
        return String(resolvedContentId || '').trim();
    }, [course?.id, routeId, resolvedContentId]);
    const effectiveSectionId = useMemo(() => {
        const active = Number(activeSectionId);
        if (Number.isInteger(active) && active > 0) return active;
        const requested = Number(requestedSectionId);
        if (Number.isInteger(requested) && requested > 0) return requested;
        return null;
    }, [activeSectionId, requestedSectionId]);
    const iframeRenderKey = useMemo(() => {
        const contentKey = String(content?.id || routeId || 'unknown');
        const sectionKey = Number.isInteger(Number(effectiveSectionId)) && Number(effectiveSectionId) > 0
            ? String(Number(effectiveSectionId))
            : 'default';
        return `${contentKey}:${sectionKey}:${isLaunchMode ? 'launch' : 'default'}`;
    }, [content?.id, routeId, effectiveSectionId, isLaunchMode]);
    const scopedStorageSuffixes = useMemo(() => {
        const userKey = sanitizeStorageScope(canonicalProgressUserId || 'anonymous') || 'anonymous';
        const sectionKey = Number.isInteger(Number(effectiveSectionId)) && Number(effectiveSectionId) > 0
            ? `:section:${Number(effectiveSectionId)}`
            : '';
        const stableSuffix = `:user:${userKey}${sectionKey}`;
        const legacyEnrollmentSuffix = Number.isInteger(Number(enrollmentId)) && Number(enrollmentId) > 0
            ? `:user:${userKey}:enrollment:${Number(enrollmentId)}${sectionKey}`
            : '';
        return Array.from(new Set([stableSuffix, legacyEnrollmentSuffix].filter(Boolean)));
    }, [canonicalProgressUserId, enrollmentId, effectiveSectionId]);
    const tincanResumeStorageKeys = useMemo(() => {
        const values = [
            String(progressContentId || '').trim(),
            String(course?.id || '').trim(),
            String(routeId || '').trim(),
        ].filter(Boolean);

        const uniqueValues = Array.from(new Set(values));
        const keys = [];
        for (const value of uniqueValues) {
            for (const suffix of scopedStorageSuffixes) {
                keys.push(`lms_tincan_resume:${value}${suffix}`);
            }
        }
        return Array.from(new Set(keys));
    }, [progressContentId, course?.id, routeId, scopedStorageSuffixes]);
    const tincanResumePathStorageKeys = useMemo(() => {
        const values = [
            String(progressContentId || '').trim(),
            String(course?.id || '').trim(),
            String(routeId || '').trim(),
        ].filter(Boolean);

        const uniqueValues = Array.from(new Set(values));
        const keys = [];
        for (const value of uniqueValues) {
            for (const suffix of scopedStorageSuffixes) {
                keys.push(`lms_tincan_resume_path:${value}${suffix}`);
            }
        }
        return Array.from(new Set(keys));
    }, [progressContentId, course?.id, routeId, scopedStorageSuffixes]);
    const webResumeStorageKeys = useMemo(() => {
        const values = [
            String(progressContentId || '').trim(),
            String(course?.id || '').trim(),
            String(routeId || '').trim(),
        ].filter(Boolean);

        const uniqueValues = Array.from(new Set(values));
        const keys = [];
        for (const value of uniqueValues) {
            for (const suffix of scopedStorageSuffixes) {
                keys.push(`lms_web_resume:${value}${suffix}`);
            }
        }
        return Array.from(new Set(keys));
    }, [progressContentId, course?.id, routeId, scopedStorageSuffixes]);
    const webStatusStorageKeys = useMemo(() => {
        const values = [
            String(progressContentId || '').trim(),
            String(course?.id || '').trim(),
            String(routeId || '').trim(),
        ].filter(Boolean);

        const uniqueValues = Array.from(new Set(values));
        const keys = [];
        for (const value of uniqueValues) {
            for (const suffix of scopedStorageSuffixes) {
                keys.push(`lms_web_status:${value}${suffix}`);
            }
        }
        return Array.from(new Set(keys));
    }, [progressContentId, course?.id, routeId, scopedStorageSuffixes]);

    const persistTincanResumeIndex = useCallback((idx) => {
        if (!content || content.type !== 'tincan') return;
        const value = Number(idx);
        if (!Number.isFinite(value) || value < 0) return;
        if (!Array.isArray(tincanResumeStorageKeys) || tincanResumeStorageKeys.length === 0) return;
        try {
            const serialized = String(Math.floor(value));
            for (const key of tincanResumeStorageKeys) {
                localStorage.setItem(key, serialized);
            }
        } catch {
            // ignore storage errors
        }
    }, [content, tincanResumeStorageKeys]);

    const readTincanResumeIndex = useCallback(() => {
        if (!content || content.type !== 'tincan') return null;
        if (!Array.isArray(tincanResumeStorageKeys) || tincanResumeStorageKeys.length === 0) return null;
        try {
            let best = null;
            for (const key of tincanResumeStorageKeys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const value = Number(raw);
                if (!Number.isFinite(value) || value < 0) continue;
                const safe = Math.floor(value);
                if (!Number.isFinite(best) || safe > best) {
                    best = safe;
                }
            }
            return Number.isFinite(best) ? best : null;
        } catch {
            return null;
        }
    }, [content, tincanResumeStorageKeys]);

    const normalizeActivityPathKey = useCallback((value = '') => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        let normalized = raw;
        if (/^https?:\/\//i.test(normalized)) {
            try {
                const url = new URL(normalized);
                normalized = `${url.pathname}${url.search}${url.hash}`;
            } catch {
                // keep raw format if URL parsing fails
            }
        }
        normalized = normalized
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/\\/g, '/')
            .split('?')[0]
            .split('#')[0]
            .replace(/^\/+/, '')
            .toLowerCase();
        return normalized;
    }, []);

    const persistTincanResumePath = useCallback((pathValue) => {
        if (!content || content.type !== 'tincan') return;
        if (!Array.isArray(tincanResumePathStorageKeys) || tincanResumePathStorageKeys.length === 0) return;
        const normalized = normalizeActivityPathKey(pathValue);
        if (!normalized) return;
        try {
            for (const key of tincanResumePathStorageKeys) {
                localStorage.setItem(key, normalized);
            }
        } catch {
            // ignore storage errors
        }
    }, [content, tincanResumePathStorageKeys, normalizeActivityPathKey]);

    const readTincanResumePath = useCallback(() => {
        if (!content || content.type !== 'tincan') return '';
        if (!Array.isArray(tincanResumePathStorageKeys) || tincanResumePathStorageKeys.length === 0) return '';
        try {
            for (const key of tincanResumePathStorageKeys) {
                const raw = localStorage.getItem(key);
                const normalized = normalizeActivityPathKey(raw);
                if (normalized) return normalized;
            }
        } catch {
            // ignore storage errors
        }
        return '';
    }, [content, tincanResumePathStorageKeys, normalizeActivityPathKey]);

    const persistWebResumeIndex = useCallback((idx) => {
        if (!content || content.type !== 'web') return;
        const value = Number(idx);
        if (!Number.isFinite(value) || value < 0) return;
        if (!Array.isArray(webResumeStorageKeys) || webResumeStorageKeys.length === 0) return;
        try {
            const serialized = String(Math.floor(value));
            for (const key of webResumeStorageKeys) {
                localStorage.setItem(key, serialized);
            }
        } catch {
            // ignore storage errors
        }
    }, [content, webResumeStorageKeys]);

    const readWebResumeIndex = useCallback(() => {
        if (!content || content.type !== 'web') return null;
        if (!Array.isArray(webResumeStorageKeys) || webResumeStorageKeys.length === 0) return null;
        try {
            let best = null;
            for (const key of webResumeStorageKeys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const value = Number(raw);
                if (!Number.isFinite(value) || value < 0) continue;
                const safe = Math.floor(value);
                if (!Number.isFinite(best) || safe > best) {
                    best = safe;
                }
            }
            return Number.isFinite(best) ? best : null;
        } catch {
            return null;
        }
    }, [content, webResumeStorageKeys]);

    const persistWebStatusSnapshot = useCallback((snapshot) => {
        if (!content || content.type !== 'web') return;
        if (!Array.isArray(webStatusStorageKeys) || webStatusStorageKeys.length === 0) return;
        if (!Array.isArray(snapshot) || snapshot.length === 0) return;
        try {
            const compact = snapshot.map((row) => ({
                attempted: row?.attempted === true,
                completed: row?.completed === true,
                passed: row?.passed === true,
                quizzed: row?.quizzed === true,
            }));
            const serialized = JSON.stringify(compact);
            for (const key of webStatusStorageKeys) {
                localStorage.setItem(key, serialized);
            }
        } catch {
            // ignore storage errors
        }
    }, [content, webStatusStorageKeys]);

    const readWebStatusSnapshot = useCallback(() => {
        if (!content || content.type !== 'web') return null;
        if (!Array.isArray(webStatusStorageKeys) || webStatusStorageKeys.length === 0) return null;
        try {
            for (const key of webStatusStorageKeys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed) || parsed.length === 0) continue;
                return parsed.map((row) => ({
                    attempted: row?.attempted === true,
                    completed: row?.completed === true,
                    passed: row?.passed === true,
                    quizzed: row?.quizzed === true,
                }));
            }
        } catch {
            // ignore parse/storage errors
        }
        return null;
    }, [content, webStatusStorageKeys]);

    const computeTinCanProgress = useCallback((position, total, completed = false) => {
        const totalLessons = Math.max(1, Number(total) || 0);
        const safePos = Math.max(1, Math.min(totalLessons, Number(position) || 1));
        if (completed) return 100;
        // Keep LEARNING below 100 to avoid dashboard desync before true completion.
        return Math.max(0, Math.min(99, Math.round((safePos / totalLessons) * 100)));
    }, []);

    const isCompletedVerb = useCallback((verb = {}) => {
        const verbId = String(verb?.id || '').toLowerCase();
        const verbLabel = String(verb?.display?.['en-US'] || verb?.display?.en || '').toLowerCase();
        return hasCompletionStatusSignal(`${verbId} ${verbLabel}`);
    }, []);

    const isAssessmentActivity = useCallback((activity) => {
        if (activity && typeof activity === 'object') {
            if (
                activity.assessment === true
                || activity?.config?.isAssessment === true
            ) {
                return true;
            }

            const masteryScore = Number(
                activity.masteryScore
                ?? activity?.config?.masteryScore
                ?? activity?.metadata?.masteryScore
            );
            if (Number.isFinite(masteryScore) && masteryScore > 0) {
                return true;
            }

            const calculatescore = activity.calculatescore
                ?? activity.calculateScore
                ?? activity?.config?.calculateScore
                ?? activity?.metadata?.calculatescore;
            if (calculatescore === true) {
                return true;
            }

            const attemptLimit = Number(
                activity.attemptLimit
                ?? activity.limitQuizzed
                ?? activity?.config?.limitQuizzed
                ?? activity?.metadata?.attemptLimit
            );
            if (Number.isFinite(attemptLimit) && attemptLimit > 0) {
                return true;
            }
        }

        const raw = typeof activity === 'string'
            ? activity
            : (activity?.name || activity?.title || activity?.launch || activity?.activityId || activity?.id || '');
        return /quiz|test|exam|assessment|post[\s-_]?test|pre[\s-_]?test|แบบทดสอบ|ทดสอบ/i.test(String(raw));
    }, []);

    const getAssessmentPassingScore = useCallback((activity) => {
        if (!activity || typeof activity !== 'object') return 80;
        const raw = Number(
            activity.masteryScore
            ?? activity?.config?.masteryScore
            ?? activity?.metadata?.masteryScore
            ?? activity?.passScore
            ?? activity?.config?.passScore
            ?? activity?.metadata?.passScore
            ?? 80
        );
        if (!Number.isFinite(raw)) return 80;
        if (raw > 0 && raw <= 1) return Math.round(raw * 100);
        return Math.max(1, Math.min(100, Math.round(raw)));
    }, []);
    const extractScorePayloadFromStatus = useCallback((item) => {
        if (!item || typeof item !== 'object') return {};
        const statusText = normalizeStatusText(
            item?.status
            ?? item?.result
            ?? item?.completionStatus
            ?? item?.successStatus
            ?? ''
        );
        const hasFailSignal = hasFailureStatusSignal(statusText);
        const scoreRaw = asFiniteNumber(
            item?.scoreRaw
            ?? item?.rawScore
            ?? item?.raw
            ?? item?.score
            ?? item?.result?.score?.raw
        );
        const scoreScaled = asFiniteNumber(
            item?.scoreScaled
            ?? item?.scaledScore
            ?? item?.scaled
            ?? item?.normalizedScore
            ?? item?.result?.score?.scaled
        );
        const completion = typeof item?.completion === 'boolean'
            ? item.completion
            : (isTruthyFlag(item?.completed) ? true : null);
        const success = typeof item?.success === 'boolean'
            ? item.success
            : (isTruthyFlag(item?.passed) ? true : null);

        const payload = {};
        if (scoreRaw !== null) payload.scoreRaw = scoreRaw;
        if (scoreScaled !== null) payload.scoreScaled = scoreScaled;
        if (success === true || (hasFailSignal && success === false)) payload.success = success;
        if (completion === true || (hasFailSignal && completion === false)) payload.completion = completion;
        return payload;
    }, []);

    const isTinCanLessonPassed = useCallback((item, activity = null) => {
        if (!item || typeof item !== 'object') return false;
        const isAssessment = isAssessmentActivity(activity);

        const statusText = normalizeStatusText(
            item.status
            ?? item.result
            ?? item.completionStatus
            ?? item.successStatus
            ?? ''
        );
        if (statusText) {
            const hasExplicitFail = hasFailureStatusSignal(statusText);
            if (hasExplicitFail) return false;

            const hasExplicitPass = hasPassStatusSignal(statusText);
            if (hasExplicitPass) return true;

            if (!isAssessment && hasCompletionStatusSignal(statusText)) {
                return true;
            }
        }

        const explicitPass =
            isTruthyFlag(item.passed) ||
            isTruthyFlag(item.isPassed) ||
            isTruthyFlag(item?.result?.passed);
        if (explicitPass) return true;
        const explicitSuccess = typeof item.success === 'boolean'
            ? item.success
            : (typeof item?.result?.success === 'boolean' ? item.result.success : null);
        if (!isAssessment && explicitSuccess === true) return true;

        const score = asFiniteNumber(
            item.score
            ?? item.rawScore
            ?? item.raw
            ?? item.resultScore
            ?? item.scoreRaw
            ?? item?.result?.score?.raw
        );
        const scoreMax = asFiniteNumber(
            item.scoreMax
            ?? item.maxScore
            ?? item.max
            ?? item.totalScore
            ?? item?.result?.score?.max
        );
        const percent = asFiniteNumber(item.percent ?? item.percentage ?? item.progressPercent);
        const scaled = asFiniteNumber(
            item.scaledScore
            ?? item.scaled
            ?? item.scoreScaled
            ?? item.normalizedScore
            ?? item?.result?.score?.scaled
        );

        const normalizedFromScore = score !== null ? (score <= 1 ? score * 100 : score) : null;
        const normalizedFromScaled = scaled !== null ? (scaled <= 1 ? scaled * 100 : scaled) : null;
        const normalizedFromRawMax =
            score !== null && scoreMax !== null && scoreMax > 0
                ? (score / scoreMax) * 100
                : null;

        if (isAssessment) {
            const passingScore = getAssessmentPassingScore(activity);
            if (normalizedFromScore !== null && normalizedFromScore >= passingScore) return true;
            if (normalizedFromScaled !== null && normalizedFromScaled >= passingScore) return true;
            if (normalizedFromRawMax !== null && normalizedFromRawMax >= passingScore) return true;
            const hasAnyScoreEvidence =
                normalizedFromScore !== null ||
                normalizedFromScaled !== null ||
                normalizedFromRawMax !== null;
            if (hasAnyScoreEvidence) return false;

            const hasCompletionSignalWithoutScore =
                isTruthyFlag(item?.completed) ||
                item?.completion === true ||
                hasCompletionStatusSignal(statusText);
            if (hasCompletionSignalWithoutScore) return true;

            if (explicitSuccess === false && hasFailureStatusSignal(statusText)) return false;
            return false;
        }

        if (explicitSuccess === false) return false;
        if (isTruthyFlag(item.completed)) return true;
        if (normalizedFromScore !== null && normalizedFromScore >= 100) return true;
        if (percent !== null && percent >= 100) return true;
        if (normalizedFromScaled !== null && normalizedFromScaled >= 100) return true;
        return false;
    }, [isAssessmentActivity, getAssessmentPassingScore]);

    const isTinCanLessonCompleted = useCallback((item) => {
        if (!item || typeof item !== 'object') return false;

        const statusText = normalizeStatusText(
            item.status
            ?? item.result
            ?? item.completionStatus
            ?? item.successStatus
            ?? ''
        );
        if (hasCompletionStatusSignal(statusText)) return true;

        const explicitCompletion = typeof item.completion === 'boolean'
            ? item.completion
            : (typeof item?.result?.completion === 'boolean' ? item.result.completion : null);
        if (explicitCompletion === true) return true;
        if (explicitCompletion === false) return false;

        if (isTruthyFlag(item.completed)) return true;

        const percent = asFiniteNumber(item.percent ?? item.percentage ?? item.progressPercent);
        if (percent !== null && percent >= 100) return true;

        const score = asFiniteNumber(
            item.score
            ?? item.rawScore
            ?? item.raw
            ?? item.resultScore
            ?? item.scoreRaw
            ?? item?.result?.score?.raw
        );
        const scaled = asFiniteNumber(
            item.scaledScore
            ?? item.scaled
            ?? item.scoreScaled
            ?? item.normalizedScore
            ?? item?.result?.score?.scaled
        );
        if (score !== null && (score <= 1 ? score * 100 : score) >= 100) return true;
        if (scaled !== null && (scaled <= 1 ? scaled * 100 : scaled) >= 100) return true;

        return false;
    }, []);

    const isTinCanLessonClearedForAdvance = useCallback((item, activity = null) => {
        const assessment = isAssessmentActivity(activity);
        // Assessment/test activities must still be passed before moving forward.
        if (assessment) {
            return isTinCanLessonPassed(item, activity);
        }
        // Content/video lessons are considered "cleared for advance" once learner has started.
        if (isTinCanLessonPassed(item, activity)) return true;
        if (item && typeof item === 'object') {
            if (isTruthyFlag(item?.attempted) || isTruthyFlag(item?.quizzed)) return true;
            const statusText = normalizeStatusText(
                item?.status
                ?? item?.result
                ?? item?.completionStatus
                ?? item?.successStatus
                ?? ''
            );
            if (statusText.includes('progress') || statusText.includes('in progress') || statusText.includes('learning')) {
                return true;
            }
        }
        return false;
    }, [isAssessmentActivity, isTinCanLessonPassed]);

    const hasAssessmentActivities = useMemo(() => {
        if (content?.type !== 'tincan' || !Array.isArray(content?.activities)) return false;
        return content.activities.some((activity) => isAssessmentActivity(activity));
    }, [content, isAssessmentActivity]);

    const areAssessmentActivitiesPassed = useMemo(() => {
        if (content?.type !== 'tincan' || !Array.isArray(content?.activities)) return false;
        if (!hasAssessmentActivities) return true;
        return content.activities.every((activity, index) => {
            if (!isAssessmentActivity(activity)) return true;
            return isTinCanLessonPassed(tinCanActivityStatus[index], activity);
        });
    }, [content, hasAssessmentActivities, isAssessmentActivity, isTinCanLessonPassed, tinCanActivityStatus]);

    const hasAssessmentFailureSignals = useMemo(() => {
        if (content?.type !== 'tincan' || !Array.isArray(content?.activities)) return false;
        if (!hasAssessmentActivities) return false;
        return content.activities.some((activity, index) => {
            if (!isAssessmentActivity(activity)) return false;
            const item = tinCanActivityStatus[index];
            const statusText = normalizeStatusText(
                item?.status
                ?? item?.result
                ?? item?.completionStatus
                ?? item?.successStatus
                ?? ''
            );
            if (hasFailureStatusSignal(statusText)) {
                return true;
            }
            if (isTinCanLessonPassed(item, activity)) return false;
            if (item?.success === false) {
                const hasAnyScoreSignal =
                    asFiniteNumber(item?.scoreRaw ?? item?.rawScore ?? item?.raw ?? item?.result?.score?.raw) !== null ||
                    asFiniteNumber(item?.scoreScaled ?? item?.scaledScore ?? item?.scaled ?? item?.result?.score?.scaled) !== null;
                if (hasAnyScoreSignal) return true;
            }
            return false;
        });
    }, [content, hasAssessmentActivities, isAssessmentActivity, tinCanActivityStatus, isTinCanLessonPassed]);

    useEffect(() => {
        if (hasAssessmentFailureSignals) {
            completionLockRef.current = false;
        }
    }, [hasAssessmentFailureSignals]);

    const requireAssessmentPass = useMemo(() => {
        const completedWhenDoAll = content?.completionPolicy?.completedWhenDoAllMasteryscore;
        if (completedWhenDoAll === false) return false;
        if (hasAssessmentActivities) return true;
        const configured = content?.completionPolicy?.requireAssessmentPass;
        if (typeof configured === 'boolean') return configured;
        return false;
    }, [content?.completionPolicy?.requireAssessmentPass, content?.completionPolicy?.completedWhenDoAllMasteryscore, hasAssessmentActivities]);

    const effectiveTinCanCondition = useMemo(() => {
        const raw = String(course?.tincanCondition || '').trim().toLowerCase();
        if (raw === 'all_completed_by_content_success') return 'all_completed_by_content_success';
        if (raw === 'all_completed_by_content_completion_success') return 'all_completed_by_content_completion_success';
        return 'all_completed';
    }, [course?.tincanCondition]);

    const canFinalizeTinCanCompletion = useCallback(({
        completedByVerb = false,
        completedByProgress: _completedByProgress = false,
        completedByPackage = false,
        completedByActivities = false,
        activityIndex: rawActivityIndex = -1,
        activityStatuses = tinCanActivityStatusRef.current,
    } = {}) => {
        const totalActivities = Array.isArray(content?.activities) ? content.activities.length : 0;
        const hasMultipleActivities = totalActivities > 1;
        const statuses = Array.isArray(activityStatuses) ? activityStatuses : [];
        const safeActivityIndex = Number.isFinite(Number(rawActivityIndex))
            ? Math.max(0, Math.min(Math.max(totalActivities - 1, 0), Math.floor(Number(rawActivityIndex))))
            : -1;
        const isFinalActivity = totalActivities <= 1 || (safeActivityIndex >= 0 && safeActivityIndex >= totalActivities - 1);

        // Do not trust raw progress-only signals for finalization because some runtimes
        // can report 100% too early (e.g. single-page packages on launch).
        const completionSignalForMulti =
            completedByPackage ||
            completedByActivities ||
            (completedByVerb && isFinalActivity);
        const completionSignalForSingle =
            completedByPackage ||
            completedByActivities ||
            completedByVerb;

        const activities = Array.isArray(content?.activities) ? content.activities : [];
        const hasActivitySignals = activities.some((_, idx) => {
            const item = statuses[idx];
            return Boolean(item && typeof item === 'object');
        });
        const allActivitiesCompleted = activities.length > 0
            && hasActivitySignals
            && activities.every((_, idx) => isTinCanLessonCompleted(statuses[idx]));
        const allActivitiesSuccess = activities.length > 0
            && hasActivitySignals
            && activities.every((activity, idx) => isTinCanLessonPassed(statuses[idx], activity));
        const hasAssessmentFailureSignalsFromStatuses = activities.some((activity, idx) => {
            if (!isAssessmentActivity(activity)) return false;
            const item = statuses[idx];
            const statusText = normalizeStatusText(
                item?.status
                ?? item?.result
                ?? item?.completionStatus
                ?? item?.successStatus
                ?? ''
            );
            if (hasFailureStatusSignal(statusText)) return true;
            const hasExplicitPassSignal =
                isTruthyFlag(item?.passed)
                || isTruthyFlag(item?.isPassed)
                || hasPassStatusSignal(statusText)
                || item?.success === true;
            if (hasExplicitPassSignal) return false;

            const rawScore = asFiniteNumber(
                item?.score
                ?? item?.rawScore
                ?? item?.raw
                ?? item?.resultScore
                ?? item?.scoreRaw
                ?? item?.result?.score?.raw
            );
            const scaledScore = asFiniteNumber(
                item?.scaledScore
                ?? item?.scaled
                ?? item?.scoreScaled
                ?? item?.normalizedScore
                ?? item?.result?.score?.scaled
            );
            const maxScore = asFiniteNumber(
                item?.scoreMax
                ?? item?.maxScore
                ?? item?.max
                ?? item?.totalScore
                ?? item?.result?.score?.max
            );
            const passScore = getAssessmentPassingScore(activity);
            const normalizedRaw =
                rawScore !== null
                    ? (rawScore <= 1 ? rawScore * 100 : rawScore)
                    : null;
            const normalizedScaled =
                scaledScore !== null
                    ? (scaledScore <= 1 ? scaledScore * 100 : scaledScore)
                    : null;
            const normalizedRawMax =
                rawScore !== null && maxScore !== null && maxScore > 0
                    ? (rawScore / maxScore) * 100
                    : null;
            const hasFailingScore =
                (normalizedRaw !== null && normalizedRaw < passScore)
                || (normalizedScaled !== null && normalizedScaled < passScore)
                || (normalizedRawMax !== null && normalizedRawMax < passScore);
            const hasAnyScore =
                normalizedRaw !== null
                || normalizedScaled !== null
                || normalizedRawMax !== null;
            if (hasAnyScore) return hasFailingScore;
            if (item?.success === false) {
                return false;
            }
            return false;
        });
        const areAssessmentActivitiesPassedFromStatuses = !activities.some((activity, idx) => {
            if (!isAssessmentActivity(activity)) return false;
            return !isTinCanLessonPassed(statuses[idx], activity);
        });

        let completionByCondition = allActivitiesCompleted;
        if (effectiveTinCanCondition === 'all_completed_by_content_success') {
            completionByCondition = allActivitiesSuccess;
        } else if (effectiveTinCanCondition === 'all_completed_by_content_completion_success') {
            completionByCondition = allActivitiesCompleted && allActivitiesSuccess;
        }

        const hasRuntimeCompletionSignal = hasMultipleActivities ? completionSignalForMulti : completionSignalForSingle;
        const hasValidCompletionSignal = completionByCondition || hasRuntimeCompletionSignal;
        const assessmentIndexes = activities.reduce((acc, activity, idx) => {
            if (isAssessmentActivity(activity)) acc.push(idx);
            return acc;
        }, []);
        const hasAssessmentInActivities = assessmentIndexes.length > 0;
        const lastAssessmentIndex = hasAssessmentInActivities ? assessmentIndexes[assessmentIndexes.length - 1] : -1;
        const isTerminalAssessmentIndex =
            hasAssessmentInActivities &&
            safeActivityIndex >= 0 &&
            safeActivityIndex === lastAssessmentIndex;
        const hasTerminalAssessmentPassSignal =
            isTerminalAssessmentIndex &&
            isTinCanLessonPassed(statuses[safeActivityIndex], activities[safeActivityIndex]) &&
            areAssessmentActivitiesPassedFromStatuses;
        const hasStrongAssessmentCompletionSignal =
            hasAssessmentInActivities &&
            areAssessmentActivitiesPassedFromStatuses &&
            (completedByActivities || completedByVerb || completedByPackage) &&
            isFinalActivity;
        // "Final slide" heuristics are only meaningful when the package exposes multiple activities/pages.
        // Single-activity packages would otherwise be marked complete immediately on launch.
        const hasFinalSlideCompletionFallback =
            hasMultipleActivities &&
            !hasAssessmentInActivities &&
            isFinalActivity &&
            safeActivityIndex >= 0;

        // Guard against instant false-positive completion on initial launch.
        const studiedSeconds = Math.max(0, Number(trackedStudySecondsRef.current || 0));
        if (
            studiedSeconds < 10 &&
            !hasStrongAssessmentCompletionSignal &&
            !hasTerminalAssessmentPassSignal
        ) return false;

        if (!hasValidCompletionSignal && !hasTerminalAssessmentPassSignal && !hasFinalSlideCompletionFallback) return false;
        const requiresSuccessValidation =
            effectiveTinCanCondition !== 'all_completed'
            || requireAssessmentPass;
        if (requiresSuccessValidation && hasAssessmentFailureSignalsFromStatuses) return false;
        if (requiresSuccessValidation && !areAssessmentActivitiesPassedFromStatuses) return false;
        return true;
    }, [
        requireAssessmentPass,
        content?.activities,
        isTinCanLessonCompleted,
        isTinCanLessonPassed,
        isAssessmentActivity,
        getAssessmentPassingScore,
        effectiveTinCanCondition,
    ]);

    const resolveActivityUrl = useCallback((entryPoint, launch) => {
        if (!entryPoint) return '';
        if (!launch) {
            if (/^https?:\/\//i.test(String(entryPoint))) return String(entryPoint);
            const value = String(entryPoint || '');
            return value.startsWith('/') ? value : `/${value}`;
        }
        if (/^https?:\/\//i.test(launch)) return launch;

        const normalizedLaunch = String(launch).replace(/\\/g, '/');
        const baseDir = entryPoint.split('/').slice(0, -1).join('/');

        if (/^\/?content\//i.test(normalizedLaunch)) {
            const normalizedContentPath = normalizedLaunch
                .replace(/^\/+/, '')
                .replace(/^content\//i, 'content/');
            return `/${normalizedContentPath}`;
        }

        try {
            const joined = new URL(normalizedLaunch.replace(/^\//, ''), `${appOrigin}/${baseDir}/`);
            return `${joined.pathname}${joined.search}${joined.hash}`;
        } catch {
            const value = String(entryPoint || '');
            return value.startsWith('/') ? value : `/${value}`;
        }
    }, [appOrigin]);

    const resolvePlayerSrc = useCallback((entryPoint) => {
        const value = String(entryPoint || '').trim();
        if (!value) return '';
        if (/^https?:\/\//i.test(value)) return value;
        return value.startsWith('/') ? value : `/${value}`;
    }, []);

    const resolveActivityCandidateUrl = useCallback((activity) => {
        if (!activity) return '';

        const preferredValues = [
            activity?.configNodeUrl,
            activity?.configNormalizedUrl,
            activity?.launch ? resolveActivityUrl(content?.entryPoint, activity.launch) : '',
        ];
        for (const candidateValue of preferredValues) {
            const candidate = String(candidateValue || '').trim();
            if (!candidate) continue;
            if (/^https?:\/\//i.test(candidate)) {
                try {
                    const url = new URL(candidate);
                    return `${url.pathname}${url.search}${url.hash}`;
                } catch {
                    return candidate;
                }
            }
            return candidate;
        }

        // Some recovered TinCan metadata has empty launch but full activity id URL.
        const activityId = String(activity.activityId || activity.id || '').trim();
        if (/^https?:\/\//i.test(activityId)) {
            try {
                const url = new URL(activityId);
                return `${url.pathname}${url.search}${url.hash}`;
            } catch {
                return '';
            }
        }

        return '';
    }, [content?.entryPoint, resolveActivityUrl]);

    const getActivityCandidateValues = useCallback((activity) => {
        if (!activity || typeof activity !== 'object') return [];
        const values = [
            activity?.configNodeUrl,
            activity?.configNormalizedUrl,
            activity?.launch ? resolveActivityUrl(content?.entryPoint, activity.launch) : '',
            activity?.launch,
            activity?.activityId,
            activity?.id,
        ];

        const seen = new Set();
        const next = [];
        for (const value of values) {
            const normalized = String(value || '').trim();
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            next.push(normalized);
        }
        return next;
    }, [content?.entryPoint, resolveActivityUrl]);

    const getActivityCandidatePathKeys = useCallback((activity) => {
        const seen = new Set();
        const keys = [];
        for (const value of getActivityCandidateValues(activity)) {
            const normalized = normalizeActivityPathKey(value);
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            keys.push(normalized);
        }
        return keys;
    }, [getActivityCandidateValues, normalizeActivityPathKey]);

    const getActivityConfigOrdinals = useCallback((activity) => {
        const raw = Number(activity?.configNodeIndex);
        if (!Number.isFinite(raw)) return [];
        const whole = Math.max(0, Math.floor(raw));
        const ordinals = new Set([whole]);
        if (whole >= 1) {
            ordinals.add(whole - 1);
        }
        return Array.from(ordinals.values()).filter((value) => Number.isFinite(value) && value >= 0);
    }, []);

    const getPrimaryActivityResumePath = useCallback((activity) => {
        const candidates = getActivityCandidateValues(activity);
        return String(candidates[0] || '').trim();
    }, [getActivityCandidateValues]);

    const ensureVideoAutoplay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        try {
            // Browsers usually allow autoplay only when muted.
            video.muted = true;
            video.playsInline = true;
            video.play?.().catch(() => { });
        } catch {
            // ignore
        }
    }, []);

    const getLegacyWebRuntimeWindows = useCallback(() => {
        if (!iframeRef.current) return [];
        const windows = [];
        try {
            const outer = iframeRef.current.contentWindow;
            if (outer) windows.push(outer);
            const inner = outer?.document?.getElementById('contentFrame')?.contentWindow;
            if (inner) windows.push(inner);
        } catch {
            // ignore cross-frame access errors
        }
        return windows;
    }, []);

    const hardenTinCanRuntimeWindow = useCallback((frameWindow) => {
        if (!frameWindow) return false;
        if (String(content?.type || '').toLowerCase() !== 'tincan') return false;
        try {
            const windows = [];
            const pushWindow = (candidate, depth = 0) => {
                if (!candidate) return;
                if (windows.includes(candidate)) return;
                windows.push(candidate);
                if (depth >= 4) return;

                try {
                    const childFrames = Array.from(candidate.document?.querySelectorAll?.('iframe') || []);
                    for (const childFrame of childFrames) {
                        pushWindow(childFrame?.contentWindow, depth + 1);
                    }
                } catch {
                    // ignore cross-frame access errors
                }
            };

            pushWindow(frameWindow);
            try {
                pushWindow(frameWindow.document?.getElementById('contentFrame')?.contentWindow, 1);
            } catch {
                // ignore cross-frame access errors
            }

            for (const win of windows) {
                const currentState = (win.currentState && typeof win.currentState === 'object')
                    ? win.currentState
                    : {};
                if (!win.currentState || typeof win.currentState !== 'object') {
                    win.currentState = currentState;
                }

                const dataIndex = Array.isArray(currentState.dataIndex) ? currentState.dataIndex : [];
                if (!Array.isArray(currentState.dataIndex)) {
                    currentState.dataIndex = dataIndex;
                }
                const treeArray = Array.isArray(win.treeArray) ? win.treeArray : [];
                if (!Array.isArray(win.treeArray)) {
                    win.treeArray = treeArray;
                }
                const ensureIndexedStateContainers = (index) => {
                    if (!Number.isFinite(Number(index)) || Number(index) < 0) return;
                    const safeIndex = Math.floor(Number(index));
                    const slots = [Math.max(0, safeIndex - 1), safeIndex, safeIndex + 1];
                    const containerKeys = [
                        'pageScore',
                        'pageScores',
                        'scoreByPage',
                        'questionScore',
                        'questionScores',
                        'quizScore',
                        'quizScores',
                        'resultByPage',
                        'statusByPage',
                        'pageStatus',
                        'attemptByPage',
                        'attemptedByPage',
                    ];

                    for (const holder of [currentState, win]) {
                        if (!holder || typeof holder !== 'object') continue;
                        for (const key of containerKeys) {
                            if (!Array.isArray(holder[key])) {
                                const existing = holder[key];
                                holder[key] = Array.isArray(existing) ? existing : [];
                            }
                            const bucket = holder[key];
                            for (const slot of slots) {
                                if (!bucket[slot] || typeof bucket[slot] !== 'object') {
                                    bucket[slot] = {};
                                }
                            }
                        }
                    }
                };

                const rawCurrentPage = Number(win.currentPage);
                const safeCurrentPage = Number.isFinite(rawCurrentPage)
                    ? Math.max(0, Math.floor(rawCurrentPage))
                    : 0;
                if (!Number.isFinite(rawCurrentPage) || rawCurrentPage < 0) {
                    win.currentPage = safeCurrentPage;
                }
                const lastSeenIndex = Number(currentState.lastSeenIndex);
                if (!Number.isFinite(lastSeenIndex) || lastSeenIndex < 0) {
                    currentState.lastSeenIndex = safeCurrentPage;
                }

                const ensureRow = (rows, index, fallbackRow = null) => {
                    if (!Array.isArray(rows) || !Number.isFinite(index) || index < 0) return;
                    const fallback = fallbackRow && typeof fallbackRow === 'object' ? fallbackRow : {};
                    if (!rows[index] || typeof rows[index] !== 'object') {
                        rows[index] = {};
                    }
                    const row = rows[index];
                    const fallbackTitle = String(
                        fallback?.title
                        || fallback?.name
                        || fallback?.topic
                        || fallback?.label
                        || fallback?.text
                        || ''
                    ).trim();
                    if (!String(row?.title || '').trim()) {
                        row.title = fallbackTitle || `Lesson ${index + 1}`;
                    }

                    const totalTime = Number(
                        row?.totalTime
                        ?? row?.totaltime
                        ?? fallback?.totalTime
                        ?? fallback?.totaltime
                        ?? fallback?.duration
                        ?? fallback?.length
                        ?? 0
                    );
                    const normalizedTotalTime = Number.isFinite(totalTime) && totalTime >= 0 ? totalTime : 0;
                    row.totalTime = normalizedTotalTime;
                    row.totaltime = normalizedTotalTime;

                    const limitAttempted = Number(
                        row?.limitattempted
                        ?? row?.limitAttempted
                        ?? row?.attemptLimit
                        ?? fallback?.limitattempted
                        ?? fallback?.limitAttempted
                        ?? fallback?.attemptLimit
                        ?? 0
                    );
                    const normalizedLimitAttempted = Number.isFinite(limitAttempted)
                        ? Math.max(0, Math.floor(limitAttempted))
                        : 0;
                    row.limitattempted = normalizedLimitAttempted;
                    row.limitAttempted = normalizedLimitAttempted;
                    row.attemptLimit = normalizedLimitAttempted;

                    const limitQuizzed = Number(
                        row?.limitquizzed
                        ?? row?.limitQuizzed
                        ?? row?.quizLimit
                        ?? fallback?.limitquizzed
                        ?? fallback?.limitQuizzed
                        ?? fallback?.quizLimit
                        ?? 0
                    );
                    const normalizedLimitQuizzed = Number.isFinite(limitQuizzed)
                        ? Math.max(0, Math.floor(limitQuizzed))
                        : 0;
                    row.limitquizzed = normalizedLimitQuizzed;
                    row.limitQuizzed = normalizedLimitQuizzed;
                    row.quizLimit = normalizedLimitQuizzed;

                    if (typeof row.attempted !== 'boolean') row.attempted = Boolean(fallback?.attempted);
                    if (typeof row.completed !== 'boolean') row.completed = Boolean(fallback?.completed);
                    if (typeof row.passed !== 'boolean') row.passed = Boolean(fallback?.passed);
                    if (typeof row.quizzed !== 'boolean') row.quizzed = Boolean(fallback?.quizzed);
                    if (!Array.isArray(row.score)) {
                        const priorScore = asFiniteNumber(row.score ?? fallback?.score);
                        row.score = priorScore !== null
                            ? [{ raw: priorScore, total: 100, percent: priorScore }]
                            : [];
                    }
                };

                const maxKnownRows = Math.max(dataIndex.length, treeArray.length);
                const targetRowCount = Math.max(
                    maxKnownRows,
                    safeCurrentPage + 1,
                    // Some legacy runtimes index dataIndex by currentPage in 1-based mode.
                    safeCurrentPage + 2
                );
                if (targetRowCount > 0) {
                    for (let index = 0; index < targetRowCount; index += 1) {
                        const treeRow = Array.isArray(treeArray) ? treeArray[index] : null;
                        const dataRow = Array.isArray(dataIndex) ? dataIndex[index] : null;
                        ensureRow(treeArray, index, dataRow);
                        ensureRow(dataIndex, index, treeRow);
                    }
                }
                ensureIndexedStateContainers(safeCurrentPage);
                ensureIndexedStateContainers(safeCurrentPage + 1);

                currentState.dataIndex = dataIndex;
                win.treeArray = treeArray;

                const needsRuntimeHeal = (error) => {
                    const message = String(error?.message || '').toLowerCase();
                    const hasReadUndefined = message.includes('cannot read properties of undefined');
                    const hasSetUndefined = message.includes('cannot set properties of undefined');
                    if (!hasReadUndefined && !hasSetUndefined) return false;
                    return (
                        message.includes('limitattempted')
                        || message.includes('title')
                        || message.includes('totaltime')
                        || message.includes('passed')
                        || message.includes('attempted')
                        || message.includes('quizzed')
                        || message.includes("setting '0'")
                    );
                };

                const healAroundCurrentPage = () => {
                    const around = Number.isFinite(Number(win.currentPage))
                        ? Math.max(0, Math.floor(Number(win.currentPage)))
                        : 0;
                    for (const idx of [around - 1, around, around + 1, around + 2]) {
                        if (!Number.isFinite(idx) || idx < 0) continue;
                        const treeRow = Array.isArray(treeArray) ? treeArray[idx] : null;
                        const dataRow = Array.isArray(dataIndex) ? dataIndex[idx] : null;
                        ensureRow(treeArray, idx, dataRow);
                        ensureRow(dataIndex, idx, treeRow);
                        ensureIndexedStateContainers(idx);
                    }
                };

                const wrapRuntimeFunctionSafely = (fnName, afterCall = null) => {
                    const currentFn = win?.[fnName];
                    if (typeof currentFn !== 'function') return;
                    if (currentFn.__lmsSafeWrapper === true) return;

                    const originalFn = currentFn;
                    const wrappedFn = function wrappedTinCanRuntimeFunction(...args) {
                        const invokeOriginal = () => {
                            const result = originalFn.apply(this, args);
                            if (typeof afterCall === 'function') {
                                try {
                                    afterCall(args, result);
                                } catch {
                                    // ignore post-call instrumentation failures
                                }
                            }
                            return result;
                        };

                        try {
                            return invokeOriginal();
                        } catch (error) {
                            if (!needsRuntimeHeal(error)) throw error;
                            try {
                                healAroundCurrentPage();
                                return invokeOriginal();
                            } catch {
                                return null;
                            }
                        }
                    };
                    wrappedFn.__lmsSafeWrapper = true;
                    wrappedFn.__lmsSafeOriginal = originalFn;
                    try {
                        win[fnName] = wrappedFn;
                    } catch {
                        // ignore runtime assignment failures
                    }
                };

                const parsePercentFromText = (value) => {
                    const text = String(value || '').trim();
                    if (!text) return null;
                    const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
                    if (percentMatch?.[1]) {
                        const parsed = Number(percentMatch[1]);
                        if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
                    }
                    return null;
                };

                const coercePercentFromScoreArgs = (rawScore, totalScore, percentScore) => {
                    const directPercent = Number(percentScore);
                    if (Number.isFinite(directPercent)) {
                        const normalizedDirectPercent =
                            directPercent >= 0 && directPercent <= 1
                                ? directPercent * 100
                                : directPercent;
                        return Math.max(0, Math.min(100, normalizedDirectPercent));
                    }

                    const raw = Number(rawScore);
                    const total = Number(totalScore);
                    if (Number.isFinite(raw) && Number.isFinite(total) && total > 0) {
                        return Math.max(0, Math.min(100, (raw / total) * 100));
                    }
                    if (Number.isFinite(raw)) return Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));
                    return null;
                };

                const readRuntimeCurrentPage = () => {
                    const readCandidates = [];
                    try { readCandidates.push(win.currentPage); } catch { /* ignore */ }
                    try { readCandidates.push(win.parent?.currentPage); } catch { /* ignore */ }
                    try { readCandidates.push(win.parent?.parent?.currentPage); } catch { /* ignore */ }
                    try { readCandidates.push(currentState.lastSeenIndex); } catch { /* ignore */ }
                    try { readCandidates.push(win.parent?.currentState?.lastSeenIndex); } catch { /* ignore */ }
                    try { readCandidates.push(win.parent?.parent?.currentState?.lastSeenIndex); } catch { /* ignore */ }

                    for (const candidate of readCandidates) {
                        const numeric = Number(candidate);
                        if (Number.isFinite(numeric) && numeric >= 0) {
                            return Math.floor(numeric);
                        }
                    }
                    return 0;
                };

                const applyAssessmentPassFromAlert = (percentValue = null, passedOverride = null) => {
                    const safeCurrentPage = readRuntimeCurrentPage();
                    const candidates = [safeCurrentPage, safeCurrentPage - 1, safeCurrentPage + 1];
                    const scorePercent = Number.isFinite(Number(percentValue))
                        ? Math.max(0, Math.min(100, Number(percentValue)))
                        : null;
                    const explicitPassed = typeof passedOverride === 'boolean' ? passedOverride : null;
                    const passByPercent = explicitPassed !== null
                        ? explicitPassed
                        : scorePercent === null ? true : scorePercent >= 80;

                    for (const idx of candidates) {
                        if (!Number.isFinite(idx) || idx < 0) continue;
                        const treeRow = Array.isArray(treeArray) ? treeArray[idx] : null;
                        const dataRow = Array.isArray(dataIndex) ? dataIndex[idx] : null;
                        ensureRow(treeArray, idx, dataRow);
                        ensureRow(dataIndex, idx, treeRow);
                        const row = dataIndex[idx];
                        if (!row || typeof row !== 'object') continue;

                        row.attempted = true;
                        row.quizzed = true;
                        row.completed = true;
                        row.completion = true;
                        row.passed = passByPercent;
                        row.success = passByPercent;
                        row.status = passByPercent ? 'passed' : 'failed';
                        if (scorePercent !== null) {
                            if (Array.isArray(row.score)) {
                                row.score[0] = { raw: scorePercent, total: 100, percent: scorePercent };
                            }
                            row.scorePercent = scorePercent;
                            row.rawScore = scorePercent;
                            row.scoreRaw = scorePercent;
                            row.scaledScore = scorePercent / 100;
                            row.scoreScaled = scorePercent / 100;
                            row.scoreMax = 100;
                            row.maxScore = 100;
                        }
                    }

                    if (passByPercent) {
                        currentState.completed = true;
                        currentState.completion = true;
                    }
                    const safeLastSeen = Number(currentState.lastSeenIndex);
                    if (!Number.isFinite(safeLastSeen) || safeCurrentPage > safeLastSeen) {
                        currentState.lastSeenIndex = safeCurrentPage;
                    }
                    try {
                        const assessmentMessage = {
                            type: 'lms-assessment-result',
                            runtimePage: safeCurrentPage,
                            percent: scorePercent,
                            passed: passByPercent,
                            completed: true,
                        };
                        win.parent?.postMessage(assessmentMessage, window.location.origin);
                        if (win.top && win.top !== win.parent) {
                            win.top.postMessage(assessmentMessage, window.location.origin);
                        }
                    } catch {
                        // ignore postMessage failures
                    }
                };

                if (typeof win?.alert === 'function' && win.alert.__lmsAssessmentAlertWrapper !== true) {
                    const originalAlert = win.alert;
                    const wrappedAlert = function wrappedTinCanAlert(message, ...args) {
                        try {
                            const text = String(message || '');
                            const mayBeAssessmentResult =
                                /คะแนน|score|result|quiz|test|exam|assessment|ผ่าน|pass/i.test(text);
                            if (mayBeAssessmentResult) {
                                const percentValue = parsePercentFromText(text);
                                applyAssessmentPassFromAlert(percentValue);
                            }
                        } catch {
                            // ignore alert parsing failures
                        }
                        return originalAlert.apply(this, [message, ...args]);
                    };
                    wrappedAlert.__lmsAssessmentAlertWrapper = true;
                    wrappedAlert.__lmsAlertOriginal = originalAlert;
                    try {
                        win.alert = wrappedAlert;
                    } catch {
                        // ignore runtime assignment failures
                    }
                }

                wrapRuntimeFunctionSafely('updatestatus');
                wrapRuntimeFunctionSafely('updateStatus');
                wrapRuntimeFunctionSafely('SetupIFrame');
                wrapRuntimeFunctionSafely('setContentStatusPassed');
                wrapRuntimeFunctionSafely('setCurrentPageScore', (args) => {
                    const percentValue = coercePercentFromScoreArgs(args?.[0], args?.[1], args?.[2]);
                    applyAssessmentPassFromAlert(percentValue);
                });
                wrapRuntimeFunctionSafely('sendCurrentPagePassedStatement', (args) => {
                    const percentValue = coercePercentFromScoreArgs(args?.[1], args?.[2], args?.[3]);
                    applyAssessmentPassFromAlert(percentValue, args?.[0] === true);
                });
                wrapRuntimeFunctionSafely('sendExperiencedStatement', () => {
                    const pageIndex = readRuntimeCurrentPage();
                    const row = Array.isArray(dataIndex) ? dataIndex[pageIndex] : null;
                    const scoreRow = Array.isArray(row?.score) ? row.score[0] : null;
                    const percentValue = coercePercentFromScoreArgs(
                        scoreRow?.raw ?? row?.scoreRaw ?? row?.rawScore ?? row?.score,
                        scoreRow?.total ?? row?.scoreMax ?? row?.maxScore ?? row?.totalScore,
                        scoreRow?.percent ?? row?.scorePercent ?? row?.scaledScore ?? row?.scoreScaled
                    );
                    applyAssessmentPassFromAlert(percentValue, true);
                });
                wrapRuntimeFunctionSafely('setCurrentPageStatus');
                wrapRuntimeFunctionSafely('setCurrentPageAttempted');
                wrapRuntimeFunctionSafely('displayMsg');
                wrapRuntimeFunctionSafely('checkAnswer');
            }

            // Share canonical state from outer wrapper to inner runtime window when available.
            if (windows.length >= 2) {
                const canonical = windows[0];
                const follower = windows[1];
                try {
                    if (canonical?.currentState && typeof canonical.currentState === 'object') {
                        follower.currentState = canonical.currentState;
                    }
                    if (Array.isArray(canonical?.treeArray)) {
                        follower.treeArray = canonical.treeArray;
                    }
                } catch {
                    // ignore assignment failures
                }
            }
            return true;
        } catch {
            return false;
        }
    }, [content?.type]);

    const detectLegacyWebPageIndex = useCallback(() => {
        const windows = getLegacyWebRuntimeWindows();
        for (const win of windows) {
            try {
                const directIndex = Number(win?.currentPage);
                if (Number.isFinite(directIndex) && directIndex >= 0) {
                    return Math.floor(directIndex);
                }
                const lastSeenIndex = Number(win?.currentState?.lastSeenIndex);
                if (Number.isFinite(lastSeenIndex) && lastSeenIndex >= 0) {
                    return Math.floor(lastSeenIndex);
                }
            } catch {
                // ignore runtime errors
            }
        }
        return -1;
    }, [getLegacyWebRuntimeWindows]);

    const getLegacyWebPageTotal = useCallback(() => {
        const windows = getLegacyWebRuntimeWindows();
        let maxTotal = 0;
        for (const win of windows) {
            try {
                const dataIndex = win?.currentState?.dataIndex;
                if (Array.isArray(dataIndex) && dataIndex.length > maxTotal) {
                    maxTotal = dataIndex.length;
                }
                const treeArray = win?.treeArray;
                if (Array.isArray(treeArray) && treeArray.length > maxTotal) {
                    maxTotal = treeArray.length;
                }
                const numpage = Number(win?.numpage);
                if (Number.isFinite(numpage) && numpage > maxTotal) {
                    maxTotal = Math.floor(numpage);
                }
            } catch {
                // ignore
            }
        }
        if (maxTotal > 0) return maxTotal;

        const fallback = Number(duration || 0);
        if (Number.isFinite(fallback) && fallback > 0) {
            return Math.max(1, Math.floor(fallback));
        }
        return 0;
    }, [duration, getLegacyWebRuntimeWindows]);

    const getLegacyWebPageTitles = useCallback(() => {
        const windows = getLegacyWebRuntimeWindows();
        let bestTitles = [];

        const pickTitle = (row, index) => {
            const candidate = String(
                row?.title
                || row?.name
                || row?.topic
                || row?.label
                || row?.text
                || row?.lessonTitle
                || ''
            ).trim();
            if (candidate) return candidate;
            return `Lesson ${index + 1}`;
        };

        for (const win of windows) {
            try {
                const treeArray = Array.isArray(win?.treeArray) ? win.treeArray : [];
                if (treeArray.length > 0) {
                    const titles = treeArray.map((row, index) => pickTitle(row, index));
                    if (titles.length > bestTitles.length) {
                        bestTitles = titles;
                    }
                }
                const dataIndex = Array.isArray(win?.currentState?.dataIndex) ? win.currentState.dataIndex : [];
                if (dataIndex.length > bestTitles.length) {
                    const titles = dataIndex.map((row, index) => pickTitle(row, index));
                    bestTitles = titles;
                }
            } catch {
                // ignore runtime access errors
            }
        }

        return bestTitles;
    }, [getLegacyWebRuntimeWindows]);

    const getCurrentWebStatusSnapshot = useCallback(() => {
        const windows = getLegacyWebRuntimeWindows();
        for (const win of windows) {
            try {
                const dataIndex = win?.currentState?.dataIndex;
                if (!Array.isArray(dataIndex) || dataIndex.length === 0) continue;
                return dataIndex.map((row) => ({
                    attempted: row?.attempted === true,
                    completed: row?.completed === true,
                    passed: row?.passed === true,
                    quizzed: row?.quizzed === true,
                }));
            } catch {
                // ignore runtime errors
            }
        }
        return null;
    }, [getLegacyWebRuntimeWindows]);

    const applyWebStatusToRuntime = useCallback((targetIndex = -1) => {
        const windows = getLegacyWebRuntimeWindows();
        const stored = readWebStatusSnapshot();

        for (const win of windows) {
            try {
                const state = win?.currentState;
                if (!state || !Array.isArray(state.dataIndex) || state.dataIndex.length === 0) continue;

                const next = state.dataIndex.map((row, index) => {
                    const source = Array.isArray(stored) ? stored[index] : null;
                    const shouldBackfill = Number.isFinite(Number(targetIndex)) && index < Number(targetIndex);
                    return {
                        ...row,
                        attempted: row?.attempted === true || source?.attempted === true || shouldBackfill,
                        completed: row?.completed === true || source?.completed === true || shouldBackfill,
                        passed: row?.passed === true || source?.passed === true || false,
                        quizzed: row?.quizzed === true || source?.quizzed === true || false,
                    };
                });

                state.dataIndex = next;
                if (typeof win.drawTOC === 'function') {
                    win.drawTOC();
                }
            } catch {
                // ignore runtime write errors
            }
        }
    }, [getLegacyWebRuntimeWindows, readWebStatusSnapshot]);

    const canFinalizeLegacyWebCompletion = useCallback(({
        pageIndex = -1,
        totalPages = 0,
    } = {}) => {
        const safePageIndex = Number.isFinite(Number(pageIndex)) ? Math.floor(Number(pageIndex)) : -1;
        const safeTotalPages = Math.max(0, Math.floor(Number(totalPages) || 0));
        const reachedLastPage = safeTotalPages > 0 && safePageIndex >= safeTotalPages - 1;

        const windows = getLegacyWebRuntimeWindows();
        let completedByRuntime = false;
        let completedByDataIndex = false;
        let attemptedAllByDataIndex = false;
        let hasAnyAttemptByDataIndex = false;

        for (const win of windows) {
            try {
                const state = win?.currentState;
                if (state?.completed === true || state?.completion === true || state?.isCompleted === true) {
                    completedByRuntime = true;
                }

                const dataIndex = state?.dataIndex;
                if (Array.isArray(dataIndex) && dataIndex.length > 0) {
                    const allCompleted = dataIndex.every((row) => row?.completed === true || row?.passed === true);
                    if (allCompleted) {
                        completedByDataIndex = true;
                    }

                    const hasAnyAttempt = dataIndex.some(
                        (row) => row?.attempted === true || row?.completed === true || row?.passed === true
                    );
                    if (hasAnyAttempt) {
                        hasAnyAttemptByDataIndex = true;
                    }

                    const allAttempted = dataIndex.every(
                        (row) => row?.attempted === true || row?.completed === true || row?.passed === true
                    );
                    if (allAttempted) {
                        attemptedAllByDataIndex = true;
                    }
                }
            } catch {
                // ignore runtime access errors
            }
        }

        // Guard against legacy web packages that report "completed" as soon as
        // the iframe boots or when a single-page package marks its only page
        // as attempted on load.
        const studiedSeconds = Math.max(0, Number(trackedStudySecondsRef.current || 0));
        if (studiedSeconds < 10) {
            return false;
        }

        return Boolean(
            completedByRuntime
            || completedByDataIndex
            || (
                safeTotalPages > 1
                && reachedLastPage
                && attemptedAllByDataIndex
                && hasAnyAttemptByDataIndex
            )
        );
    }, [getLegacyWebRuntimeWindows]);

    const applyLegacyWebResumeToIframe = useCallback(() => {
        if (!iframeRef.current || content?.type !== 'web' || !resumeLoaded) return;

        const savedIdx = readWebResumeIndex();
        const progressIdx = Number.isFinite(Number(currentTime)) && Number(currentTime) > 0
            ? Math.floor(Number(currentTime) - 1)
            : -1;
        const requestedIndex = Math.max(
            Number.isFinite(savedIdx) ? Math.floor(savedIdx) : -1,
            progressIdx
        );
        if (!Number.isFinite(requestedIndex) || requestedIndex <= 0) return;

        let attempts = 0;
        const maxAttempts = 80;
        const timer = setInterval(() => {
            attempts += 1;
            const windows = getLegacyWebRuntimeWindows();
            let applied = false;

            for (const win of windows) {
                try {
                    const goToPage = win?.goToPage;
                    if (typeof goToPage !== 'function') continue;

                    const runtimeTotal = Math.max(
                        0,
                        Number(Array.isArray(win?.currentState?.dataIndex) ? win.currentState.dataIndex.length : 0),
                        Number(Array.isArray(win?.treeArray) ? win.treeArray.length : 0),
                        Number(win?.numpage || 0),
                    );
                    const targetIndex = runtimeTotal > 0
                        ? Math.max(0, Math.min(requestedIndex, runtimeTotal - 1))
                        : requestedIndex;

                    const current = Number(win?.currentPage);
                    if (Number.isFinite(current) && current === targetIndex) {
                        clearInterval(timer);
                        return;
                    }

                    const previousLinear = win?.islinear;
                    try {
                        win.islinear = false;
                    } catch {
                        // ignore
                    }
                    goToPage(targetIndex);
                    try {
                        win.islinear = previousLinear;
                    } catch {
                        // ignore
                    }

                    applyWebStatusToRuntime(targetIndex);

                    const after = Number(win?.currentPage);
                    if (Number.isFinite(after) && after === targetIndex) {
                        clearInterval(timer);
                        return;
                    }
                    applied = true;
                } catch {
                    // keep retrying until runtime is ready
                }
            }

            if (!applied && attempts >= maxAttempts) {
                clearInterval(timer);
            } else if (attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }, 250);
    }, [content?.type, resumeLoaded, currentTime, readWebResumeIndex, getLegacyWebRuntimeWindows, applyWebStatusToRuntime]);

    const getTinCanRuntimeRowPathKey = useCallback((row) => {
        const candidates = [
            row?.url,
            row?.urlOffline,
            row?.launch,
            row?.href,
            row?.src,
            row?.path,
            row?.link,
            row?.filename,
        ];

        for (const candidate of candidates) {
            const normalized = normalizeActivityPathKey(candidate);
            if (normalized) return normalized;
        }

        return '';
    }, [normalizeActivityPathKey]);

    const getTinCanRuntimeRowTitleKey = useCallback((row) => {
        const raw = String(
            row?.name
            || row?.title
            || row?.topic
            || row?.label
            || row?.text
            || ''
        ).trim();
        if (!raw) return '';
        return raw
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }, []);

    const extractLessonNumber = useCallback((value) => {
        const text = String(value || '').trim();
        if (!text) return null;
        const thaiLessonMatch = text.match(/บทที่\s*([0-9]+)/i);
        if (thaiLessonMatch?.[1]) {
            const parsed = Number(thaiLessonMatch[1]);
            return Number.isFinite(parsed) ? parsed : null;
        }
        const lessonMatch = text.match(/(?:lesson|chapter|module)\s*([0-9]+)/i);
        if (lessonMatch?.[1]) {
            const parsed = Number(lessonMatch[1]);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }, []);

    const scoreTinCanActivityRowMatch = useCallback((activity, row, {
        activityIndex = -1,
        rowOrdinal = -1,
        rowOrder = -1,
    } = {}) => {
        if (!activity || !row || typeof activity !== 'object' || typeof row !== 'object') return -1;

        const normalizeTitle = (value) => String(value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        const activityCandidateKeys = getActivityCandidatePathKeys(activity);
        const activityOrdinals = getActivityConfigOrdinals(activity);
        const activityTitle = String(activity?.configNodeText || activity?.name || activity?.title || '').trim();
        const activityLessonNumber = extractLessonNumber(activityTitle);
        const activityNodeKey = String(activity?.configNodeId || activity?.id || activity?.activityId || '').trim().toLowerCase();
        const rowKey = getTinCanRuntimeRowPathKey(row);
        const rowTitleKey = getTinCanRuntimeRowTitleKey(row);
        const rowLessonNumber = extractLessonNumber(rowTitleKey);
        const rowNodeKey = String(row?.id || row?.nodeId || '').trim().toLowerCase();
        const activityTitleKey = normalizeTitle(activityTitle);

        let score = 0;

        if (activityNodeKey && rowNodeKey && activityNodeKey === rowNodeKey) {
            score += 32;
        }
        if (rowKey && activityCandidateKeys.length > 0) {
            const exactPathMatch = activityCandidateKeys.some((candidate) => candidate === rowKey);
            const loosePathMatch = !exactPathMatch && activityCandidateKeys.some((candidate) => (
                rowKey.endsWith(candidate)
                || candidate.endsWith(rowKey)
            ));
            if (exactPathMatch) {
                score += 36;
            } else if (loosePathMatch) {
                score += 24;
            }
        }
        if (Number.isFinite(rowOrdinal) && rowOrdinal >= 0 && activityOrdinals.includes(Number(rowOrdinal))) {
            score += 26;
        }
        if (activityTitleKey && rowTitleKey) {
            if (rowTitleKey === activityTitleKey) score += 10;
            else if (rowTitleKey.includes(activityTitleKey) || activityTitleKey.includes(rowTitleKey)) score += 5;
        }
        if (
            Number.isFinite(activityLessonNumber)
            && Number.isFinite(rowLessonNumber)
            && Number(activityLessonNumber) === Number(rowLessonNumber)
        ) {
            score += 8;
        }
        const distanceOrdinal = Number.isFinite(rowOrder) && rowOrder >= 0
            ? rowOrder
            : rowOrdinal;
        if (Number.isFinite(activityIndex) && Number.isFinite(distanceOrdinal) && activityIndex >= 0 && distanceOrdinal >= 0) {
            const distance = Math.abs(Number(activityIndex) - Number(distanceOrdinal));
            if (distance === 0) score += 6;
            else if (distance === 1) score += 3;
        }

        return score;
    }, [getActivityCandidatePathKeys, getActivityConfigOrdinals, extractLessonNumber, getTinCanRuntimeRowPathKey, getTinCanRuntimeRowTitleKey]);

    const getTinCanStatusRows = useCallback(() => {
        try {
            const frameWindow = iframeRef.current?.contentWindow;
            const dataIndex = Array.isArray(frameWindow?.currentState?.dataIndex)
                ? frameWindow.currentState.dataIndex
                : [];
            if (dataIndex.length > 0) {
                return dataIndex.map((row, index) => ({ row, statusIndex: index, statusOrder: index }));
            }
        } catch {
            // ignore iframe access errors
        }

        return [];
    }, []);

    const resolveTinCanRuntimeSource = useCallback(() => {
        try {
            const frameWindow = iframeRef.current?.contentWindow;
            if (!frameWindow) return 'treeArray';
            const currentIndex = Number(frameWindow?.currentPage);
            if (!Number.isFinite(currentIndex) || currentIndex < 0) return 'treeArray';

            const dataIndex = Array.isArray(frameWindow?.currentState?.dataIndex)
                ? frameWindow.currentState.dataIndex
                : [];
            const treeArray = Array.isArray(frameWindow?.treeArray) ? frameWindow.treeArray : [];

            let innerKey = '';
            try {
                const innerSrc = frameWindow?.document?.getElementById('contentFrame')?.getAttribute('src')
                    || frameWindow?.document?.getElementById('contentFrame')?.src
                    || '';
                innerKey = normalizeActivityPathKey(innerSrc);
            } catch {
                innerKey = '';
            }

            const matchesIndex = (rows) => {
                if (!Array.isArray(rows) || rows.length === 0) return false;
                const row = rows[currentIndex];
                if (!row) return false;
                const rowKey = getTinCanRuntimeRowPathKey(row);
                if (!innerKey || !rowKey) return false;
                return rowKey === innerKey || rowKey.endsWith(innerKey) || innerKey.endsWith(rowKey);
            };

            if (matchesIndex(dataIndex)) return 'dataIndex';
            if (matchesIndex(treeArray)) return 'treeArray';
            if (dataIndex.length && treeArray.length === 0) return 'dataIndex';
            return 'treeArray';
        } catch {
            return 'treeArray';
        }
    }, [getTinCanRuntimeRowPathKey, normalizeActivityPathKey]);

    const getTinCanRuntimeRows = useCallback(() => {
        try {
            const frameWindow = iframeRef.current?.contentWindow;
            if (!frameWindow) return [];

            const isLaunchableRow = (row = {}) => {
                const isPage = row?.ispage;
                const hasLaunch = Boolean(
                    String(row?.url || '').trim()
                    || String(row?.urlOffline || '').trim()
                    || String(row?.launch || '').trim()
                    || String(row?.href || '').trim()
                    || String(row?.src || '').trim()
                    || String(row?.path || '').trim()
                );
                if (isPage === true) return true;
                if (String(isPage).toLowerCase() === 'true') return true;
                return hasLaunch;
            };

            const runtimeSource = resolveTinCanRuntimeSource();
            const treeArray = Array.isArray(frameWindow?.treeArray) ? frameWindow.treeArray : [];
            const dataIndex = Array.isArray(frameWindow?.currentState?.dataIndex)
                ? frameWindow.currentState.dataIndex
                : [];
            const sourceRows = runtimeSource === 'dataIndex' ? dataIndex : treeArray;
            if (sourceRows.length > 0) {
                const pageRows = sourceRows
                    .map((row, index) => ({ row, runtimeIndex: index }))
                    .filter((entry) => isLaunchableRow(entry?.row));
                if (pageRows.length > 0) {
                    return pageRows.map((entry, order) => ({
                        row: entry.row,
                        runtimeIndex: Number(entry.runtimeIndex),
                        runtimeOrder: order,
                        runtimePage: Number(entry.runtimeIndex),
                        runtimeSource,
                    }));
                }
            }
        } catch {
            // ignore iframe access errors
        }

        return [];
    }, [resolveTinCanRuntimeSource]);

    const TINCAN_STRONG_MATCH_SCORE = 30;

    const findRuntimePageIndexForActivity = useCallback((activityIndex) => {
        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (activities.length === 0) return -1;

        const safeIndex = Math.max(0, Math.min(activities.length - 1, Math.floor(Number(activityIndex) || 0)));
        const activity = activities[safeIndex];
        const runtimeRows = getTinCanRuntimeRows();

        let bestRuntimePage = -1;
        let bestScore = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let order = 0; order < runtimeRows.length; order++) {
            const entry = runtimeRows[order];
            const rowOrdinal = Number.isFinite(Number(entry?.runtimeIndex)) ? Number(entry.runtimeIndex) : order;
            const rowOrder = Number.isFinite(Number(entry?.runtimeOrder)) ? Number(entry.runtimeOrder) : order;
            const score = scoreTinCanActivityRowMatch(activity, entry?.row, {
                activityIndex: safeIndex,
                rowOrdinal,
                rowOrder,
            });
            const distance = Math.abs(safeIndex - rowOrder);

            if (score > bestScore || (score === bestScore && distance < bestDistance)) {
                bestScore = score;
                bestRuntimePage = Number(entry.runtimePage);
                bestDistance = distance;
            }
        }

        if (bestScore >= TINCAN_STRONG_MATCH_SCORE) {
            return bestRuntimePage;
        }

        if (runtimeRows.length === activities.length) {
            const fallbackEntry = runtimeRows[safeIndex];
            if (fallbackEntry && Number.isFinite(Number(fallbackEntry.runtimePage))) {
                return Math.floor(Number(fallbackEntry.runtimePage));
            }
        }

        return -1;
    }, [content?.activities, getTinCanRuntimeRows, scoreTinCanActivityRowMatch]);

    const findActivityIndexForRuntimePage = useCallback((runtimePageIndex) => {
        const runtimeIndex = Math.floor(Number(runtimePageIndex));
        if (!Number.isFinite(runtimeIndex) || runtimeIndex < 0) return -1;

        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (activities.length === 0) return -1;

        const runtimeRows = getTinCanRuntimeRows();
        const runtimeEntry =
            runtimeRows.find((entry) => Number(entry?.runtimePage) === runtimeIndex)
            || runtimeRows.find((entry) => Number(entry?.runtimeIndex) === runtimeIndex);
        const runtimeRow = runtimeEntry?.row;
        const rowOrdinal = Number.isFinite(Number(runtimeEntry?.runtimeIndex))
            ? Number(runtimeEntry.runtimeIndex)
            : runtimeRows.findIndex((entry) => Number(entry?.runtimePage) === runtimeIndex);
        const rowOrder = Number.isFinite(Number(runtimeEntry?.runtimeOrder))
            ? Number(runtimeEntry.runtimeOrder)
            : runtimeRows.findIndex((entry) => Number(entry?.runtimePage) === runtimeIndex);

        let bestIndex = -1;
        let bestScore = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < activities.length; i++) {
            const score = scoreTinCanActivityRowMatch(activities[i], runtimeRow, {
                activityIndex: i,
                rowOrdinal,
                rowOrder,
            });
            const distance = Math.abs(i - rowOrder);
            if (score > bestScore || (score === bestScore && distance < bestDistance)) {
                bestScore = score;
                bestIndex = i;
                bestDistance = distance;
            }
        }

        if (bestScore >= TINCAN_STRONG_MATCH_SCORE) {
            return bestIndex;
        }

        const orderedIndex = runtimeRows.findIndex((entry) => Number(entry?.runtimePage) === runtimeIndex);
        if (orderedIndex >= 0 && orderedIndex < activities.length) {
            return orderedIndex;
        }

        return -1;
    }, [content?.activities, getTinCanRuntimeRows, scoreTinCanActivityRowMatch]);

    const getTinCanRuntimeIndexOffset = useCallback(() => {
        if (!content || content.type !== 'tincan' || !Array.isArray(content.activities) || content.activities.length === 0) {
            return 0;
        }

        const activities = content.activities;
        const runtimeRows = getTinCanRuntimeRows();
        if (!Array.isArray(runtimeRows) || runtimeRows.length === 0) return 0;

        // Prefer real path matching to estimate offset. This is safer than using
        // count differences, which can be very wrong for some packages.
        const diffCount = new Map();
        let matched = 0;
        for (let i = 0; i < activities.length; i++) {
            const candidateKeys = getActivityCandidatePathKeys(activities[i]);
            const candidateOrdinals = getActivityConfigOrdinals(activities[i]);
            if (candidateKeys.length === 0 && candidateOrdinals.length === 0) continue;

            const rowIndex = runtimeRows.findIndex((entry) => {
                const rowKey = getTinCanRuntimeRowPathKey(entry?.row);
                const rowOrdinal = Number.isFinite(Number(entry?.runtimeIndex))
                    ? Number(entry.runtimeIndex)
                    : runtimeRows.findIndex((runtimeEntry) => runtimeEntry === entry);
                const pathMatched = rowKey && candidateKeys.some((candidateKey) => (
                    rowKey === candidateKey
                    || rowKey.endsWith(candidateKey)
                    || candidateKey.endsWith(rowKey)
                ));
                const ordinalMatched = Number.isFinite(rowOrdinal) && candidateOrdinals.includes(rowOrdinal);
                return Boolean(pathMatched || ordinalMatched);
            });
            if (rowIndex < 0) continue;

            const diff = Math.floor(Number(rowIndex) - Number(i));
            if (!Number.isFinite(diff) || diff < 0) continue;
            matched += 1;
            diffCount.set(diff, Number(diffCount.get(diff) || 0) + 1);
        }

        if (matched >= 2 && diffCount.size > 0) {
            let bestDiff = 0;
            let bestCount = -1;
            for (const [diff, count] of diffCount.entries()) {
                if (count > bestCount || (count === bestCount && diff < bestDiff)) {
                    bestDiff = diff;
                    bestCount = count;
                }
            }
            return Math.max(0, bestDiff);
        }

        if (runtimeRows.length === activities.length) return 0;

        // Last-resort fallback: keep offset conservative to avoid jumping to wrong chapter.
        const rawDiff = runtimeRows.length - activities.length;
        if (!Number.isFinite(rawDiff)) return 0;
        return Math.max(0, Math.min(2, Math.floor(rawDiff)));
    }, [content, getTinCanRuntimeRows, getActivityCandidatePathKeys, getActivityConfigOrdinals, getTinCanRuntimeRowPathKey]);

    const mapRuntimePageToActivityIndex = useCallback((runtimePageIndex) => {
        const numeric = Number(runtimePageIndex);
        if (!Number.isFinite(numeric)) return -1;
        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (activities.length === 0) return -1;

        const exact = findActivityIndexForRuntimePage(numeric);
        if (exact >= 0) return exact;

        const runtimeRows = getTinCanRuntimeRows();
        const orderedIndex = runtimeRows.findIndex((entry) => Number(entry?.runtimePage) === Math.floor(numeric));
        if (orderedIndex >= 0 && orderedIndex < activities.length) {
            return orderedIndex;
        }

        return -1;
    }, [content?.activities, findActivityIndexForRuntimePage, getTinCanRuntimeRows]);

    const mapActivityIndexToRuntimePage = useCallback((activityIndex) => {
        const numeric = Number(activityIndex);
        if (!Number.isFinite(numeric)) return -1;
        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (activities.length === 0) return -1;

        const safeActivityIndex = Math.max(0, Math.min(activities.length - 1, Math.floor(numeric)));
        const exact = findRuntimePageIndexForActivity(safeActivityIndex);
        if (exact >= 0) return exact;

        const runtimeRows = getTinCanRuntimeRows();
        const fallbackRow = runtimeRows[safeActivityIndex];
        if (fallbackRow && Number.isFinite(Number(fallbackRow.runtimePage))) {
            return Math.floor(Number(fallbackRow.runtimePage));
        }

        return -1;
    }, [content?.activities, findRuntimePageIndexForActivity, getTinCanRuntimeRows]);

    const findTinCanStatusRowForActivity = useCallback((activityIndex) => {
        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (activities.length === 0) return null;

        const safeIndex = Math.max(0, Math.min(activities.length - 1, Math.floor(Number(activityIndex) || 0)));
        const activity = activities[safeIndex];
        const statusRows = getTinCanStatusRows();
        if (statusRows.length === 0) return null;

        let bestRow = null;
        let bestScore = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let order = 0; order < statusRows.length; order++) {
            const entry = statusRows[order];
            const rowOrdinal = Number.isFinite(Number(entry?.statusOrder)) ? Number(entry.statusOrder) : order;
            const score = scoreTinCanActivityRowMatch(activity, entry?.row, {
                activityIndex: safeIndex,
                rowOrdinal,
                rowOrder: rowOrdinal,
            });
            const distance = Math.abs(safeIndex - rowOrdinal);

            if (score > bestScore || (score === bestScore && distance < bestDistance)) {
                bestScore = score;
                bestRow = entry?.row || null;
                bestDistance = distance;
            }
        }

        if (bestScore >= TINCAN_STRONG_MATCH_SCORE) {
            return bestRow;
        }

        if (statusRows.length === activities.length) {
            return statusRows[safeIndex]?.row || null;
        }

        return null;
    }, [content?.activities, getTinCanStatusRows, scoreTinCanActivityRowMatch]);

    const findUniqueActivityIndexByPathKey = useCallback((normalizedPathKey, { allowLoose = false } = {}) => {
        const key = String(normalizedPathKey || '').trim();
        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (!key || activities.length === 0) return -1;

        const exactMatches = [];
        const looseMatches = [];
        for (let i = 0; i < activities.length; i++) {
            const candidateKeys = getActivityCandidatePathKeys(activities[i]);
            if (!Array.isArray(candidateKeys) || candidateKeys.length === 0) continue;
            if (candidateKeys.includes(key)) {
                exactMatches.push(i);
                continue;
            }
            if (
                allowLoose &&
                candidateKeys.some((candidate) => (
                    key.endsWith(candidate)
                    || candidate.endsWith(key)
                ))
            ) {
                looseMatches.push(i);
            }
        }

        if (exactMatches.length === 1) return exactMatches[0];
        if (exactMatches.length > 1) return -1;
        if (allowLoose && looseMatches.length === 1) return looseMatches[0];
        return -1;
    }, [content?.activities, getActivityCandidatePathKeys]);

    const detectActivityIndexFromIframe = useCallback((options = {}) => {
        if (!iframeRef.current || !content || !Array.isArray(content.activities) || content.activities.length === 0) return -1;

        const frameWindow = iframeRef.current.contentWindow;
        if (!frameWindow) return -1;
        const preferInnerOnly = options?.preferInnerOnly === true;
        let innerContentWindow = null;

        // TinCan wrapper keeps the real activity in its inner iframe (#contentFrame).
        // Prefer this source over currentPage because runtime page counters can be stale during transitions.
        try {
            const contentFrame = frameWindow.document?.getElementById('contentFrame');
            innerContentWindow = contentFrame?.contentWindow || null;
            const innerSrc = contentFrame?.getAttribute('src') || contentFrame?.src || '';
            const inner = normalizeActivityPathKey(innerSrc);
            if (inner) {
                const exact = findUniqueActivityIndexByPathKey(inner, { allowLoose: false });
                if (exact >= 0) return exact;
                const loose = findUniqueActivityIndexByPathKey(inner, { allowLoose: true });
                if (loose >= 0) return loose;
            }
        } catch {
            // Ignore inner-frame access errors and try broader fallbacks.
        }

        let currentHref = '';
        try {
            currentHref = frameWindow.location?.href || '';
        } catch {
            currentHref = '';
        }
        if (currentHref) {
            const current = normalizeActivityPathKey(currentHref);
            if (current) {
                const exactCurrent = findUniqueActivityIndexByPathKey(current, { allowLoose: false });
                if (exactCurrent >= 0) return exactCurrent;
                const looseCurrent = findUniqueActivityIndexByPathKey(current, { allowLoose: true });
                if (looseCurrent >= 0) return looseCurrent;
            }
        }

        if (preferInnerOnly) return -1;

        // Fallback: runtime counters. Keep this last because wrappers can report selected page
        // before the actual activity iframe has navigated.
        try {
            const toActivityIndexFromRuntimeCounter = (rawValue) => {
                const numeric = Number(rawValue);
                if (!Number.isFinite(numeric) || numeric < 0) return -1;
                const whole = Math.floor(numeric);
                const mapped = mapRuntimePageToActivityIndex(whole);
                if (mapped >= 0) return mapped;

                // Some iSpring packages keep runtime counters valid but expose
                // inconsistent path keys in tree/data maps. Use a safe in-range fallback.
                if (whole >= 0 && whole < content.activities.length) {
                    return whole;
                }
                const oneBased = whole - 1;
                if (oneBased >= 0 && oneBased < content.activities.length) {
                    return oneBased;
                }
                return -1;
            };

            const runtimeWindows = [frameWindow, innerContentWindow].filter(Boolean);
            for (const runtimeWin of runtimeWindows) {
                const directIndex = Number(runtimeWin?.currentPage);
                if (Number.isFinite(directIndex) && directIndex >= 0) {
                    const mapped = toActivityIndexFromRuntimeCounter(directIndex);
                    if (mapped >= 0) return mapped;
                }

                const lastSeenIndex = Number(runtimeWin?.currentState?.lastSeenIndex);
                if (Number.isFinite(lastSeenIndex) && lastSeenIndex >= 0) {
                    const mapped = toActivityIndexFromRuntimeCounter(lastSeenIndex);
                    if (mapped >= 0) return mapped;
                }
            }
        } catch {
            // Ignore cross-frame access errors.
        }

        return -1;
    }, [content, getTinCanRuntimeRows, normalizeActivityPathKey, mapRuntimePageToActivityIndex, findUniqueActivityIndexByPathKey]);

    const syncTinCanActivityStatusFromIframe = useCallback(() => {
        if (!content || content.type !== 'tincan' || !Array.isArray(content.activities) || content.activities.length === 0) {
            return Array.isArray(tinCanActivityStatusRef.current) ? tinCanActivityStatusRef.current : [];
        }

        try {
            const frameWindow = iframeRef.current?.contentWindow;
            hardenTinCanRuntimeWindow(frameWindow);
            const dataIndex = frameWindow?.currentState?.dataIndex;
            if (!Array.isArray(dataIndex)) {
                return Array.isArray(tinCanActivityStatusRef.current) ? tinCanActivityStatusRef.current : [];
            }
            const runtimeRows = getTinCanRuntimeRows();

            const next = content.activities.map((_, i) => {
                const directStatusRow = findTinCanStatusRowForActivity(i);
                const mappedRuntimePage = findRuntimePageIndexForActivity(i);
                const mappedRow = mappedRuntimePage >= 0
                    ? runtimeRows.find((entry) => Number(entry?.runtimePage) === mappedRuntimePage)?.row
                    : null;
                const row = directStatusRow || mappedRow || {};
                const activity = content.activities[i];
                const isAssessment = isAssessmentActivity(activity);
                const statusText = normalizeStatusText(
                    row?.status
                    ?? row?.result
                    ?? row?.completionStatus
                    ?? row?.successStatus
                    ?? ''
                );
                const hasFailStatus = hasFailureStatusSignal(statusText);
                const hasPassStatus = hasPassStatusSignal(statusText);
                const rawScore = asFiniteNumber(
                    row?.score
                    ?? row?.rawScore
                    ?? row?.raw
                    ?? row?.resultScore
                    ?? row?.scoreRaw
                    ?? row?.result?.score?.raw
                );
                const scaledScore = asFiniteNumber(
                    row?.scaledScore
                    ?? row?.scaled
                    ?? row?.scoreScaled
                    ?? row?.normalizedScore
                    ?? row?.result?.score?.scaled
                );
                const maxScore = asFiniteNumber(
                    row?.scoreMax
                    ?? row?.maxScore
                    ?? row?.max
                    ?? row?.totalScore
                    ?? row?.result?.score?.max
                );
                const assessmentPassingScore = getAssessmentPassingScore(activity);
                const normalizedFromRawMax =
                    rawScore !== null && maxScore !== null && maxScore > 0
                        ? (rawScore / maxScore) * 100
                        : null;
                const normalizedFromRaw =
                    rawScore !== null
                        ? (rawScore <= 1 ? rawScore * 100 : rawScore)
                        : null;
                const normalizedFromScaled =
                    scaledScore !== null
                        ? (scaledScore <= 1 ? scaledScore * 100 : scaledScore)
                        : null;
                const hasPassingScore =
                    (normalizedFromRawMax !== null && normalizedFromRawMax >= assessmentPassingScore) ||
                    (normalizedFromScaled !== null && normalizedFromScaled >= assessmentPassingScore) ||
                    (normalizedFromRaw !== null && normalizedFromRaw >= assessmentPassingScore);
                const hasAnyScoreEvidence =
                    normalizedFromRawMax !== null ||
                    normalizedFromScaled !== null ||
                    normalizedFromRaw !== null;
                const hasAssessmentCompletionSignal =
                    isAssessment &&
                    !hasFailStatus &&
                    (isTruthyFlag(row?.completed) || row?.completion === true || hasCompletionStatusSignal(statusText));
                const markedPass =
                    !hasFailStatus &&
                    (
                        isTruthyFlag(row?.passed)
                        || hasPassStatus
                        || hasPassingScore
                        || (hasAssessmentCompletionSignal && !hasAnyScoreEvidence)
                        || (!isAssessment && row?.success === true)
                    );
                const markedComplete =
                    !hasFailStatus &&
                    (isTruthyFlag(row?.completed) || row?.completion === true || hasCompletionStatusSignal(statusText));
                const derivedSuccess = markedPass
                    ? true
                    : (
                        hasFailStatus || (isAssessment && hasAnyScoreEvidence && !hasPassingScore)
                            ? false
                            : null
                    );
                const derivedCompletion = (isAssessment ? markedPass : markedComplete)
                    ? true
                    : (hasFailStatus && hasAttemptSignal ? false : null);
                return {
                    attempted: isTruthyFlag(row?.attempted),
                    completed: isAssessment ? markedPass : markedComplete,
                    passed: markedPass,
                    quizzed: isTruthyFlag(row?.quizzed),
                    status: String(statusText || ''),
                    success: derivedSuccess,
                    completion: derivedCompletion,
                    scoreRaw: rawScore,
                    scoreScaled: scaledScore,
                    scoreMax: maxScore,
                };
            });

            const sig = JSON.stringify(next);
            tinCanActivityStatusRef.current = next;
            if (sig !== lastTinCanStatusSigRef.current) {
                lastTinCanStatusSigRef.current = sig;
                setTinCanActivityStatus(next);
            }
            return next;
        } catch {
            // ignore iframe state read errors
            return Array.isArray(tinCanActivityStatusRef.current) ? tinCanActivityStatusRef.current : [];
        }
    }, [content, isAssessmentActivity, getAssessmentPassingScore, getTinCanRuntimeRows, findRuntimePageIndexForActivity, findTinCanStatusRowForActivity, hardenTinCanRuntimeWindow]);

    const applyTincanResumeToIframe = useCallback(() => {
        if (!content || content.type !== 'tincan' || !Array.isArray(content.activities) || content.activities.length === 0) return;
        // Allow manual selection to bypass resumeLoaded guard so sidebar clicks work even before resume is fully loaded
        const manualActiveCheck = Number.isFinite(Number(manualSelectionRef.current?.target)) && Date.now() < Number(manualSelectionRef.current?.until || 0);
        if (!iframeRef.current || (!resumeLoaded && !manualActiveCheck)) return;

        const frameWindow = iframeRef.current.contentWindow;
        if (!frameWindow) return;

        const manualTarget = Number(manualSelectionRef.current?.target);
        const manualUntil = Number(manualSelectionRef.current?.until || 0);
        const manualActive = Number.isFinite(manualTarget) && Date.now() < manualUntil;
        const targetIndex = Math.max(
            0,
            Math.min(
                manualActive ? Math.floor(manualTarget) : Number(selectedActivityIndex),
                content.activities.length - 1
            )
        );
        let attempts = 0;
        const maxAttempts = 80;
        const commitResolvedIndex = (resolvedIndex, options = {}) => {
            const preserveManual = options?.preserveManual === true;
            if (!Number.isFinite(Number(resolvedIndex))) return;
            const safeResolvedIndex = Math.max(0, Math.min(content.activities.length - 1, Math.floor(Number(resolvedIndex))));
            const resolvedActivity = content.activities[safeResolvedIndex];
            const resolvedPath = getPrimaryActivityResumePath(resolvedActivity);
            setSelectedActivityIndex(safeResolvedIndex);
            setCurrentTime(safeResolvedIndex + 1);
            persistTincanResumeIndex(safeResolvedIndex);
            persistTincanResumePath(resolvedPath || resolvedActivity?.activityId || resolvedActivity?.id || '');
            highestSeenActivityIndexRef.current = Math.max(
                Number(highestSeenActivityIndexRef.current || 0),
                safeResolvedIndex
            );
            if (manualActive && !preserveManual) {
                manualSelectionRef.current = { target: null, until: 0 };
            } else if (manualActive && preserveManual) {
                manualSelectionRef.current = { target: safeResolvedIndex, until: Date.now() + 12000 };
            }
        };
        const forceNavigateInnerFrameToTarget = () => {
            try {
                const targetActivity = content.activities?.[targetIndex];
                if (!targetActivity) return false;
                const launchCandidate = String(targetActivity?.launch || '').trim();
                const targetUrl = resolveActivityUrl(
                    content.entryPoint,
                    launchCandidate || getPrimaryActivityResumePath(targetActivity)
                );
                if (!targetUrl) return false;

                const frameDoc = frameWindow?.document;
                const contentFrameEl = frameDoc?.getElementById('contentFrame');
                if (!contentFrameEl) return false;

                const currentSrc = contentFrameEl.getAttribute('src') || contentFrameEl.src || '';
                const normalizedCurrent = normalizeActivityPathKey(currentSrc);
                const normalizedTarget = normalizeActivityPathKey(targetUrl);
                if (normalizedTarget && normalizedCurrent === normalizedTarget) {
                    return true;
                }

                contentFrameEl.setAttribute('src', targetUrl);
                contentFrameEl.src = targetUrl;
                if (typeof frameWindow?.drawTOC === 'function') {
                    frameWindow.drawTOC();
                }
                return true;
            } catch {
                return false;
            }
        };

        const timer = setInterval(() => {
            attempts += 1;
            try {
                hardenTinCanRuntimeWindow(frameWindow);
                // Prefer direct inner-frame navigation first.
                // This avoids off-by-one and stale runtime-page mapping on both
                // explicit clicks and resume restoration.
                if (attempts === 1) {
                    if (forceNavigateInnerFrameToTarget()) {
                        commitResolvedIndex(targetIndex, { preserveManual: manualActive });
                        clearInterval(timer);
                        return;
                    }
                }
                const goToPage = frameWindow.goToPage;
                // Wait until TinCan runtime exposes goToPage; then keep retrying until target page is active.
                if (typeof goToPage === 'function') {
                    let runtimeTargetIndex = mapActivityIndexToRuntimePage(targetIndex);
                    const candidateTargets = Array.from(new Set([
                        runtimeTargetIndex,
                        targetIndex,
                    ].filter((value) => Number.isFinite(Number(value)) && Number(value) >= 0)
                        .map((value) => Math.floor(Number(value)))));
                    if (candidateTargets.length === 0) {
                        if (forceNavigateInnerFrameToTarget()) {
                            commitResolvedIndex(targetIndex, { preserveManual: manualActive });
                            clearInterval(timer);
                            return;
                        }
                        return;
                    }

                    const roundTripIndex = mapRuntimePageToActivityIndex(runtimeTargetIndex);

                    logLessonMapDebug('resume-jump-prepare', {
                        targetIndex,
                        runtimeTargetIndex,
                        roundTripIndex,
                        currentRuntimePage: Number(frameWindow.currentPage),
                        targetActivityTitle: String(content?.activities?.[targetIndex]?.name || content?.activities?.[targetIndex]?.title || ''),
                    });

                    const detectedBefore = detectActivityIndexFromIframe({ preferInnerOnly: true });
                    if (detectedBefore === targetIndex) {
                        logLessonMapDebug('resume-jump-skip-detected-target', {
                            targetIndex,
                            runtimeTargetIndex,
                            currentRuntimePage: Number(frameWindow.currentPage),
                            detectedActivityIndex: detectedBefore,
                        });
                        commitResolvedIndex(detectedBefore);
                        clearInterval(timer);
                        return;
                    }

                    const current = Number(frameWindow.currentPage);
                    if (!Number.isFinite(current) || current !== runtimeTargetIndex || detectedBefore !== targetIndex) {
                        for (const candidatePage of candidateTargets) {
                            const previousLinear = frameWindow.islinear;
                            try {
                                frameWindow.islinear = false;
                            } catch {
                                // ignore
                            }
                            goToPage(candidatePage);
                            try {
                                frameWindow.islinear = previousLinear;
                            } catch {
                                // ignore
                            }
                            if (typeof frameWindow.drawTOC === 'function') {
                                frameWindow.drawTOC();
                            }

                            const detectedAfter = detectActivityIndexFromIframe({ preferInnerOnly: true });
                            const runtimeAfter = Number(frameWindow.currentPage);
                            const mappedAfter = Number.isFinite(runtimeAfter) && runtimeAfter >= 0
                                ? mapRuntimePageToActivityIndex(runtimeAfter)
                                : -1;
                            if (detectedAfter === targetIndex || mappedAfter === targetIndex) {
                                const after = Number(frameWindow.currentPage);
                                logLessonMapDebug('resume-jump-applied', {
                                    targetIndex,
                                    runtimeTargetIndex,
                                    candidatePage,
                                    currentRuntimePage: after,
                                    detectedActivityIndex: detectedAfter,
                                    mappedActivityIndex: mappedAfter,
                                });
                                commitResolvedIndex(detectedAfter >= 0 ? detectedAfter : mappedAfter);
                                clearInterval(timer);
                                return;
                            }
                        }
                    }
                }
            } catch {
                // Keep retrying until script initialization is ready.
            }

            if (attempts >= maxAttempts) {
                const detectedFinal = detectActivityIndexFromIframe();
                const runtimeFinal = Number(frameWindow.currentPage);
                const mappedFinal = Number.isFinite(runtimeFinal) && runtimeFinal >= 0
                    ? mapRuntimePageToActivityIndex(runtimeFinal)
                    : -1;
                if (detectedFinal !== targetIndex && forceNavigateInnerFrameToTarget()) {
                    commitResolvedIndex(targetIndex, { preserveManual: manualActive });
                    clearInterval(timer);
                    return;
                }
                if (manualActive && detectedFinal !== targetIndex) {
                    if (mappedFinal === targetIndex) {
                        commitResolvedIndex(mappedFinal);
                        clearInterval(timer);
                        return;
                    }
                    manualSelectionRef.current = { target: null, until: 0 };
                    toast.warning(
                        'ไม่สามารถเปิดบทที่เลือกได้ในขณะนี้ กรุณาลองอีกครั้ง',
                        { ...LEARNER_TOAST, toastId: 'learner-open-lesson-failed' }
                    );
                } else if (detectedFinal >= 0) {
                    commitResolvedIndex(detectedFinal);
                } else if (mappedFinal >= 0) {
                    commitResolvedIndex(mappedFinal);
                } else if (manualActive) {
                    manualSelectionRef.current = { target: null, until: 0 };
                }
                clearInterval(timer);
            }
        }, 250);
    }, [content, selectedActivityIndex, resumeLoaded, mapActivityIndexToRuntimePage, mapRuntimePageToActivityIndex, logLessonMapDebug, detectActivityIndexFromIframe, persistTincanResumeIndex, persistTincanResumePath, getPrimaryActivityResumePath, hardenTinCanRuntimeWindow, resolveActivityUrl, normalizeActivityPathKey]);

    const restoreTincanPositionFromProgress = useCallback((entry) => {
        if (!content || content.type !== 'tincan' || !Array.isArray(content.activities) || content.activities.length === 0) return;

        const total = content.activities.length;
        let idx = 0;
        let resolvedFromProgress = false;

        const savedPathKey = readTincanResumePath();
        const idxFromSavedPath = savedPathKey
            ? content.activities.findIndex((activity) => {
                const candidateKeys = getActivityCandidatePathKeys(activity);
                return candidateKeys.includes(savedPathKey);
            })
            : -1;

        // Source 1: currentTime stores selected activity index + 1 for TinCan.
        const current = Number(entry?.currentTime);
        let idxFromCurrent = -1;
        if (Number.isFinite(current) && current >= 1 && current <= total) {
            idxFromCurrent = Math.floor(current - 1);
            resolvedFromProgress = true;
        }

        // If current chapter reached 100% but overall package is not completed yet,
        // continue from the next chapter instead of restarting the same one.
        const entryProgress = Number(entry?.progress || 0);
        const isCourseCompleted = String(entry?.status || '').toUpperCase() === 'COMPLETED';
        if (
            idxFromCurrent >= 0 &&
            !isCourseCompleted &&
            Number.isFinite(entryProgress) &&
            entryProgress >= 100 &&
            idxFromCurrent < total - 1
        ) {
            idxFromCurrent += 1;
        }

        // Source 2: local resume chapter saved from iframe navigation.
        const savedIdx = readTincanResumeIndex();
        const idxFromSaved = Number.isFinite(savedIdx) && savedIdx >= 0 && savedIdx < total
            ? Math.floor(savedIdx)
            : -1;
        const idxFromHighestSeen = Number.isFinite(Number(highestSeenActivityIndexRef.current))
            ? Math.max(0, Math.min(total - 1, Math.floor(Number(highestSeenActivityIndexRef.current))))
            : -1;

        // Merge server/local resume safely:
        // prefer the furthest locally-known lesson to avoid stale server row resetting learner to chapter 1.
        let merged = idxFromCurrent >= 0 ? idxFromCurrent : -1;
        const bestLocal = Math.max(
            Number.isFinite(idxFromSaved) ? idxFromSaved : -1,
            Number.isFinite(idxFromSavedPath) ? idxFromSavedPath : -1,
            Number.isFinite(idxFromHighestSeen) ? idxFromHighestSeen : -1
        );
        if (bestLocal >= 0) {
            merged = Math.max(merged, bestLocal);
        }

        idx = Math.max(0, merged);
        highestSeenActivityIndexRef.current = Math.max(Number(highestSeenActivityIndexRef.current || 0), idx);

        setSelectedActivityIndex(idx);
        if (idx > 0) {
            // Guard a short window to avoid early "chapter 1" sync overriding resume target.
            resumeGuardUntilRef.current = Date.now() + 10000;
        } else {
            resumeGuardUntilRef.current = 0;
        }
        if (resolvedFromProgress || idx > 0 || (idxFromSaved >= 0 && idxFromSaved !== idx)) {
            persistTincanResumeIndex(idx);
        }
        if (idx >= 0 && idx < content.activities.length) {
            const resumePath = getPrimaryActivityResumePath(content.activities[idx]);
            persistTincanResumePath(resumePath || content.activities[idx]?.activityId || content.activities[idx]?.id || '');
        }
        // Keep TinCan wrapper loaded (shows TOC/sidebar), then jump chapter via goToPage.
        setIframeSrc(resolvePlayerSrc(content.entryPoint));
    }, [content, readTincanResumePath, getActivityCandidatePathKeys, readTincanResumeIndex, persistTincanResumeIndex, persistTincanResumePath, getPrimaryActivityResumePath, resolvePlayerSrc]);

    useEffect(() => {
        if (!content) return;
        clearIframeInteractionTracking();
        clearInnerFrameLoadBinding();
        clearIframeDeferredSync();
        setResumeLoaded(false);
        setIsTinCanFrameReady(false);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setStatus('NOT_STARTED');
        setTinCanActivityStatus([]);
        tinCanActivityStatusRef.current = [];
        lastTinCanStatusSigRef.current = '';
        lastTincanSyncRef.current = { position: null, status: null, progress: null, at: 0 };
        selectedActivitySyncStateRef.current = { idx: null, status: '', at: 0 };
        legacyWebSyncStateRef.current = { idx: null, status: '', at: 0 };
        completionLockRef.current = false;
        resumeGuardUntilRef.current = 0;
        manualSelectionRef.current = { target: null, until: 0 };
        const persistedResumeIndex = content.type === 'tincan'
            ? readTincanResumeIndex()
            : null;
        const safePersistedResumeIndex = Number.isFinite(Number(persistedResumeIndex)) && Number(persistedResumeIndex) >= 0
            ? Math.floor(Number(persistedResumeIndex))
            : 0;
        highestSeenActivityIndexRef.current = safePersistedResumeIndex;
        trackedStudySecondsRef.current = 0;
        trackedStudyTickAtRef.current = 0;
        lastUserInteractionAtRef.current = Date.now();
        if (content.type === 'tincan' && content.activities?.length > 0) {
            const maxIndex = Math.max(0, content.activities.length - 1);
            const initialResumeIndex = Math.max(0, Math.min(maxIndex, safePersistedResumeIndex));
            setSelectedActivityIndex(initialResumeIndex);
            resumeGuardUntilRef.current = initialResumeIndex > 0 ? Date.now() + 10000 : 0;
            // Always start from TinCan wrapper page, not activity launch page.
            setIframeSrc(resolvePlayerSrc(content.entryPoint));
            return;
        }
        setIframeSrc(resolvePlayerSrc(content.entryPoint));
    }, [content, resolvePlayerSrc, clearIframeInteractionTracking, clearInnerFrameLoadBinding, clearIframeDeferredSync, readTincanResumeIndex]);

    useEffect(() => {
        if (!content || content.type !== 'tincan' || !resumeLoaded) return;
        if (!resumeLoaded) return;
        applyTincanResumeToIframe();
    }, [content, selectedActivityIndex, resumeLoaded, applyTincanResumeToIframe]);

    useEffect(() => {
        if (!content || content.type !== 'web' || !resumeLoaded) return;
        applyLegacyWebResumeToIframe();
    }, [content, resumeLoaded, currentTime, applyLegacyWebResumeToIframe]);

    useEffect(() => {
        if (!content || content.type !== 'tincan') return;
        // Avoid overwriting saved resume with default lesson 1 before
        // server/local resume restoration has completed.
        if (!resumeLoaded) return;
        const safeIdx = Math.max(0, Number(selectedActivityIndex) || 0);
        if (safeIdx > Number(highestSeenActivityIndexRef.current || 0)) {
            highestSeenActivityIndexRef.current = safeIdx;
        }
    }, [content, selectedActivityIndex, resumeLoaded]);

    // Resolve enrollment record for this user/course (used to keep /my-learning status synced)
    useEffect(() => {
        const loadEnrollment = async () => {
            if (!course?.id) return;
            try {
                const res = await fetch(`/api/enrollments?courseId=${course.id}&raw=1`, { cache: 'no-store' });
                if (!res.ok) return;
                const rows = await res.json();
                if (Array.isArray(rows) && rows.length > 0) {
                    setEnrollmentId(rows[0].id);
                }
            } catch {
                // ignore enrollment sync lookup errors
            }
        };
        loadEnrollment();
    }, [course?.id]);

    const syncEnrollmentStatus = useCallback(async (nextStatus, nextProgress) => {
        const gate = enrollmentSyncStateRef.current;
        const now = Date.now();
        const normalizedStatus = String(nextStatus || '').toUpperCase();
        const numericProgress = Number(nextProgress);
        const normalizedProgress = Number.isFinite(numericProgress)
            ? Math.max(0, Math.min(100, Math.round(numericProgress)))
            : 0;

        if (
            completionLockRef.current &&
            normalizedStatus !== 'COMPLETED' &&
            !hasAssessmentFailureSignals
        ) {
            return;
        }

        if (now < Number(gate.blockedUntil || 0)) return;
        if (gate.inFlight) return;

        const isDuplicate =
            gate.lastStatus === normalizedStatus &&
            Number(gate.lastProgress) === normalizedProgress &&
            now - Number(gate.lastAt || 0) < 6000;
        if (isDuplicate) return;

        gate.inFlight = true;
        try {
            let targetId = enrollmentId;

            if (!targetId && course?.id) {
                const res = await fetch(`/api/enrollments?courseId=${course.id}&raw=1`, { cache: 'no-store' });
                if (res.ok) {
                    const rows = await res.json();
                    if (Array.isArray(rows) && rows.length > 0) {
                        targetId = rows[0].id;
                        setEnrollmentId(targetId);
                    }
                }
            }

            if (!targetId) return;

            const patchRes = await fetch('/api/enrollments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: targetId,
                    status: normalizedStatus,
                    progress: normalizedProgress,
                }),
            });
            if (!patchRes.ok) {
                throw new Error(`Enrollment sync failed: ${patchRes.status}`);
            }

            gate.lastStatus = normalizedStatus;
            gate.lastProgress = normalizedProgress;
            gate.lastAt = Date.now();
            gate.blockedUntil = 0;
            if (normalizedStatus === 'COMPLETED') {
                completionLockRef.current = true;
            } else if (normalizedStatus === 'FAILED') {
                completionLockRef.current = false;
            }
        } catch {
            // Back off briefly to avoid request storms on transient network issues.
            gate.blockedUntil = Date.now() + 4000;
        } finally {
            gate.inFlight = false;
        }
    }, [course?.id, enrollmentId, hasAssessmentFailureSignals]);

    const bindIframeInteractionTracking = useCallback(() => {
        clearIframeInteractionTracking();
        const cleanups = [];

        const bindTarget = (target) => {
            if (!target || typeof target.addEventListener !== 'function') return;
            const events = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click', 'mousemove'];
            for (const eventName of events) {
                const handler = () => markLearningInteraction();
                target.addEventListener(eventName, handler, { passive: true });
                cleanups.push(() => {
                    try {
                        target.removeEventListener(eventName, handler, { passive: true });
                    } catch {
                        target.removeEventListener(eventName, handler);
                    }
                });
            }
        };

        try {
            const outer = iframeRef.current?.contentWindow;
            if (outer) {
                bindTarget(outer);
                bindTarget(outer.document);
                const inner = outer.document?.getElementById('contentFrame')?.contentWindow;
                if (inner) {
                    bindTarget(inner);
                    bindTarget(inner.document);
                }
            }
        } catch {
            // ignore cross-frame access issues
        }

        iframeInteractionCleanupRef.current = () => {
            for (const cleanup of cleanups) {
                try {
                    cleanup();
                } catch {
                    // ignore
                }
            }
        };
    }, [clearIframeInteractionTracking, markLearningInteraction]);

    const getTrackedStudySeconds = useCallback(() => {
        const value = Number(trackedStudySecondsRef.current || 0);
        if (!Number.isFinite(value) || value <= 0) return 0;
        return Math.max(0, Math.round(value));
    }, []);

    const syncProgressWithTrackedTime = useCallback(async (payload = {}) => {
        if (progressWriteBlockRef.current?.disabled) {
            if (String(payload?.status || '').toUpperCase() === 'COMPLETED') {
                completionLockRef.current = false;
                setStatus((prev) => (String(prev || '').toUpperCase() === 'COMPLETED' ? 'LEARNING' : prev));
                setProgress((prev) => Math.min(99, Math.max(0, Number(prev) || 0)));
            }
            return {
                success: false,
                reason: progressWriteBlockRef.current.reason || 'PROGRESS_SYNC_DISABLED',
                skipped: true,
            };
        }
        const requestedStatus = String(payload?.status || '').toUpperCase();
        const shouldKeepCompleted =
            completionLockRef.current &&
            !progressWriteBlockRef.current?.disabled &&
            requestedStatus !== 'COMPLETED' &&
            !hasAssessmentFailureSignals;
        const normalizedPayloadBase = shouldKeepCompleted
            ? { ...payload, status: 'COMPLETED', progress: 100 }
            : payload;
        const normalizedStatus = String(normalizedPayloadBase?.status || '').toUpperCase();
        const normalizedPayload = { ...normalizedPayloadBase };
        if (normalizedStatus === 'COMPLETED') {
            // Never let stale false flags downgrade a valid completion write on server.
            normalizedPayload.completion = true;
            if (normalizedPayload.success === false) {
                delete normalizedPayload.success;
            }
        }
        const normalizedSectionId = Number(normalizedPayload?.sectionId);
        const sectionIdForWrite =
            Number.isInteger(normalizedSectionId) && normalizedSectionId > 0
                ? normalizedSectionId
                : effectiveSectionId;
        const result = await updateProgress({
            ...normalizedPayload,
            sectionId: sectionIdForWrite,
        });
        const reason = String(result?.reason || '').toUpperCase();
        const statusCode = Number(result?.status || 0);
        const isForbiddenWrite = reason === 'ENROLLMENT_REQUIRED' || statusCode === 403;
        if (isForbiddenWrite) {
            progressWriteBlockRef.current = {
                disabled: true,
                reason: reason || 'FORBIDDEN',
            };
            completionLockRef.current = false;
            if (requestedStatus === 'COMPLETED') {
                setStatus((prev) => (String(prev || '').toUpperCase() === 'COMPLETED' ? 'LEARNING' : prev));
                setProgress((prev) => Math.min(99, Math.max(0, Number(prev) || 0)));
            }
            return {
                ...(result || {}),
                success: false,
                reason: reason || 'ENROLLMENT_REQUIRED',
            };
        }

        const writeSucceeded = result && result.success !== false;
        if (writeSucceeded && String(normalizedPayload?.status || '').toUpperCase() === 'COMPLETED') {
            completionLockRef.current = true;
        } else if (!writeSucceeded && requestedStatus === 'COMPLETED' && !shouldKeepCompleted) {
            completionLockRef.current = false;
        }
        return result;
    }, [getTrackedStudySeconds, hasAssessmentFailureSignals, effectiveSectionId]);

    useEffect(() => {
        progressWriteBlockRef.current = { disabled: false, reason: '' };
    }, [enrollmentId, progressContentId, progressUserId, activeSectionId]);

    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                markLearningInteraction();
                trackedStudyTickAtRef.current = Date.now();
            }
        };

        const onFocus = () => {
            markLearningInteraction();
            trackedStudyTickAtRef.current = Date.now();
        };

        const onInteraction = () => {
            markLearningInteraction();
        };

        const events = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click', 'mousemove'];
        for (const eventName of events) {
            window.addEventListener(eventName, onInteraction, { passive: true });
        }
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        markLearningInteraction();

        return () => {
            for (const eventName of events) {
                window.removeEventListener(eventName, onInteraction, { passive: true });
            }
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [markLearningInteraction]);

    useEffect(() => {
        if (!isLaunchMode || !content || !resumeLoaded) {
            trackedStudyTickAtRef.current = 0;
            return;
        }

        trackedStudyTickAtRef.current = Date.now();
        const timer = setInterval(() => {
            const now = Date.now();
            const last = Number(trackedStudyTickAtRef.current || 0);
            trackedStudyTickAtRef.current = now;

            if (!last) return;
            if (document.visibilityState !== 'visible') return;
            if (typeof document.hasFocus === 'function' && !document.hasFocus()) return;
            const idleSeconds = (now - Number(lastUserInteractionAtRef.current || 0)) / 1000;
            if (!Number.isFinite(idleSeconds) || idleSeconds > 75) return;

            if (content?.type === 'video') {
                const video = videoRef.current;
                if (!video || video.paused || video.ended) return;
            }

            const deltaSeconds = (now - last) / 1000;
            if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 30) return;

            trackedStudySecondsRef.current = Math.max(0, Number(trackedStudySecondsRef.current || 0)) + deltaSeconds;
        }, 1000);

        return () => clearInterval(timer);
    }, [isLaunchMode, content, content?.type, resumeLoaded]);

    // Fallback sync: keep chapter/enrollment status moving even when iframe index detection is flaky.
    useEffect(() => {
        if (!isLaunchMode || content?.type !== 'tincan' || !resumeLoaded) return;
        if (!progressContentId || !progressUserId) return;

        const total = Math.max(1, Number(content?.activities?.length || 0));
        const detectedIdx = detectActivityIndexFromIframe();
        const safeIdx = Math.max(
            0,
            Math.min(
                total - 1,
                Number.isFinite(Number(detectedIdx)) && detectedIdx >= 0
                    ? Math.floor(Number(detectedIdx))
                    : Math.floor(Number(selectedActivityIndex) || 0)
            )
        );
        const activityStatuses = Array.isArray(tinCanActivityStatusRef.current) ? tinCanActivityStatusRef.current : [];
        const completedByActivities =
            activityStatuses.length > 0 &&
            activityStatuses.every((item, idx) => isTinCanLessonPassed(item, content?.activities?.[idx]));
        const shouldComplete = canFinalizeTinCanCompletion({
            completedByProgress: false,
            completedByActivities,
            activityIndex: safeIdx,
            activityStatuses,
        });
        const lockedCompleted = completionLockRef.current && !hasAssessmentFailureSignals;
        const nextStatus = (shouldComplete || lockedCompleted) ? 'COMPLETED' : 'LEARNING';
        const nextProgress = nextStatus === 'COMPLETED'
            ? 100
            : computeTinCanProgress(safeIdx + 1, total, false);

        const gate = selectedActivitySyncStateRef.current || {};
        const now = Date.now();
        const unchangedRecently =
            Number(gate.idx) === safeIdx &&
            String(gate.status || '').toUpperCase() === nextStatus &&
            now - Number(gate.at || 0) < 5000;
        if (unchangedRecently) return;

        selectedActivitySyncStateRef.current = { idx: safeIdx, status: nextStatus, at: now };
        setStatus(nextStatus);
        setProgress(nextProgress);
        setCurrentTime(safeIdx + 1);
        setDuration(total);
        const fallbackScorePayload = extractScorePayloadFromStatus(activityStatuses[safeIdx]);

        syncProgressWithTrackedTime({
            contentId: progressContentId,
            userId: progressUserId,
            sectionId: activeSectionId,
            status: nextStatus,
            progress: nextProgress,
            currentTime: safeIdx + 1,
            duration: total,
            ...fallbackScorePayload,
        });

        if (nextStatus === 'COMPLETED') {
            syncEnrollmentStatus('COMPLETED', 100);
        } else {
            syncEnrollmentStatus('LEARNING', nextProgress);
        }
    }, [isLaunchMode, content, resumeLoaded, progressContentId, progressUserId, activeSectionId, selectedActivityIndex, computeTinCanProgress, syncEnrollmentStatus, syncProgressWithTrackedTime, canFinalizeTinCanCompletion, tinCanActivityStatus, isTinCanLessonPassed, hasAssessmentFailureSignals, detectActivityIndexFromIframe, extractScorePayloadFromStatus]);

    // Load content only from user's own enrollment (prevent bypass by direct URL).
    useEffect(() => {
        const loadContent = async () => {
            try {
                setLoading(true);
                setError('');
                setActiveSectionId(null);
                setCohortModuleEnabled(false);
                setEnrollmentId(null);
                progressWriteBlockRef.current = { disabled: false, reason: '' };

                const enrollmentRes = await fetch('/api/enrollments?raw=1', { cache: 'no-store' });
                if (enrollmentRes.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                if (!enrollmentRes.ok) {
                    setError('Failed to verify enrollment');
                    return;
                }

                const enrollments = await enrollmentRes.json();
                if (!Array.isArray(enrollments) || enrollments.length === 0) {
                    setError('คุณยังไม่มีสิทธิ์เรียนคอร์สนี้ กรุณาลงทะเบียนก่อน');
                    return;
                }

                const numericCourseId = Number(routeId);
                let candidates = [];

                if (Number.isInteger(numericCourseId) && numericCourseId > 0) {
                    candidates = enrollments.filter((row) => Number(row?.courseId || row?.course?.id) === numericCourseId);
                } else {
                    const routeKey = String(routeId || '').trim();
                    candidates = enrollments.filter((row) => String(row?.course?.tincanId || '').trim() === routeKey);
                }

                if (candidates.length === 0) {
                    setError('คุณยังไม่ได้ลงทะเบียนคอร์สนี้');
                    return;
                }

                const canLearnStatuses = new Set(['APPROVED', 'LEARNING', 'COMPLETED']);
                const allowedCandidates = candidates.filter((row) => canLearnStatuses.has(String(row?.status || '').toUpperCase()));
                if (allowedCandidates.length === 0) {
                    const hasPending = candidates.some((row) => String(row?.status || '').toUpperCase() === 'PENDING');
                    setError(hasPending
                        ? 'คำขอลงทะเบียนของคุณกำลังรอแอดมินอนุมัติ ยังไม่สามารถเข้าเรียนได้'
                        : 'คุณยังไม่ได้รับสิทธิ์เข้าเรียนคอร์สนี้');
                    return;
                }

                const selectedEnrollment = [...allowedCandidates].sort((a, b) => {
                    const bTime = toTimestamp(b?.enrolledAt || b?.updatedAt || b?.lastActivityAt || 0);
                    const aTime = toTimestamp(a?.enrolledAt || a?.updatedAt || a?.lastActivityAt || 0);
                    if (bTime !== aTime) return bTime - aTime;
                    return Number(b?.id || 0) - Number(a?.id || 0);
                })[0] || null;
                if (!selectedEnrollment) {
                    setError('Enrollment not found');
                    return;
                }

                const courseAccess = evaluateCourseLearnAccess(selectedEnrollment?.course);
                if (!courseAccess.allowed) {
                    setError(getLearningAccessMessage(courseAccess.reason));
                    return;
                }

                setEnrollmentId(selectedEnrollment.id || null);
                setCourse(selectedEnrollment.course || null);

                const availableSections = Array.isArray(selectedEnrollment?.course?.sections)
                    ? selectedEnrollment.course.sections
                    : [];
                const normalizedSelectedSection = selectedEnrollment?.section || null;
                const mergeSectionWithNormalizedAsset = (candidateSection) => {
                    if (!candidateSection) return candidateSection;
                    if (candidateSection?.asset) return candidateSection;
                    if (!normalizedSelectedSection?.asset) return candidateSection;
                    const sameSection = Number(candidateSection?.id || 0) === Number(normalizedSelectedSection?.id || 0);
                    const candidateHasNoMedia = !String(candidateSection?.assetId || '').trim();
                    if (!sameSection && !candidateHasNoMedia) return candidateSection;
                    return {
                        ...candidateSection,
                        sectionType: normalizedSelectedSection?.sectionType || candidateSection?.sectionType,
                        asset: normalizedSelectedSection.asset,
                    };
                };

                let section = normalizedSelectedSection || null;
                if (normalizedSelectedSection) {
                    const assignedSectionAccess = evaluateSectionLearnAccess(normalizedSelectedSection);
                    if (!assignedSectionAccess.allowed) {
                        setError(getLearningAccessMessage(assignedSectionAccess.reason));
                        return;
                    }
                }
                if (requestedSectionId) {
                    const matchedSection = availableSections.find(
                        (candidate) => Number(candidate?.id || 0) === requestedSectionId
                    );
                    if (matchedSection) {
                        section = mergeSectionWithNormalizedAsset(matchedSection);
                    }
                }
                if (!section && availableSections.length > 0) {
                    const preferred = availableSections.find((candidate) => candidate?.isActive) || availableSections[0];
                    section = mergeSectionWithNormalizedAsset(preferred);
                }

                const sectionAccess = evaluateSectionLearnAccess(section);
                if (!sectionAccess.allowed) {
                    setError(getLearningAccessMessage(sectionAccess.reason));
                    return;
                }

                let asset = section?.asset || null;
                let metadata = (asset?.metadataJson && typeof asset.metadataJson === 'object') ? asset.metadataJson : {};
                let entryPoint = String(asset?.publicUrl || asset?.storagePath || metadata.entryPoint || '').trim();

                // If requested section has no launchable asset, fallback to a section that does.
                if (!entryPoint && Array.isArray(availableSections) && availableSections.length > 0) {
                    const sortedSections = [...availableSections].sort((a, b) => {
                        const assetScoreA = a?.asset ? 1 : 0;
                        const assetScoreB = b?.asset ? 1 : 0;
                        if (assetScoreB !== assetScoreA) return assetScoreB - assetScoreA;
                        const activeScoreA = a?.isActive ? 1 : 0;
                        const activeScoreB = b?.isActive ? 1 : 0;
                        if (activeScoreB !== activeScoreA) return activeScoreB - activeScoreA;
                        const orderA = Number(a?.orderNo || 0);
                        const orderB = Number(b?.orderNo || 0);
                        if (orderA !== orderB) return orderA - orderB;
                        return Number(a?.id || 0) - Number(b?.id || 0);
                    });

                    for (const candidate of sortedSections) {
                        const mergedCandidate = mergeSectionWithNormalizedAsset(candidate);
                        const candidateAsset = mergedCandidate?.asset || null;
                        const candidateMetadata =
                            (candidateAsset?.metadataJson && typeof candidateAsset.metadataJson === 'object')
                                ? candidateAsset.metadataJson
                                : {};
                        const candidateEntryPoint = String(
                            candidateAsset?.publicUrl || candidateAsset?.storagePath || candidateMetadata.entryPoint || ''
                        ).trim();
                        if (!candidateEntryPoint) continue;

                        section = mergedCandidate;
                        asset = candidateAsset;
                        metadata = candidateMetadata;
                        entryPoint = candidateEntryPoint;
                        break;
                    }
                }

                const fallbackTinCanId = String(selectedEnrollment?.course?.tincanId || '').trim();
                if (!entryPoint && fallbackTinCanId) {
                    const fallbackCandidate = `/content/${fallbackTinCanId}`;
                    try {
                        const res = await fetch(`/api/content/resolve?src=${encodeURIComponent(fallbackCandidate)}`, {
                            cache: 'no-store',
                        });
                        const data = await res.json().catch(() => null);
                        entryPoint = String(data?.resolvedSrc || fallbackCandidate).trim();
                    } catch {
                        entryPoint = fallbackCandidate;
                    }
                }

                if (!entryPoint) {
                    setError('คอร์สนี้ยังไม่มีไฟล์เนื้อหาที่ใช้งานได้');
                    return;
                }

                const resolvedSectionId = Number(section?.id || selectedEnrollment?.sectionId || 0);
                setActiveSectionId(Number.isInteger(resolvedSectionId) && resolvedSectionId > 0 ? resolvedSectionId : null);
                setCohortModuleEnabled(Boolean(section?.cohortModule || normalizedSelectedSection?.cohortModule));

                const sectionType = String(section?.sectionType || '').toUpperCase();
                const metadataType = String(metadata?.type || '').toLowerCase();
                const hasActivities = Array.isArray(metadata?.activities) && metadata.activities.length > 0;
                const isVideoByPath = /\.(mp4|webm|ogg|mov)(?:[?#].*)?$/i.test(entryPoint);
                const isHtmlByPath = /\.x?html?(?:[?#].*)?$/i.test(entryPoint);

                let type = metadataType
                    || (sectionType === 'VIDEO' ? 'video' : sectionType === 'TINCAN' ? 'tincan' : (isVideoByPath ? 'video' : 'web'));

                // Guard legacy/misconfigured metadata: HTML/TinCan payload should not render in <video>.
                if (type === 'video' && isHtmlByPath) {
                    type = hasActivities || sectionType === 'TINCAN' ? 'tincan' : 'web';
                }
                // If activities are present, treat content as TinCan regardless of generic "web" tag.
                if (type === 'web' && hasActivities) {
                    type = 'tincan';
                }

                setContent(normalizeTinCanActivities({
                    id: metadata?.contentId || selectedEnrollment?.course?.tincanId || `course-${selectedEnrollment.courseId}-section-${selectedEnrollment.sectionId || 'default'}`,
                    title: section?.title || selectedEnrollment?.course?.name || selectedEnrollment?.course?.title || 'Learning Content',
                    type,
                    entryPoint,
                    activities: Array.isArray(metadata?.activities) ? metadata.activities : [],
                    completionPolicy: metadata?.completionPolicy || null,
                    packageConfig: metadata?.packageConfig || null,
                    uploadedAt: asset?.uploadedAt || selectedEnrollment?.course?.createdAt || new Date().toISOString(),
                }));
            } catch {
                setError('Failed to load content');
            } finally {
                setLoading(false);
            }
        };
        loadContent();
    }, [routeId, requestedSectionId]);

    // Load progress
    useEffect(() => {
        const loadProgress = async () => {
            let selectedUserId = canonicalProgressUserId || 'anonymous';
            let selectedEntry = null;

            const uniqueCandidates = Array.from(new Set(progressUserCandidates));
            const rowsByCandidate = new Map();
            for (const candidate of uniqueCandidates) {
                const progressData = await getProgress(progressContentId, candidate, effectiveSectionId);
                if (Array.isArray(progressData) && progressData.length > 0) {
                    rowsByCandidate.set(candidate, progressData.map((row) => ({ ...row, __candidateUserId: candidate })));
                }
            }

            const pickLatest = (rows) => {
                if (!Array.isArray(rows) || rows.length === 0) return null;
                const isTinCanContent = String(content?.type || '').toLowerCase() === 'tincan';
                const sorted = [...rows].sort((a, b) => {
                    const rank = (value) => {
                        const key = String(value || '').toUpperCase();
                        if (key === 'COMPLETED') return 2;
                        if (key === 'LEARNING' || key === 'IN_PROGRESS') return 1;
                        return 0;
                    };
                    if (isTinCanContent) {
                        // For TinCan resume, prefer the furthest reached chapter first.
                        // This avoids old COMPLETED rows (often chapter 1 from legacy data)
                        // overriding newer in-progress position.
                        const ca = Number(a.currentTime || 0);
                        const cb = Number(b.currentTime || 0);
                        if (cb !== ca) return cb - ca;

                        const ta = new Date(a.updatedAt || 0).getTime();
                        const tb = new Date(b.updatedAt || 0).getTime();
                        if (tb !== ta) return tb - ta;

                        const pa = Number(a.progress || 0);
                        const pb = Number(b.progress || 0);
                        if (pb !== pa) return pb - pa;

                        const ra = rank(a.status);
                        const rb = rank(b.status);
                        if (rb !== ra) return rb - ra;

                        return Number(b.id || 0) - Number(a.id || 0);
                    }
                    const ra = rank(a.status);
                    const rb = rank(b.status);
                    if (rb !== ra) return rb - ra;

                    const pa = Number(a.progress || 0);
                    const pb = Number(b.progress || 0);
                    if (pb !== pa) return pb - pa;

                    const ca = Number(a.currentTime || 0);
                    const cb = Number(b.currentTime || 0);
                    if (cb !== ca) return cb - ca;

                    const ta = new Date(a.updatedAt || 0).getTime();
                    const tb = new Date(b.updatedAt || 0).getTime();
                    return tb - ta;
                });
                return sorted[0];
            };

            // Priority: use current logged-in user progress first, then fallback candidates.
            const canonicalEntry = pickLatest(rowsByCandidate.get(canonicalProgressUserId));
            if (canonicalEntry) {
                selectedEntry = canonicalEntry;
                selectedUserId = canonicalProgressUserId;
            } else {
                const fallbackOrder = uniqueCandidates.filter((c) => c !== canonicalProgressUserId);
                for (const candidate of fallbackOrder) {
                    const candidateEntry = pickLatest(rowsByCandidate.get(candidate));
                    if (candidateEntry) {
                        selectedEntry = candidateEntry;
                        selectedUserId = candidateEntry.userId || candidateEntry.__candidateUserId || selectedUserId;
                        break;
                    }
                }
            }

            if (selectedEntry) {
                selectedUserId = selectedEntry.userId || selectedEntry.__candidateUserId || selectedUserId;
            }

            if (selectedEntry) {
                const selectedStatus = String(selectedEntry.status || 'NOT_STARTED').toUpperCase();
                const selectedDuration = Number(selectedEntry.duration || 0);
                const selectedCurrent = Number(selectedEntry.currentTime || 0);
                const selectedSuccess = selectedEntry?.success;
                const selectedTrackedStudySeconds = Number(selectedEntry.scoreRaw || 0);
                if (Number.isFinite(selectedTrackedStudySeconds) && selectedTrackedStudySeconds > 0) {
                    trackedStudySecondsRef.current = Math.max(
                        Number(trackedStudySecondsRef.current || 0),
                        selectedTrackedStudySeconds
                    );
                }
                const savedWebIdx = content?.type === 'web' ? readWebResumeIndex() : null;
                const mergedCurrent = content?.type === 'web'
                    ? Math.max(
                        selectedCurrent,
                        Number.isFinite(savedWebIdx) && savedWebIdx >= 0 ? (Math.floor(savedWebIdx) + 1) : 0
                    )
                    : selectedCurrent;
                const mergedDuration = content?.type === 'web'
                    ? Math.max(
                        selectedDuration,
                        Number.isFinite(savedWebIdx) && savedWebIdx >= 0 ? (Math.floor(savedWebIdx) + 1) : 0
                    )
                    : selectedDuration;
                const requiresPassVerification = content?.type === 'tincan' && requireAssessmentPass;
                const completedNeedsVerification =
                    selectedStatus === 'COMPLETED' &&
                    requiresPassVerification &&
                    selectedSuccess !== true;
                const restoredStatus = completedNeedsVerification ? 'LEARNING' : selectedStatus;
                const sanitizedProgress = restoredStatus === 'COMPLETED'
                    ? 100
                    : computeTinCanProgress(mergedCurrent || 1, mergedDuration || (content?.activities?.length || 1), false);
                setProgress(sanitizedProgress);
                setStatus(restoredStatus);
                completionLockRef.current = restoredStatus === 'COMPLETED';
                setCurrentTime(mergedCurrent || 0);
                setDuration(mergedDuration || 0);
                restoreTincanPositionFromProgress(selectedEntry);
                if (content?.type === 'web' && Number.isFinite(savedWebIdx) && savedWebIdx >= 0) {
                    persistWebResumeIndex(savedWebIdx);
                }

                // Normalize to canonical user key to avoid future mismatched resume records.
                if (canonicalProgressUserId && selectedUserId !== canonicalProgressUserId) {
                    await syncProgressWithTrackedTime({
                        contentId: progressContentId,
                        userId: canonicalProgressUserId,
                        sectionId: activeSectionId,
                        status: restoredStatus,
                        progress: sanitizedProgress,
                        currentTime: mergedCurrent || 0,
                        duration: mergedDuration || 0,
                    });
                    selectedUserId = canonicalProgressUserId;
                }
                if (completedNeedsVerification) {
                    await syncEnrollmentStatus('LEARNING', sanitizedProgress);
                }
            }

            if (!selectedEntry && content?.type === 'tincan') {
                const savedIdx = readTincanResumeIndex();
                if (Number.isFinite(savedIdx) && savedIdx >= 0) {
                    const total = Math.max(1, Number(content?.activities?.length || 0));
                    const safeIdx = Math.max(0, Math.min(total - 1, Math.floor(savedIdx)));
                    setSelectedActivityIndex(safeIdx);
                    setCurrentTime(safeIdx + 1);
                    setProgress(computeTinCanProgress(safeIdx + 1, total, false));
                    setStatus('LEARNING');
                }
            }
            if (!selectedEntry && content?.type === 'web') {
                const savedIdx = readWebResumeIndex();
                if (Number.isFinite(savedIdx) && savedIdx >= 0) {
                    const safeIdx = Math.max(0, Math.floor(savedIdx));
                    const total = Math.max(1, safeIdx + 1);
                    setCurrentTime(safeIdx + 1);
                    setDuration(total);
                    setProgress(computeTinCanProgress(safeIdx + 1, total, false));
                    setStatus('LEARNING');
                }
            }

            setProgressUserId(selectedUserId);
            setResumeLoaded(true);
        };
        if (content && progressContentId && progressUserCandidates.length > 0) {
            loadProgress();
        }
    }, [content, progressContentId, progressUserCandidates, restoreTincanPositionFromProgress, canonicalProgressUserId, computeTinCanProgress, readTincanResumeIndex, readWebResumeIndex, persistWebResumeIndex, effectiveSectionId, syncProgressWithTrackedTime, syncEnrollmentStatus, requireAssessmentPass]);

    // Load xAPI statements for this content
    useEffect(() => {
        const loadStatements = async () => {
            try {
                const res = await fetch(`/api/xapi/statements?contentId=${resolvedContentId}&actor=${encodeURIComponent(learningUserId)}&limit=20`);
                if (res.ok) {
                    const data = await res.json();
                    setStatements(data);
                }
            } catch { /* ignore */ }
        };
        if (resolvedContentId && learningUserId) loadStatements();
    }, [resolvedContentId, learningUserId]);

    // Send initialized statement once per learning entry session.
    useEffect(() => {
        if (!content || !resumeLoaded) return;

        const sessionKey = `${String(content?.id || routeId || '')}:${Number(activeSectionId || 0)}:${Number(enrollmentId || 0)}`;
        if (initializedStatementGateRef.current === sessionKey) return;
        initializedStatementGateRef.current = sessionKey;

        sendStatement(buildVideoEventStatement({
            actor,
            contentId: content.id,
            contentName: content.title,
            verb: 'initialized',
            currentTime: 0,
            duration: 0,
        }));

        if (status === 'NOT_STARTED') {
            setStatus('LEARNING');
            syncProgressWithTrackedTime({ contentId: progressContentId, userId: progressUserId, sectionId: activeSectionId, status: 'LEARNING', progress: 0 });
            syncEnrollmentStatus('LEARNING', 0);
        }
    }, [content, status, actor, progressContentId, progressUserId, activeSectionId, syncEnrollmentStatus, resumeLoaded, syncProgressWithTrackedTime, routeId, enrollmentId]);

    // Ensure each selected TinCan lesson emits at least one lesson-level statement
    // so report can separate rows by lesson even if package script is quiet.
    useEffect(() => {
        if (!isLaunchMode || content?.type !== 'tincan' || !resumeLoaded) return;
        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (activities.length === 0) return;
        const detectedIdx = detectActivityIndexFromIframe();
        const safeIndex = Math.max(
            0,
            Math.min(
                activities.length - 1,
                Number.isFinite(Number(detectedIdx)) && detectedIdx >= 0
                    ? Math.floor(Number(detectedIdx))
                    : Number(selectedActivityIndex) || 0
            )
        );
        const lesson = activities[safeIndex];
        if (!lesson) return;

        const lessonId = String(
            getPrimaryActivityResumePath(lesson)
            || lesson?.activityId
            || lesson?.id
            || `lesson-${safeIndex + 1}`
        ).trim();
        const lessonName = String(lesson?.name || lesson?.title || `Lesson ${safeIndex + 1}`).trim();
        const gateKey = `${String(content?.id || routeId || '')}:${Number(enrollmentId || 0)}:${Number(activeSectionId || 0)}:${safeIndex}:${lessonId}`;
        if (lessonEntryStatementGateRef.current === gateKey) return;
        lessonEntryStatementGateRef.current = gateKey;

        const statement = buildVideoEventStatement({
            actor,
            contentId: content.id,
            contentName: lessonName || content.title,
            verb: 'experienced',
            currentTime: safeIndex + 1,
            duration: activities.length,
        });
        statement.object = {
            ...(statement.object || {}),
            definition: {
                ...(statement.object?.definition || {}),
                name: {
                    ...(statement.object?.definition?.name || {}),
                    'en-US': lessonName || content.title,
                },
            },
        };
        statement.context = {
            ...(statement.context || {}),
            extensions: {
                ...(statement.context?.extensions || {}),
                [`${xapiExtensionNamespace}/activity-id`]: lessonId,
                [`${xapiExtensionNamespace}/activity-name`]: lessonName,
                [`${xapiExtensionNamespace}/activity-index`]: Number(safeIndex + 1),
                [`${xapiExtensionNamespace}/section-id`]: Number(activeSectionId || 0),
                [xapiSkipProgressSyncKey]: true,
            },
        };
        sendStatement(statement);
    }, [isLaunchMode, content, resumeLoaded, selectedActivityIndex, getPrimaryActivityResumePath, actor, routeId, enrollmentId, activeSectionId, xapiExtensionNamespace, xapiSkipProgressSyncKey, detectActivityIndexFromIframe]);

    // Video event handlers
    const handlePlay = useCallback(() => {
        if (!content) return;
        sendStatement(buildVideoEventStatement({
            actor, contentId: content.id, contentName: content.title,
            verb: 'played', currentTime: videoRef.current?.currentTime || 0, duration: videoRef.current?.duration || 0,
        }));
    }, [content, actor]);

    const handlePause = useCallback(() => {
        if (!content) return;
        sendStatement(buildVideoEventStatement({
            actor, contentId: content.id, contentName: content.title,
            verb: 'paused', currentTime: videoRef.current?.currentTime || 0, duration: videoRef.current?.duration || 0,
        }));
    }, [content, actor]);

    const handleTimeUpdate = useCallback(() => {
        if (!content || !videoRef.current) return;
        const video = videoRef.current;
        const ct = video.currentTime;
        const dur = video.duration || 1;
        const prog = Math.round((ct / dur) * 100);

        setCurrentTime(ct);
        setDuration(dur);
        setProgress(prog);

        // Send progress statement every 10 seconds
        if (ct - lastSentTimeRef.current >= 10) {
            lastSentTimeRef.current = ct;
            sendStatement(buildVideoProgressStatement({
                actor, contentId: content.id, contentName: content.title,
                currentTime: ct, duration: dur,
            }));
            syncProgressWithTrackedTime({
                contentId: progressContentId, userId: progressUserId, sectionId: activeSectionId,
                status: 'LEARNING', progress: prog, currentTime: ct, duration: dur,
            });
            syncEnrollmentStatus('LEARNING', prog);
        }
    }, [content, actor, progressContentId, progressUserId, activeSectionId, syncEnrollmentStatus, syncProgressWithTrackedTime]);

    const handleEnded = useCallback(() => {
        if (!content) return;
        sendStatement(buildCompletionStatement({
            actor, contentId: content.id, contentName: content.title,
            duration: videoRef.current?.duration || 0,
        }));
        setStatus('COMPLETED');
        setProgress(100);
        syncProgressWithTrackedTime({
            contentId: progressContentId, userId: progressUserId, sectionId: activeSectionId,
            status: 'COMPLETED', progress: 100, currentTime: videoRef.current?.duration || 0, duration: videoRef.current?.duration || 0,
        });
        syncEnrollmentStatus('COMPLETED', 100);
    }, [content, actor, progressContentId, progressUserId, activeSectionId, syncEnrollmentStatus, syncProgressWithTrackedTime]);

    // Receive xAPI statements emitted from TinCan content inside iframe via postMessage.
    useEffect(() => {
        if (!content || content.type !== 'tincan') return;

        const onMessage = async (event) => {
            if (event.origin !== window.location.origin) return;

            let payload = event?.data;
            if (!payload) return;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch {
                    return;
                }
            }

            const type = payload?.type || payload?.event || '';
            const normalizedType = String(type || '').toLowerCase();
            if (normalizedType === 'lms-assessment-result') {
                const activities = Array.isArray(content?.activities) ? content.activities : [];
                if (activities.length === 0 || !progressContentId || !progressUserId) return;

                const runtimePage = Number(payload?.runtimePage);
                const mappedRuntimeIndex = Number.isFinite(runtimePage)
                    ? mapRuntimePageToActivityIndex(Math.floor(runtimePage))
                    : -1;
                const detectedIndex = detectActivityIndexFromIframe();
                const selectedIndex = Number.isFinite(Number(selectedActivityIndex))
                    ? Math.floor(Number(selectedActivityIndex))
                    : -1;
                const lastAssessmentIndex = activities.reduce((last, activity, idx) => (
                    isAssessmentActivity(activity) ? idx : last
                ), -1);
                const rawIndex =
                    mappedRuntimeIndex >= 0 ? mappedRuntimeIndex
                        : detectedIndex >= 0 ? detectedIndex
                            : selectedIndex >= 0 ? selectedIndex
                                : lastAssessmentIndex >= 0 ? lastAssessmentIndex
                                    : activities.length - 1;
                const safeIndex = Math.max(0, Math.min(activities.length - 1, Math.floor(rawIndex)));
                const activity = activities[safeIndex];
                const percent = asFiniteNumber(payload?.percent);
                const passScore = getAssessmentPassingScore(activity);
                const passed = payload?.passed === true || (percent !== null && percent >= passScore);
                if (!passed) return;
                const isTerminalAssessmentResult =
                    lastAssessmentIndex >= 0
                        ? safeIndex === lastAssessmentIndex
                        : safeIndex >= activities.length - 1;

                const previousStatuses = Array.isArray(tinCanActivityStatusRef.current)
                    ? tinCanActivityStatusRef.current
                    : [];
                const nextActivityStatuses = Array.from({ length: activities.length }, (_, idx) => ({
                    attempted: Boolean(previousStatuses?.[idx]?.attempted),
                    completed: Boolean(previousStatuses?.[idx]?.completed),
                    passed: Boolean(previousStatuses?.[idx]?.passed),
                    quizzed: Boolean(previousStatuses?.[idx]?.quizzed),
                    status: String(previousStatuses?.[idx]?.status || ''),
                    success: typeof previousStatuses?.[idx]?.success === 'boolean' ? previousStatuses[idx].success : null,
                    completion: typeof previousStatuses?.[idx]?.completion === 'boolean' ? previousStatuses[idx].completion : null,
                    scoreRaw: asFiniteNumber(previousStatuses?.[idx]?.scoreRaw),
                    scoreScaled: asFiniteNumber(previousStatuses?.[idx]?.scoreScaled),
                    scoreMax: asFiniteNumber(previousStatuses?.[idx]?.scoreMax),
                }));

                nextActivityStatuses[safeIndex] = {
                    ...nextActivityStatuses[safeIndex],
                    attempted: true,
                    completed: true,
                    passed: true,
                    quizzed: true,
                    status: 'passed',
                    success: true,
                    completion: true,
                    scoreRaw: percent ?? asFiniteNumber(nextActivityStatuses[safeIndex]?.scoreRaw),
                    scoreScaled: percent !== null ? percent / 100 : asFiniteNumber(nextActivityStatuses[safeIndex]?.scoreScaled),
                    scoreMax: percent !== null ? 100 : asFiniteNumber(nextActivityStatuses[safeIndex]?.scoreMax),
                };

                const sig = JSON.stringify(nextActivityStatuses);
                tinCanActivityStatusRef.current = nextActivityStatuses;
                if (sig !== lastTinCanStatusSigRef.current) {
                    lastTinCanStatusSigRef.current = sig;
                    setTinCanActivityStatus(nextActivityStatuses);
                }

                resumeGuardUntilRef.current = 0;
                completionLockRef.current = true;
                highestSeenActivityIndexRef.current = Math.max(Number(highestSeenActivityIndexRef.current || 0), safeIndex);
                setSelectedActivityIndex(safeIndex);
                setCurrentTime(safeIndex + 1);
                setDuration(activities.length);
                setStatus('COMPLETED');
                setProgress(100);
                persistTincanResumeIndex(safeIndex);
                const activityPath = getPrimaryActivityResumePath(activity);
                persistTincanResumePath(activityPath || activity?.activityId || activity?.id || '');

                if (!isTerminalAssessmentResult) {
                    return;
                }

                await syncProgressWithTrackedTime({
                    contentId: progressContentId,
                    userId: progressUserId,
                    sectionId: activeSectionId,
                    status: 'COMPLETED',
                    progress: 100,
                    currentTime: safeIndex + 1,
                    duration: activities.length,
                    scoreRaw: percent ?? undefined,
                    scoreScaled: percent !== null ? percent / 100 : undefined,
                    success: true,
                    completion: true,
                });
                await syncEnrollmentStatus('COMPLETED', 100);
                return;
            }
            if (type && !['xapi', 'xapi-statement', 'statement'].includes(String(type).toLowerCase())) {
                return;
            }

            if (!payload) return;

            const incoming = payload.statement || payload.data || payload;
            if (!incoming?.verb || !incoming?.object) return;

            const incomingContextExtensions =
                incoming?.context?.extensions && typeof incoming.context.extensions === 'object'
                    ? incoming.context.extensions
                    : {};
            const incomingResultExtensions =
                incoming?.result?.extensions && typeof incoming.result.extensions === 'object'
                    ? incoming.result.extensions
                    : {};
            const incomingResultSnapshot = parseXapiResultSnapshot(incoming?.result || {}, {
                extensions: {
                    ...(incomingContextExtensions || {}),
                    ...(incomingResultExtensions || {}),
                },
            });
            const readIncomingExtensionBySuffix = (suffix) => {
                for (const source of [incomingContextExtensions, incomingResultExtensions]) {
                    for (const [key, value] of Object.entries(source || {})) {
                        if (!String(key || '').endsWith(suffix)) continue;
                        if (value === undefined || value === null) continue;
                        const normalized = String(value).trim();
                        if (normalized) return normalized;
                    }
                }
                return '';
            };

            // Prefer the iframe's real current lesson before trusting package-emitted IDs.
            let matchedActivityIndex = detectActivityIndexFromIframe();
            const incomingTaggedActivityIndex = readIncomingExtensionBySuffix('/activity-index');
            if (matchedActivityIndex < 0) {
                const parsedIncomingIndex = Number(incomingTaggedActivityIndex);
                if (Number.isFinite(parsedIncomingIndex)) {
                    const zeroBasedIncomingIndex = parsedIncomingIndex > 0
                        ? Math.floor(parsedIncomingIndex - 1)
                        : Math.floor(parsedIncomingIndex);
                    if (
                        Array.isArray(content.activities)
                        && zeroBasedIncomingIndex >= 0
                        && zeroBasedIncomingIndex < content.activities.length
                    ) {
                        matchedActivityIndex = zeroBasedIncomingIndex;
                    }
                }
            }
            const incomingObjectId = String(incoming.object?.id || '').trim();
            const incomingObjectKey = normalizeActivityPathKey(incomingObjectId);
            if (matchedActivityIndex < 0 && incomingObjectKey && Array.isArray(content.activities)) {
                matchedActivityIndex = findUniqueActivityIndexByPathKey(incomingObjectKey, { allowLoose: false });
                if (matchedActivityIndex < 0) {
                    matchedActivityIndex = findUniqueActivityIndexByPathKey(incomingObjectKey, { allowLoose: true });
                }
            }
            const matchedActivity =
                Array.isArray(content?.activities) && matchedActivityIndex >= 0 && matchedActivityIndex < content.activities.length
                    ? content.activities[matchedActivityIndex]
                    : null;
            const matchedActivityId = String(
                getPrimaryActivityResumePath(matchedActivity)
                || incomingObjectId
                || matchedActivity?.activityId
                || matchedActivity?.id
                || ''
            ).trim();
            const matchedActivityName = String(
                matchedActivity?.name
                || matchedActivity?.title
                || incoming?.object?.definition?.name?.['en-US']
                || content?.title
                || ''
            ).trim();

            // Force statement ownership to current user + current content.
            // Some TinCan packages send external actor/object IDs that do not map to our DB keys.
            const statement = {
                ...incoming,
                actor: {
                    mbox: `mailto:${actor.email}`,
                    name: actor.name,
                    objectType: 'Agent',
                },
                object: {
                    ...(incoming.object || {}),
                    id: `${xapiContentBase}/${content.id}`,
                    objectType: incoming.object?.objectType || 'Activity',
                    definition: {
                        ...(incoming.object?.definition || {}),
                        name: {
                            ...(incoming.object?.definition?.name || {}),
                            'en-US': matchedActivityName || incoming.object?.definition?.name?.['en-US'] || content.title,
                        },
                    },
                },
                context: {
                    ...(incoming.context || {}),
                    extensions: {
                        ...(incoming.context?.extensions || {}),
                        [`${xapiExtensionNamespace}/original-actor-mbox`]: incoming.actor?.mbox || '',
                        [`${xapiExtensionNamespace}/original-object-id`]: incoming.object?.id || '',
                        [`${xapiExtensionNamespace}/activity-id`]: matchedActivityId,
                        [`${xapiExtensionNamespace}/activity-name`]: matchedActivityName,
                        [`${xapiExtensionNamespace}/activity-index`]: matchedActivityIndex >= 0 ? Number(matchedActivityIndex + 1) : null,
                        [`${xapiExtensionNamespace}/section-id`]: Number(activeSectionId || 0),
                        // Chapter resume is synced by LearnPage logic...
                        [xapiSkipProgressSyncKey]: true,
                    },
                },
            };

            const result = await sendStatement(statement);
            if (result?.success) {
                const completedByVerbSignal =
                    isCompletedVerb(incoming?.verb) ||
                    incomingResultSnapshot?.completion === true;
                let shouldRefreshProgressFromServer = completedByVerbSignal;

                if (matchedActivityIndex >= 0) {
                    const manualTarget = Number(manualSelectionRef.current?.target);
                    const manualUntil = Number(manualSelectionRef.current?.until || 0);
                    const manualActive = Number.isFinite(manualTarget) && Date.now() < manualUntil;
                    if (manualActive && matchedActivityIndex !== manualTarget) {
                        return;
                    }
                    const total = Array.isArray(content?.activities) ? content.activities.length : 0;
                    if (total <= 0 || matchedActivityIndex < 0 || matchedActivityIndex >= total) {
                        return;
                    }

                    const previousStatuses = Array.isArray(tinCanActivityStatusRef.current) && tinCanActivityStatusRef.current.length === total
                        ? tinCanActivityStatusRef.current
                        : [];
                    const nextActivityStatuses = previousStatuses.length === total
                        ? [...previousStatuses]
                        : Array.from({ length: total }, (_, index) => ({
                            attempted: Boolean(previousStatuses?.[index]?.attempted),
                            completed: Boolean(previousStatuses?.[index]?.completed),
                            passed: Boolean(previousStatuses?.[index]?.passed),
                            quizzed: Boolean(previousStatuses?.[index]?.quizzed),
                            status: String(previousStatuses?.[index]?.status || ''),
                            success: typeof previousStatuses?.[index]?.success === 'boolean' ? previousStatuses[index].success : null,
                            completion: typeof previousStatuses?.[index]?.completion === 'boolean' ? previousStatuses[index].completion : null,
                            scoreRaw: asFiniteNumber(previousStatuses?.[index]?.scoreRaw),
                            scoreScaled: asFiniteNumber(previousStatuses?.[index]?.scoreScaled),
                            scoreMax: asFiniteNumber(previousStatuses?.[index]?.scoreMax),
                        }));

                    const current = nextActivityStatuses[matchedActivityIndex] || {};
                    const verbId = String(incoming?.verb?.id || '').toLowerCase();
                    const verbLabel = String(incoming?.verb?.display?.['en-US'] || incoming?.verb?.display?.en || '').toLowerCase();
                    const incomingRaw = asFiniteNumber(incomingResultSnapshot?.raw);
                    const incomingScaled = asFiniteNumber(incomingResultSnapshot?.scaled);
                    const incomingMax = asFiniteNumber(incomingResultSnapshot?.max);
                    const matchedActivity = content?.activities?.[matchedActivityIndex];
                    const passingScore = getAssessmentPassingScore(matchedActivity);
                    const normalizedIncomingRaw =
                        incomingRaw !== null
                            ? (incomingRaw <= 1 ? incomingRaw * 100 : incomingRaw)
                            : null;
                    const normalizedIncomingScaled =
                        incomingScaled !== null
                            ? (incomingScaled <= 1 ? incomingScaled * 100 : incomingScaled)
                            : null;
                    const normalizedIncomingRawMax =
                        incomingRaw !== null && incomingMax !== null && incomingMax > 0
                            ? (incomingRaw / incomingMax) * 100
                            : null;
                    const incomingHasPassingScore =
                        (normalizedIncomingRaw !== null && normalizedIncomingRaw >= passingScore) ||
                        (normalizedIncomingScaled !== null && normalizedIncomingScaled >= passingScore) ||
                        (normalizedIncomingRawMax !== null && normalizedIncomingRawMax >= passingScore);
                    const matchedIsAssessment = isAssessmentActivity(matchedActivity);
                    const markedPass = matchedIsAssessment
                        ? Boolean(
                            verbId.includes('pass')
                            || verbLabel.includes('pass')
                            || verbLabel.includes('ผ่าน')
                            || incomingHasPassingScore
                            || incomingResultSnapshot?.success === true
                            || incomingResultSnapshot?.passed === true
                        )
                        : Boolean(
                            incomingResultSnapshot?.success === true
                            || verbId.includes('pass')
                            || verbLabel.includes('pass')
                            || verbLabel.includes('ผ่าน')
                            || incomingHasPassingScore
                        );
                    const markedComplete = Boolean(
                        incomingResultSnapshot?.completion === true
                        || isCompletedVerb(incoming?.verb)
                        || (matchedIsAssessment && markedPass)
                    );
                    const currentStatusText = normalizeStatusText(
                        current?.status
                        ?? current?.result
                        ?? current?.completionStatus
                        ?? current?.successStatus
                        ?? ''
                    );
                    const currentHasFailSignal = hasFailureStatusSignal(currentStatusText);
                    const normalizedCurrentSuccess = typeof current?.success === 'boolean'
                        ? (current.success === false && !currentHasFailSignal ? null : current.success)
                        : null;
                    const normalizedCurrentCompletion = typeof current?.completion === 'boolean'
                        ? (current.completion === false && !currentHasFailSignal ? null : current.completion)
                        : null;

                    nextActivityStatuses[matchedActivityIndex] = {
                        attempted: true,
                        completed: Boolean(current?.completed) || markedComplete,
                        passed: Boolean(current?.passed) || markedPass,
                        quizzed: Boolean(current?.quizzed) || /quiz|test|exam|assessment|แบบทดสอบ|ทดสอบ/i.test(
                            String(
                                content?.activities?.[matchedActivityIndex]?.name
                                || content?.activities?.[matchedActivityIndex]?.title
                                || ''
                            )
                        ),
                        status: String(current?.status || ''),
                        success: typeof incomingResultSnapshot?.success === 'boolean'
                            ? incomingResultSnapshot.success
                            : (markedPass ? true : normalizedCurrentSuccess),
                        completion: typeof incomingResultSnapshot?.completion === 'boolean'
                            ? incomingResultSnapshot.completion
                            : (markedComplete ? true : normalizedCurrentCompletion),
                        scoreRaw: asFiniteNumber(incomingResultSnapshot?.raw) ?? asFiniteNumber(current?.scoreRaw),
                        scoreScaled: asFiniteNumber(incomingResultSnapshot?.scaled) ?? asFiniteNumber(current?.scoreScaled),
                        scoreMax: asFiniteNumber(incomingResultSnapshot?.max) ?? asFiniteNumber(current?.scoreMax),
                    };

                    const nextActivityStatusesSig = JSON.stringify(nextActivityStatuses);
                    tinCanActivityStatusRef.current = nextActivityStatuses;
                    if (nextActivityStatusesSig !== lastTinCanStatusSigRef.current) {
                        lastTinCanStatusSigRef.current = nextActivityStatusesSig;
                        setTinCanActivityStatus(nextActivityStatuses);
                    }
                    const savedIdx = readTincanResumeIndex();
                    const savedKnownIndex = Number.isFinite(savedIdx) && savedIdx >= 0 ? Math.floor(savedIdx) : -1;
                    const currentKnownIndex =
                        Number.isFinite(currentTime) && Number(currentTime) > 0
                            ? Math.max(0, Math.floor(Number(currentTime) - 1))
                            : -1;
                    const lastKnownIndex =
                        Number.isFinite(Number(lastTincanSyncRef.current?.position))
                            ? Math.max(0, Math.floor(Number(lastTincanSyncRef.current.position) - 1))
                            : -1;
                    const highestSeenIndex = Number.isFinite(Number(highestSeenActivityIndexRef.current))
                        ? Math.max(0, Math.floor(Number(highestSeenActivityIndexRef.current)))
                        : -1;
                    const knownFloorIndex = Math.max(savedKnownIndex, currentKnownIndex, lastKnownIndex, highestSeenIndex, 0);
                    // Never auto-regress to an earlier lesson from stale/late statements.
                    // Backward jump is only allowed when user explicitly selected a lesson.
                    if (!manualActive && matchedActivityIndex < knownFloorIndex) {
                        return;
                    }
                    setSelectedActivityIndex(matchedActivityIndex);
                    setCurrentTime(matchedActivityIndex + 1);
                    setDuration(total);
                    resumeGuardUntilRef.current = 0;
                    persistTincanResumeIndex(matchedActivityIndex);
                    const matchedPath = getPrimaryActivityResumePath(matchedActivity);
                    persistTincanResumePath(matchedPath || matchedActivity?.activityId || matchedActivity?.id || '');
                    const totalActivities = Math.max(content.activities?.length || 0, 1);
                    const statementProgressRaw =
                        incoming?.result?.extensions?.['https://w3id.org/xapi/video/extensions/progress'] ??
                        incoming?.result?.extensions?.progress ??
                        incoming?.result?.progress;
                    const statementProgress = Number(statementProgressRaw);
                    const completedByProgress =
                        (Number.isFinite(statementProgress) && statementProgress >= 100);
                    const completedByActivities =
                        nextActivityStatuses.length > 0 &&
                        nextActivityStatuses.every((item, idx) => isTinCanLessonPassed(item, content?.activities?.[idx]));
                    const shouldComplete = canFinalizeTinCanCompletion({
                        completedByVerb: completedByVerbSignal,
                        completedByProgress,
                        completedByActivities,
                        activityIndex: matchedActivityIndex,
                        activityStatuses: nextActivityStatuses,
                    });
                    const lockedCompleted = completionLockRef.current && !hasAssessmentFailureSignals;
                    const nextStatus = (shouldComplete || lockedCompleted) ? 'COMPLETED' : 'LEARNING';
                    const nextProgress = nextStatus === 'COMPLETED'
                        ? 100
                        : computeTinCanProgress(matchedActivityIndex + 1, totalActivities, false);
                    const statementScorePayload = {};
                    if (incomingRaw !== null) statementScorePayload.scoreRaw = incomingRaw;
                    if (incomingScaled !== null) statementScorePayload.scoreScaled = incomingScaled;
                    if (typeof incomingResultSnapshot?.success === 'boolean') {
                        statementScorePayload.success = incomingResultSnapshot.success;
                    }
                    if (typeof incomingResultSnapshot?.completion === 'boolean') {
                        statementScorePayload.completion = incomingResultSnapshot.completion;
                    }
                    const statusScorePayload = extractScorePayloadFromStatus(
                        nextActivityStatuses[matchedActivityIndex]
                    );
                    await syncProgressWithTrackedTime({
                        contentId: progressContentId,
                        userId: progressUserId,
                        sectionId: activeSectionId,
                        status: nextStatus,
                        progress: nextProgress,
                        currentTime: matchedActivityIndex + 1,
                        duration: totalActivities,
                        ...statusScorePayload,
                        ...statementScorePayload,
                    });
                    setStatus(nextStatus);
                    setProgress(nextProgress);
                    if (nextStatus === 'COMPLETED') {
                        await syncEnrollmentStatus('COMPLETED', 100);
                    } else {
                        await syncEnrollmentStatus('LEARNING', nextProgress);
                    }
                    shouldRefreshProgressFromServer = shouldRefreshProgressFromServer || shouldComplete || lockedCompleted;
                }

                const progressGate = progressRefreshStateRef.current;
                const now = Date.now();
                const isRefreshDue = now - Number(progressGate.lastAt || 0) >= 15000;
                if ((shouldRefreshProgressFromServer || isRefreshDue) && !progressGate.inFlight) {
                    progressGate.inFlight = true;
                    try {
                        const query = new URLSearchParams({
                            contentId: String(progressContentId || ''),
                            userId: String(progressUserId || ''),
                        });
                        if (Number.isInteger(Number(activeSectionId)) && Number(activeSectionId) > 0) {
                            query.set('sectionId', String(Number(activeSectionId)));
                        }
                        const res = await fetch(`/api/content/progress?${query.toString()}`, { cache: 'no-store' });
                        if (res.ok) {
                            const progressData = await res.json();
                            if (progressData?.length > 0) {
                                const entry = progressData[0];
                                const rawStatus = String(entry?.status || 'NOT_STARTED').toUpperCase();
                                const entryCompletedNeedsVerification =
                                    rawStatus === 'COMPLETED' &&
                                    requireAssessmentPass &&
                                    entry?.success !== true;
                                const normalizedStatus = entryCompletedNeedsVerification ? 'LEARNING' : rawStatus;
                                const entryCurrent = Number(entry?.currentTime || 0);
                                const entryDuration = Number(entry?.duration || 0);
                                const fallbackProgress = computeTinCanProgress(
                                    entryCurrent || 1,
                                    entryDuration || (content?.activities?.length || 1),
                                    false
                                );
                                const normalizedProgress = normalizedStatus === 'COMPLETED'
                                    ? 100
                                    : Math.min(
                                        99,
                                        Math.max(Number(entry?.progress || 0), Number(fallbackProgress || 0))
                                    );
                                setProgress(normalizedProgress);
                                setStatus(normalizedStatus);
                                setCurrentTime(entryCurrent || 0);
                                setDuration(entryDuration || 0);
                                if (normalizedStatus === 'COMPLETED') {
                                    syncEnrollmentStatus('COMPLETED', 100);
                                } else if (normalizedStatus === 'LEARNING') {
                                    syncEnrollmentStatus('LEARNING', normalizedProgress);
                                }
                            }
                        }
                    } catch {
                        // ignore refresh errors; local state already updated
                    } finally {
                        progressGate.inFlight = false;
                        progressGate.lastAt = Date.now();
                    }
                }
            }
        };

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [content, actor, resolvedContentId, progressContentId, progressUserId, activeSectionId, progress, status, syncEnrollmentStatus, persistTincanResumeIndex, persistTincanResumePath, readTincanResumeIndex, selectedActivityIndex, currentTime, computeTinCanProgress, isCompletedVerb, canFinalizeTinCanCompletion, tinCanActivityStatus, isTinCanLessonPassed, resumeLoaded, syncProgressWithTrackedTime, requireAssessmentPass, getAssessmentPassingScore, detectActivityIndexFromIframe, hasAssessmentFailureSignals, isAssessmentActivity, findUniqueActivityIndexByPathKey, getPrimaryActivityResumePath, normalizeActivityPathKey, extractScorePayloadFromStatus, mapRuntimePageToActivityIndex]);

    // Format time
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const notifyLearningRefresh = useCallback(() => {
        try {
            localStorage.setItem('lms_learning_refresh', String(Date.now()));
        } catch {
            // ignore storage write errors
        }
        try {
            const channel = new BroadcastChannel('lms_learning');
            channel.postMessage({ type: 'refresh', at: Date.now() });
            channel.close();
        } catch {
            // ignore BroadcastChannel errors
        }
    }, []);

    const handleCloseLaunch = useCallback(async () => {
        const fallbackUrl = '/my-learning';

        // Capture latest TinCan page at close time to avoid losing resume position.
        try {
            if (content?.type === 'tincan' && Array.isArray(content.activities) && content.activities.length > 0 && progressUserId) {
                const frameWindow = iframeRef.current?.contentWindow;
                let idx = detectActivityIndexFromIframe();
                if (idx < 0) {
                    try {
                        const directIndex = Number(frameWindow?.currentPage);
                        if (Number.isFinite(directIndex) && directIndex >= 0) {
                            idx = mapRuntimePageToActivityIndex(directIndex);
                        } else {
                            const lastSeenIndex = Number(frameWindow?.currentState?.lastSeenIndex);
                            if (Number.isFinite(lastSeenIndex) && lastSeenIndex >= 0) {
                                idx = mapRuntimePageToActivityIndex(lastSeenIndex);
                            }
                        }
                    } catch {
                        idx = -1;
                    }
                }
                if (idx < 0) {
                    const savedIdx = readTincanResumeIndex();
                    if (Number.isFinite(savedIdx) && savedIdx >= 0 && savedIdx < content.activities.length) {
                        idx = Math.floor(savedIdx);
                    }
                }
                if (idx < 0) {
                    const highestSeenIdx = Number.isFinite(Number(highestSeenActivityIndexRef.current))
                        ? Math.floor(Number(highestSeenActivityIndexRef.current))
                        : 0;
                    const selectedIdx = Number.isFinite(Number(selectedActivityIndex))
                        ? Math.floor(Number(selectedActivityIndex))
                        : 0;
                    const currentIdx = Number.isFinite(Number(currentTime)) && Number(currentTime) > 0
                        ? Math.floor(Number(currentTime) - 1)
                        : 0;
                    idx = Math.max(
                        0,
                        Math.min(
                            content.activities.length - 1,
                            Math.max(highestSeenIdx, selectedIdx, currentIdx)
                        )
                    );
                }

                if (idx >= 0) {
                    resumeGuardUntilRef.current = 0;
                    highestSeenActivityIndexRef.current = Math.max(Number(highestSeenActivityIndexRef.current || 0), idx);
                    persistTincanResumeIndex(idx);
                    const closeActivity = content.activities[idx];
                    const closePath = getPrimaryActivityResumePath(closeActivity);
                    persistTincanResumePath(closePath || closeActivity?.activityId || closeActivity?.id || '');
                    const total = content.activities.length;
                    const syncedStatuses = syncTinCanActivityStatusFromIframe() || (Array.isArray(tinCanActivityStatusRef.current) ? tinCanActivityStatusRef.current : []);
                    const packageCompleted = Boolean(frameWindow?.currentState?.completed);
                    const completedByActivities =
                        syncedStatuses.length > 0 &&
                        syncedStatuses.every((item, idx) => isTinCanLessonPassed(item, content?.activities?.[idx]));
                    const shouldComplete = canFinalizeTinCanCompletion({
                        completedByPackage: packageCompleted,
                        completedByProgress: false,
                        completedByActivities,
                        activityIndex: idx,
                        activityStatuses: syncedStatuses,
                    });
                    const lockedCompleted = completionLockRef.current && !hasAssessmentFailureSignals;
                    const nextStatus = (shouldComplete || lockedCompleted) ? 'COMPLETED' : 'LEARNING';
                    const nextProgress = computeTinCanProgress(idx + 1, total, nextStatus === 'COMPLETED');
                    const closeScorePayload = extractScorePayloadFromStatus(syncedStatuses[idx]);
                    await syncProgressWithTrackedTime({
                        contentId: progressContentId,
                        userId: progressUserId,
                        sectionId: activeSectionId,
                        status: nextStatus,
                        progress: nextProgress,
                        currentTime: idx + 1,
                        duration: total,
                        ...closeScorePayload,
                    });
                    if (nextStatus === 'COMPLETED') {
                        await syncEnrollmentStatus('COMPLETED', 100);
                    } else {
                        await syncEnrollmentStatus('LEARNING', nextProgress);
                    }
                }
            } else if (content?.type === 'web' && progressUserId) {
                let idx = detectLegacyWebPageIndex();
                if (idx < 0) {
                    const savedIdx = readWebResumeIndex();
                    if (Number.isFinite(savedIdx) && savedIdx >= 0) {
                        idx = Math.floor(savedIdx);
                    }
                }
                if (idx >= 0) {
                    applyWebStatusToRuntime(idx);
                    const runtimeSnapshot = getCurrentWebStatusSnapshot();
                    if (Array.isArray(runtimeSnapshot) && runtimeSnapshot.length > 0) {
                        persistWebStatusSnapshot(runtimeSnapshot);
                    }
                    const total = Math.max(1, getLegacyWebPageTotal() || (idx + 1));
                    const shouldComplete = canFinalizeLegacyWebCompletion({ pageIndex: idx, totalPages: total });
                    const nextStatus = shouldComplete ? 'COMPLETED' : 'LEARNING';
                    const nextProgress = nextStatus === 'COMPLETED'
                        ? 100
                        : computeTinCanProgress(idx + 1, total, nextStatus === 'COMPLETED');
                    persistWebResumeIndex(idx);
                    await syncProgressWithTrackedTime({
                        contentId: progressContentId,
                        userId: progressUserId,
                        sectionId: activeSectionId,
                        status: nextStatus,
                        progress: nextProgress,
                        currentTime: idx + 1,
                        duration: total,
                    });
                    if (nextStatus === 'COMPLETED') {
                        await syncEnrollmentStatus('COMPLETED', 100);
                    } else {
                        await syncEnrollmentStatus('LEARNING', nextProgress);
                    }
                }
            }
        } catch {
            // ignore close-time position sync errors
        }

        // Before closing, sync final enrollment status from latest stored progress.
        try {
            if (progressContentId && progressUserId) {
                const query = new URLSearchParams({
                    contentId: String(progressContentId || ''),
                    userId: String(progressUserId || ''),
                });
                if (Number.isInteger(Number(activeSectionId)) && Number(activeSectionId) > 0) {
                    query.set('sectionId', String(Number(activeSectionId)));
                }
                const res = await fetch(`/api/content/progress?${query.toString()}`, { cache: 'no-store' });
                if (res.ok) {
                    const rows = await res.json();
                    const latest = Array.isArray(rows) ? rows[0] : null;
                    const latestCurrent = Number(latest?.currentTime || 0);
                    const latestDuration = Number(latest?.duration || 0);
                    const latestStatus = String(latest?.status || '').toUpperCase();
                    const hasVerifiedServerCompletion =
                        latestStatus === 'COMPLETED' &&
                        (
                            latest?.success === true ||
                            latest?.completion === true
                        );
                    const closeStatuses = syncTinCanActivityStatusFromIframe() || (Array.isArray(tinCanActivityStatusRef.current) ? tinCanActivityStatusRef.current : []);
                    const isActuallyCompleted = hasVerifiedServerCompletion
                        || canFinalizeTinCanCompletion({
                            completedByProgress: false,
                            completedByActivities:
                                closeStatuses.length > 0 &&
                                closeStatuses.every((item, idx) => isTinCanLessonPassed(item, content?.activities?.[idx])),
                            activityIndex: (Number.isFinite(latestCurrent) && latestCurrent > 0) ? (latestCurrent - 1) : -1,
                            activityStatuses: closeStatuses,
                        });
                    if (isActuallyCompleted) {
                        await syncEnrollmentStatus('COMPLETED', 100);
                    } else if (latest?.status === 'LEARNING' || Number(latest?.progress || 0) > 0) {
                        const safeProgress = computeTinCanProgress(latestCurrent || 1, latestDuration || (content?.activities?.length || 1), false);
                        await syncEnrollmentStatus('LEARNING', safeProgress);
                    }
                }
            }
        } catch {
            // ignore close-time sync errors
        }

        // Notify opener tabs (e.g. /my-learning) to refresh data automatically.
        notifyLearningRefresh();

        const canAttemptClose = Boolean(window.opener && !window.opener.closed);
        if (canAttemptClose) {
            try {
                window.close();
            } catch {
                // ignore
            }
        }

        // If browser blocks close (common for manually opened tabs), redirect back.
        setTimeout(() => {
            if (!window.closed) {
                window.location.href = fallbackUrl;
            }
        }, 120);
    }, [content, getPrimaryActivityResumePath, progressContentId, progressUserId, activeSectionId, syncEnrollmentStatus, notifyLearningRefresh, persistTincanResumeIndex, persistTincanResumePath, persistWebResumeIndex, persistWebStatusSnapshot, computeTinCanProgress, status, tinCanActivityStatus, isTinCanLessonPassed, canFinalizeTinCanCompletion, canFinalizeLegacyWebCompletion, detectActivityIndexFromIframe, detectLegacyWebPageIndex, getLegacyWebPageTotal, readTincanResumeIndex, readWebResumeIndex, selectedActivityIndex, getCurrentWebStatusSnapshot, applyWebStatusToRuntime, syncProgressWithTrackedTime, mapRuntimePageToActivityIndex, requireAssessmentPass, hasAssessmentFailureSignals, syncTinCanActivityStatusFromIframe, extractScorePayloadFromStatus]);

    const bindIframeCloseHandler = useCallback(() => {
        const frameWindow = iframeRef.current?.contentWindow;
        if (!frameWindow) return;
        const bindClose = (win) => {
            if (!win) return;
            try {
                win.close = handleCloseLaunch;
            } catch {
                // ignore
            }
        };
        try {
            bindClose(frameWindow);
            const innerWindow = frameWindow.document?.getElementById('contentFrame')?.contentWindow;
            bindClose(innerWindow);
        } catch {
            // ignore
        }
    }, [handleCloseLaunch]);

    const applyTinCanWrapperChrome = useCallback(() => {
        if (!iframeRef.current) return;
        const type = String(content?.type || '').toLowerCase();
        if (!['tincan', 'web'].includes(type)) return;

        let attempts = 0;
        const maxAttempts = 40;

        const timer = setInterval(() => {
            attempts += 1;
            try {
                const frameWindow = iframeRef.current?.contentWindow;
                const frameDoc = frameWindow?.document;
                if (!frameDoc) return;
                hardenTinCanRuntimeWindow(frameWindow);

                const menuBar = frameDoc.getElementById('menuBar');
                const menuToc = frameDoc.getElementById('menuTOC');
                const contentFrame = frameDoc.getElementById('contentFrame');
                const contentContainer = frameDoc.getElementById('divContentFrame');

                const wrapperStyleId = 'lms-force-wrapper-chrome';
                let styleEl = frameDoc.getElementById(wrapperStyleId);
                if (!styleEl) {
                    styleEl = frameDoc.createElement('style');
                    styleEl.id = wrapperStyleId;
                    (frameDoc.head || frameDoc.body || frameDoc.documentElement).appendChild(styleEl);
                }
                styleEl.textContent = `
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                            height: 100% !important;
                            overflow: hidden !important;
                            background: #000 !important;
                        }
                        #menuBar,
                        #menuTOC,
                        #menuTOCTop,
                        #menuTOCStatus {
                            display: none !important;
                            visibility: hidden !important;
                            pointer-events: none !important;
                        }
                        #menuTOC {
                            width: 0 !important;
                            min-width: 0 !important;
                            max-width: 0 !important;
                            left: -99999px !important;
                            border: 0 !important;
                            overflow: hidden !important;
                        }
                        #divContentFrame,
                        #contentFrame {
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            transform: none !important;
                            width: 100% !important;
                            height: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            border: 0 !important;
                            overflow: hidden !important;
                        }
                    `;

                if (menuBar) menuBar.style.display = 'none';
                if (menuToc) {
                    menuToc.style.setProperty('display', 'none', 'important');
                    menuToc.style.setProperty('visibility', 'hidden', 'important');
                    menuToc.style.setProperty('pointer-events', 'none', 'important');
                    menuToc.style.setProperty('width', '0px', 'important');
                    menuToc.style.setProperty('min-width', '0px', 'important');
                    menuToc.style.setProperty('max-width', '0px', 'important');
                    menuToc.style.setProperty('left', '-99999px', 'important');
                    menuToc.style.setProperty('border', '0', 'important');
                    menuToc.style.setProperty('overflow', 'hidden', 'important');
                }

                if (contentContainer) {
                    contentContainer.style.setProperty('top', '0', 'important');
                    contentContainer.style.setProperty('left', '0', 'important');
                    contentContainer.style.setProperty('transform', 'none', 'important');
                    contentContainer.style.setProperty('width', '100%', 'important');
                    contentContainer.style.setProperty('height', '100%', 'important');
                    contentContainer.style.setProperty('overflow', 'hidden', 'important');
                }

                if (contentFrame) {
                    contentFrame.style.setProperty('top', '0', 'important');
                    contentFrame.style.setProperty('left', '0', 'important');
                    contentFrame.style.setProperty('transform', 'none', 'important');
                    contentFrame.style.setProperty('width', '100%', 'important');
                    contentFrame.style.setProperty('height', '100%', 'important');
                    contentFrame.style.setProperty('border', '0', 'important');
                }

                if (frameDoc.body) {
                    frameDoc.body.style.margin = '0';
                    frameDoc.body.style.padding = '0';
                    frameDoc.body.style.overflow = 'hidden';
                    frameDoc.body.style.background = '#000';
                }

                // Legacy quiz/posttest packages often render a fixed-size canvas (e.g. nolpifrm),
                // which leaves large black margins. Force that frame to cover the whole player.
                const innerDoc = contentFrame?.contentWindow?.document;
                if (innerDoc) {
                    const hasLegacyNolp =
                        Boolean(innerDoc.getElementById('nolpifrm')) ||
                        Boolean(innerDoc.querySelector('iframe[name="nolpifrm"]'));

                    if (hasLegacyNolp) {
                        const styleId = 'lms-force-fullscreen-nolp';
                        if (!innerDoc.getElementById(styleId)) {
                            const styleEl = innerDoc.createElement('style');
                            styleEl.id = styleId;
                            styleEl.textContent = `
                                html, body {
                                    margin: 0 !important;
                                    padding: 0 !important;
                                    width: 100% !important;
                                    height: 100% !important;
                                    overflow: hidden !important;
                                    background: #000 !important;
                                }
                                span#skin > img, [id="skin"] > img {
                                    display: none !important;
                                }
                                #nolpifrm, iframe[name="nolpifrm"] {
                                    position: fixed !important;
                                    inset: 0 !important;
                                    width: 100vw !important;
                                    height: 100vh !important;
                                    border: 0 !important;
                                    margin: 0 !important;
                                    padding: 0 !important;
                                    background: #fff !important;
                                    z-index: 2147483000 !important;
                                }
                            `;
                            (innerDoc.head || innerDoc.body || innerDoc.documentElement).appendChild(styleEl);
                        }
                    }
                }

                if (contentFrame || contentContainer) {
                    setIsTinCanFrameReady(true);
                    if (frameRevealTimeoutRef.current) {
                        clearTimeout(frameRevealTimeoutRef.current);
                        frameRevealTimeoutRef.current = null;
                    }
                }
            } catch {
                // ignore cross-frame access/runtime readiness errors
            }

            if (attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }, 250);
    }, [content?.type, hardenTinCanRuntimeWindow]);

    const forceTinCanReflow = useCallback(() => {
        if (!iframeRef.current) return;
        const type = String(content?.type || '').toLowerCase();
        if (!['tincan', 'web'].includes(type)) return;

        const sessionId = Date.now();
        reflowSessionRef.current = sessionId;
        let attempts = 0;
        const maxAttempts = 8;

        const tick = () => {
            if (reflowSessionRef.current !== sessionId) return;
            attempts += 1;
            try {
                const frameWindow = iframeRef.current?.contentWindow;
                if (frameWindow) {
                    hardenTinCanRuntimeWindow(frameWindow);
                    // Let package script recalc, then immediately override with our full-bleed chrome.
                    if (typeof frameWindow.updateOC === 'function') frameWindow.updateOC();
                    if (typeof frameWindow.SetupIFrame === 'function') frameWindow.SetupIFrame();
                    frameWindow.dispatchEvent(new Event('resize'));
                    if (typeof frameWindow.resizewindow === 'function') frameWindow.resizewindow();
                    if (typeof frameWindow.resizeWindow === 'function') frameWindow.resizeWindow();

                    const frameDoc = frameWindow.document;
                    const contentFrame = frameDoc?.getElementById('contentFrame');
                    const innerWin = contentFrame?.contentWindow;
                    if (innerWin) {
                        innerWin.dispatchEvent(new Event('resize'));
                    }
                }
                applyTinCanWrapperChrome();
            } catch {
                // ignore transient iframe access errors
            }

            if (attempts < maxAttempts) {
                setTimeout(tick, 80);
            }
        };

        tick();
    }, [content?.type, applyTinCanWrapperChrome, hardenTinCanRuntimeWindow]);
    const queuePlayerReflow = useCallback(() => {
        const pending = Array.isArray(playerReflowTimeoutsRef.current)
            ? playerReflowTimeoutsRef.current
            : [];
        pending.forEach((timer) => clearTimeout(timer));
        playerReflowTimeoutsRef.current = [];

        // Trigger a few reflow passes while layout animation is running.
        [24, 140, 300, 520].forEach((delay) => {
            const timer = setTimeout(() => {
                forceTinCanReflow();
            }, delay);
            playerReflowTimeoutsRef.current.push(timer);
        });
    }, [forceTinCanReflow]);

    const handleToggleLearningSidebar = useCallback(() => {
        setIsLearningSidebarOpen((prev) => !prev);
        queuePlayerReflow();
    }, [queuePlayerReflow]);

    const handleCloseLearningSidebar = useCallback(() => {
        setIsLearningSidebarOpen(false);
        queuePlayerReflow();
    }, [queuePlayerReflow]);

    const handleToggleLearningAi = useCallback(() => {
        setIsLearningAiOpen((prev) => !prev);
        queuePlayerReflow();
    }, [queuePlayerReflow]);

    const handleCloseLearningAi = useCallback(() => {
        setIsLearningAiOpen(false);
        queuePlayerReflow();
    }, [queuePlayerReflow]);

    const syncTincanPositionFromIframe = useCallback(async () => {
        if (tinCanSyncInFlightRef.current) return;
        tinCanSyncInFlightRef.current = true;
        try {
        if (!content || content.type !== 'tincan' || !Array.isArray(content.activities) || content.activities.length === 0) return;
        if (!resumeLoaded) return;
        const syncedStatuses = syncTinCanActivityStatusFromIframe() || (Array.isArray(tinCanActivityStatusRef.current) ? tinCanActivityStatusRef.current : []);

        let packageCompleted = false;
        try {
            const frameWindow = iframeRef.current?.contentWindow;
            packageCompleted = Boolean(frameWindow?.currentState?.completed);
        } catch {
            packageCompleted = false;
        }

        const idx = detectActivityIndexFromIframe();
        if (idx < 0) return;
        if (idx !== selectedActivityIndex) {
            logLessonMapDebug('runtime-position-detected', {
                detectedActivityIndex: idx,
                selectedActivityIndex,
                currentRuntimePage: Number(iframeRef.current?.contentWindow?.currentPage),
                detectedActivityTitle: String(content?.activities?.[idx]?.name || content?.activities?.[idx]?.title || ''),
            });
        }
        const total = content.activities.length;
        const position = idx + 1;

        const manualTarget = Number(manualSelectionRef.current?.target);
        const manualUntil = Number(manualSelectionRef.current?.until || 0);
        const manualActive = Number.isFinite(manualTarget) && Date.now() < manualUntil;
        const forceExactPosition = manualActive && idx === manualTarget;
        if (manualActive) {
            // While user-initiated jump is still in-flight, ignore old iframe position reports.
            if (idx !== manualTarget) {
                return;
            }
            // Landed on target chapter, allow backward sync exactly once.
            manualSelectionRef.current = { target: null, until: 0 };
        }

        const savedIdx = readTincanResumeIndex();
        const savedKnownIndex = Number.isFinite(savedIdx) && savedIdx >= 0 ? Math.floor(savedIdx) : -1;
        const currentKnownIndex =
            Number.isFinite(currentTime) && Number(currentTime) > 0
                ? Math.max(0, Math.floor(Number(currentTime) - 1))
                : -1;
        const lastKnownIndex =
            Number.isFinite(Number(lastTincanSyncRef.current?.position))
                ? Math.max(0, Math.floor(Number(lastTincanSyncRef.current.position) - 1))
                : -1;
        const highestSeenIndex = Number.isFinite(Number(highestSeenActivityIndexRef.current))
            ? Math.max(0, Math.floor(Number(highestSeenActivityIndexRef.current)))
            : -1;
        const knownFloorIndex = Math.max(savedKnownIndex, currentKnownIndex, lastKnownIndex, highestSeenIndex, 0);

        const effectivePosition = position;
        const effectiveIndex = Math.max(0, Math.min(total - 1, effectivePosition - 1));

        // Ignore auto-sync regressions while restoring/opening TinCan.
        if (!forceExactPosition && effectiveIndex < knownFloorIndex) {
            return;
        }

        if (effectiveIndex !== selectedActivityIndex) {
            setSelectedActivityIndex(effectiveIndex);
        }
        if (effectiveIndex > Number(highestSeenActivityIndexRef.current || 0)) {
            highestSeenActivityIndexRef.current = effectiveIndex;
        }

        const completedByActivityFlags =
            syncedStatuses.length > 0 &&
            syncedStatuses.every((item, idx) => isTinCanLessonPassed(item, content?.activities?.[idx]));
        const shouldComplete = canFinalizeTinCanCompletion({
            completedByPackage: packageCompleted,
            completedByProgress: false,
            completedByActivities: completedByActivityFlags,
            activityIndex: effectiveIndex,
            activityStatuses: syncedStatuses,
        });
        const lockedCompleted = completionLockRef.current && !hasAssessmentFailureSignals;
        const nextStatus = (shouldComplete || lockedCompleted) ? 'COMPLETED' : 'LEARNING';
        const nextProgress = computeTinCanProgress(effectivePosition, total, nextStatus === 'COMPLETED');
        const guardActive = Date.now() < Number(resumeGuardUntilRef.current || 0);
        const guardBaseline = Math.max(savedKnownIndex, currentKnownIndex, lastKnownIndex, highestSeenIndex, 0);
        if (guardActive && guardBaseline > 0 && effectiveIndex < guardBaseline) {
            return;
        }
        const now = Date.now();
        const last = lastTincanSyncRef.current || {};
        const unchangedRecently =
            last.position === effectivePosition &&
            last.status === nextStatus &&
            Number(last.progress) === Number(nextProgress) &&
            now - Number(last.at || 0) < 5000;
        if (unchangedRecently) return;
        lastTincanSyncRef.current = { position: effectivePosition, status: nextStatus, progress: nextProgress, at: now };
        persistTincanResumeIndex(effectiveIndex);
        const effectiveActivity = content.activities[effectiveIndex];
        const effectivePath = getPrimaryActivityResumePath(effectiveActivity);
        persistTincanResumePath(effectivePath || effectiveActivity?.activityId || effectiveActivity?.id || '');
        setCurrentTime(effectivePosition);
        if (nextStatus === 'COMPLETED') {
            setProgress(100);
        } else {
            setProgress(nextProgress);
        }
        const positionScorePayload = extractScorePayloadFromStatus(syncedStatuses[effectiveIndex]);

        await syncProgressWithTrackedTime({
            contentId: progressContentId,
            userId: progressUserId,
            sectionId: activeSectionId,
            status: nextStatus,
            progress: nextProgress,
            currentTime: effectivePosition,
            duration: total,
            ...positionScorePayload,
        });

        setStatus(nextStatus);
        if (nextStatus === 'COMPLETED') {
            setProgress(100);
            await syncEnrollmentStatus('COMPLETED', 100);
        } else {
            setProgress(nextProgress);
            await syncEnrollmentStatus('LEARNING', nextProgress);
        }
        } finally {
            tinCanSyncInFlightRef.current = false;
        }
    }, [content, getPrimaryActivityResumePath, detectActivityIndexFromIframe, selectedActivityIndex, progressContentId, progressUserId, activeSectionId, resumeLoaded, syncEnrollmentStatus, persistTincanResumeIndex, persistTincanResumePath, readTincanResumeIndex, currentTime, syncTinCanActivityStatusFromIframe, computeTinCanProgress, tinCanActivityStatus, status, isTinCanLessonPassed, canFinalizeTinCanCompletion, syncProgressWithTrackedTime, hasAssessmentFailureSignals, logLessonMapDebug, extractScorePayloadFromStatus]);
    const runIframeRuntimeSync = useCallback(() => {
        const frameWindow = iframeRef.current?.contentWindow;
        hardenTinCanRuntimeWindow(frameWindow);
        applyTinCanWrapperChrome();
        bindIframeCloseHandler();
        bindIframeInteractionTracking();
        applyTincanResumeToIframe();
        applyLegacyWebResumeToIframe();
        syncTinCanActivityStatusFromIframe();
        syncTincanPositionFromIframe();
    }, [
        hardenTinCanRuntimeWindow,
        applyTinCanWrapperChrome,
        bindIframeCloseHandler,
        bindIframeInteractionTracking,
        applyTincanResumeToIframe,
        applyLegacyWebResumeToIframe,
        syncTinCanActivityStatusFromIframe,
        syncTincanPositionFromIframe,
    ]);
    const scheduleDeferredIframeRuntimeSync = useCallback(() => {
        clearIframeDeferredSync();
        iframeDeferredSyncTimeoutRef.current = setTimeout(() => {
            iframeDeferredSyncTimeoutRef.current = null;
            runIframeRuntimeSync();
            forceTinCanReflow();
        }, 1200);
    }, [clearIframeDeferredSync, runIframeRuntimeSync, forceTinCanReflow]);
    const bindInnerContentFrameLoadHandler = useCallback(() => {
        clearInnerFrameLoadBinding();
        try {
            const frameWindow = iframeRef.current?.contentWindow;
            const frameDoc = frameWindow?.document;
            const contentFrameEl = frameDoc?.getElementById('contentFrame');
            if (!contentFrameEl || typeof contentFrameEl.addEventListener !== 'function') return;

            const onInnerLoad = () => {
                runIframeRuntimeSync();
                scheduleDeferredIframeRuntimeSync();
            };
            contentFrameEl.addEventListener('load', onInnerLoad);
            innerFrameLoadCleanupRef.current = () => {
                try {
                    contentFrameEl.removeEventListener('load', onInnerLoad);
                } catch {
                    // ignore cleanup errors
                }
            };
        } catch {
            // ignore cross-frame access errors
        }
    }, [clearInnerFrameLoadBinding, runIframeRuntimeSync, scheduleDeferredIframeRuntimeSync]);

    const getMaxUnlockedActivityIndex = useCallback(() => {
        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (activities.length === 0) return 0;
        if (!chapterLockEnabled) return activities.length - 1;

        let runtimeUnlocked = -1;
        try {
            let contiguousPassed = 0;
            for (let i = 0; i < activities.length; i++) {
                const row = findTinCanStatusRowForActivity(i);
                if (isTinCanLessonClearedForAdvance(row, activities[i])) {
                    contiguousPassed += 1;
                    continue;
                }
                break;
            }
            runtimeUnlocked = Math.max(0, Math.min(activities.length - 1, contiguousPassed));
        } catch {
            // ignore iframe access errors and fallback to local state
        }

        const activityStatuses = Array.isArray(tinCanActivityStatusRef.current) ? tinCanActivityStatusRef.current : [];
        let localUnlocked = 0;
        for (let i = 0; i < activities.length; i++) {
            if (isTinCanLessonClearedForAdvance(activityStatuses[i], activities[i])) {
                localUnlocked += 1;
                continue;
            }
            break;
        }
        localUnlocked = Math.max(0, Math.min(activities.length - 1, localUnlocked));

        const selectedSafe = Math.max(0, Math.min(activities.length - 1, selectedActivityIndex));
        let forwardFromSelected = selectedSafe;
        for (let i = selectedSafe; i < activities.length; i++) {
            if (isTinCanLessonClearedForAdvance(activityStatuses[i], activities[i])) {
                forwardFromSelected = i + 1;
                continue;
            }
            break;
        }
        forwardFromSelected = Math.max(0, Math.min(activities.length - 1, forwardFromSelected));

        const highestSeenSafe = Math.max(
            0,
            Math.min(
                activities.length - 1,
                Number.isFinite(Number(highestSeenActivityIndexRef.current))
                    ? Math.floor(Number(highestSeenActivityIndexRef.current))
                    : 0
            )
        );
        return Math.max(runtimeUnlocked, localUnlocked, selectedSafe, highestSeenSafe, forwardFromSelected);
    }, [content, chapterLockEnabled, selectedActivityIndex, tinCanActivityStatus, isTinCanLessonClearedForAdvance, findTinCanStatusRowForActivity]);

    const handleManualActivitySelect = useCallback(async (idx) => {
        const activities = Array.isArray(content?.activities) ? content.activities : [];
        if (activities.length === 0) return;

        const safeIndex = Math.max(0, Math.min(activities.length - 1, Number(idx) || 0));
        const maxUnlocked = getMaxUnlockedActivityIndex();
        logLessonMapDebug('manual-select-click', {
            requestedIndex: Number(idx),
            targetIndex: safeIndex,
            runtimeTargetIndex: mapActivityIndexToRuntimePage(safeIndex),
            detectedActivityIndex: detectActivityIndexFromIframe(),
            selectedActivityIndex,
            targetActivityTitle: String(activities?.[safeIndex]?.name || activities?.[safeIndex]?.title || ''),
        });
        if (chapterLockEnabled && safeIndex > maxUnlocked) {
            toast.warning(
                'กรุณาเรียนบทก่อนหน้าให้ครบก่อน จึงจะไปบทถัดไปได้',
                { ...LEARNER_TOAST, toastId: 'learner-tincan-lock-warning' }
            );
            return;
        }

        // Update selected index immediately so sidebar highlights the clicked lesson right away
        setSelectedActivityIndex(safeIndex);
        manualSelectionRef.current = { target: safeIndex, until: Date.now() + 12000 };
        highestSeenActivityIndexRef.current = Math.max(
            Number(highestSeenActivityIndexRef.current || 0),
            safeIndex
        );
        resumeGuardUntilRef.current = 0;
        applyTincanResumeToIframe();
    }, [content, chapterLockEnabled, getMaxUnlockedActivityIndex, applyTincanResumeToIframe, logLessonMapDebug, mapActivityIndexToRuntimePage, detectActivityIndexFromIframe, selectedActivityIndex]);

    const getMaxUnlockedWebPageIndex = useCallback(() => {
        const knownTotal = Math.max(
            1,
            Number(getLegacyWebPageTotal() || 0),
            Number(duration || 0),
            Number(currentTime || 0)
        );
        if (knownTotal <= 1) return 0;
        if (!chapterLockEnabled) return knownTotal - 1;

        const runtimeSnapshot = getCurrentWebStatusSnapshot();
        const savedSnapshot = readWebStatusSnapshot();
        const snapshot = Array.isArray(runtimeSnapshot) && runtimeSnapshot.length > 0
            ? runtimeSnapshot
            : (Array.isArray(savedSnapshot) ? savedSnapshot : []);

        let contiguousCompleted = 0;
        for (let index = 0; index < knownTotal; index++) {
            const row = snapshot[index];
            if (row?.completed || row?.passed) {
                contiguousCompleted = index + 1;
                continue;
            }
            break;
        }

        const detectedIndex = detectLegacyWebPageIndex();
        const inferredCurrentIndex = Math.max(0, Math.floor(Number(currentTime || 1) - 1));
        const selectedIndex = Number.isInteger(Number(detectedIndex)) && Number(detectedIndex) >= 0
            ? Number(detectedIndex)
            : inferredCurrentIndex;
        return Math.max(0, Math.min(knownTotal - 1, Math.max(contiguousCompleted, selectedIndex)));
    }, [getLegacyWebPageTotal, duration, currentTime, chapterLockEnabled, getCurrentWebStatusSnapshot, readWebStatusSnapshot, detectLegacyWebPageIndex]);

    const handleManualWebPageSelect = useCallback(async (idx) => {
        if (content?.type !== 'web') return;

        const knownTotal = Math.max(
            1,
            Number(getLegacyWebPageTotal() || 0),
            Number(duration || 0),
            Number(currentTime || 0),
            Number(idx || 0) + 1
        );
        const safeIndex = Math.max(0, Math.min(knownTotal - 1, Number(idx) || 0));
        if (chapterLockEnabled) {
            const maxUnlocked = getMaxUnlockedWebPageIndex();
            if (safeIndex > maxUnlocked) {
                toast.warning(
                    'กรุณาเรียนหน้าก่อนหน้าให้ผ่านก่อน จึงจะไปหน้าถัดไปได้',
                    { ...LEARNER_TOAST, toastId: 'learner-web-lock-warning' }
                );
                return;
            }
        }

        persistWebResumeIndex(safeIndex);
        setCurrentTime(safeIndex + 1);
        setDuration(Math.max(knownTotal, safeIndex + 1));

        const shouldComplete = canFinalizeLegacyWebCompletion({
            pageIndex: safeIndex,
            totalPages: knownTotal,
        });
        const nextStatus = shouldComplete ? 'COMPLETED' : 'LEARNING';
        const nextProgress = nextStatus === 'COMPLETED'
            ? 100
            : computeTinCanProgress(safeIndex + 1, knownTotal, false);

        setProgress(nextProgress);
        if (nextStatus === 'COMPLETED') {
            setStatus('COMPLETED');
        } else if (String(status || '').toUpperCase() !== 'COMPLETED') {
            setStatus('LEARNING');
        }

        const windows = getLegacyWebRuntimeWindows();
        for (const win of windows) {
            try {
                if (typeof win?.goToPage !== 'function') continue;
                const previousLinear = win?.islinear;
                try {
                    win.islinear = false;
                } catch {
                    // ignore
                }
                win.goToPage(safeIndex);
                try {
                    win.islinear = previousLinear;
                } catch {
                    // ignore
                }
                if (typeof win.drawTOC === 'function') {
                    win.drawTOC();
                }
            } catch {
                // ignore runtime navigation errors
            }
        }

        applyWebStatusToRuntime(safeIndex);
        const runtimeSnapshot = getCurrentWebStatusSnapshot();
        if (Array.isArray(runtimeSnapshot) && runtimeSnapshot.length > 0) {
            persistWebStatusSnapshot(runtimeSnapshot);
        }

        if (!progressUserId) return;
        try {
            await syncProgressWithTrackedTime({
                contentId: progressContentId,
                userId: progressUserId,
                sectionId: activeSectionId,
                status: nextStatus,
                progress: nextProgress,
                currentTime: safeIndex + 1,
                duration: knownTotal,
            });
            if (nextStatus === 'COMPLETED') {
                await syncEnrollmentStatus('COMPLETED', 100);
            } else {
                await syncEnrollmentStatus('LEARNING', nextProgress);
            }
        } catch {
            // ignore manual select sync errors
        }
    }, [
        content?.type,
        getLegacyWebPageTotal,
        duration,
        currentTime,
        chapterLockEnabled,
        getMaxUnlockedWebPageIndex,
        persistWebResumeIndex,
        canFinalizeLegacyWebCompletion,
        computeTinCanProgress,
        status,
        getLegacyWebRuntimeWindows,
        applyWebStatusToRuntime,
        getCurrentWebStatusSnapshot,
        persistWebStatusSnapshot,
        progressUserId,
        syncProgressWithTrackedTime,
        progressContentId,
        activeSectionId,
        syncEnrollmentStatus,
    ]);

    useEffect(() => {
        if (!isLaunchMode || !content || content.type !== 'tincan') return;
        const timer = setInterval(() => {
            syncTincanPositionFromIframe();
        }, 1000);
        return () => clearInterval(timer);
    }, [isLaunchMode, content, syncTincanPositionFromIframe]);

    useEffect(() => {
        if (!isLaunchMode || content?.type !== 'web' || !resumeLoaded) return;
        if (!progressContentId || !progressUserId) return;

        const timer = setInterval(() => {
            const idx = detectLegacyWebPageIndex();
            if (idx < 0) return;

            const total = Math.max(1, getLegacyWebPageTotal() || (idx + 1));
            const shouldComplete = canFinalizeLegacyWebCompletion({ pageIndex: idx, totalPages: total });
            const nextStatus = shouldComplete ? 'COMPLETED' : 'LEARNING';
            const nextProgress = nextStatus === 'COMPLETED'
                ? 100
                : computeTinCanProgress(idx + 1, total, nextStatus === 'COMPLETED');

            const gate = legacyWebSyncStateRef.current || {};
            const now = Date.now();
            applyWebStatusToRuntime(idx);
            const runtimeSnapshot = getCurrentWebStatusSnapshot();
            if (Array.isArray(runtimeSnapshot) && runtimeSnapshot.length > 0) {
                const shouldPersistSnapshot =
                    Number(gate.idx) !== idx ||
                    now - Number(gate.snapshotAt || 0) >= 4000;
                if (shouldPersistSnapshot) {
                    persistWebStatusSnapshot(runtimeSnapshot);
                    legacyWebSyncStateRef.current = { ...gate, snapshotAt: now };
                }
            }
            const latestGate = legacyWebSyncStateRef.current || gate;
            const unchangedRecently =
                Number(latestGate.idx) === idx &&
                String(latestGate.status || '').toUpperCase() === nextStatus &&
                now - Number(latestGate.at || 0) < 5000;
            if (unchangedRecently) return;

            legacyWebSyncStateRef.current = { ...latestGate, idx, status: nextStatus, at: now };
            persistWebResumeIndex(idx);
            setCurrentTime(idx + 1);
            setDuration(total);
            setProgress(nextProgress);
            if (nextStatus === 'COMPLETED') {
                setStatus('COMPLETED');
            } else if (String(status || '').toUpperCase() !== 'COMPLETED') {
                setStatus('LEARNING');
            }

            syncProgressWithTrackedTime({
                contentId: progressContentId,
                userId: progressUserId,
                sectionId: activeSectionId,
                status: nextStatus,
                progress: nextProgress,
                currentTime: idx + 1,
                duration: total,
            });

            if (nextStatus === 'COMPLETED') {
                syncEnrollmentStatus('COMPLETED', 100);
            } else {
                syncEnrollmentStatus('LEARNING', nextProgress);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [
        isLaunchMode,
        content?.type,
        resumeLoaded,
        progressContentId,
        progressUserId,
        activeSectionId,
        status,
        computeTinCanProgress,
        syncEnrollmentStatus,
        detectLegacyWebPageIndex,
        getLegacyWebPageTotal,
        persistWebResumeIndex,
        persistWebStatusSnapshot,
        getCurrentWebStatusSnapshot,
        applyWebStatusToRuntime,
        canFinalizeLegacyWebCompletion,
        syncProgressWithTrackedTime,
    ]);

    useEffect(() => {
        if (!isLaunchMode) return;
        const type = String(content?.type || '').toLowerCase();
        if (!['tincan', 'web'].includes(type)) return;
        const timer = setTimeout(() => {
            forceTinCanReflow();
        }, 40);
        return () => clearTimeout(timer);
    }, [isLaunchMode, content?.type, forceTinCanReflow]);

    useEffect(() => {
        if (!isLaunchMode) return;
        const type = String(content?.type || '').toLowerCase();
        if (!['tincan', 'web'].includes(type)) return;
        const timer = setInterval(() => {
            applyTinCanWrapperChrome();
        }, 1200);
        return () => clearInterval(timer);
    }, [isLaunchMode, content?.type, applyTinCanWrapperChrome]);

    if (!mounted || loading) {
        return <LoadScreen text="Loading content..." variant="minimal" className="bg-[#0f0f1a]/55" />;
    }

    if (error || !content) {
        return (
            <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-white text-2xl mb-2">Content Not Found</h2>
                    <p className="text-white/50">{error || 'The content you are looking for does not exist.'}</p>
                    <a href={course ? `/courses/${course.id}` : '/courses'} className="text-[#687EFF] mt-4 inline-block hover:underline">← Back to Courses</a>
                </div>
            </div>
        );
    }

    if (isLaunchMode) {
        const isTinCanContent = content.type === 'tincan';
        const isLegacyWebContent = content.type === 'web';
        const hasStructuredLessons = isTinCanContent || isLegacyWebContent;
        const normalizedStatus = String(status || '').toUpperCase();
        const lessonItems = isTinCanContent
            ? (Array.isArray(content.activities) ? content.activities : [])
            : (() => {
                const runtimeTotal = Math.max(
                    1,
                    Number(getLegacyWebPageTotal() || 0),
                    Number(duration || 0),
                    Number(currentTime || 0)
                );
                const runtimeTitles = getLegacyWebPageTitles();
                return Array.from({ length: runtimeTotal }, (_, index) => ({
                    id: index + 1,
                    name: runtimeTitles[index] || `Lesson ${index + 1}`,
                    duration: '--:--',
                }));
            })();
        const resumePositionIndex =
            Number.isFinite(Number(currentTime)) && Number(currentTime) > 0
                ? Math.max(0, Math.floor(Number(currentTime) - 1))
                : -1;
        const detectedWebIndex = isLegacyWebContent ? detectLegacyWebPageIndex() : -1;
        const detectedTinCanIndex = isTinCanContent ? detectActivityIndexFromIframe() : -1;
        const selectedLessonIndex = isTinCanContent
            ? Math.max(
                0,
                Math.min(
                    lessonItems.length - 1,
                    Number.isFinite(Number(detectedTinCanIndex)) && detectedTinCanIndex >= 0
                        ? Math.floor(Number(detectedTinCanIndex))
                        : (Number(selectedActivityIndex) || 0)
                )
            )
            : Math.max(
                0,
                Math.min(
                    lessonItems.length - 1,
                    Number.isFinite(detectedWebIndex) && detectedWebIndex >= 0
                        ? detectedWebIndex
                        : (resumePositionIndex >= 0 ? resumePositionIndex : 0)
                )
            );
        const maxUnlockedLessonIndex = isTinCanContent
            ? Math.max(0, Math.min(lessonItems.length - 1, getMaxUnlockedActivityIndex()))
            : Math.max(0, Math.min(lessonItems.length - 1, getMaxUnlockedWebPageIndex()));
        const tinCanHasCompletionEvidence = isTinCanContent && (
            (Array.isArray(tinCanActivityStatus) && tinCanActivityStatus.some((st) => Boolean(st?.completed || st?.passed)))
            || (resumePositionIndex >= 0 && resumePositionIndex >= lessonItems.length - 1)
        );
        const inferredCompletedThrough = isTinCanContent
            ? (normalizedStatus === 'COMPLETED' && tinCanHasCompletionEvidence
                ? lessonItems.length - 1
                : Math.max(-1, Math.min(lessonItems.length - 1, Math.max(resumePositionIndex, selectedLessonIndex - 1))))
            : (normalizedStatus === 'COMPLETED'
                ? lessonItems.length - 1
                : Math.max(-1, Math.min(lessonItems.length - 1, selectedLessonIndex - 1)));
        const webStatusSnapshot = isLegacyWebContent
            ? (getCurrentWebStatusSnapshot() || readWebStatusSnapshot() || [])
            : [];
        const completedFlags = lessonItems.map((lesson, index) => {
            if (isTinCanContent) {
                const st = tinCanActivityStatus[index];
                const explicitCompleted = Boolean(st?.passed || st?.completed);
                if (explicitCompleted) return true;
                if (!isAssessmentActivity(lesson) && index <= inferredCompletedThrough) {
                    return true;
                }
                return false;
            }
            const st = webStatusSnapshot[index];
            if (normalizedStatus === 'COMPLETED') return true;
            if (st?.completed || st?.passed) return true;
            return index <= inferredCompletedThrough;
        });
        const lessonStatuses = lessonItems.map((_, index) => {
            if (index === selectedLessonIndex && normalizedStatus !== 'COMPLETED') return 'in_progress';
            if (completedFlags[index]) return 'completed';
            if (isTinCanContent) {
                const st = tinCanActivityStatus[index];
                const futureLocked = chapterLockEnabled && index > maxUnlockedLessonIndex;
                if (futureLocked) return 'not_started';
                if (st?.attempted || st?.quizzed) return 'attempted';
            } else {
                const st = webStatusSnapshot[index];
                if (st?.attempted || st?.quizzed) return 'attempted';
            }
            return 'not_started';
        });
        const getLessonStatusLabel = (lessonStatus) => {
            const normalized = String(lessonStatus || '').toLowerCase();
            if (normalized === 'completed') return 'เรียนผ่านแล้ว';
            if (normalized === 'in_progress') return 'กำลังเรียน';
            if (normalized === 'attempted') return 'เริ่มเรียนแล้ว';
            return 'ยังไม่เริ่ม';
        };
        const activeLessonTitle = lessonItems[selectedLessonIndex]?.name || lessonItems[selectedLessonIndex]?.title || content.title;
        const assistantCourseTitle = String(course?.title || '').trim();
        const assistantSectionTitle = String(content?.title || '').trim();
        const assistantLessonOutline = lessonItems.map((lesson, index) => ({
            index: index + 1,
            title: String(lesson?.name || lesson?.title || `Lesson ${index + 1}`),
            status: String(lessonStatuses[index] || ''),
        }));
        const lessonModules = [
            {
                id: 1,
                module: 'Module 1',
                items: lessonItems.map((lesson, index) => ({
                    id: index + 1,
                    title: lesson?.name || `Lesson ${index + 1}`,
                    duration: lesson?.duration || '--:--',
                    completed: Boolean(completedFlags[index]),
                    status: lessonStatuses[index],
                    statusLabel: getLessonStatusLabel(lessonStatuses[index]),
                })),
            },
        ];

        return (
            <div
                className="fixed inset-0 bg-white overflow-hidden flex"
                style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
            >
                {hasStructuredLessons && (
                    <div
                        className={`h-full overflow-hidden transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            isLearningSidebarOpen
                                ? 'fixed inset-y-0 left-0 z-[45] w-[85vw] max-w-[300px] opacity-100 translate-x-0 shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:w-[300px] lg:max-w-none lg:shadow-none'
                                : 'w-0 opacity-0 -translate-x-full pointer-events-none lg:translate-x-0'
                        }`}
                    >
                        <div className="h-full w-[85vw] max-w-[300px] lg:w-[300px]">
                            <LearningLessonSidebar
                                lessons={lessonModules}
                                activeLesson={selectedLessonIndex + 1}
                                onSelectLesson={(lessonId) => {
                                    const idx = Math.max(0, Number(lessonId) - 1);
                                    if (isTinCanContent) {
                                        handleManualActivitySelect(idx);
                                        return;
                                    }
                                    if (isLegacyWebContent) {
                                        handleManualWebPageSelect(idx);
                                    }
                                }}
                                onClose={handleCloseLearningSidebar}
                            />
                        </div>
                    </div>
                )}

                {(isLearningSidebarOpen || isLearningAiOpen) && (
                    <button
                        type="button"
                        aria-label="Close side panels"
                        onClick={() => {
                            handleCloseLearningSidebar();
                            handleCloseLearningAi();
                        }}
                        className="fixed inset-0 z-[38] bg-black/45 backdrop-blur-[1px] lg:hidden"
                    />
                )}

                <LearningVideoPlayer
                    lessonTitle={activeLessonTitle}
                    sidebarOpen={isLearningSidebarOpen}
                    onToggleSidebar={handleToggleLearningSidebar}
                    onToggleAi={handleToggleLearningAi}
                    aiPanelOpen={isLearningAiOpen}
                    onBack={handleCloseLaunch}
                >
                    {content.type === 'video' ? (
                        <video
                            ref={videoRef}
                            src={resolvePlayerSrc(content.entryPoint)}
                            controls
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-contain bg-black"
                            onPlay={handlePlay}
                            onPause={handlePause}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={handleEnded}
                            onLoadedMetadata={(e) => {
                                setDuration(e.target.duration);
                                ensureVideoAutoplay();
                            }}
                            onCanPlay={ensureVideoAutoplay}
                        />
                    ) : (
                        <>
                            <iframe
                                key={iframeRenderKey}
                                ref={iframeRef}
                                src={iframeSrc || resolvePlayerSrc(content.entryPoint)}
                                className="w-full h-full border-none transition-opacity duration-150"
                                style={{
                                    opacity: content.type === 'tincan' && !isTinCanFrameReady ? 0 : 1,
                                    transform: 'translateZ(0)',
                                    willChange: 'transform,width,opacity',
                                }}
                                allow="fullscreen; autoplay; camera; microphone; geolocation"
                                sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
                                title={content.title}
                                onLoad={() => {
                                    setIsTinCanFrameReady(false);
                                    if (frameRevealTimeoutRef.current) clearTimeout(frameRevealTimeoutRef.current);
                                    frameRevealTimeoutRef.current = setTimeout(() => {
                                        setIsTinCanFrameReady(true);
                                    }, 1800);
                                    bindInnerContentFrameLoadHandler();
                                    runIframeRuntimeSync();
                                    scheduleDeferredIframeRuntimeSync();
                                }}
                            />
                            {content.type === 'tincan' && !isTinCanFrameReady && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1220]">
                                    <div className="flex items-center gap-3 text-white/80 text-sm">
                                        <span className="w-3 h-3 rounded-full bg-violet-400 animate-pulse"></span>
                                        Loading lesson...
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </LearningVideoPlayer>

                <div
                    className={`h-full overflow-hidden transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isLearningAiOpen
                            ? 'fixed inset-y-0 right-0 z-[45] w-[88vw] max-w-[320px] opacity-100 translate-x-0 shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:w-[320px] lg:max-w-none lg:shadow-none'
                            : 'w-0 opacity-0 translate-x-full pointer-events-none lg:translate-x-0'
                    }`}
                >
                    <div className="h-full w-[88vw] max-w-[320px] lg:w-[320px]">
                        <LearningAiAssistant
                            onClose={handleCloseLearningAi}
                            courseTitle={assistantCourseTitle}
                            sectionTitle={assistantSectionTitle}
                            lessonTitle={activeLessonTitle}
                            activeLessonIndex={selectedLessonIndex + 1}
                            totalLessons={lessonItems.length}
                            lessonOutline={assistantLessonOutline}
                            lessonSrc={resolvePlayerSrc(content.entryPoint)}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f1a] font-['Outfit',sans-serif]">
            <Navbar />

            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-16 sm:pb-20">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-[14px] text-white/50 mb-6">
                    <a href={course ? `/courses/${course.id}` : '/courses'} className="hover:text-white transition-colors">
                        {course ? 'Course' : 'Courses'}
                    </a>
                    <span>/</span>
                    <span className="text-white/80">{content.title}</span>
                </div>

                <div className="flex flex-col xl:flex-row gap-8">
                    {/* Main Player Area */}
                    <div className="flex-1 min-w-0">
                        {/* Player Container */}
                        <div className="bg-black rounded-2xl overflow-hidden shadow-2xl shadow-[#687EFF]/10 relative">
                            {content.type === 'video' ? (
                                <video
                                    ref={videoRef}
                                    src={resolvePlayerSrc(content.entryPoint)}
                                    controls
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full aspect-video"
                                    onPlay={handlePlay}
                                    onPause={handlePause}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={handleEnded}
                                    onLoadedMetadata={(e) => {
                                        setDuration(e.target.duration);
                                        ensureVideoAutoplay();
                                    }}
                                    onCanPlay={ensureVideoAutoplay}
                                />
                            ) : content.type === 'tincan' || content.type === 'web' ? (
                                <>
                                    <iframe
                                        key={iframeRenderKey}
                                        ref={iframeRef}
                                        src={iframeSrc || resolvePlayerSrc(content.entryPoint)}
                                        className="w-full h-[58vh] min-h-[320px] sm:min-h-[420px] lg:min-h-[520px] border-none transition-opacity duration-150"
                                        style={{
                                            opacity: content.type === 'tincan' && !isTinCanFrameReady ? 0 : 1,
                                            transform: 'translateZ(0)',
                                            willChange: 'transform,width,opacity',
                                        }}
                                        allow="fullscreen; autoplay; camera; microphone; geolocation"
                                        sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
                                        title={content.title}
                                        onLoad={() => {
                                            setIsTinCanFrameReady(false);
                                            if (frameRevealTimeoutRef.current) clearTimeout(frameRevealTimeoutRef.current);
                                            frameRevealTimeoutRef.current = setTimeout(() => {
                                                setIsTinCanFrameReady(true);
                                            }, 1800);
                                            bindInnerContentFrameLoadHandler();
                                            runIframeRuntimeSync();
                                            scheduleDeferredIframeRuntimeSync();
                                        }}
                                    />
                                    {content.type === 'tincan' && !isTinCanFrameReady && (
                                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
                                            <div className="flex items-center gap-3 text-white/80 text-sm">
                                                <span className="w-3 h-3 rounded-full bg-violet-400 animate-pulse"></span>
                                                Loading lesson...
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="w-full aspect-video flex items-center justify-center text-white/50">
                                    Unsupported content type
                                </div>
                            )}
                        </div>

                        {/* Title & Status */}
                        <div className="mt-6 flex items-start justify-between gap-4">
                            <div>
                                <h1 className="text-white text-[24px] font-semibold">{content.title}</h1>
                                <div className="flex items-center gap-4 mt-2 text-[14px] text-white/50">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium ${content.type === 'tincan' ? 'bg-purple-500/20 text-purple-300' :
                                            content.type === 'video' ? 'bg-blue-500/20 text-blue-300' :
                                                'bg-gray-500/20 text-gray-300'
                                        }`}>
                                        {content.type === 'tincan' ? (
                                            <>
                                                <Package className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span>TinCan Package</span>
                                            </>
                                        ) : (
                                            <>
                                                <Video className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span>Video</span>
                                            </>
                                        )}
                                    </span>
                                    <span>Uploaded: {new Date(content.uploadedAt).toLocaleDateString('th-TH')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Activities List (for TinCan) */}
                        {content.activities?.length > 0 && (
                            <div className="mt-8 bg-white/5 rounded-xl p-6 border border-white/10">
                                <h3 className="flex items-center gap-2 text-white text-[16px] font-semibold mb-4">
                                    <ListChecks className="w-4 h-4 text-white/70" aria-hidden="true" />
                                    <span>Activities</span>
                                </h3>
                                <div className="flex flex-col gap-2">
                                    {content.activities.map((act, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => {
                                                handleManualActivitySelect(i);
                                            }}
                                            className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                                selectedActivityIndex === i
                                                    ? 'bg-[#687EFF]/20 border border-[#687EFF]/40'
                                                    : 'hover:bg-white/5 border border-transparent'
                                            }`}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-[#687EFF]/20 text-[#687EFF] text-[12px] flex items-center justify-center font-medium">{i + 1}</div>
                                            <div className="min-w-0">
                                                <div className="text-white/90 text-[14px] truncate">{act.name || act}</div>
                                                {act.launch && <div className="text-white/40 text-[11px] truncate">{act.launch}</div>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Progress & xAPI Log */}
                    <div className="w-full xl:w-[340px] 2xl:w-[360px] shrink-0 flex flex-col gap-6">
                        {/* Progress Card */}
                        <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                            <h3 className="flex items-center gap-2 text-white text-[16px] font-semibold mb-4">
                                <BarChart3 className="w-4 h-4 text-white/70" aria-hidden="true" />
                                <span>Learning Progress</span>
                            </h3>

                            {/* Circular Progress */}
                            <div className="flex items-center justify-center mb-6">
                                <div className="relative w-[140px] h-[140px]">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                                        <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="8" />
                                        <circle cx="60" cy="60" r="52" fill="none" stroke={status === 'COMPLETED' ? '#1DBA9F' : '#687EFF'}
                                            strokeWidth="8" strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 52}`}
                                            strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
                                            className="transition-all duration-500"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-white text-[28px] font-bold">{progress}%</span>
                                        <span className="text-white/50 text-[12px]">Progress</span>
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex flex-col gap-3 text-[14px]">
                                <div className="flex justify-between">
                                    <span className="text-white/50">สถานะ</span>
                                    <span className={`font-medium ${status === 'COMPLETED' ? 'text-[#1DBA9F]' :
                                            status === 'LEARNING' ? 'text-[#5BC0DE]' :
                                                'text-white/50'
                                        }`}>
                                        {status === 'COMPLETED' ? ' เสร็จสิ้น' :
                                            status === 'LEARNING' ? ' กำลังเรียน' :
                                                (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Clock3 className="w-3.5 h-3.5" aria-hidden="true" />
                                                        <span>ยังไม่เริ่ม</span>
                                                    </span>
                                                )}
                                    </span>
                                </div>
                                {content.type === 'video' && (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-white/50">เวลาปัจจุบัน</span>
                                            <span className="text-white/80 font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-white/50">Content Type</span>
                                    <span className="text-white/80">{content.type === 'tincan' ? 'TinCan' : 'Video'}</span>
                                </div>
                            </div>
                        </div>

                        {/* xAPI Statement Log */}
                        <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                            <h3 className="flex items-center gap-2 text-white text-[16px] font-semibold mb-4">
                                <RadioTower className="w-4 h-4 text-white/70" aria-hidden="true" />
                                <span>xAPI Statements</span>
                                <span className="text-white/30 text-[12px] font-normal ml-2">Live</span>
                            </h3>
                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                                {statements.length === 0 ? (
                                    <p className="text-white/30 text-[13px] text-center py-4">No statements yet. Start learning to generate xAPI data.</p>
                                ) : statements.slice(0, 15).map((st, i) => (
                                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white/5 text-[12px]">
                                        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${st.verb?.display?.['en-US'] === 'completed' ? 'bg-[#1DBA9F]' :
                                                st.verb?.display?.['en-US'] === 'progressed' ? 'bg-[#687EFF]' :
                                                    st.verb?.display?.['en-US'] === 'played' ? 'bg-green-400' :
                                                        st.verb?.display?.['en-US'] === 'paused' ? 'bg-yellow-400' :
                                                            'bg-white/30'
                                            }`}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className="text-white/70 font-medium">{st.verb?.display?.['en-US'] || 'unknown'}</span>
                                                {st.result?.extensions?.['https://w3id.org/xapi/video/extensions/progress'] !== undefined && (
                                                    <span className="text-white/40">({st.result.extensions['https://w3id.org/xapi/video/extensions/progress']}%)</span>
                                                )}
                                            </div>
                                            <div className="text-white/30 truncate">{new Date(st.timestamp).toLocaleTimeString('th-TH')}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Refresh button */}
                            <button
                                onClick={async () => {
                                    const res = await fetch(`/api/xapi/statements?contentId=${resolvedContentId}&actor=${encodeURIComponent(learningUserId)}&limit=20`);
                                    if (res.ok) setStatements(await res.json());
                                }}
                                className="w-full mt-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] transition-colors"
                            >
                                ↻ Refresh Statements
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
