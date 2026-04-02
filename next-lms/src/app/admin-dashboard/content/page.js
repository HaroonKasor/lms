'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminEntriesControl,
    AdminInlineAlert,
    AdminPageHeader,
    AdminPagination,
    AdminSearchInput,
    AdminTable,
    AdminTableHead,
    AdminTableWrap,
    AdminTd,
    AdminTh,
    AdminToastStack,
    AdminToolbar,
    adminInputClass,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
} from '@/components/admin/ui/AdminPrimitives';
import {
    createContent,
    deleteContent,
    listContents,
    updateContent,
} from '@/services/admin/contentService';

const CONTENT_FILTERS = [
    { id: 'ALL', label: 'All content' },
    { id: 'HAS_ACTIVITY', label: 'Has activities' },
    { id: 'NO_ACTIVITY', label: 'No activities' },
];

const INITIAL_FORM = {
    title: '',
    file: null,
};

function slugify(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export default function ContentManagementPage() {
    const [view, setView] = useState('list');
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [formMode, setFormMode] = useState('create');
    const [editingContent, setEditingContent] = useState(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [entries, setEntries] = useState(10);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [contentFilter, setContentFilter] = useState('ALL');
    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [toasts, setToasts] = useState([]);

    const fileInputRef = useRef(null);
    const dragCounterRef = useRef(0);
    const toastTimersRef = useRef(new Map());

    const appOrigin = React.useMemo(() => {
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
    }, []);

    useEffect(() => {
        return () => {
            for (const timer of toastTimersRef.current.values()) clearTimeout(timer);
            toastTimersRef.current.clear();
        };
    }, []);

    const dismissToast = (id) => {
        const timer = toastTimersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            toastTimersRef.current.delete(id);
        }
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    const pushToast = (tone, message, title = '') => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, tone, message, title }]);
        const timer = setTimeout(() => dismissToast(id), 3200);
        toastTimersRef.current.set(id, timer);
    };

    const getContentRootLaunchUrl = (content) => {
        const contentId = String(content?.id || '').trim();
        if (contentId) return `/content/${contentId}`;
        return content?.entryPoint ? `/${content.entryPoint}` : '#';
    };

    const resolveActivityUrl = (content, launch) => {
        if (!launch) return getContentRootLaunchUrl(content);
        if (/^https?:\/\//i.test(launch)) return launch;
        const normalizedLaunch = String(launch).replace(/\\/g, '/');
        const baseDir = (content?.entryPoint || '').split('/').slice(0, -1).join('/');
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
            return getContentRootLaunchUrl(content);
        }
    };

    const resolveSafeLaunchUrl = async (candidateUrl, fallbackUrl) => {
        const candidates = [candidateUrl, fallbackUrl].filter((value) => value && value !== '#');
        if (candidates.length === 0) return '#';

        for (const candidate of candidates) {
            if (/^https?:\/\//i.test(candidate)) return candidate;
            const localPath = candidate.startsWith('/') ? candidate : `/${candidate}`;
            try {
                const res = await fetch(`/api/content/resolve?src=${encodeURIComponent(localPath)}`, { cache: 'no-store' });
                const data = await res.json().catch(() => null);
                const resolved = String(data?.resolvedSrc || '').trim();
                if (res.ok && resolved) return resolved;
                if (res.ok) return localPath;
            } catch {
                // ignore and try next candidate
            }
        }

        const fallback = candidates[candidates.length - 1];
        return fallback.startsWith('/') || /^https?:\/\//i.test(fallback) ? fallback : `/${fallback}`;
    };

    const openLaunchWindow = (url, fallbackUrl) => {
        const w = window.screen?.availWidth || window.innerWidth || 1600;
        const h = window.screen?.availHeight || window.innerHeight || 900;
        const features = `left=0,top=0,width=${w},height=${h}`;
        const win = window.open('about:blank', '_blank', features);
        if (!win) return;

        win.focus();
        try {
            win.moveTo(0, 0);
            win.resizeTo(w, h);
        } catch {
            // Some browsers block move/resize.
        }

        (async () => {
            const safeUrl = await resolveSafeLaunchUrl(url, fallbackUrl);
            if (!safeUrl || safeUrl === '#') {
                try { win.close(); } catch {}
                return;
            }
            const launchUrl = `/launch?src=${encodeURIComponent(safeUrl)}&autoplay=1`;
            win.location.href = launchUrl;
        })();
    };

    const loadContents = async () => {
        try {
            setLoading(true);
            setLoadError('');
            setContents(await listContents());
        } catch (err) {
            console.error(err);
            setContents([]);
            setLoadError(err?.message || 'Failed to load content library');
            pushToast('error', err?.message || 'Failed to load content library', 'Load failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContents();
    }, []);

    const filteredContents = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return contents.filter((content) => {
            const activityCount = Array.isArray(content?.activities) ? content.activities.length : 0;
            const matchesFilter = contentFilter === 'ALL'
                || (contentFilter === 'HAS_ACTIVITY' && activityCount > 0)
                || (contentFilter === 'NO_ACTIVITY' && activityCount === 0);
            if (!matchesFilter) return false;
            if (!keyword) return true;
            return [content?.title, content?.id, content?.entryPoint]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));
        });
    }, [contents, contentFilter, search]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredContents.length / entries)), [filteredContents.length, entries]);
    const pagedContents = useMemo(() => {
        const start = (page - 1) * entries;
        return filteredContents.slice(start, start + entries);
    }, [filteredContents, page, entries]);

    useEffect(() => {
        setPage(1);
    }, [entries, search, contentFilter, filteredContents.length]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const resetForm = () => {
        setForm(INITIAL_FORM);
        setEditingContent(null);
        setFormMode('create');
        setUploadProgress(0);
        setIsDragging(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const openCreate = () => {
        resetForm();
        setView('form');
        setFormMode('create');
    };

    const openEdit = (content) => {
        setEditingContent(content);
        setFormMode('edit');
        setForm({ title: content?.title || '', file: null });
        setUploadProgress(0);
        setView('form');
    };

    const handleSelectedFile = (file) => {
        if (!file) return;
        const isZipByMime = ['application/zip', 'application/x-zip-compressed'].includes(file.type);
        const isZipByName = /\.zip$/i.test(file.name || '');

        if (!isZipByMime && !isZipByName) {
            pushToast('error', 'Only .zip TinCan/xAPI packages are supported.', 'Invalid file');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setForm((prev) => ({ ...prev, file }));
        pushToast('success', `Selected ${file.name}`, 'File ready');
    };

    const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragCounterRef.current += 1;
        setIsDragging(true);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragging(false);
        }
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragging(false);
        const droppedFile = event.dataTransfer?.files?.[0] || null;
        handleSelectedFile(droppedFile);
    };

    const simulateProgress = () => {
        setUploadProgress(12);
        return window.setInterval(() => {
            setUploadProgress((prev) => (prev >= 86 ? prev : prev + 8));
        }, 170);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.title.trim()) {
            pushToast('error', 'Please enter a content title.', 'Missing title');
            return;
        }

        setSaving(true);
        const progressTimer = formMode === 'create' ? simulateProgress() : null;

        try {
            if (formMode === 'create') {
                await createContent(form);
            } else {
                await updateContent(editingContent?.id, { ...form, slug: slugify(form.title) });
            }

            setUploadProgress(100);
            pushToast('success', formMode === 'create' ? 'Content package created successfully.' : 'Content updated successfully.', formMode === 'create' ? 'Create complete' : 'Update complete');
            await loadContents();
            resetForm();
            setView('list');
        } catch (err) {
            console.error(err);
            pushToast('error', err?.message || 'Unable to save content.', 'Save failed');
            setUploadProgress(0);
        } finally {
            if (progressTimer) clearInterval(progressTimer);
            setSaving(false);
        }
    };

    const handleDelete = async (content) => {
        if (!window.confirm(`Delete content \"${content?.title || '-'}\"?`)) return;
        try {
            await deleteContent(content?.id);
            pushToast('success', 'Content removed from the library.', 'Deleted');
            await loadContents();
        } catch (err) {
            console.error(err);
            pushToast('error', err?.message || 'Delete failed', 'Delete failed');
        }
    };

    const handleLaunch = (content) => {
        const launchUrl = getContentRootLaunchUrl(content);
        openLaunchWindow(launchUrl, launchUrl);
    };

    return (
        <AdminShell>
            <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
            <div className="flex w-full flex-col gap-6 font-['Outfit',sans-serif]">
                <AdminPageHeader
                    title="Content"
                    description="Manage TinCan/xAPI content packages used in the LMS."
                    action={view === 'list' ? (
                        <button type="button" onClick={openCreate} className={adminPrimaryButtonClass}>
                            Create content
                        </button>
                    ) : null}
                />

                {view === 'list' ? (
                    <AdminCard title="Content Library">
                        {loadError ? (
                            <div className="mb-4">
                                <AdminInlineAlert>{loadError}</AdminInlineAlert>
                            </div>
                        ) : null}

                        <AdminToolbar
                            left={(
                                <>
                                    <AdminEntriesControl value={entries} onChange={setEntries} label="items" />
                                    <select
                                        value={contentFilter}
                                        onChange={(event) => setContentFilter(event.target.value)}
                                        className="h-[38px] rounded-xl border border-[#DDE4FF] bg-white px-3 text-[13px] text-[#334155] outline-none focus:border-[#687EFF]"
                                    >
                                        {CONTENT_FILTERS.map((item) => (
                                            <option key={item.id} value={item.id}>{item.label}</option>
                                        ))}
                                    </select>
                                </>
                            )}
                            right={<AdminSearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, UUID, or entry point" />}
                        />

                        <AdminTableWrap>
                            <AdminTable>
                                <AdminTableHead>
                                    <tr>
                                        <AdminTh className="w-[72px]">No.</AdminTh>
                                        <AdminTh className="min-w-[220px]">Content</AdminTh>
                                        <AdminTh className="min-w-[220px]">UUID</AdminTh>
                                        <AdminTh className="min-w-[240px]">Activities</AdminTh>
                                        <AdminTh className="w-[120px] text-center">Launch</AdminTh>
                                        <AdminTh className="w-[160px] text-center">Tools</AdminTh>
                                    </tr>
                                </AdminTableHead>
                                <tbody>
                                    {loading ? (
                                        <AdminBodyStateRow colSpan={6}>Loading content library...</AdminBodyStateRow>
                                    ) : pagedContents.length === 0 ? (
                                        <AdminBodyStateRow colSpan={6}>
                                            {search || contentFilter !== 'ALL'
                                                ? 'No content matched the current filters.'
                                                : 'No content yet. Create your first package to get started.'}
                                        </AdminBodyStateRow>
                                    ) : pagedContents.map((content, index) => {
                                        const activityCount = Array.isArray(content?.activities) ? content.activities.length : 0;
                                        return (
                                            <tr key={content.id} className="border-b border-[#EEF2FF] last:border-none hover:bg-[#FBFCFF]">
                                                <AdminTd className="font-medium text-[#1E293B]">{(page - 1) * entries + index + 1}</AdminTd>
                                                <AdminTd>
                                                    <div className="font-semibold text-[#1E293B]">{content.title}</div>
                                                    <div className="mt-1 text-[12px] text-[#94A3B8]">{content.entryPoint || '-'}</div>
                                                </AdminTd>
                                                <AdminTd className="font-mono text-[12px] text-[#64748B]">{content.id}</AdminTd>
                                                <AdminTd>
                                                    {activityCount > 0 ? (
                                                        <div className="flex flex-col gap-1.5">
                                                            {content.activities.map((activity, activityIndex) => (
                                                                <button
                                                                    key={`${content.id}-${activityIndex}`}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const fallback = getContentRootLaunchUrl(content);
                                                                        openLaunchWindow(resolveActivityUrl(content, activity.launch), fallback);
                                                                    }}
                                                                    className="inline-flex items-center gap-2 text-left text-[13px] text-[#4F64E6] transition hover:underline"
                                                                >
                                                                    <span>{activity?.name || `Activity ${activityIndex + 1}`}</span>
                                                                    <span className="text-[11px] text-[#94A3B8]">Open</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[13px] text-[#94A3B8]">No activities</span>
                                                    )}
                                                </AdminTd>
                                                <AdminTd className="text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLaunch(content)}
                                                        className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[13px] font-medium text-emerald-700 transition hover:bg-emerald-100"
                                                    >
                                                        Learn
                                                    </button>
                                                </AdminTd>
                                                <AdminTd className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(content)}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE4FF] bg-white text-[#475569] transition hover:bg-[#F8FAFF]"
                                                            title="Edit"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(content)}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                                                            title="Delete"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /><path d="M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </AdminTd>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </AdminTable>
                        </AdminTableWrap>

                        <AdminPagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            totalItems={filteredContents.length}
                            startRow={filteredContents.length === 0 ? 0 : (page - 1) * entries + 1}
                            endRow={Math.min(page * entries, filteredContents.length)}
                        />
                    </AdminCard>
                ) : (
                    <AdminCard title={formMode === 'create' ? 'Upload Content Package' : 'Edit Content'}>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                                <div className="space-y-5">
                                    <div>
                                        <label className="mb-2 block text-[14px] font-semibold text-[#1E293B]">Content title</label>
                                        <input
                                            type="text"
                                            value={form.title}
                                            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                            placeholder="Enter content title"
                                            className={adminInputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-[14px] font-semibold text-[#1E293B]">
                                            TinCan package {formMode === 'create' ? '' : '(optional)'}
                                        </label>
                                        <div
                                            className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed px-6 py-10 text-center transition ${
                                                form.file
                                                    ? 'border-emerald-300 bg-emerald-50'
                                                    : isDragging
                                                        ? 'border-[#687EFF] bg-[#EEF2FF]'
                                                        : 'border-[#C9D6FF] bg-[#F8FAFF] hover:border-[#687EFF] hover:bg-[#F4F7FF]'
                                            }`}
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragEnter={handleDragEnter}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".zip"
                                                className="hidden"
                                                onChange={(event) => handleSelectedFile(event.target.files?.[0] || null)}
                                            />
                                            {form.file ? (
                                                <>
                                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                                                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                    </div>
                                                    <div className="text-[16px] font-semibold text-[#0F2243]">{form.file.name}</div>
                                                    <div className="mt-1 text-[13px] text-[#64748B]">{(form.file.size / 1024 / 1024).toFixed(2)} MB</div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#687EFF] shadow-sm">
                                                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                    </div>
                                                    <div className="text-[16px] font-semibold text-[#0F2243]">Drag and drop your .zip package here</div>
                                                    <div className="mt-1 text-[13px] text-[#64748B]">or click to browse from your machine</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[20px] border border-[#E8EEFF] bg-[#FBFCFF] p-5">
                                    <h3 className="text-[15px] font-semibold text-[#1E293B]">Package summary</h3>
                                    <dl className="mt-4 space-y-4 text-[13px] text-[#64748B]">
                                        <div>
                                            <dt className="font-medium text-[#1E293B]">Mode</dt>
                                            <dd className="mt-1 capitalize">{formMode}</dd>
                                        </div>
                                        <div>
                                            <dt className="font-medium text-[#1E293B]">Current title</dt>
                                            <dd className="mt-1 break-words">{form.title || '-'}</dd>
                                        </div>
                                        <div>
                                            <dt className="font-medium text-[#1E293B]">File</dt>
                                            <dd className="mt-1 break-words">{form.file?.name || (formMode === 'edit' ? 'Keep existing package' : '-')}</dd>
                                        </div>
                                        <div>
                                            <dt className="font-medium text-[#1E293B]">Progress</dt>
                                            <dd className="mt-2">
                                                <div className="h-3 overflow-hidden rounded-full bg-[#E8EEFF]">
                                                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#687EFF_0%,#1DBA9F_100%)] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                                </div>
                                                <div className="mt-2 text-[12px] text-[#64748B]">{uploadProgress}% complete</div>
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#EEF2FF] pt-5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        resetForm();
                                        setView('list');
                                    }}
                                    className={adminSecondaryButtonClass}
                                >
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving} className={adminPrimaryButtonClass}>
                                    {saving ? 'Saving...' : formMode === 'create' ? 'Create content' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    </AdminCard>
                )}
            </div>
        </AdminShell>
    );
}

