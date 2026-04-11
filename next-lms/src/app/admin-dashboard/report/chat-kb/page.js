'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import {
    AdminBodyStateRow,
    AdminCard,
    AdminPageHeader,
    AdminSearchInput,
    AdminStatusPill,
    AdminTable,
    AdminTableHead,
    AdminTableWrap,
    AdminTd,
    AdminTh,
    AdminToolbar,
    adminDangerButtonClass,
    adminInputClass,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
    adminTextareaClass,
} from '@/components/admin/ui/AdminPrimitives';

function formatDate(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
}

function splitCommaText(value) {
    return Array.from(
        new Set(
            String(value || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
        )
    );
}

function joinCommaText(values = []) {
    if (!Array.isArray(values) || values.length === 0) return '';
    return values.join(', ');
}

const defaultForm = {
    itemId: 0,
    title: '',
    content: '',
    tagsText: '',
    intentsText: '',
    isActive: true,
};

export default function ChatKnowledgeBasePage() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(0);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState([]);
    const [form, setForm] = useState(defaultForm);

    const fetchItems = async (nextQuery = query) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (String(nextQuery || '').trim()) params.set('q', String(nextQuery || '').trim());
            const res = await fetch(`/api/reports/chat-kb?${params.toString()}`, { cache: 'no-store' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Failed to load knowledge base');
            setRows(Array.isArray(json?.items) ? json.items : []);
        } catch (err) {
            setError(String(err?.message || 'Failed to load knowledge base'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                itemId: Number(form.itemId || 0) || undefined,
                title: String(form.title || '').trim(),
                content: String(form.content || '').trim(),
                tags: splitCommaText(form.tagsText),
                intents: splitCommaText(form.intentsText),
                isActive: form.isActive !== false,
            };
            const res = await fetch('/api/reports/chat-kb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Failed to save knowledge item');
            setForm(defaultForm);
            await fetchItems(query);
        } catch (err) {
            setError(String(err?.message || 'Failed to save knowledge item'));
        } finally {
            setSaving(false);
        }
    };

    const onDelete = async (itemId) => {
        const id = Number(itemId || 0);
        if (!id) return;
        const confirmed = window.confirm('Delete this knowledge item?');
        if (!confirmed) return;
        setDeletingId(id);
        setError('');
        try {
            const res = await fetch(`/api/reports/chat-kb?itemId=${id}`, {
                method: 'DELETE',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || 'Failed to delete knowledge item');
            if (Number(form.itemId || 0) === id) {
                setForm(defaultForm);
            }
            await fetchItems(query);
        } catch (err) {
            setError(String(err?.message || 'Failed to delete knowledge item'));
        } finally {
            setDeletingId(0);
        }
    };

    const selectedLabel = useMemo(() => {
        if (!form.itemId) return 'Create New Item';
        return `Editing #${form.itemId}`;
    }, [form.itemId]);

    return (
        <AdminShell>
            <div className="relative z-10 w-full space-y-6 pb-20 lg:space-y-7">
                <AdminPageHeader
                    title="Report: Chat Knowledge Base"
                    description="Manage trusted facts for chatbot retrieval. Update content, tags, and intent mapping without code changes."
                />

                {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div> : null}

                <AdminCard title="Knowledge Items" headerTone="secondary" contentClassName="mt-1">
                    <AdminToolbar
                        left={(
                            <>
                                <AdminSearchInput
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search title/content/tags..."
                                    className="lg:w-[360px]"
                                />
                                <button onClick={() => fetchItems(query)} className={adminPrimaryButtonClass}>
                                    {loading ? 'Loading...' : 'Search'}
                                </button>
                                <button
                                    onClick={() => {
                                        setQuery('');
                                        fetchItems('');
                                    }}
                                    className={adminSecondaryButtonClass}
                                >
                                    Reset
                                </button>
                            </>
                        )}
                        right={(
                            <button
                                onClick={() => setForm(defaultForm)}
                                className={adminSecondaryButtonClass}
                            >
                                New Item
                            </button>
                        )}
                    />
                    <AdminTableWrap>
                        <AdminTable className="min-w-[1000px]">
                            <AdminTableHead>
                                <tr>
                                    <AdminTh className="w-[70px]">No.</AdminTh>
                                    <AdminTh className="w-[220px]">Title</AdminTh>
                                    <AdminTh className="w-[200px]">Tags</AdminTh>
                                    <AdminTh className="w-[180px]">Intents</AdminTh>
                                    <AdminTh className="w-[110px]">Status</AdminTh>
                                    <AdminTh className="w-[180px]">Updated</AdminTh>
                                    <AdminTh className="w-[170px]">Actions</AdminTh>
                                </tr>
                            </AdminTableHead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.id || index} className="border-b border-[#EEF2FF] last:border-b-0 hover:bg-[#F8FAFF]">
                                        <AdminTd className="font-medium text-[#0F2243]">{index + 1}</AdminTd>
                                        <AdminTd>{row.title || '-'}</AdminTd>
                                        <AdminTd>{Array.isArray(row.tags) && row.tags.length > 0 ? row.tags.join(', ') : '-'}</AdminTd>
                                        <AdminTd>{Array.isArray(row.intents) && row.intents.length > 0 ? row.intents.join(', ') : '-'}</AdminTd>
                                        <AdminTd><AdminStatusPill active={row.isActive !== false} /></AdminTd>
                                        <AdminTd>{formatDate(row.updatedAt)}</AdminTd>
                                        <AdminTd>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    className={adminSecondaryButtonClass}
                                                    onClick={() => setForm({
                                                        itemId: Number(row.id || 0),
                                                        title: String(row.title || ''),
                                                        content: String(row.content || ''),
                                                        tagsText: joinCommaText(row.tags),
                                                        intentsText: joinCommaText(row.intents),
                                                        isActive: row.isActive !== false,
                                                    })}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className={adminDangerButtonClass}
                                                    onClick={() => onDelete(row.id)}
                                                    disabled={deletingId === Number(row.id || 0)}
                                                >
                                                    {deletingId === Number(row.id || 0) ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </AdminTd>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <AdminBodyStateRow colSpan={7}>
                                        {loading ? 'Loading knowledge items...' : 'No knowledge items found'}
                                    </AdminBodyStateRow>
                                )}
                            </tbody>
                        </AdminTable>
                    </AdminTableWrap>
                </AdminCard>

                <AdminCard title={selectedLabel} contentClassName="mt-2">
                    <form className="space-y-4" onSubmit={onSubmit}>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">Title</label>
                                <input
                                    className={adminInputClass}
                                    value={form.title}
                                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                    placeholder="Example: About SkillUp Project"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">Status</label>
                                <select
                                    className={adminInputClass}
                                    value={form.isActive ? 'active' : 'inactive'}
                                    onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.value === 'active' }))}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[13px] font-medium text-[#334155]">Content</label>
                            <textarea
                                className={`${adminTextareaClass} min-h-[140px]`}
                                value={form.content}
                                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                                placeholder="Write the trusted knowledge content for chatbot retrieval..."
                                required
                            />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">Tags (comma separated)</label>
                                <input
                                    className={adminInputClass}
                                    value={form.tagsText}
                                    onChange={(event) => setForm((prev) => ({ ...prev, tagsText: event.target.value }))}
                                    placeholder="about, skillup, project"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-[#334155]">Intents (comma separated)</label>
                                <input
                                    className={adminInputClass}
                                    value={form.intentsText}
                                    onChange={(event) => setForm((prev) => ({ ...prev, intentsText: event.target.value }))}
                                    placeholder="about_skillup, my_learning"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button type="submit" className={adminPrimaryButtonClass} disabled={saving}>
                                {saving ? 'Saving...' : (form.itemId ? 'Update Item' : 'Create Item')}
                            </button>
                            <button
                                type="button"
                                className={adminSecondaryButtonClass}
                                onClick={() => setForm(defaultForm)}
                            >
                                Clear
                            </button>
                        </div>
                    </form>
                </AdminCard>
            </div>
        </AdminShell>
    );
}
