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
    AdminStatusPill,
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
    adminTextareaClass,
} from '@/components/admin/ui/AdminPrimitives';
import {
    createCategory,
    deleteCategory,
    listCategories,
    updateCategory,
} from '@/services/admin/categoryService';

const initialForm = {
    categoryName: '',
    codeName: '',
    categoryDetail: '',
    isPublic: true,
    mainCategory: '',
};

export default function CategoryPage() {
    const [view, setView] = useState('list');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState(initialForm);
    const [entries, setEntries] = useState(10);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [visibilityFilter, setVisibilityFilter] = useState('ALL');
    const [structureFilter, setStructureFilter] = useState('ALL');
    const [toasts, setToasts] = useState([]);

    const toastTimersRef = useRef(new Map());

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

    const loadCategories = async () => {
        try {
            setLoading(true);
            setLoadError('');
            setCategories(await listCategories());
        } catch (e) {
            console.error(e);
            setCategories([]);
            setLoadError(e?.message || 'Failed to load categories');
            pushToast('error', e?.message || 'Failed to load categories', 'Load failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const categoryMap = useMemo(() => {
        const map = new Map();
        categories.forEach((cat) => map.set(String(cat.id), cat.name));
        return map;
    }, [categories]);

    const filteredCategories = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return categories.filter((cat) => {
            const matchesVisibility = visibilityFilter === 'ALL'
                || (visibilityFilter === 'PUBLIC' && cat.isPublic)
                || (visibilityFilter === 'PRIVATE' && !cat.isPublic);
            const isRoot = !cat.parentId;
            const matchesStructure = structureFilter === 'ALL'
                || (structureFilter === 'ROOT' && isRoot)
                || (structureFilter === 'NESTED' && !isRoot);
            if (!matchesVisibility || !matchesStructure) return false;
            if (!keyword) return true;
            return [cat.name, cat.codeName, cat.detail, categoryMap.get(String(cat.parentId || ''))]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));
        });
    }, [categories, visibilityFilter, structureFilter, search, categoryMap]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredCategories.length / entries)), [filteredCategories.length, entries]);
    const pagedCategories = useMemo(() => {
        const start = (page - 1) * entries;
        return filteredCategories.slice(start, start + entries);
    }, [filteredCategories, page, entries]);

    useEffect(() => {
        setPage(1);
    }, [entries, search, visibilityFilter, structureFilter, filteredCategories.length]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const resetForm = () => {
        setFormData(initialForm);
        setEditingCategory(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.categoryName.trim()) {
            pushToast('error', 'Category name is required.', 'Missing field');
            return;
        }

        setSaving(true);
        try {
            const isEdit = Boolean(editingCategory);
            if (isEdit) await updateCategory(editingCategory.id, formData);
            else await createCategory(formData);

            pushToast('success', isEdit ? 'Category updated successfully.' : 'Category created successfully.', isEdit ? 'Updated' : 'Created');
            resetForm();
            setView('list');
            await loadCategories();
        } catch (e) {
            console.error(e);
            pushToast('error', e?.message || 'Save category failed', 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete category \"${name}\"?`)) return;
        try {
            await deleteCategory(id);
            pushToast('success', 'Category deleted successfully.', 'Deleted');
            await loadCategories();
        } catch (e) {
            console.error(e);
            pushToast('error', e?.message || 'Delete category failed', 'Delete failed');
        }
    };

    const openCreate = () => {
        resetForm();
        setView('form');
    };

    const handleCancel = () => {
        resetForm();
        setView('list');
    };

    const handleEdit = (cat) => {
        setEditingCategory(cat);
        setFormData({
            categoryName: cat.name || '',
            codeName: cat.codeName || '',
            categoryDetail: cat.detail || '',
            isPublic: cat.isPublic ?? true,
            mainCategory: cat.parentId ? String(cat.parentId) : '',
        });
        setView('form');
    };

    return (
        <AdminShell>
            <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
            <div className="flex w-full flex-col gap-6 font-['Outfit',sans-serif]">
                <AdminPageHeader
                    title={view === 'list' ? 'Category' : editingCategory ? 'Edit Category' : 'Create Category'}
                    description={view === 'list' ? 'Organize courses with reusable course categories.' : 'Define category information and visibility for the LMS.'}
                    action={view === 'list' ? (
                        <button type="button" onClick={openCreate} className={adminPrimaryButtonClass}>
                            Create category
                        </button>
                    ) : null}
                />

                {view === 'list' ? (
                    <AdminCard title="Category Library">
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
                                        value={visibilityFilter}
                                        onChange={(event) => setVisibilityFilter(event.target.value)}
                                        className="h-[38px] rounded-xl border border-[#DDE4FF] bg-white px-3 text-[13px] text-[#334155] outline-none focus:border-[#687EFF]"
                                    >
                                        <option value="ALL">All visibility</option>
                                        <option value="PUBLIC">Public</option>
                                        <option value="PRIVATE">Private</option>
                                    </select>
                                    <select
                                        value={structureFilter}
                                        onChange={(event) => setStructureFilter(event.target.value)}
                                        className="h-[38px] rounded-xl border border-[#DDE4FF] bg-white px-3 text-[13px] text-[#334155] outline-none focus:border-[#687EFF]"
                                    >
                                        <option value="ALL">All levels</option>
                                        <option value="ROOT">Root categories</option>
                                        <option value="NESTED">Child categories</option>
                                    </select>
                                </>
                            )}
                            right={<AdminSearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, detail, or parent" />}
                        />

                        <AdminTableWrap>
                            <AdminTable className="min-w-[980px]">
                                <AdminTableHead>
                                    <tr>
                                        <AdminTh className="w-[72px]">No.</AdminTh>
                                        <AdminTh className="min-w-[180px]">Category name</AdminTh>
                                        <AdminTh className="w-[140px]">Code</AdminTh>
                                        <AdminTh className="min-w-[260px]">Detail</AdminTh>
                                        <AdminTh className="w-[160px]">Main category</AdminTh>
                                        <AdminTh className="w-[120px]">Visibility</AdminTh>
                                        <AdminTh className="w-[160px] text-center">Tools</AdminTh>
                                    </tr>
                                </AdminTableHead>
                                <tbody>
                                    {loading ? (
                                        <AdminBodyStateRow colSpan={7}>Loading categories...</AdminBodyStateRow>
                                    ) : pagedCategories.length === 0 ? (
                                        <AdminBodyStateRow colSpan={7}>
                                            {search || visibilityFilter !== 'ALL' || structureFilter !== 'ALL'
                                                ? 'No categories matched the current filters.'
                                                : 'No categories yet. Create your first category to get started.'}
                                        </AdminBodyStateRow>
                                    ) : pagedCategories.map((cat, index) => (
                                        <tr key={cat.id} className="border-b border-[#EEF2FF] last:border-none hover:bg-[#FBFCFF]">
                                            <AdminTd className="font-medium text-[#1E293B]">{(page - 1) * entries + index + 1}</AdminTd>
                                            <AdminTd>
                                                <div className="font-semibold text-[#1E293B]">{cat.name}</div>
                                                <div className="mt-1 text-[12px] text-[#94A3B8]">ID: {cat.id}</div>
                                            </AdminTd>
                                            <AdminTd>{cat.codeName || '-'}</AdminTd>
                                            <AdminTd className="max-w-[260px] whitespace-normal">{cat.detail || '-'}</AdminTd>
                                            <AdminTd>{cat.parentId ? (categoryMap.get(String(cat.parentId)) || '-') : 'Root category'}</AdminTd>
                                            <AdminTd>
                                                <AdminStatusPill active={Boolean(cat.isPublic)} activeLabel="Public" inactiveLabel="Private" />
                                            </AdminTd>
                                            <AdminTd className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(cat)}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE4FF] bg-white text-[#475569] transition hover:bg-[#F8FAFF]"
                                                        title="Edit"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(cat.id, cat.name)}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                                                        title="Delete"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /><path d="M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </AdminTd>
                                        </tr>
                                    ))}
                                </tbody>
                            </AdminTable>
                        </AdminTableWrap>

                        <AdminPagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            totalItems={filteredCategories.length}
                            startRow={filteredCategories.length === 0 ? 0 : (page - 1) * entries + 1}
                            endRow={Math.min(page * entries, filteredCategories.length)}
                        />
                    </AdminCard>
                ) : (
                    <AdminCard title={editingCategory ? 'Category details' : 'New category'}>
                        <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="space-y-5">
                                <div>
                                    <label className="mb-2 block text-[14px] font-semibold text-[#1E293B]">Code name</label>
                                    <input
                                        type="text"
                                        value={formData.codeName}
                                        onChange={(e) => handleChange('codeName', e.target.value)}
                                        className={adminInputClass}
                                        placeholder="e.g. cyber-awareness"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-[14px] font-semibold text-[#1E293B]">Category name</label>
                                    <input
                                        type="text"
                                        value={formData.categoryName}
                                        onChange={(e) => handleChange('categoryName', e.target.value)}
                                        className={adminInputClass}
                                        placeholder="Enter category name"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-[14px] font-semibold text-[#1E293B]">Category detail</label>
                                    <textarea
                                        value={formData.categoryDetail}
                                        onChange={(e) => handleChange('categoryDetail', e.target.value)}
                                        rows={6}
                                        className={adminTextareaClass}
                                        placeholder="Describe what this category is used for"
                                    />
                                </div>
                            </div>

                            <div className="space-y-5 rounded-[20px] border border-[#E8EEFF] bg-[#FBFCFF] p-5">
                                <div>
                                    <label className="mb-2 block text-[14px] font-semibold text-[#1E293B]">Visibility</label>
                                    <div className="space-y-3 text-[14px] text-[#334155]">
                                        <label className="flex items-center gap-2">
                                            <input type="radio" name="isPublic" checked={formData.isPublic === true} onChange={() => handleChange('isPublic', true)} className="accent-[#687EFF]" />
                                            Public
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="radio" name="isPublic" checked={formData.isPublic === false} onChange={() => handleChange('isPublic', false)} className="accent-[#687EFF]" />
                                            Private
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-[14px] font-semibold text-[#1E293B]">Main category</label>
                                    <select
                                        value={formData.mainCategory}
                                        onChange={(e) => handleChange('mainCategory', e.target.value)}
                                        className={adminInputClass}
                                    >
                                        <option value="">None (root category)</option>
                                        {categories
                                            .filter((cat) => !editingCategory || cat.id !== editingCategory.id)
                                            .map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                    </select>
                                </div>

                                <div className="rounded-2xl border border-[#E8EEFF] bg-white p-4 text-[13px] text-[#64748B]">
                                    <div className="font-semibold text-[#1E293B]">Preview</div>
                                    <div className="mt-3">Name: {formData.categoryName || '-'}</div>
                                    <div className="mt-1">Code: {formData.codeName || '-'}</div>
                                    <div className="mt-1">Visibility: {formData.isPublic ? 'Public' : 'Private'}</div>
                                    <div className="mt-1">Parent: {formData.mainCategory ? (categoryMap.get(String(formData.mainCategory)) || '-') : 'Root category'}</div>
                                </div>
                            </div>

                            <div className="xl:col-span-2 flex flex-wrap items-center justify-end gap-3 border-t border-[#EEF2FF] pt-5">
                                <button type="button" onClick={handleCancel} className={adminSecondaryButtonClass}>Cancel</button>
                                <button type="submit" disabled={saving} className={adminPrimaryButtonClass}>
                                    {saving ? 'Saving...' : editingCategory ? 'Save changes' : 'Create category'}
                                </button>
                            </div>
                        </form>
                    </AdminCard>
                )}
            </div>
        </AdminShell>
    );
}

