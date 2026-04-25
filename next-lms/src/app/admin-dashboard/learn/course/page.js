'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/admin/layout/AdminShell';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminEntriesControl,
    AdminPageHeader,
    AdminPagination,
    AdminSearchInput,
    AdminStatusPill,
    AdminTable,
    AdminTableHead,
    AdminTableWrap,
    AdminTd,
    AdminTh,
    AdminToastStack,
    AdminToolbar,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
} from '@/components/admin/ui/AdminPrimitives';

function toEffectiveLearnerStatus(row) {
    const normalizedStatus = String(row?.status || '').toUpperCase();
    const numericProgress = Number(row?.progress ?? row?.progressPercent ?? 0);
    const safeProgress = Number.isFinite(numericProgress)
        ? Math.max(0, Math.min(100, Math.round(numericProgress)))
        : 0;

    const hasStartedAt = Boolean(row?.startedAt);
    const hasCompletedAt = Boolean(row?.completedAt);

    if (
        normalizedStatus === 'FAILED'
        || normalizedStatus === 'CANCELLED'
        || normalizedStatus === 'SUSPENDED'
        || normalizedStatus === 'DROPPED'
    ) {
        return 'SUSPENDED';
    }

    if (normalizedStatus === 'COMPLETED' || hasCompletedAt || safeProgress >= 100) {
        return 'COMPLETED';
    }

    if (
        normalizedStatus === 'LEARNING'
        || normalizedStatus === 'IN_PROGRESS'
        || hasStartedAt
        || safeProgress > 0
    ) {
        return 'LEARNING';
    }

    return 'NOT_STARTED';
}

function normalizeBaseUrl(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withProtocol);
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/+$/, '');
    } catch {
        return '';
    }
}

function isLocalOrPrivateHost(hostname = '') {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host) return true;
    if (host === 'localhost' || host === '0.0.0.0' || host === '::1') return true;
    if (host.startsWith('127.')) return true;
    if (host.startsWith('10.')) return true;
    if (host.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    return false;
}

function resolveQrEnrollmentUrl(payload = {}) {
    const path = String(payload?.path || '').trim();
    const apiUrl = String(payload?.url || '').trim();
    const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || '');
    const browserBase = typeof window !== 'undefined' ? normalizeBaseUrl(window.location.origin || '') : '';

    const candidates = [
        apiUrl,
        path && envBase ? new URL(path, envBase).toString() : '',
        path && browserBase ? new URL(path, browserBase).toString() : '',
    ].filter(Boolean);

    const publicCandidate = candidates.find((candidate) => {
        try {
            return !isLocalOrPrivateHost(new URL(candidate).hostname);
        } catch {
            return false;
        }
    });
    if (publicCandidate) return publicCandidate;

    return candidates[0] || path || '';
}

function normalizeSectionGroupCode(value = '') {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return '';
    if (normalized === 'ADMIN' || normalized === 'ADMINISTRATOR') return 'ADMIN';
    if (normalized === 'INSTRUCTOR' || normalized === 'INSTRUCTURE' || normalized === 'TEACHER') return 'INSTRUCTOR';
    if (normalized === 'LEARNER' || normalized === 'USER' || normalized === 'STUDENT') return 'LEARNER';
    return '';
}

function normalizeSectionGroupsValue(value = '') {
    const selected = Array.from(new Set(
        String(value || '')
            .split(',')
            .map((item) => normalizeSectionGroupCode(item))
            .filter(Boolean)
    ));
    if (selected.length > 0) return selected.join(',');
    return 'LEARNER';
}

function mapLegacyStatusToPublishStatus(status = '') {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'active') return 'published';
    if (normalized === 'inactive') return 'draft';
    if (normalized === 'archived') return 'archived';
    return 'draft';
}

function mapLegacyPublicToVisibility(isPublic) {
    if (typeof isPublic === 'boolean') return isPublic ? 'public' : 'private';
    return 'organization';
}

