'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

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

export default function CourseManagementPage() {
    const searchParams = useSearchParams();
    const thumbnailInputRef = useRef(null);
    const getDefaultCourseForm = () => ({
        courseCode: '', name: '', nameEn: '', thumbnail: '', detail: '',
        registerDateFrom: '', registerDateTo: '', registerUnlimit: false,
        isModule: false, selfLearning: true, onlineClassroom: false,
        liveChat: false, offlineClassroom: false, collaborate: false,
        tincanId: '', tincanCondition: '',
        durationHours: 0, durationMinutes: 0,
        maxLearner: 1, maxLearnerUnlimit: false, lessons: 0,
        status: '', isPublic: null, webboard: null,
        autoApprove: null, certificate: null, autoCert: null,
        printCert: null, category: '', categoryId: '', prerequisites: [], instructor: '',
    });
    const getDefaultSectionForm = () => ({
        sessionCode: '', name: '', detail: '',
        registerDateFrom: '', registerDateTo: '', registerUnlimit: false,
        learnDateTo: '', learnDateUnlimit: true,
        maxLearner: 0, maxLearnerUnlimit: true,
        status: '', isPublic: null, autoApprove: null,
        certificate: null, autoCert: null, printCert: null,
        cohortModule: false, groups: '',
    });

    const [view, setView] = useState('COURSE_LIST');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [editingCourseId, setEditingCourseId] = useState(null);
    const [editingSectionId, setEditingSectionId] = useState(null);
    const [selectedSection, setSelectedSection] = useState(null);
    const [loading, setLoading] = useState(false);

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
            printCert: hasCertificate ? Boolean(selectedCourse?.printCert) : false,
        };
    }, [selectedCourse]);

    const requestedCourseId = useMemo(() => {
        const raw = String(searchParams.get('courseId') || searchParams.get('lrscourseid') || '').trim();
        const value = Number(raw);
        return Number.isInteger(value) && value > 0 ? value : null;
    }, [searchParams]);

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

    const openCourseCreate = () => {
        setEditingCourseId(null);
        setCourseForm(getDefaultCourseForm());
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
            maxLearner: Number(section?.maxLearner ?? 0),
            maxLearnerUnlimit: section?.maxLearnerUnlimit ?? section?.maxLearner == null,
            status: section?.status || (section?.isActive ? 'active' : 'inactive'),
            isPublic: typeof section?.isPublic === 'boolean'
                ? section.isPublic
                : (section?.status === 'public' ? true : false),
            certificate: certificateDefaults.certificate,
            autoCert: certificateDefaults.autoCert,
            printCert: certificateDefaults.printCert,
        });
        setView('SECTION_CREATE');
    };

    const handleEditCourse = (course) => {
        setEditingCourseId(course.id);
        setCourseForm({
            ...getDefaultCourseForm(),
            ...course,
            categoryId: course.categoryId ? String(course.categoryId) : '',
            prerequisites: Array.isArray(course.prerequisites)
                ? course.prerequisites
                : String(course.prerequisites || '').split('|').map((v) => v.trim()).filter(Boolean),
        });
        setView('COURSE_CREATE');
    };

    // Submit course
    const handleCourseSubmit = async () => {
        if (!courseForm.name?.trim()) {
            alert('กรุณากรอกชื่อหลักสูตร');
            return;
        }
        if (!courseForm.categoryId) {
            alert('กรุณาเลือก Category ก่อนสร้างหลักสูตร');
            return;
        }
        const normalizedCourseCode = String(courseForm.courseCode || '').trim();
        if (normalizedCourseCode) {
            const duplicateExists = courses.some((course) => {
                if (editingCourseId && course.id === editingCourseId) return false;
                return String(course.courseCode || '').trim().toLowerCase() === normalizedCourseCode.toLowerCase();
            });
            if (duplicateExists) {
                alert('Course Code นี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น');
                return;
            }
        }

        setLoading(true);
        try {
            const isEditMode = Boolean(editingCourseId);
            const payloadBase = { ...courseForm, courseCode: normalizedCourseCode };
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
                    alert('อัปเดตหลักสูตรสำเร็จ');
                } else {
                    setSelectedCourse(course);
                    setView('SECTION_LIST');
                    alert('สร้างหลักสูตรสำเร็จ');
                }
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || (editingCourseId ? 'Error updating course' : 'Error creating course'));
            }
        } catch (e) { alert('Error: ' + e.message); }
        setLoading(false);
    };

    // Submit section
    const handleSectionSubmit = async () => {
        if (!selectedCourse) return;
        if (!String(sectionForm.name || '').trim()) {
            alert('กรุณากรอกชื่อ Section');
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
                alert(isEditMode ? 'อัปเดต Section สำเร็จ!' : 'สร้าง Section สำเร็จ!');
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || (isEditMode ? 'Error updating section' : 'Error creating section'));
            }
        } catch (e) { alert('Error: ' + e.message); }
        setLoading(false);
    };

    // Delete course
    const handleDeleteCourse = async (id) => {
        if (!confirm('ลบหลักสูตรนี้?')) return;
        const res = await fetch(`/api/courses?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'ไม่สามารถลบหลักสูตรได้');
            return;
        }
        await loadCourses();
    };

    // Delete section
    const handleDeleteSection = async (id) => {
        if (!confirm('ลบ Section นี้?')) return;
        const res = await fetch(`/api/courses/sections?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'ไม่สามารถลบ Section ได้');
            return;
        }
        if (selectedCourse) await loadSections(selectedCourse.id);
        await loadCourses();
    };

    const handleThumbnailSelect = () => {
        thumbnailInputRef.current?.click();
    };

    const handleThumbnailChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
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
        } catch (err) {
            alert(err.message || 'อัปโหลดรูปไม่สำเร็จ');
        } finally {
            e.target.value = '';
        }
    };

    // Theme color (Purplish-blue #687EFF based on user request)
    const themeColor = '#687EFF';
    const headerClass = "bg-[#687EFF] px-4 py-3 flex items-center justify-between text-white font-medium text-[15px]";

    // --- RENDER COURSE LIST ---
    const renderCourseList = () => (
        <div className="bg-white border border-[#D1E3FB] rounded-[8px] flex flex-col w-full overflow-hidden shadow-sm">
            <div className={headerClass}>
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" /></svg>
                    Course
                </div>
                <button onClick={openCourseCreate} className="text-white hover:bg-white/20 w-7 h-7 rounded flex items-center justify-center transition-colors text-xl leading-none font-bold">
                    +
                </button>
            </div>
            <div className="p-4 overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                    <thead className="bg-[#F8FAFC] border-b border-gray-200 text-[#334155]">
                        <tr>
                            <th className="p-2 font-semibold">#</th>
                            <th className="p-2 font-semibold">Category</th>
                            <th className="p-2 font-semibold">Course name</th>
                            <th className="p-2 font-semibold">Start-End date</th>
                            <th className="p-2 font-semibold">Max learners</th>
                            <th className="p-2 font-semibold text-center">Status</th>
                            <th className="p-2 font-semibold text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map((course, idx) => (
                            <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50 text-[#475569]">
                                <td className="p-2">{idx + 1}</td>
                                <td className="p-2">{course.category}</td>
                                <td className="p-2 font-medium text-[#052143]">{course.name}</td>
                                <td className="p-2">{course.registerUnlimit ? 'Unlimited' : `${course.registerDateFrom || '-'} to ${course.registerDateTo || '-'}`}</td>
                                <td className="p-2">{course.maxLearnerUnlimit ? 'Unlimited' : course.maxLearner}</td>
                                <td className="p-2 text-center">
                                    {course.status === 'active' && <div className="inline-block w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>}
                                    {course.status !== 'active' && <div className="inline-block w-4 h-4 bg-gray-400 rounded-full border-2 border-white shadow-sm"></div>}
                                </td>
                                <td className="p-2 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => { setSelectedCourse(course); setView('SECTION_LIST'); }} className="text-[#687EFF] hover:text-blue-800" title="Manage Sections">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                                        </button>
                                        <button onClick={() => handleEditCourse(course)} className="text-gray-500 hover:text-gray-800" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                        <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // --- RENDER COURSE CREATE ---
    const renderCourseCreate = () => (
        <div className="bg-white flex flex-col w-full h-full min-h-[calc(100vh-200px)]">
            <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 mb-4 pb-4">
                <span className="text-[#A2A4A8] text-[24px] font-light">{editingCourseId ? 'Course Edit' : 'Course Create'}</span>
            </div>
            <form className="px-6 pb-6 flex flex-col gap-[14px] text-[#334155] text-[13px] font-medium w-full">

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <label className="sm:w-[220px] text-right shrink-0">Course Code</label>
                    <input type="text" value={courseForm.courseCode} onChange={e => setCourseForm({ ...courseForm, courseCode: e.target.value })} className="w-[300px] max-w-full border border-gray-300 rounded px-2 py-[5px] outline-none focus:border-[#687EFF]" />
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
                    <input
                        type="checkbox"
                        checked={courseForm.isModule}
                        onChange={(e) => setCourseForm({ ...courseForm, isModule: e.target.checked })}
                        disabled
                        className="w-4 h-4 accent-[#2EB89B] border-gray-300 cursor-not-allowed opacity-50"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-0.5">
                    <label className="sm:w-[220px] text-right shrink-0">Self learning</label>
                    <input
                        type="checkbox"
                        checked={courseForm.selfLearning}
                        onChange={(e) => setCourseForm({ ...courseForm, selfLearning: e.target.checked })}
                        className="w-4 h-4 accent-[#68A1A2] text-[#68A1A2] cursor-pointer appearance-none rounded-sm border border-gray-300 checked:bg-transparent checked:border-[#68A1A2] relative before:content-['✓'] before:absolute before:text-white before:font-bold before:-translate-y-[2px] before:translate-x-[1px] checked:before:text-[#68A1A2]"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-0.5">
                    <label className="sm:w-[220px] text-right shrink-0">Online classroom</label>
                    <input
                        type="checkbox"
                        checked={courseForm.onlineClassroom}
                        onChange={(e) => setCourseForm({ ...courseForm, onlineClassroom: e.target.checked })}
                        disabled
                        className="w-4 h-4 accent-[#2EB89B] border-gray-300 cursor-not-allowed opacity-50"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-0.5">
                    <label className="sm:w-[220px] text-right shrink-0">Live chat classroom</label>
                    <input
                        type="checkbox"
                        checked={courseForm.liveChat}
                        onChange={(e) => setCourseForm({ ...courseForm, liveChat: e.target.checked })}
                        disabled
                        className="w-4 h-4 accent-[#2EB89B] border-gray-300 cursor-not-allowed opacity-50"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-0.5">
                    <label className="sm:w-[220px] text-right shrink-0">Offline classroom</label>
                    <input
                        type="checkbox"
                        checked={courseForm.offlineClassroom}
                        onChange={(e) => setCourseForm({ ...courseForm, offlineClassroom: e.target.checked })}
                        disabled
                        className="w-4 h-4 accent-[#2EB89B] border-gray-300 cursor-not-allowed opacity-50"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-2">
                    <label className="sm:w-[220px] text-right shrink-0">Collaborate</label>
                    <input
                        type="checkbox"
                        checked={courseForm.collaborate}
                        onChange={(e) => setCourseForm({ ...courseForm, collaborate: e.target.checked })}
                        disabled
                        className="w-4 h-4 accent-[#2EB89B] border-gray-300 cursor-not-allowed opacity-50"
                    />
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
                            <input type="radio" name="c_cert" checked={courseForm.certificate === false} onChange={() => setCourseForm({ ...courseForm, certificate: false, autoCert: false, printCert: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> No
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

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1 mb-2">
                    <label className="sm:w-[220px] text-right shrink-0 pb-2">Print The Certificate From<br />Learning Page</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_ptc" checked={courseForm.printCert === true} onChange={() => setCourseForm({ ...courseForm, printCert: true, certificate: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="c_ptc" checked={courseForm.printCert === false} onChange={() => setCourseForm({ ...courseForm, printCert: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> No
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
                    <div className="w-[300px] max-w-full">
                        <input
                            type="text"
                            value={courseForm.instructor}
                            onChange={(e) => setCourseForm({ ...courseForm, instructor: e.target.value })}
                            placeholder="Instructor name"
                            className="w-full border border-gray-300 rounded px-2 py-[5px] outline-none bg-white text-[13px]"
                        />
                    </div>
                </div>

                <div className="flex w-full justify-center gap-2 mt-4 pb-12 shadow-sm pt-4 border-t border-gray-200">
                    <button type="button" onClick={handleCourseSubmit} disabled={loading} className="bg-[#337AB7] text-white px-[14px] py-[4px] rounded-[15px] font-medium text-[12px] hover:bg-blue-600 outline-none w-[70px] disabled:opacity-50">{loading ? '...' : (editingCourseId ? 'Update' : 'Submit')}</button>
                    <button type="button" onClick={() => { setEditingCourseId(null); setCourseForm(getDefaultCourseForm()); setView('COURSE_LIST'); }} className="bg-[#EAEAEA] text-[#333] px-[14px] py-[4px] border border-gray-300 rounded-[15px] font-medium text-[12px] hover:bg-gray-300 outline-none w-[70px]">Cancel</button>
                </div>
            </form>
        </div>
    );

    // --- RENDER SECTION LIST ---
    const renderSectionList = () => {
        const courseSections = sections.filter(s => s.courseId === selectedCourse?.id);
        return (
            <div className="bg-white border border-[#D1E3FB] rounded-[8px] flex flex-col w-full overflow-hidden shadow-sm">
                <div className={headerClass + " flex-col items-start gap-1 py-4"}>
                    <div className="flex items-center justify-between w-full">
                        <div className="font-semibold text-[16px]">Category: {selectedCourse?.category}</div>
                        <button onClick={openSectionCreate} className="text-white hover:bg-white/20 w-7 h-7 rounded flex items-center justify-center transition-colors text-xl leading-none font-bold">
                            +
                        </button>
                    </div>
                    <div className="text-[14px] opacity-90">Course: {selectedCourse?.name}</div>
                </div>
                <div className="p-4 overflow-x-auto">
                    <div className="mb-4">
                        <button onClick={() => setView('COURSE_LIST')} className="text-sm text-[#687EFF] hover:underline flex items-center gap-1">
                            &larr; Back to Courses
                        </button>
                    </div>
                    <table className="w-full text-left text-[14px]">
                        <thead className="bg-[#F8FAFC] border-b border-gray-200 text-[#334155]">
                            <tr>
                                <th className="p-2 font-semibold">#</th>
                                <th className="p-2 font-semibold">Section name</th>
                                <th className="p-2 font-semibold">Registration</th>
                                <th className="p-2 font-semibold">Learning</th>
                                <th className="p-2 font-semibold">Max learners</th>
                                <th className="p-2 font-semibold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courseSections.map((sec, idx) => (
                                <tr key={sec.id} className="border-b border-gray-100 hover:bg-gray-50 text-[#475569]">
                                    <td className="p-2">{idx + 1}</td>
                                    <td className="p-2 font-medium text-[#052143]">{sec.name}</td>
                                    <td className="p-2">{sec.registerUnlimit ? 'Unlimited' : `${sec.registerDateFrom || '-'} to ${sec.registerDateTo || '-'}`}</td>
                                    <td className="p-2">{sec.learnDateUnlimit ? 'Unlimited' : (sec.learnDateTo || '-')}</td>
                                    <td className="p-2">{sec.maxLearnerUnlimit ? 'Unlimited' : sec.maxLearner}</td>
                                    <td className="p-2 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={async () => {
                                                setSelectedSection(sec);
                                                await loadLearners(selectedCourse?.id, sec?.id);
                                                setView('SECTION_LEARNERS');
                                            }} className="text-[#687EFF] hover:text-blue-800" title="Learners">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"></path></svg>
                                            </button>
                                            <button onClick={() => handleEditSection(sec)} className="text-gray-500 hover:text-gray-800" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                            <button onClick={() => handleDeleteSection(sec.id)} className="text-red-500 hover:text-red-700" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {courseSections.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-4 text-center text-gray-400">No sections found. Create one.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // --- RENDER SECTION CREATE ---
    const renderSectionCreate = () => (
        <div className="bg-white flex flex-col w-full h-full min-h-[calc(100vh-200px)]">
            <div className="bg-[#687EFF] px-4 py-3 flex items-center justify-between text-white font-medium text-[15px] rounded-t-[8px]">
                <span>{editingSectionId ? 'Section Edit' : 'Section Create'}</span>
            </div>
            <form className="p-6 flex flex-col gap-[14px] text-[#334155] text-[13px] font-medium w-full border border-t-0 border-[#D1E3FB] rounded-b-[8px]">

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
                    <label className="sm:w-[220px] text-right shrink-0">Question set</label>
                    <div className="flex flex-col gap-1 w-[300px]">
                        <select className="w-full border border-gray-300 rounded px-2 py-[5px] outline-none bg-gray-100 text-gray-500">
                            <option>-- Question set --</option>
                        </select>
                        <div className="h-[2px] w-full bg-[#ccc] mt-5 mb-1" />
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
                            <input type="radio" name="s_cert" checked={sectionForm.certificate === false} onChange={() => setSectionForm({ ...sectionForm, certificate: false, autoCert: false, printCert: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> No
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

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-1.5">
                    <label className="sm:w-[220px] text-right shrink-0 pb-2">Print The Certificate From<br />Learning Page</label>
                    <div className="flex gap-4 text-[13px] font-normal">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_ptc" checked={sectionForm.printCert === true} onChange={() => setSectionForm({ ...sectionForm, printCert: true, certificate: true })} className="accent-[#68A1A2] w-3.5 h-3.5" /> Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="s_ptc" checked={sectionForm.printCert === false} onChange={() => setSectionForm({ ...sectionForm, printCert: false })} className="accent-[#68A1A2] w-3.5 h-3.5" /> No
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
                                setSectionForm({ ...sectionForm, groups: selected.join(',') });
                            }}
                            className="w-full border border-gray-300 px-1 py-1 outline-none bg-white text-[12px] font-normal overflow-y-auto"
                            style={{ height: '70px' }}
                        >
                            <option>ADMINISTRATOR</option>
                            <option>INSTRUCTOR</option>
                            <option>LEARNER</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center mt-4 pt-4 border-t border-gray-100 pb-12">
                    <div className="sm:w-[220px]"></div>
                    <div className="flex gap-2">
                        <button type="button" onClick={handleSectionSubmit} disabled={loading} className="bg-[#337AB7] text-white px-[14px] py-[4px] rounded-[15px] font-medium text-[12px] hover:bg-blue-600 outline-none w-[70px] disabled:opacity-50">{loading ? '...' : (editingSectionId ? 'Update' : 'Submit')}</button>
                        <button type="button" onClick={() => { setEditingSectionId(null); setSectionForm(getDefaultSectionForm()); setView('SECTION_LIST'); }} className="bg-[#EAEAEA] text-[#333] px-[14px] py-[4px] border border-gray-300 rounded-[15px] font-medium text-[12px] hover:bg-gray-300 outline-none w-[70px]">Cancel</button>
                    </div>
                </div>
            </form>
        </div>
    );

    // --- RENDER SECTION LEARNERS ---
    const renderSectionLearners = () => {
        const sectionLearners = learners;
        const getStatusMeta = (status) => {
            if (status === 'LEARNING') {
                return { label: 'กำลังเรียน', chipClass: 'bg-[#EAF0FF] text-[#3752DC]' };
            }
            if (status === 'COMPLETED') {
                return { label: 'เสร็จสิ้น', chipClass: 'bg-[#E8FAF5] text-[#0F8B68]' };
            }
            if (status === 'SUSPENDED') {
                return { label: 'ถูกระงับ', chipClass: 'bg-[#FFF1F3] text-[#C73D57]' };
            }
            return { label: 'ยังไม่เริ่ม', chipClass: 'bg-[#F1F4FF] text-[#4B5AA8]' };
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
                                สถานะผู้เรียน
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl bg-white/15 border border-white/30 px-4 py-3">
                                    <div className="text-[12px] text-white/80">หมวดหมู่</div>
                                    <div className="text-white font-semibold text-[19px] leading-tight truncate">{selectedCourse?.category || '-'}</div>
                                </div>
                                <div className="rounded-xl bg-white/15 border border-white/30 px-4 py-3">
                                    <div className="text-[12px] text-white/80">หลักสูตร</div>
                                    <div className="text-white font-semibold text-[19px] leading-tight truncate">{selectedCourse?.name || '-'}</div>
                                </div>
                                <div className="rounded-xl bg-white/15 border border-white/30 px-4 py-3">
                                    <div className="text-[12px] text-white/80">กลุ่ม</div>
                                    <div className="text-white font-semibold text-[19px] leading-tight truncate">{selectedSection?.name || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-1 xl:mt-0 rounded-2xl bg-white px-3 py-3 shadow-md border border-[#E1E6FF] w-full sm:w-[220px]">
                            <div className="text-[#1E2A56] text-[12px] font-semibold text-center mb-2">QR สำหรับ Enroll</div>
                            <div className="w-[156px] h-[156px] mx-auto bg-[#F7F9FF] border border-[#E1E7FF] rounded-lg overflow-hidden flex items-center justify-center">
                                {qrEnrollUrl ? (
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(qrEnrollUrl)}`}
                                        alt="Enroll QR"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="text-[11px] text-gray-400 text-center px-2">
                                        {qrLoading ? 'กำลังสร้าง QR...' : 'ยังไม่มี QR'}
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={generateEnrollmentQr}
                                disabled={qrLoading || !selectedCourse?.id}
                                className="mt-3 w-full h-9 rounded-lg bg-[#687EFF] hover:bg-[#5B72F2] disabled:opacity-50 text-white text-[13px] font-semibold transition-colors"
                            >
                                {qrLoading ? 'กำลังสร้าง...' : 'Generate ใหม่'}
                            </button>
                            {qrExpiresAt && (
                                <div className="mt-2 text-[11px] text-[#5D6585] text-center">
                                    หมดอายุ: {qrExpiresAt}
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
                            พิมพ์รายชื่อผู้ใช้
                        </button>
                        <span className="text-[#5D6690] font-medium">ผู้เรียนทั้งหมด {sectionLearners.length} คน</span>
                    </div>

                    <button onClick={() => setView('SECTION_LIST')} className="text-sm text-[#687EFF] hover:text-[#4F64E6] hover:underline flex items-center gap-1 font-medium">
                        &larr; Back to Sections
                    </button>
                </div>

                <div className="p-5 overflow-x-auto">
                    <div className="rounded-xl border border-[#E2E8FF] overflow-x-auto">
                        <table className="w-full text-left text-[14px]">
                            <thead className="bg-[#F4F7FF] border-b border-[#E2E8FF] text-[#2F3C6C]">
                                <tr>
                                    <th className="p-3 border-r border-[#E2E8FF]">ลำดับ</th>
                                    <th className="p-3 border-r border-[#E2E8FF]">ชื่อผู้ใช้</th>
                                    <th className="p-3 border-r border-[#E2E8FF]">ชื่อ</th>
                                    <th className="p-3 border-r border-[#E2E8FF]">วันที่เรียนรู้</th>
                                    <th className="p-3 border-r border-[#E2E8FF] text-center">ยังไม่เริ่ม</th>
                                    <th className="p-3 border-r border-[#E2E8FF] text-center">กำลังเรียน</th>
                                    <th className="p-3 border-r border-[#E2E8FF] text-center">ถูกระงับ</th>
                                    <th className="p-3 border-r border-[#E2E8FF] text-center">เสร็จสิ้น/ล้มเหลว</th>
                                    <th className="p-3 text-center">สถานะปัจจุบัน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sectionLearners.map((learner, idx) => {
                                    const statusMeta = getStatusMeta(learner.status);
                                    return (
                                        <tr key={learner.id} className="border-b border-[#EEF1FF] text-[#475569] hover:bg-[#F9FAFF]">
                                            <td className="p-3 border-r border-[#EEF1FF] text-center">{idx + 1}</td>
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
                                            ยังไม่มีผู้ลงทะเบียนในหลักสูตรนี้
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex gap-3 justify-center mt-6">
                        <button className="h-10 min-w-[140px] bg-[#687EFF] hover:bg-[#5B72F2] text-white px-8 rounded-lg font-semibold shadow-sm transition-colors">บันทึก</button>
                        <button className="h-10 min-w-[140px] bg-[#EEF1FF] hover:bg-[#E1E8FF] text-[#4E5FC9] px-8 rounded-lg font-semibold shadow-sm transition-colors">ยกเลิก</button>
                    </div>
                </div>
            </div>
        )
    };

    return (
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-6 font-['Outfit',sans-serif]">
                <h1 className="text-[28px] font-medium text-[#052143] leading-[150%]">
                    {view === 'COURSE_LIST' && 'Course'}
                    {view === 'COURSE_CREATE' && (editingCourseId ? 'Course Edit' : 'Course Create')}
                    {view === 'SECTION_LIST' && 'Section'}
                    {view === 'SECTION_CREATE' && (editingSectionId ? 'Section Edit' : 'Section Create')}
                    {view === 'SECTION_LEARNERS' && 'Section Learners'}
                </h1>

                {view === 'COURSE_LIST' && renderCourseList()}
                {view === 'COURSE_CREATE' && renderCourseCreate()}
                {view === 'SECTION_LIST' && renderSectionList()}
                {view === 'SECTION_CREATE' && renderSectionCreate()}
                {view === 'SECTION_LEARNERS' && renderSectionLearners()}

                <div className="text-center text-[#6B778B] text-[13px] py-4">
                    Copyright © 2024
                </div>
            </div>
        </AdminLmsDashboard>
    );
}

