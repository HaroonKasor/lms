import prisma from '@/lib/prisma';
import { getSectionCompatMaps } from '@/lib/server/compat-db';
import { ensureDefaultOrganization, getUserDisplayName } from '@/lib/server/enterprise-context';
import { hasMailConfig, sendCourseExpiryReminderEmail } from '@/lib/server/mailer';
import { createNotification } from '@/lib/server/notifications';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS_LEFT = 3;
const rawSweepIntervalMs = Number(process.env.ENROLLMENT_EXPIRY_SWEEP_INTERVAL_MS || '');
const REMINDER_SWEEP_INTERVAL_MS = Math.max(
    60 * 1000,
    Number.isFinite(rawSweepIntervalMs) && rawSweepIntervalMs > 0
        ? rawSweepIntervalMs
        : 15 * 60 * 1000
);
const REMINDER_MAP_PREFIX = '__map__/mail/enrollment-expiry-reminder/';

let lastSweepAtMs = 0;
let sweepInFlight = null;

function normalizeDateOnly(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return '';
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toDateOnlyTime(value) {
    const normalized = normalizeDateOnly(value);
    if (!normalized) return null;
    const [year, month, day] = normalized.split('-').map((item) => Number(item));
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function getTodayDateOnlyTime() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
}

function getDaysLeftFromDateOnly(learnDateTo) {
    const targetTime = toDateOnlyTime(learnDateTo);
    if (!Number.isFinite(targetTime)) return null;
    const todayTime = getTodayDateOnlyTime();
    return Math.floor((targetTime - todayTime) / DAY_MS);
}

function getPrimarySectionId(course) {
    const sections = Array.isArray(course?.sections) ? course.sections : [];
    if (sections.length === 0) return null;
    const sorted = [...sections].sort((a, b) => {
        const activeA = a?.isActive ? 1 : 0;
        const activeB = b?.isActive ? 1 : 0;
        if (activeB !== activeA) return activeB - activeA;
        const orderA = Number(a?.orderNo || 0);
        const orderB = Number(b?.orderNo || 0);
        if (orderA !== orderB) return orderA - orderB;
        return Number(a?.id || 0) - Number(b?.id || 0);
    });
    const sectionId = Number(sorted[0]?.id || 0);
    return Number.isInteger(sectionId) && sectionId > 0 ? sectionId : null;
}

function getCandidateSectionIds(enrollment) {
    const fromProgress = Array.from(
        new Set(
            (Array.isArray(enrollment?.learning_progress) ? enrollment.learning_progress : [])
                .map((row) => Number(row?.sectionId || 0))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );
    if (fromProgress.length > 0) return fromProgress;

    const primarySectionId = getPrimarySectionId(enrollment?.courses);
    return primarySectionId ? [primarySectionId] : [];
}

function resolveNearestLearnExpiry(sectionIds = [], sectionSettingsBySectionId = {}) {
    let selected = null;
    for (const sectionId of sectionIds) {
        const settings = sectionSettingsBySectionId?.[String(sectionId)] || {};
        const isUnlimited = settings?.learnDateUnlimit !== false;
        if (isUnlimited) continue;
        const learnDateTo = normalizeDateOnly(settings?.learnDateTo);
        if (!learnDateTo) continue;
        const time = toDateOnlyTime(learnDateTo);
        if (!Number.isFinite(time)) continue;
        if (!selected || time < selected.time) {
            selected = {
                sectionId,
                learnDateTo,
                time,
            };
        }
    }
    return selected;
}

function getAppBaseUrl() {
    const primary = String(process.env.NEXT_PUBLIC_APP_URL || '').trim();
    if (primary) return primary.replace(/\/+$/, '');
    const fallback = String(process.env.APP_URL || '').trim();
    if (fallback) return fallback.replace(/\/+$/, '');
    return 'http://localhost:8080';
}

function buildReminderStoragePath(enrollmentId, learnDateTo) {
    return `${REMINDER_MAP_PREFIX}${String(enrollmentId || '').trim()}/${String(learnDateTo || '').trim()}`;
}

export async function runEnrollmentExpiryReminderSweep() {
    const mailEnabled = hasMailConfig();

    const organizationId = await ensureDefaultOrganization();
    const activeEnrollments = await prisma.enrollment.findMany({
        where: {
            organization_id: organizationId,
            status: { in: ['enrolled', 'in_progress'] },
        },
        select: {
            id: true,
            userId: true,
            courseId: true,
            courses: {
                select: {
                    id: true,
                    title: true,
                    sections: {
                        select: { id: true, orderNo: true, isActive: true },
                        orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
                    },
                },
            },
            organization_users: {
                select: {
                    users: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            profile: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                },
            },
            learning_progress: {
                select: { sectionId: true },
            },
        },
    });

    const allSectionIds = Array.from(
        new Set(
            activeEnrollments.flatMap((enrollment) => {
                const ids = [];
                for (const row of enrollment?.learning_progress || []) {
                    const sectionId = Number(row?.sectionId || 0);
                    if (Number.isInteger(sectionId) && sectionId > 0) ids.push(sectionId);
                }
                for (const section of enrollment?.courses?.sections || []) {
                    const sectionId = Number(section?.id || 0);
                    if (Number.isInteger(sectionId) && sectionId > 0) ids.push(sectionId);
                }
                return ids;
            })
        )
    );

    const sectionCompatMaps = allSectionIds.length > 0
        ? await getSectionCompatMaps(allSectionIds)
        : { sectionSettingsBySectionId: {} };
    const sectionSettingsBySectionId = sectionCompatMaps?.sectionSettingsBySectionId || {};
    const myLearningUrl = `${getAppBaseUrl()}/my-learning`;

    const candidates = [];
    for (const enrollment of activeEnrollments) {
        const learner = enrollment?.organization_users?.users;
        const learnerEmail = String(learner?.email || '').trim();
        if (!learnerEmail) continue;

        const candidateSectionIds = getCandidateSectionIds(enrollment);
        if (candidateSectionIds.length === 0) continue;

        const expiry = resolveNearestLearnExpiry(candidateSectionIds, sectionSettingsBySectionId);
        if (!expiry?.learnDateTo) continue;

        const daysLeft = getDaysLeftFromDateOnly(expiry.learnDateTo);
        if (daysLeft !== REMINDER_DAYS_LEFT) continue;

        candidates.push({
            enrollmentId: Number(enrollment.id || 0),
            userId: Number(enrollment.userId || 0),
            courseName: String(enrollment?.courses?.title || 'Course').trim() || 'Course',
            learnerName: getUserDisplayName(learner) || learner?.username || learnerEmail,
            learnerEmail,
            learnDateTo: expiry.learnDateTo,
            daysLeft,
            storagePath: buildReminderStoragePath(enrollment.id, expiry.learnDateTo),
        });
    }

    if (candidates.length === 0) {
        return {
            success: true,
            skipped: false,
            reason: null,
            scanned: activeEnrollments.length,
            matched: 0,
            sent: 0,
        };
    }

    const existing = await prisma.learningAsset.findMany({
        where: {
            organization_id: organizationId,
            assetType: 'document',
            storagePath: { in: candidates.map((item) => item.storagePath) },
        },
        select: { storagePath: true },
    });
    const sentStoragePaths = new Set(
        existing
            .map((item) => String(item?.storagePath || '').trim())
            .filter(Boolean)
    );

    let sent = 0;
    let notificationsSent = 0;
    for (const item of candidates) {
        if (!item.storagePath || sentStoragePaths.has(item.storagePath)) continue;
        try {
            await createNotification({
                organizationId,
                type: 'COURSE_EXPIRING_SOON',
                title: 'Course Near Expiry',
                message: `"${item.courseName}" will expire in ${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'}.`,
                payload: {
                    kind: 'course_expiring_soon',
                    enrollmentId: item.enrollmentId,
                    courseName: item.courseName,
                    daysLeft: item.daysLeft,
                    learnDateTo: item.learnDateTo,
                    actionUrl: '/my-learning',
                },
                severity: 'critical',
                category: 'COURSE',
                recipientUserIds: [item.userId],
            });
            notificationsSent += 1;

            if (mailEnabled) {
                await sendCourseExpiryReminderEmail({
                    to: item.learnerEmail,
                    learnerName: item.learnerName,
                    courseName: item.courseName,
                    daysLeft: item.daysLeft,
                    learnDateTo: item.learnDateTo,
                    myLearningUrl,
                });
                sent += 1;
            }

            await prisma.learningAsset.create({
                data: {
                    organization_id: organizationId,
                    assetType: 'document',
                    title: `Enrollment expiry reminder (${item.enrollmentId})`,
                    storagePath: item.storagePath,
                    metadataJson: {
                        kind: 'enrollment-expiry-reminder',
                        enrollmentId: item.enrollmentId,
                        userId: item.userId,
                        learnDateTo: item.learnDateTo,
                        daysLeft: item.daysLeft,
                        hasEmail: mailEnabled,
                        sentAt: new Date().toISOString(),
                    },
                },
                select: { id: true },
            });
            sentStoragePaths.add(item.storagePath);
        } catch (mailErr) {
            console.error('[enrollment-expiry-reminder] send failed', {
                enrollmentId: item.enrollmentId,
                userId: item.userId,
                email: item.learnerEmail,
                error: mailErr,
            });
        }
    }

    return {
        success: true,
        skipped: false,
        reason: null,
        mailEnabled,
        scanned: activeEnrollments.length,
        matched: candidates.length,
        notificationsSent,
        sent,
    };
}

export async function triggerEnrollmentExpiryReminderSweep({ force = false } = {}) {
    const now = Date.now();
    if (!force && (now - lastSweepAtMs) < REMINDER_SWEEP_INTERVAL_MS) {
        return {
            success: true,
            skipped: true,
            reason: 'throttled',
            nextRunInMs: REMINDER_SWEEP_INTERVAL_MS - (now - lastSweepAtMs),
        };
    }

    if (sweepInFlight) return sweepInFlight;

    lastSweepAtMs = now;
    sweepInFlight = runEnrollmentExpiryReminderSweep()
        .catch((err) => {
            console.error('[enrollment-expiry-reminder] sweep failed', err);
            return {
                success: false,
                skipped: false,
                reason: 'failed',
                error: String(err?.message || err || 'Unknown error'),
            };
        })
        .finally(() => {
            sweepInFlight = null;
        });

    return sweepInFlight;
}