export default function CourseManagementPage() {
    const searchParams = useSearchParams();
    const thumbnailInputRef = useRef(null);
    const toastTimersRef = useRef(new Map());
    const getDefaultCourseForm = () => ({
        courseCode: '', name: '', nameEn: '', thumbnail: '', detail: '',
        registerDateFrom: '', registerDateTo: '', registerUnlimit: false,
        tincanId: '', tincanCondition: 'all_completed',
        durationHours: 0, durationMinutes: 0,
        maxLearner: 1, maxLearnerUnlimit: false, lessons: 0,
        status: '', isPublic: null, webboard: null,
        autoApprove: null, certificate: null, autoCert: null,
        category: '', categoryId: '', prerequisites: [], instructor: '', instructorExperience: '',
    });
    const getDefaultSectionForm = () => ({
        sessionCode: '', name: '', detail: '',
        registerDateFrom: '', registerDateTo: '', registerUnlimit: false,
        learnDateTo: '', learnDateUnlimit: true,
        maxLearner: 0, maxLearnerUnlimit: true,
        status: '', isPublic: null, autoApprove: null,
        certificate: null, autoCert: null,
        cohortModule: false, groups: 'LEARNER',
    });

    const [view, setView] = useState('COURSE_LIST');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [editingCourseId, setEditingCourseId] = useState(null);
    const [editingSectionId, setEditingSectionId] = useState(null);
    const [selectedSection, setSelectedSection] = useState(null);
    const [loading, setLoading] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [courseSearch, setCourseSearch] = useState('');
    const [courseStatusFilter, setCourseStatusFilter] = useState('ALL');
    const [courseEntries, setCourseEntries] = useState(10);
    const [coursePage, setCoursePage] = useState(1);
    const [sectionSearch, setSectionSearch] = useState('');
    const [sectionEntries, setSectionEntries] = useState(10);
    const [sectionPage, setSectionPage] = useState(1);
    const [learnerSearch, setLearnerSearch] = useState('');
    const [learnerEntries, setLearnerEntries] = useState(10);
    const [learnerPage, setLearnerPage] = useState(1);

    // Data from DB
    const [courses, setCourses] = useState([]);
    const [sections, setSections] = useState([]);
    const [learners, setLearners] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tincanContents, setTincanContents] = useState([]);
    const [qrEnrollUrl, setQrEnrollUrl] = useState('');
    const [qrExpiresAt, setQrExpiresAt] = useState('');
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState('');

    // Course form state
    const [courseForm, setCourseForm] = useState(getDefaultCourseForm());

    const prerequisiteOptions = useMemo(() => {
        const names = courses
            .map((course) => (course?.name || '').trim())
            .filter(Boolean);
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }, [courses]);

    // Section form state
    const [sectionForm, setSectionForm] = useState(getDefaultSectionForm());

    const getSectionCertificateDefaultsFromCourse = useCallback(() => {
        const hasCertificate = Boolean(selectedCourse?.certificate);
        const autoByMode = String(selectedCourse?.certificateMode || '').toLowerCase() === 'auto';
        const autoFromCourse = selectedCourse?.autoCert;
        const resolvedAutoCert = typeof autoFromCourse === 'boolean' ? autoFromCourse : autoByMode;
        return {
            certificate: hasCertificate,
            autoCert: hasCertificate ? Boolean(resolvedAutoCert) : false,
        };
    }, [selectedCourse]);

    const requestedCourseId = useMemo(() => {
        const raw = String(searchParams.get('courseId') || searchParams.get('lrscourseid') || '').trim();
        const value = Number(raw);
        return Number.isInteger(value) && value > 0 ? value : null;
    }, [searchParams]);

    useEffect(() => {
        return () => {
            for (const timer of toastTimersRef.current.values()) clearTimeout(timer);
            toastTimersRef.current.clear();
        };
    }, []);

    const dismissToast = useCallback((id) => {
        const timer = toastTimersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            toastTimersRef.current.delete(id);
        }
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback((tone, message, title = '') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, tone, message, title }]);
        const timer = setTimeout(() => dismissToast(id), 3200);
        toastTimersRef.current.set(id, timer);
    }, [dismissToast]);

    // Load courses from API
    const loadCourses = async () => {
        try {
            const res = await fetch('/api/courses');
            if (res.ok) setCourses(await res.json());
        } catch (e) { console.error(e); }
    };

    const loadCategories = async () => {
        try {
            const res = await fetch('/api/categories');
            if (res.ok) setCategories(await res.json());
        } catch (e) { console.error(e); }
    };

    const loadTincanContents = async () => {
        try {
            const res = await fetch('/api/content/upload');
            if (!res.ok) return;
            const data = await res.json();
            setTincanContents(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
    };

    // Load sections for selected course
    const loadSections = async (courseId) => {
        try {
            const res = await fetch(`/api/courses/sections?courseId=${courseId}`);
            if (res.ok) setSections(await res.json());
        } catch (e) { console.error(e); }
    };

    const loadLearners = useCallback(async (courseId, sectionId = null) => {
        if (!courseId) {
            setLearners([]);
            return;
        }

        try {
            const params = new URLSearchParams({
                courseId: String(courseId),
                raw: '1',
                scope: 'all',
            });
            const res = await fetch(`/api/enrollments?${params.toString()}`);
            if (!res.ok) {
                setLearners([]);
                return;
            }

            const data = await res.json();
            const rows = Array.isArray(data) ? data : [];
            setLearners(rows.map((row) => {
                const learner = row?.learner || {};
                const effectiveStatus = toEffectiveLearnerStatus(row);
                const learnDateSource = row?.startedAt || row?.lastActivityAt || row?.enrolledAt || null;
                const numericProgress = Number(row?.progress ?? row?.progressPercent ?? 0);
                const safeProgress = Number.isFinite(numericProgress)
                    ? Math.max(0, Math.min(100, Math.round(numericProgress)))
                    : 0;

                return {
                    id: String(row?.id || `${learner?.userId || 'user'}-${row?.courseId || courseId}`),
                    enrollmentId: Number(row?.id || 0),
                    userId: Number(learner?.userId || 0),
                    sectionId: Number(sectionId || row?.sectionId || 0) || null,
                    username: learner?.username || learner?.email || '-',
                    name: learner?.fullName || learner?.username || learner?.email || '-',
                    learnDate: learnDateSource ? new Date(learnDateSource).toLocaleDateString('th-TH') : '-',
                    status: effectiveStatus || 'NOT_STARTED',
                    progress: safeProgress,
                };
            }));
        } catch (e) {
            console.error(e);
            setLearners([]);
        }
    }, []);

    const generateEnrollmentQr = useCallback(async () => {
        if (!selectedCourse?.id) return;
        setQrLoading(true);
        setQrError('');
        try {
            const res = await fetch('/api/enrollments/qr-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId: Number(selectedCourse.id),
                    sectionId: Number(selectedSection?.id || 0) || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.path) {
                throw new Error(data?.error || 'สร้าง QR ไม่สำเร็จ');
            }

            const absolute = resolveQrEnrollmentUrl(data);
            setQrEnrollUrl(absolute);

            const expiresSeconds = Number(data?.expiresInSeconds || 0);
            if (Number.isFinite(expiresSeconds) && expiresSeconds > 0) {
                const expiry = new Date(Date.now() + (expiresSeconds * 1000));
                setQrExpiresAt(expiry.toLocaleString('th-TH'));
            } else {
                setQrExpiresAt('');
            }
        } catch (error) {
            setQrError(error?.message || 'สร้าง QR ไม่สำเร็จ');
            setQrEnrollUrl('');
            setQrExpiresAt('');
        } finally {
            setQrLoading(false);
        }
    }, [selectedCourse?.id, selectedSection?.id]);

    useEffect(() => { loadCourses(); loadCategories(); loadTincanContents(); }, []);
    useEffect(() => { if (selectedCourse) loadSections(selectedCourse.id); }, [selectedCourse]);
    useEffect(() => {
        if (view !== 'SECTION_LEARNERS' || !selectedCourse?.id) return undefined;

        const refresh = () => {
            loadLearners(selectedCourse.id, selectedSection?.id || null);
        };
        refresh();

        const timer = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            refresh();
        }, 10000);

        return () => clearInterval(timer);
    }, [view, selectedCourse?.id, selectedSection?.id, loadLearners]);

    useEffect(() => {
        if (view !== 'SECTION_LEARNERS' || !selectedCourse?.id) return;
        generateEnrollmentQr();
    }, [view, selectedCourse?.id, selectedSection?.id, generateEnrollmentQr]);

    useEffect(() => {
        if (!requestedCourseId || !Array.isArray(courses) || courses.length === 0) return;
        const matched = courses.find((course) => Number(course?.id || 0) === requestedCourseId);
        if (!matched) return;
        if (Number(selectedCourse?.id || 0) !== requestedCourseId) {
            setSelectedCourse(matched);
        }
        setView('SECTION_LIST');
    }, [requestedCourseId, courses, selectedCourse]);

    const filteredCourses = useMemo(() => {
        const keyword = courseSearch.trim().toLowerCase();
        return courses.filter((course) => {
            const matchesStatus = courseStatusFilter === 'ALL' || String(course?.status || '').toLowerCase() === courseStatusFilter.toLowerCase();
            if (!matchesStatus) return false;
            if (!keyword) return true;
            return [course?.name, course?.courseCode, course?.category]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));
        });
    }, [courses, courseSearch, courseStatusFilter]);

    const totalCoursePages = useMemo(() => Math.max(1, Math.ceil(filteredCourses.length / courseEntries)), [filteredCourses.length, courseEntries]);
    const pagedCourses = useMemo(() => {
        const start = (coursePage - 1) * courseEntries;
        return filteredCourses.slice(start, start + courseEntries);
    }, [filteredCourses, coursePage, courseEntries]);

    useEffect(() => {
        setCoursePage(1);
    }, [courseEntries, courseSearch, courseStatusFilter, filteredCourses.length]);

    useEffect(() => {
        if (coursePage > totalCoursePages) setCoursePage(totalCoursePages);
    }, [coursePage, totalCoursePages]);

    const courseSections = useMemo(() => sections.filter((section) => section.courseId === selectedCourse?.id), [sections, selectedCourse?.id]);
    const filteredSections = useMemo(() => {
        const keyword = sectionSearch.trim().toLowerCase();
        return courseSections.filter((section) => {
            if (!keyword) return true;
            return [section?.name, section?.sessionCode, section?.detail]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));
        });
    }, [courseSections, sectionSearch]);

    const totalSectionPages = useMemo(() => Math.max(1, Math.ceil(filteredSections.length / sectionEntries)), [filteredSections.length, sectionEntries]);
    const pagedSections = useMemo(() => {
        const start = (sectionPage - 1) * sectionEntries;
        return filteredSections.slice(start, start + sectionEntries);
    }, [filteredSections, sectionPage, sectionEntries]);

    useEffect(() => {
        setSectionPage(1);
    }, [sectionEntries, sectionSearch, filteredSections.length, selectedCourse?.id]);

    useEffect(() => {
        if (sectionPage > totalSectionPages) setSectionPage(totalSectionPages);
    }, [sectionPage, totalSectionPages]);

    const filteredLearners = useMemo(() => {
        const keyword = learnerSearch.trim().toLowerCase();
        return learners.filter((learner) => {
            if (!keyword) return true;
            return [learner?.username, learner?.name, learner?.status]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));
        });
    }, [learners, learnerSearch]);

    const totalLearnerPages = useMemo(() => Math.max(1, Math.ceil(filteredLearners.length / learnerEntries)), [filteredLearners.length, learnerEntries]);
    const pagedLearners = useMemo(() => {
        const start = (learnerPage - 1) * learnerEntries;
        return filteredLearners.slice(start, start + learnerEntries);
    }, [filteredLearners, learnerPage, learnerEntries]);

    useEffect(() => {
        setLearnerPage(1);
    }, [learnerEntries, learnerSearch, filteredLearners.length, selectedSection?.id, selectedCourse?.id]);

    useEffect(() => {
        if (learnerPage > totalLearnerPages) setLearnerPage(totalLearnerPages);
    }, [learnerPage, totalLearnerPages]);

    const generateNextCourseCode = useCallback(() => {
        const numericCodes = (courses || [])
            .map((c) => String(c?.courseCode || '').trim())
            .filter((code) => /^\d+$/.test(code))
            .map(Number);
        const next = numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : 1;
        const padWidth = numericCodes.length > 0
            ? Math.max(2, String(Math.max(...numericCodes)).length)
            : 2;
        return String(next).padStart(padWidth, '0');
    }, [courses]);

    const openCourseCreate = () => {
        setEditingCourseId(null);
        setCourseForm({ ...getDefaultCourseForm(), courseCode: generateNextCourseCode() });
        setView('COURSE_CREATE');
    };

    const openSectionCreate = () => {
        setEditingSectionId(null);
        setSectionForm({
            ...getDefaultSectionForm(),
            ...getSectionCertificateDefaultsFromCourse(),
        });
        setView('SECTION_CREATE');
    };

    const handleEditSection = (section) => {
        const certificateDefaults = getSectionCertificateDefaultsFromCourse();
        setEditingSectionId(section.id);
        setSectionForm({
            ...getDefaultSectionForm(),
            ...section,
            groups: normalizeSectionGroupsValue(section?.groups || ''),
            maxLearner: Number(section?.maxLearner ?? 0),
            maxLearnerUnlimit: section?.maxLearnerUnlimit ?? section?.maxLearner == null,
            status: section?.status || (section?.isActive ? 'active' : 'inactive'),
            isPublic: typeof section?.isPublic === 'boolean'
                ? section.isPublic
                : (section?.status === 'public' ? true : false),
            certificate: certificateDefaults.certificate,
            autoCert: certificateDefaults.autoCert,
        });
        setView('SECTION_CREATE');
    };

    const handleEditCourse = (course) => {
        setEditingCourseId(course.id);
        setCourseForm({
            ...getDefaultCourseForm(),
            ...course,
            categoryId: course.categoryId ? String(course.categoryId) : '',
            tincanCondition: String(course?.tincanCondition || 'all_completed').trim() || 'all_completed',
            prerequisites: Array.isArray(course.prerequisites)
                ? course.prerequisites
                : String(course.prerequisites || '').split('|').map((v) => v.trim()).filter(Boolean),
        });
        setView('COURSE_CREATE');
    };

    // Submit course
    const handleCourseSubmit = async () => {
        if (!courseForm.name?.trim()) {
            pushToast('error', 'Please enter a course name.', 'Missing field');
            return;
        }
        if (!courseForm.categoryId) {
            pushToast('error', 'Please select a category before creating the course.', 'Missing field');
            return;
        }
        const isCreateMode = !editingCourseId;
        let normalizedCourseCode = String(courseForm.courseCode || '').trim();
        if (isCreateMode && !normalizedCourseCode) {
            normalizedCourseCode = generateNextCourseCode();
        }
        if (normalizedCourseCode) {
            const duplicateExists = courses.some((course) => {
                if (editingCourseId && course.id === editingCourseId) return false;
                return String(course.courseCode || '').trim().toLowerCase() === normalizedCourseCode.toLowerCase();
            });
            if (duplicateExists) {
                if (isCreateMode) {
                    normalizedCourseCode = generateNextCourseCode();
                } else {
                    pushToast('error', 'This course code is already in use. Please choose another one.', 'Duplicate course code');
                    return;
                }
            }
        }

        setLoading(true);
        try {
            const isEditMode = Boolean(editingCourseId);
            const publishStatus = mapLegacyStatusToPublishStatus(courseForm.status);
            const visibility = mapLegacyPublicToVisibility(courseForm.isPublic);
            const payloadBase = {
                ...courseForm,
                courseCode: normalizedCourseCode,
                publishStatus,
                visibility,
            };
            const payload = isEditMode ? { ...payloadBase, id: editingCourseId } : payloadBase;
            const res = await fetch('/api/courses', {
                method: isEditMode ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                const { course } = await res.json();
                await loadCourses();
                setCourseForm(getDefaultCourseForm());
                if (isEditMode) {
                    setEditingCourseId(null);
                    setView('COURSE_LIST');
                    pushToast('success', 'Course updated successfully.', 'Updated');
                } else {
                    setSelectedCourse(course);
                    setView('SECTION_LIST');
                    pushToast('success', 'Course created successfully.', 'Created');
                }
            } else {
                const data = await res.json().catch(() => ({}));
                pushToast('error', data.error || (editingCourseId ? 'Error updating course' : 'Error creating course'), 'Save failed');
            }
        } catch (e) {
            pushToast('error', e.message || 'Error saving course', 'Save failed');
        }
        setLoading(false);
    };

    // Submit section
    const handleSectionSubmit = async () => {
        if (!selectedCourse) return;
        if (!String(sectionForm.name || '').trim()) {
            pushToast('error', 'Please enter a section name.', 'Missing field');
            return;
        }

        setLoading(true);
        try {
            const isEditMode = Boolean(editingSectionId);
            const res = await fetch('/api/courses/sections', {
                method: isEditMode ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...sectionForm,
                    groups: normalizeSectionGroupsValue(sectionForm.groups),
                    courseId: selectedCourse.id,
                    ...(isEditMode ? { id: editingSectionId } : {}),
                }),
            });
            if (res.ok) {
                await loadSections(selectedCourse.id);
                await loadCourses();
                setView('SECTION_LIST');
                setEditingSectionId(null);
                setSectionForm(getDefaultSectionForm());
                pushToast('success', isEditMode ? 'Section updated successfully.' : 'Section created successfully.', isEditMode ? 'Updated' : 'Created');
            } else {
                const data = await res.json().catch(() => ({}));
                pushToast('error', data.error || (isEditMode ? 'Error updating section' : 'Error creating section'), 'Save failed');
            }
        } catch (e) {
            pushToast('error', e.message || 'Error saving section', 'Save failed');
        }
        setLoading(false);
    };

    // Delete course
    const handleDeleteCourse = async (id) => {
        if (!window.confirm('Delete this course?')) return;
        const res = await fetch(`/api/courses?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            pushToast('error', data.error || 'Unable to delete course', 'Delete failed');
            return;
        }
        await loadCourses();
        pushToast('success', 'Course deleted successfully.', 'Deleted');
    };

    // Delete section
    const handleDeleteSection = async (id) => {
        if (!window.confirm('Delete this section?')) return;
        const res = await fetch(`/api/courses/sections?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            pushToast('error', data.error || 'Unable to delete section', 'Delete failed');
            return;
        }
        if (selectedCourse) await loadSections(selectedCourse.id);
        await loadCourses();
        pushToast('success', 'Section deleted successfully.', 'Deleted');
    };

    const handleThumbnailSelect = () => {
        thumbnailInputRef.current?.click();
    };

    const handleThumbnailChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            pushToast('error', 'Please choose an image file only.', 'Invalid file');
            e.target.value = '';
            return;
        }
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/uploads/image', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.url) {
                throw new Error(data?.error || 'อัปโหลดรูปไม่สำเร็จ');
            }
            setCourseForm((prev) => ({ ...prev, thumbnail: data.url }));
            pushToast('success', 'Thumbnail uploaded successfully.', 'Upload complete');
        } catch (err) {
            pushToast('error', err.message || 'Thumbnail upload failed', 'Upload failed');
        } finally {
            e.target.value = '';
        }
    };

    // --- RENDER COURSE LIST ---
    const renderCourseList = () => (
        <AdminCard
            title="Course Library"
            action={(
                <button onClick={openCourseCreate} className="inline-flex h-9 items-center justify-center rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white transition hover:bg-white/25">
                    Create course
                </button>
            )}
        >
            <AdminToolbar
                left={(
                    <>
                        <AdminEntriesControl value={courseEntries} onChange={setCourseEntries} label="items" />
                        <select
                            value={courseStatusFilter}
                            onChange={(event) => setCourseStatusFilter(event.target.value)}
                            className="h-[38px] rounded-xl border border-[#DDE4FF] bg-white px-3 text-[13px] text-[#334155] outline-none focus:border-[#687EFF]"
                        >
                            <option value="ALL">All status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </>
                )}
                right={<AdminSearchInput value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Search course, code, or category" />}
            />
            <AdminTableWrap>
                <AdminTable>
                    <AdminTableHead>
                        <tr>
                            <AdminTh className="w-[72px]">No.</AdminTh>
                            <AdminTh className="w-[180px]">Category</AdminTh>
                            <AdminTh className="min-w-[220px]">Course</AdminTh>
                            <AdminTh className="min-w-[220px]">Registration</AdminTh>
                            <AdminTh className="w-[140px]">Max learners</AdminTh>
                            <AdminTh className="w-[120px] text-center">Status</AdminTh>
                            <AdminTh className="w-[160px] text-center">Tools</AdminTh>
                        </tr>
                    </AdminTableHead>
                    <tbody>
                        {pagedCourses.length === 0 ? (
                            <AdminBodyStateRow colSpan={7}>
                                {courseSearch || courseStatusFilter !== 'ALL' ? 'No courses matched the current filters.' : 'No courses yet. Create your first course to get started.'}
                            </AdminBodyStateRow>
                        ) : pagedCourses.map((course, idx) => (
                            <tr key={course.id} className="border-b border-[#EEF2FF] last:border-none hover:bg-[#FBFCFF]">
                                <AdminTd className="font-medium text-[#1E293B]">{(coursePage - 1) * courseEntries + idx + 1}</AdminTd>
                                <AdminTd>{course.category}</AdminTd>
                                <AdminTd>
                                    <div className="font-semibold text-[#1E293B]">{course.name}</div>
                                    <div className="mt-1 text-[12px] text-[#94A3B8]">{course.courseCode || '-'}</div>
                                </AdminTd>
                                <AdminTd>{course.registerUnlimit ? 'Unlimited' : `${course.registerDateFrom || '-'} to ${course.registerDateTo || '-'}`}</AdminTd>
                                <AdminTd>{course.maxLearnerUnlimit ? 'Unlimited' : course.maxLearner}</AdminTd>
                                <AdminTd className="text-center">
                                    <AdminStatusPill active={course.status === 'active'} activeLabel="Active" inactiveLabel="Inactive" />
                                </AdminTd>
                                <AdminTd className="text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => { setSelectedCourse(course); setView('SECTION_LIST'); }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE4FF] bg-white text-[#687EFF] transition hover:bg-[#F8FAFF]" title="Manage sections">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                                        </button>
                                        <button onClick={() => handleEditCourse(course)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE4FF] bg-white text-[#475569] transition hover:bg-[#F8FAFF]" title="Edit">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        <button onClick={() => handleDeleteCourse(course.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50" title="Delete">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                                        </button>
                                    </div>
                                </AdminTd>
                            </tr>
                        ))}
                    </tbody>
                </AdminTable>
            </AdminTableWrap>
            <AdminPagination
                currentPage={coursePage}
                totalPages={totalCoursePages}
                onPageChange={setCoursePage}
                totalItems={filteredCourses.length}
                startRow={filteredCourses.length === 0 ? 0 : (coursePage - 1) * courseEntries + 1}
                endRow={Math.min(coursePage * courseEntries, filteredCourses.length)}
            />
        </AdminCard>
    );

    // --- RENDER COURSE CREATE ---
    const renderCourseCreate = () => (
        <AdminCard
            title={editingCourseId ? 'Edit Course' : 'Create Course'}
            headerTone="secondary"
            action={(
                <button onClick={() => setView('COURSE_LIST')} className="text-sm font-medium text-[#687EFF] hover:underline">
                    &larr; Back to Courses
                </button>
            )}
        >
            <form className="flex w-full flex-col gap-[14px] text-[13px] font-medium text-[#334155]
                [&_input[type='text']]:rounded-xl [&_input[type='text']]:border [&_input[type='text']]:border-[#DDE4FF] [&_input[type='text']]:bg-white [&_input[type='text']]:px-3 [&_input[type='text']]:py-[9px] [&_input[type='text']]:outline-none [&_input[type='text']]:transition [&_input[type='text']]:focus:border-[#687EFF] [&_input[type='text']]:focus:ring-2 [&_input[type='text']]:focus:ring-[#687EFF]/20
                [&_input[type='number']]:rounded-xl [&_input[type='number']]:border [&_input[type='number']]:border-[#DDE4FF] [&_input[type='number']]:bg-white [&_input[type='number']]:px-3 [&_input[type='number']]:py-[9px] [&_input[type='number']]:outline-none [&_input[type='number']]:transition [&_input[type='number']]:focus:border-[#687EFF] [&_input[type='number']]:focus:ring-2 [&_input[type='number']]:focus:ring-[#687EFF]/20
                [&_input[type='date']]:rounded-xl [&_input[type='date']]:border [&_input[type='date']]:border-[#DDE4FF] [&_input[type='date']]:bg-white [&_input[type='date']]:px-3 [&_input[type='date']]:py-[9px] [&_input[type='date']]:outline-none [&_input[type='date']]:transition [&_input[type='date']]:focus:border-[#687EFF] [&_input[type='date']]:focus:ring-2 [&_input[type='date']]:focus:ring-[#687EFF]/20
                [&_select]:rounded-xl [&_select]:border [&_select]:border-[#DDE4FF] [&_select]:bg-white [&_select]:px-3 [&_select]:py-[9px] [&_select]:outline-none [&_select]:transition [&_select]:focus:border-[#687EFF] [&_select]:focus:ring-2 [&_select]:focus:ring-[#687EFF]/20
                [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[#DDE4FF] [&_textarea]:bg-white [&_textarea]:px-3 [&_textarea]:py-3 [&_textarea]:outline-none [&_textarea]:transition [&_textarea]:focus:border-[#687EFF] [&_textarea]:focus:ring-2 [&_textarea]:focus:ring-[#687EFF]/20">

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <label className="sm:w-[220px] text-right shrink-0">Course Code</label>
                    <div className="flex flex-col gap-1">
                        <input type="text" value={courseForm.courseCode} onChange={e => setCourseForm({ ...courseForm, courseCode: e.target.value })} className="w-[300px] max-w-full border border-gray-300 rounded px-2 py-[5px] outline-none focus:border-[#687EFF]" />
                        {!editingCourseId && (
                            <span className="text-[11px] text-[#94A3B8]">Auto-generated. Leave as-is or edit if you need a custom code.</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <label className="sm:w-[220px] text-right shrink-0">Course Name</label>
                    <input type="text" value={courseForm.name} onChange={e => setCourseForm({ ...courseForm, name: e.target.value })} className="w-[300px] max-w-full border border-gray-300 rounded px-2 py-[5px] outline-none focus:border-[#687EFF]" />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <label className="sm:w-[220px] text-right shrink-0">Course Name English</label>
                    <input type="text" value={courseForm.nameEn} onChange={e => setCourseForm({ ...courseForm, nameEn: e.target.value })} className="w-[300px] max-w-full border border-gray-300 rounded px-2 py-[5px] outline-none focus:border-[#687EFF]" />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-start pt-1">
                    <label className="sm:w-[220px] text-right shrink-0">Thumbnail</label>
                    <div className="flex flex-col gap-2">
                        <div className="w-[85px] h-[95px] border border-gray-300 rounded-sm bg-[#FAFAFA] flex items-center justify-center overflow-hidden">
                            {courseForm.thumbnail ? (
                                <img src={courseForm.thumbnail} alt="Course thumbnail preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[10px] text-gray-400">No image</span>
                            )}
                        </div>
                        <input
                            ref={thumbnailInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleThumbnailChange}
                            className="hidden"
                        />
                        <button type="button" onClick={handleThumbnailSelect} className="bg-[#E95E10] hover:bg-[#c9510c] text-white px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-colors shadow-sm w-fit">Select image</button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-start pt-2">
                    <label className="sm:w-[220px] text-right shrink-0 py-1">Detail</label>
                    <div className="flex-1 max-w-[550px] border border-gray-300 rounded bg-[#FAFAFA] min-h-[220px]">
                        <div className="border-b border-gray-300 px-2 py-1 flex flex-wrap gap-1 bg-gray-50/50">
                            {/* Toolbar Buttons mockup */}
                            <div className="flex gap-1 border-r border-gray-300 pr-1">
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-xs text-gray-600 rounded">Source</button>
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-500 rounded"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-500 rounded"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></button>
                            </div>
                            <div className="flex gap-0.5 border-r border-gray-300 pr-1 items-center">
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-700 font-bold font-serif">B</button>
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-700 italic font-serif">I</button>
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-700 underline font-serif">U</button>
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-700 line-through font-serif">S</button>
                            </div>
                            <div className="flex gap-0.5 items-center pl-1">
                                <span className="text-[12px] text-gray-600 flex items-center gap-1 border border-gray-200 px-2 py-0.5 bg-white cursor-pointer">Styles <svg fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5 opacity-60"><path d="M7 10l5 5 5-5z" /></svg></span>
                                <span className="text-[12px] text-gray-600 flex items-center gap-1 border border-gray-200 px-2 py-0.5 bg-white cursor-pointer">Format <svg fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5 opacity-60"><path d="M7 10l5 5 5-5z" /></svg></span>
                                <span className="text-[12px] text-gray-600 flex items-center gap-1 border border-gray-200 px-2 py-0.5 bg-white cursor-pointer">Font <svg fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5 opacity-60"><path d="M7 10l5 5 5-5z" /></svg></span>
                            </div>
                        </div>
                        <textarea
                            value={courseForm.detail}
                            onChange={e => setCourseForm({ ...courseForm, detail: e.target.value })}
                            className="w-full h-full min-h-[180px] border-none bg-white resize-y p-2 outline-none text-[13px]"
                        ></textarea>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-3">
                    <label className="sm:w-[220px] text-right shrink-0">Register Date</label>
                    <div className="flex flex-col gap-[8px]">
                        <div className="flex items-center gap-3">
                            <input
                                type="date"
                                value={courseForm.registerDateFrom}
                                onChange={(e) => setCourseForm({ ...courseForm, registerDateFrom: e.target.value })}
                                disabled={courseForm.registerUnlimit}
                                className="w-[120px] border border-gray-300 rounded px-2 py-[5px] outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            />
                            <span className="text-gray-400 text-[13px]">to</span>
                            <input
                                type="date"
                                value={courseForm.registerDateTo}
                                onChange={(e) => setCourseForm({ ...courseForm, registerDateTo: e.target.value })}
                                disabled={courseForm.registerUnlimit}
                                className="w-[120px] border border-gray-300 rounded px-2 py-[5px] outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            />
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#334155] text-[12px] font-normal">
                            <input
                                type="checkbox"
                                checked={courseForm.registerUnlimit}
                                onChange={(e) => setCourseForm({ ...courseForm, registerUnlimit: e.target.checked })}
                                className="w-3.5 h-3.5 accent-[#2EB89B] border-gray-300"
                            /> Unlimit
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-0.5">
                    <label className="sm:w-[220px] text-right shrink-0">Module</label>
                    <p className="text-[12px] text-gray-500">
                        Configure per section via <span className="font-medium text-[#334155]">Cohort Module</span>.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-2">
                    <label className="sm:w-[220px] text-right shrink-0">Content Tincan</label>
                    <select
                        value={courseForm.tincanId}
                        onChange={(e) => setCourseForm({ ...courseForm, tincanId: e.target.value })}
                        className="w-[300px] max-w-full border border-gray-300 rounded px-2 py-[5px] outline-none focus:border-[#687EFF] bg-white text-[13px]"
                    >
                        <option value="">-- Select TinCan Content --</option>
                        {tincanContents.length === 0 && <option value="" disabled>-- No TinCan content uploaded --</option>}
                        {tincanContents.map((content) => (
                            <option key={content.id} value={content.id}>
                                {content.title || content.fileName || content.id}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-start pt-1">
                    <label className="sm:w-[220px] text-right shrink-0">Tincan Learning Condition</label>
                    <div className="flex flex-col gap-1.5 text-[12px] font-normal text-[#555]">
                        <label className="flex items-center gap-2 cursor-pointer items-start">
                            <input
                                type="radio"
                                name="tincan_cl"
                                value="all_completed"
                                checked={courseForm.tincanCondition === 'all_completed'}
                                onChange={(e) => setCourseForm({ ...courseForm, tincanCondition: e.target.value })}
                                className="accent-[#68A1A2] w-3.5 h-3.5 mt-0.5"
                            /> All Completed
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer items-start">
                            <input
                                type="radio"
                                name="tincan_cl"
                                value="all_completed_by_content_success"
                                checked={courseForm.tincanCondition === 'all_completed_by_content_success'}
                                onChange={(e) => setCourseForm({ ...courseForm, tincanCondition: e.target.value })}
                                className="accent-[#68A1A2] w-3.5 h-3.5 mt-0.5"
                            /> <span>All Completed By Content<br />(Success)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer items-start">
                            <input
                                type="radio"
                                name="tincan_cl"
                                value="all_completed_by_content_completion_success"
                                checked={courseForm.tincanCondition === 'all_completed_by_content_completion_success'}
                                onChange={(e) => setCourseForm({ ...courseForm, tincanCondition: e.target.value })}
                                className="accent-[#68A1A2] w-3.5 h-3.5 mt-0.5"
                            /> <span>All Completed By Content<br />(Completion, Success)</span>
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-3">
                    <label className="sm:w-[220px] text-right shrink-0">เวลาที่ต้องใช้เรียน</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={courseForm.durationHours}
                            onChange={(e) => setCourseForm({ ...courseForm, durationHours: Number(e.target.value || 0) })}
                            className="w-[60px] border border-gray-300 rounded px-2 py-[4px] outline-none text-center"
                        />
                        <span className="text-[13px] bg-gray-100 px-3 py-1 border border-gray-300 rounded font-normal text-gray-600">ชั่วโมง</span>
                        <input
                            type="number"
                            value={courseForm.durationMinutes}
                            onChange={(e) => setCourseForm({ ...courseForm, durationMinutes: Number(e.target.value || 0) })}
                            className="w-[60px] border border-gray-300 rounded px-2 py-[4px] outline-none text-center ml-2"
                        />
                        <span className="text-[13px] bg-gray-100 px-3 py-1 border border-gray-300 rounded font-normal text-gray-600">นาที</span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-3">
                    <label className="sm:w-[220px] text-right shrink-0">Max Learner</label>
                    <div className="flex flex-col gap-1 w-[300px]">
                        <input
                            type="number"
                            value={courseForm.maxLearner}
                            disabled={courseForm.maxLearnerUnlimit}
                            onChange={(e) => setCourseForm({ ...courseForm, maxLearner: Number(e.target.value || 0) })}
                            className="w-full border border-gray-300 rounded px-2 py-[5px] outline-none disabled:bg-gray-100"
                        />
                        <label className="flex items-center gap-1.5 cursor-pointer pt-0.5 text-[12px] font-normal">
                            <input
                                type="checkbox"
                                checked={courseForm.maxLearnerUnlimit}
                                onChange={(e) => setCourseForm({ ...courseForm, maxLearnerUnlimit: e.target.checked })}
                                className="w-3.5 h-3.5 accent-[#2EB89B]"
                            /> Unlimit
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1">
                    <label className="sm:w-[220px] text-right shrink-0">จำนวนบทเรียน</label>
                    <input
                        type="number"
                        value={courseForm.lessons}
                        onChange={(e) => setCourseForm({ ...courseForm, lessons: Number(e.target.value || 0) })}
                        className="w-[300px] border border-gray-300 rounded px-2 py-[5px] outline-none"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-3">
                    <label className="sm:w-[220px] text-right shrink-0">Status</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_status" value="active" checked={courseForm.status === 'active'} onChange={(e) => setCourseForm({ ...courseForm, status: e.target.value })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Active
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_status" value="inactive" checked={courseForm.status === 'inactive'} onChange={(e) => setCourseForm({ ...courseForm, status: e.target.value })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Inactive
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <label className="sm:w-[220px] text-right shrink-0">Public</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_public" checked={courseForm.isPublic === true} onChange={() => setCourseForm({ ...courseForm, isPublic: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Public
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_public" checked={courseForm.isPublic === false} onChange={() => setCourseForm({ ...courseForm, isPublic: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> UnPublic
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1">
                    <label className="sm:w-[220px] text-right shrink-0">Webboard</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_webb" checked={courseForm.webboard === true} onChange={() => setCourseForm({ ...courseForm, webboard: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Enable
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_webb" checked={courseForm.webboard === false} onChange={() => setCourseForm({ ...courseForm, webboard: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Disable
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1">
                    <label className="sm:w-[220px] text-right shrink-0">Auto Approve Course</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_aac" checked={courseForm.autoApprove === true} onChange={() => setCourseForm({ ...courseForm, autoApprove: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Auto
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_aac" checked={courseForm.autoApprove === false} onChange={() => setCourseForm({ ...courseForm, autoApprove: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Manual
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1">
                    <label className="sm:w-[220px] text-right shrink-0">Certificate</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_cert" checked={courseForm.certificate === true} onChange={() => setCourseForm({ ...courseForm, certificate: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_cert" checked={courseForm.certificate === false} onChange={() => setCourseForm({ ...courseForm, certificate: false, autoCert: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> No
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1">
                    <label className="sm:w-[220px] text-right shrink-0">Auto Approve Certificate</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_aacert" checked={courseForm.autoCert === true} onChange={() => setCourseForm({ ...courseForm, autoCert: true, certificate: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_aacert" checked={courseForm.autoCert === false} onChange={() => setCourseForm({ ...courseForm, autoCert: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> No
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <label className="sm:w-[220px] text-right shrink-0">Category</label>
                    <select
                        value={courseForm.categoryId}
                        onChange={(e) => {
                            const selectedCategoryId = e.target.value;
                            const selectedCategory = categories.find((cat) => String(cat.id) === selectedCategoryId);
                            setCourseForm({
                                ...courseForm,
                                categoryId: selectedCategoryId,
                                category: selectedCategory?.name || '',
                            });
                        }}
                        className="w-[300px] border border-gray-300 rounded px-2 py-[5px] outline-none bg-white"
                    >
                        <option value="">-- Select category --</option>
                        {categories.length === 0 && <option value="" disabled>-- No category, please create first --</option>}
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-start pt-1">
                    <label className="sm:w-[220px] text-right shrink-0 pt-1">Prerequisites</label>
                    <div className="w-[300px] max-w-full">
                        <select
                            multiple
                            size="5"
                            disabled={prerequisiteOptions.length === 0}
                            value={courseForm.prerequisites}
                            onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                                setCourseForm({ ...courseForm, prerequisites: selected });
                            }}
                            className="w-full border border-gray-300 px-1 py-1 outline-none bg-white text-[12px] font-normal overflow-y-auto"
                            style={{ height: '100px' }}
                        >
                            {prerequisiteOptions.length === 0 && (
                                <option value="" disabled>
                                    -- No courses yet --
                                </option>
                            )}
                            {prerequisiteOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-start pt-1 pb-10">
                    <label className="sm:w-[220px] text-right shrink-0 pt-2">Instructor</label>
                    <div className="w-[300px] max-w-full space-y-2">
                        <input
                            type="text"
                            value={courseForm.instructor}
                            onChange={(e) => setCourseForm({ ...courseForm, instructor: e.target.value })}
                            placeholder="Instructor name"
                            className="w-full border border-gray-300 rounded px-2 py-[5px] outline-none bg-white text-[13px]"
                        />
                        <input
                            type="text"
                            value={courseForm.instructorExperience}
                            onChange={(e) => setCourseForm({ ...courseForm, instructorExperience: e.target.value })}
                            placeholder="Instructor experience (e.g. 8+ Years Experience)"
                            className="w-full border border-gray-300 rounded px-2 py-[5px] outline-none bg-white text-[13px]"
                        />
                    </div>
                </div>

                <div className="mt-6 flex w-full justify-center gap-3 border-t border-[#E8EEFF] pt-5">
                    <button type="button" onClick={handleCourseSubmit} disabled={loading} className={adminPrimaryButtonClass}>
                        {loading ? 'Working...' : (editingCourseId ? 'Update course' : 'Create course')}
                    </button>
                    <button type="button" onClick={() => { setEditingCourseId(null); setCourseForm(getDefaultCourseForm()); setView('COURSE_LIST'); }} className={adminSecondaryButtonClass}>
                        Cancel
                    </button>
                </div>
            </form>
        </AdminCard>
    );

    // --- RENDER SECTION LIST ---
    const renderSectionList = () => {
        return (
            <AdminCard
                title={`Sections · ${selectedCourse?.name || '-'}`}
                action={(
                    <button onClick={openSectionCreate} className="inline-flex h-9 items-center justify-center rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white transition hover:bg-white/25">
                        Create section
                    </button>
                )}
            >
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-[13px] text-[#64748B]">
                        <span className="font-semibold text-[#1E293B]">Category:</span> {selectedCourse?.category || '-'}
                    </div>
                    <button onClick={() => setView('COURSE_LIST')} className="text-sm font-medium text-[#687EFF] hover:underline">
                        &larr; Back to Courses
                    </button>
                </div>
                <AdminToolbar
                    left={<AdminEntriesControl value={sectionEntries} onChange={setSectionEntries} label="items" />}
                    right={<AdminSearchInput value={sectionSearch} onChange={(event) => setSectionSearch(event.target.value)} placeholder="Search section name or code" />}
                />
                <AdminTableWrap>
                    <AdminTable>
                        <AdminTableHead>
                            <tr>
                                <AdminTh className="w-[72px]">No.</AdminTh>
                                <AdminTh className="min-w-[220px]">Section</AdminTh>
                                <AdminTh className="min-w-[200px]">Registration</AdminTh>
                                <AdminTh className="w-[160px]">Learning</AdminTh>
                                <AdminTh className="w-[140px]">Max learners</AdminTh>
                                <AdminTh className="w-[160px] text-center">Tools</AdminTh>
                            </tr>
                        </AdminTableHead>
                        <tbody>
                            {pagedSections.length === 0 ? (
                                <AdminBodyStateRow colSpan={6}>
                                    {sectionSearch ? 'No sections matched the current search.' : 'No sections found. Create one to get started.'}
                                </AdminBodyStateRow>
                            ) : pagedSections.map((sec, idx) => (
                                <tr key={sec.id} className="border-b border-[#EEF2FF] last:border-none hover:bg-[#FBFCFF]">
                                    <AdminTd className="font-medium text-[#1E293B]">{(sectionPage - 1) * sectionEntries + idx + 1}</AdminTd>
                                    <AdminTd>
                                        <div className="font-semibold text-[#1E293B]">{sec.name}</div>
                                        <div className="mt-1 text-[12px] text-[#94A3B8]">{sec.sessionCode || '-'}</div>
                                    </AdminTd>
                                    <AdminTd>{sec.registerUnlimit ? 'Unlimited' : `${sec.registerDateFrom || '-'} to ${sec.registerDateTo || '-'}`}</AdminTd>
                                    <AdminTd>{sec.learnDateUnlimit ? 'Unlimited' : (sec.learnDateTo || '-')}</AdminTd>
                                    <AdminTd>{sec.maxLearnerUnlimit ? 'Unlimited' : sec.maxLearner}</AdminTd>
                                    <AdminTd className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={async () => {
                                                setSelectedSection(sec);
                                                await loadLearners(selectedCourse?.id, sec?.id);
                                                setView('SECTION_LEARNERS');
                                            }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE4FF] bg-white text-[#687EFF] transition hover:bg-[#F8FAFF]" title="Learners">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"></path></svg>
                                            </button>
                                            <button onClick={() => handleEditSection(sec)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE4FF] bg-white text-[#475569] transition hover:bg-[#F8FAFF]" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                            <button onClick={() => handleDeleteSection(sec.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg></button>
                                        </div>
                                    </AdminTd>
                                </tr>
                            ))}
                        </tbody>
                    </AdminTable>
                </AdminTableWrap>
                <AdminPagination
                    currentPage={sectionPage}
                    totalPages={totalSectionPages}
                    onPageChange={setSectionPage}
                    totalItems={filteredSections.length}
                    startRow={filteredSections.length === 0 ? 0 : (sectionPage - 1) * sectionEntries + 1}
                    endRow={Math.min(sectionPage * sectionEntries, filteredSections.length)}
                />
            </AdminCard>
        );
    };

    // --- RENDER SECTION CREATE ---
    const renderSectionCreate = () => (
        <AdminCard
            title={editingSectionId ? 'Edit Section' : 'Create Section'}
            headerTone="secondary"
            action={(
                <button onClick={() => setView('SECTION_LIST')} className="text-sm font-medium text-[#687EFF] hover:underline">
                    &larr; Back to Sections
                </button>
            )}
        >
            <form className="flex w-full flex-col gap-[14px] text-[13px] font-medium text-[#334155]
                [&_input[type='text']]:rounded-xl [&_input[type='text']]:border [&_input[type='text']]:border-[#DDE4FF] [&_input[type='text']]:bg-white [&_input[type='text']]:px-3 [&_input[type='text']]:py-[9px] [&_input[type='text']]:outline-none [&_input[type='text']]:transition [&_input[type='text']]:focus:border-[#687EFF] [&_input[type='text']]:focus:ring-2 [&_input[type='text']]:focus:ring-[#687EFF]/20
                [&_input[type='number']]:rounded-xl [&_input[type='number']]:border [&_input[type='number']]:border-[#DDE4FF] [&_input[type='number']]:bg-white [&_input[type='number']]:px-3 [&_input[type='number']]:py-[9px] [&_input[type='number']]:outline-none [&_input[type='number']]:transition [&_input[type='number']]:focus:border-[#687EFF] [&_input[type='number']]:focus:ring-2 [&_input[type='number']]:focus:ring-[#687EFF]/20
                [&_input[type='date']]:rounded-xl [&_input[type='date']]:border [&_input[type='date']]:border-[#DDE4FF] [&_input[type='date']]:bg-white [&_input[type='date']]:px-3 [&_input[type='date']]:py-[9px] [&_input[type='date']]:outline-none [&_input[type='date']]:transition [&_input[type='date']]:focus:border-[#687EFF] [&_input[type='date']]:focus:ring-2 [&_input[type='date']]:focus:ring-[#687EFF]/20
                [&_select]:rounded-xl [&_select]:border [&_select]:border-[#DDE4FF] [&_select]:bg-white [&_select]:px-3 [&_select]:py-[9px] [&_select]:outline-none [&_select]:transition [&_select]:focus:border-[#687EFF] [&_select]:focus:ring-2 [&_select]:focus:ring-[#687EFF]/20
                [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[#DDE4FF] [&_textarea]:bg-white [&_textarea]:px-3 [&_textarea]:py-3 [&_textarea]:outline-none [&_textarea]:transition [&_textarea]:focus:border-[#687EFF] [&_textarea]:focus:ring-2 [&_textarea]:focus:ring-[#687EFF]/20">

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <label className="sm:w-[220px] text-right shrink-0">Session Code</label>
                    <input type="text" value={sectionForm.sessionCode} onChange={e => setSectionForm({ ...sectionForm, sessionCode: e.target.value })} className="w-[300px] max-w-full border border-gray-300 rounded px-2 py-[5px] outline-none focus:border-[#687EFF]" />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <label className="sm:w-[220px] text-right shrink-0">Session Name</label>
                    <input type="text" value={sectionForm.name} onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })} className="w-[300px] max-w-full border border-gray-300 rounded px-2 py-[5px] outline-none focus:border-[#687EFF]" />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-start pt-2">
                    <label className="sm:w-[220px] text-right shrink-0 py-1">Detail</label>
                    <div className="flex-1 max-w-[550px] border border-gray-300 rounded bg-[#FAFAFA] min-h-[220px]">
                        <div className="border-b border-gray-300 px-2 py-1 flex flex-wrap gap-1 bg-gray-50/50">
                            {/* Toolbar Buttons mockup */}
                            <div className="flex gap-1 border-r border-gray-300 pr-1">
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-xs text-gray-600 rounded">Source</button>
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-500 rounded"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                            </div>
                            <div className="flex gap-0.5 border-r border-gray-300 pr-1 items-center">
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-700 font-bold font-serif">B</button>
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-700 italic font-serif">I</button>
                                <button type="button" className="px-1.5 py-0.5 hover:bg-white border border-transparent hover:border-gray-200 text-gray-700 underline font-serif">U</button>
                            </div>
                            <div className="flex gap-0.5 items-center pl-1">
                                <span className="text-[12px] text-gray-600 flex items-center gap-1 border border-gray-200 px-2 py-0.5 bg-white cursor-pointer">Styles <svg fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5 opacity-60"><path d="M7 10l5 5 5-5z" /></svg></span>
                                <span className="text-[12px] text-gray-600 flex items-center gap-1 border border-gray-200 px-2 py-0.5 bg-white cursor-pointer">Format <svg fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5 opacity-60"><path d="M7 10l5 5 5-5z" /></svg></span>
                            </div>
                        </div>
                        <textarea
                            value={sectionForm.detail}
                            onChange={e => setSectionForm({ ...sectionForm, detail: e.target.value })}
                            className="w-full h-full min-h-[180px] border-none bg-white resize-y p-2 outline-none text-[13px]"
                        ></textarea>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-3">
                    <label className="sm:w-[220px] text-right shrink-0">Register Date</label>
                    <div className="flex flex-col gap-[8px]">
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={sectionForm.registerDateFrom}
                                onChange={e => setSectionForm({ ...sectionForm, registerDateFrom: e.target.value })}
                                disabled={sectionForm.registerUnlimit}
                                className="w-[120px] bg-gray-100 border border-gray-300 rounded px-2 py-[5px] outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            />
                            <span className="text-gray-500 text-[13px] bg-gray-100 px-2 py-1 text-center min-w-[30px] border border-gray-300">To</span>
                            <input
                                type="date"
                                value={sectionForm.registerDateTo}
                                onChange={e => setSectionForm({ ...sectionForm, registerDateTo: e.target.value })}
                                disabled={sectionForm.registerUnlimit}
                                className="w-[120px] border border-gray-300 rounded px-2 py-[5px] outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            />
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#334155] text-[12px] font-normal">
                            <input
                                type="checkbox"
                                checked={sectionForm.registerUnlimit}
                                onChange={e => setSectionForm({ ...sectionForm, registerUnlimit: e.target.checked })}
                                className="w-3.5 h-3.5 accent-[#2EB89B] border-gray-300"
                            /> Unlimit
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1">
                    <label className="sm:w-[220px] text-right shrink-0">Learn Date</label>
                    <div className="flex flex-col gap-[8px]">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-[13px] bg-gray-100 px-2 py-1 text-center min-w-[30px] border border-gray-300 opacity-0 pointer-events-none">To</span>
                            <span className="text-gray-500 text-[13px] bg-gray-100 px-2 py-1 text-center min-w-[30px] border border-gray-300">To</span>
                            <input
                                type="date"
                                value={sectionForm.learnDateTo}
                                onChange={e => setSectionForm({ ...sectionForm, learnDateTo: e.target.value })}
                                className="w-[120px] border border-gray-300 rounded px-2 py-[5px] outline-none"
                            />
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[#334155] text-[12px] font-normal">
                            <input
                                type="checkbox"
                                checked={sectionForm.learnDateUnlimit}
                                onChange={e => setSectionForm({ ...sectionForm, learnDateUnlimit: e.target.checked })}
                                className="w-3.5 h-3.5 accent-[#2EB89B] border-gray-300"
                            /> Unlimit
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1">
                    <label className="sm:w-[220px] text-right shrink-0">Max Learner(Unlimit)</label>
                    <div className="flex flex-col gap-1 w-[300px]">
                        <input
                            type="number"
                            value={sectionForm.maxLearner}
                            disabled={sectionForm.maxLearnerUnlimit}
                            onChange={e => setSectionForm({ ...sectionForm, maxLearner: Number(e.target.value || 0) })}
                            className="w-full border border-gray-300 rounded px-2 py-[5px] outline-none bg-gray-100 disabled:opacity-80"
                        />
                        <label className="flex items-center gap-1.5 cursor-pointer pt-0.5 text-[12px] font-normal text-[#2EB89B]">
                            <input
                                type="checkbox"
                                checked={sectionForm.maxLearnerUnlimit}
                                onChange={e => setSectionForm({ ...sectionForm, maxLearnerUnlimit: e.target.checked })}
                                className="w-3.5 h-3.5 accent-[#2EB89B]"
                            /> Unlimit
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-3">
                    <label className="sm:w-[220px] text-right shrink-0">Status</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_status" value="active" checked={sectionForm.status === 'active'} onChange={e => setSectionForm({ ...sectionForm, status: e.target.value })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Active
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_status" value="inactive" checked={sectionForm.status === 'inactive'} onChange={e => setSectionForm({ ...sectionForm, status: e.target.value })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Inactive
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1.5">
                    <label className="sm:w-[220px] text-right shrink-0">Public</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_public" checked={sectionForm.isPublic === true} onChange={() => setSectionForm({ ...sectionForm, isPublic: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Public
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_public" checked={sectionForm.isPublic === false} onChange={() => setSectionForm({ ...sectionForm, isPublic: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> UnPublic
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1.5">
                    <label className="sm:w-[220px] text-right shrink-0">Auto Approve Session</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_aas" checked={sectionForm.autoApprove === true} onChange={() => setSectionForm({ ...sectionForm, autoApprove: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Auto
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_aas" checked={sectionForm.autoApprove === false} onChange={() => setSectionForm({ ...sectionForm, autoApprove: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Manual
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1.5">
                    <label className="sm:w-[220px] text-right shrink-0">Certificate</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_cert" checked={sectionForm.certificate === true} onChange={() => setSectionForm({ ...sectionForm, certificate: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_cert" checked={sectionForm.certificate === false} onChange={() => setSectionForm({ ...sectionForm, certificate: false, autoCert: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> No
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1.5">
                    <label className="sm:w-[220px] text-right shrink-0">Auto Approve Certificate</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_aacert" checked={sectionForm.autoCert === true} onChange={() => setSectionForm({ ...sectionForm, autoCert: true, certificate: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_aacert" checked={sectionForm.autoCert === false} onChange={() => setSectionForm({ ...sectionForm, autoCert: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> No
                        </label>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1.5 mb-1">
                    <label className="sm:w-[220px] text-right shrink-0">Cohort for module</label>
                    <input
                        type="checkbox"
                        checked={sectionForm.cohortModule}
                        onChange={e => setSectionForm({ ...sectionForm, cohortModule: e.target.checked })}
                        className="w-4 h-4 accent-[#2EB89B] border-gray-300 cursor-pointer"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-start mt-1">
                    <label className="sm:w-[220px] text-right shrink-0 pt-1">Groups</label>
                    <div className="w-[300px] max-w-full">
                        <select
                            multiple
                            size="5"
                            value={sectionForm.groups ? sectionForm.groups.split(',').filter(Boolean) : []}
                            onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                                setSectionForm({ ...sectionForm, groups: normalizeSectionGroupsValue(selected.join(',')) });
                            }}
                            className="w-full border border-gray-300 px-1 py-1 outline-none bg-white text-[12px] font-normal overflow-y-auto"
                            style={{ height: '70px' }}
                        >
                            <option value="ADMIN">ADMINISTRATOR</option>
                            <option value="INSTRUCTOR">INSTRUCTOR</option>
                            <option value="LEARNER">LEARNER</option>
                        </select>
                    </div>
                </div>

                <div className="mt-6 flex flex-col gap-2 border-t border-[#E8EEFF] pt-5 sm:flex-row sm:items-center">
                    <div className="sm:w-[220px]" />
                    <div className="flex gap-3">
                        <button type="button" onClick={handleSectionSubmit} disabled={loading} className={adminPrimaryButtonClass}>
                            {loading ? 'Working...' : (editingSectionId ? 'Update section' : 'Create section')}
                        </button>
                        <button type="button" onClick={() => { setEditingSectionId(null); setSectionForm(getDefaultSectionForm()); setView('SECTION_LIST'); }} className={adminSecondaryButtonClass}>
                            Cancel
                        </button>
                    </div>
                </div>
            </form>
        </AdminCard>
    );

    // --- RENDER SECTION LEARNERS ---
    const renderSectionLearners = () => {
        const sectionLearners = pagedLearners;
        const getStatusMeta = (status) => {
            if (status === 'LEARNING') {
                return { label: 'Learning', chipClass: 'bg-[#EAF0FF] text-[#3752DC]' };
            }
            if (status === 'COMPLETED') {
                return { label: 'Completed', chipClass: 'bg-[#E8FAF5] text-[#0F8B68]' };
            }
            if (status === 'SUSPENDED') {
                return { label: 'Suspended', chipClass: 'bg-[#FFF1F3] text-[#C73D57]' };
            }
            return { label: 'Not started', chipClass: 'bg-[#F1F4FF] text-[#4B5AA8]' };
        };

        return (
            <div className="bg-white border border-[#DCE3FF] rounded-2xl flex flex-col w-full overflow-hidden shadow-[0_12px_30px_rgba(104,126,255,0.10)]">
                <div className="relative border-b border-[#E4E9FF] px-5 py-5 md:px-7 md:py-6 bg-[linear-gradient(135deg,#687EFF_0%,#5B72F2_60%,#7A8EFF_100%)]">
                    <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#8EA0FF]/40 blur-2xl pointer-events-none" />

                    <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-5 items-start">
                        <div className="space-y-4">
                            <div className="font-semibold text-[22px] text-white flex items-center gap-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                Learner Status
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl bg-white/15 border border-white/30 px-4 py-3">
                                    <div className="text-[12px] text-white/80">Category</div>
                                    <div className="text-white font-semibold text-[19px] leading-tight truncate">{selectedCourse?.category || '-'}</div>
                                </div>
                                <div className="rounded-xl bg-white/15 border border-white/30 px-4 py-3">
                                    <div className="text-[12px] text-white/80">Course</div>
                                    <div className="text-white font-semibold text-[19px] leading-tight truncate">{selectedCourse?.name || '-'}</div>
                                </div>
                                <div className="rounded-xl bg-white/15 border border-white/30 px-4 py-3">
                                    <div className="text-[12px] text-white/80">Section</div>
                                    <div className="text-white font-semibold text-[19px] leading-tight truncate">{selectedSection?.name || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-1 xl:mt-0 rounded-2xl bg-white px-3 py-3 shadow-md border border-[#E1E6FF] w-full sm:w-[220px]">
                            <div className="text-[#1E2A56] text-[12px] font-semibold text-center mb-2">Enrollment QR</div>
                            <div className="w-[156px] h-[156px] mx-auto bg-[#F7F9FF] border border-[#E1E7FF] rounded-lg overflow-hidden flex items-center justify-center">
                                {qrEnrollUrl ? (
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(qrEnrollUrl)}`}
                                        alt="Enroll QR"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="text-[11px] text-gray-400 text-center px-2">
                                        {qrLoading ? 'Generating QR...' : 'QR not available yet'}
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={generateEnrollmentQr}
                                disabled={qrLoading || !selectedCourse?.id}
                                className="mt-3 w-full h-9 rounded-lg bg-[#687EFF] hover:bg-[#5B72F2] disabled:opacity-50 text-white text-[13px] font-semibold transition-colors"
                            >
                                {qrLoading ? 'Generating...' : 'Regenerate'}
                            </button>
                            {qrExpiresAt && (
                                <div className="mt-2 text-[11px] text-[#5D6585] text-center">
                                    Expires: {qrExpiresAt}
                                </div>
                            )}
                            {qrError && (
                                <div className="mt-2 text-[11px] text-[#D63B57] text-center break-words">
                                    {qrError}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-b border-[#E8ECFF] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[#687EFF] text-[14px] font-semibold">
                        <button
                            type="button"
                            onClick={() => { if (typeof window !== 'undefined') window.print(); }}
                            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#EEF1FF] hover:bg-[#E1E8FF] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"></path></svg>
                            Print learner list
                        </button>
                        <span className="text-[#5D6690] font-medium">Total learners {filteredLearners.length}</span>
                    </div>

                    <button onClick={() => setView('SECTION_LIST')} className="text-sm text-[#687EFF] hover:text-[#4F64E6] hover:underline flex items-center gap-1 font-medium">
                        &larr; Back to Sections
                    </button>
                </div>

                <div className="p-5 overflow-x-auto">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <AdminEntriesControl value={learnerEntries} onChange={setLearnerEntries} label="learners" />
                        <AdminSearchInput value={learnerSearch} onChange={(event) => setLearnerSearch(event.target.value)} placeholder="Search username, learner, or status" />
                    </div>
                    <div className="rounded-xl border border-[#E2E8FF] overflow-x-auto">
                        <table className="w-full text-left text-[14px]">
                            <thead className="bg-[#F4F7FF] border-b border-[#E2E8FF] text-[#2F3C6C]">
                                <tr>
                                    <th className="p-3 border-r border-[#E2E8FF]">No.</th>
                                    <th className="p-3 border-r border-[#E2E8FF]">Username</th>
                                    <th className="p-3 border-r border-[#E2E8FF]">Learner</th>
                                    <th className="p-3 border-r border-[#E2E8FF]">Learning date</th>
                                    <th className="p-3 border-r border-[#E2E8FF] text-center">Not started</th>
                                    <th className="p-3 border-r border-[#E2E8FF] text-center">Learning</th>
                                    <th className="p-3 border-r border-[#E2E8FF] text-center">Suspended</th>
                                    <th className="p-3 border-r border-[#E2E8FF] text-center">Completed</th>
                                    <th className="p-3 text-center">Current status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sectionLearners.map((learner, idx) => {
                                    const statusMeta = getStatusMeta(learner.status);
                                    return (
                                        <tr key={learner.id} className="border-b border-[#EEF1FF] text-[#475569] hover:bg-[#F9FAFF]">
                                            <td className="p-3 border-r border-[#EEF1FF] text-center">{(learnerPage - 1) * learnerEntries + idx + 1}</td>
                                            <td className="p-3 border-r border-[#EEF1FF]">{learner.username}</td>
                                            <td className="p-3 border-r border-[#EEF1FF]">{learner.name}</td>
                                            <td className="p-3 border-r border-[#EEF1FF] text-center">{learner.learnDate}</td>
                                            <td className="p-3 border-r border-[#EEF1FF] text-center"><input type="radio" name={`st_${learner.id}`} checked={learner.status === 'NOT_STARTED'} readOnly className="accent-[#687EFF] w-4 h-4" /></td>
                                            <td className="p-3 border-r border-[#EEF1FF] text-center"><input type="radio" name={`st_${learner.id}`} checked={learner.status === 'LEARNING'} readOnly className="accent-[#687EFF] w-4 h-4" /></td>
                                            <td className="p-3 border-r border-[#EEF1FF] text-center"><input type="radio" name={`st_${learner.id}`} checked={learner.status === 'SUSPENDED'} readOnly className="accent-[#687EFF] w-4 h-4" /></td>
                                            <td className="p-3 border-r border-[#EEF1FF] text-center"><input type="radio" name={`st_${learner.id}`} checked={learner.status === 'COMPLETED'} readOnly className="accent-[#687EFF] w-4 h-4" /></td>
                                            <td className="p-3 text-center">
                                                <div className={`px-3 py-1.5 rounded-full text-[12px] inline-block font-semibold ${statusMeta.chipClass}`}>
                                                    {statusMeta.label}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sectionLearners.length === 0 && (
                                    <tr>
                                        <td colSpan="9" className="p-8 text-center text-[#64748B]">
                                            {learnerSearch ? 'No learners matched the current search.' : 'No learners enrolled in this section yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <AdminPagination
                        currentPage={learnerPage}
                        totalPages={totalLearnerPages}
                        onPageChange={setLearnerPage}
                        totalItems={filteredLearners.length}
                        startRow={filteredLearners.length === 0 ? 0 : (learnerPage - 1) * learnerEntries + 1}
                        endRow={Math.min(learnerPage * learnerEntries, filteredLearners.length)}
                    />
                </div>
            </div>
        )
    };

    return (
        <AdminShell>
            <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
            <div className="w-full flex flex-col gap-6 font-['Outfit',sans-serif]">
                <AdminPageHeader
                    title={
                        (view === 'COURSE_LIST' && 'Course')
                        || (view === 'COURSE_CREATE' && (editingCourseId ? 'Edit Course' : 'Create Course'))
                        || (view === 'SECTION_LIST' && 'Section')
                        || (view === 'SECTION_CREATE' && (editingSectionId ? 'Edit Section' : 'Create Section'))
                        || 'Section Learners'
                    }
                    description={
                        view === 'COURSE_LIST'
                            ? 'Manage course records, registration windows, and section setup.'
                            : view === 'SECTION_LIST'
                                ? `Review sections for ${selectedCourse?.name || 'the selected course'}.`
                                : view === 'SECTION_LEARNERS'
                                    ? 'Track learner progress and generate enrollment QR links.'
                                    : 'Configure course information for the admin LMS.'
                    }
                />

                {view === 'COURSE_LIST' && renderCourseList()}
                {view === 'COURSE_CREATE' && renderCourseCreate()}
                {view === 'SECTION_LIST' && renderSectionList()}
                {view === 'SECTION_CREATE' && renderSectionCreate()}
                {view === 'SECTION_LEARNERS' && renderSectionLearners()}
            </div>
        </AdminShell>
    );
}


