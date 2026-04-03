'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';

const FILTERS = ['ALL', 'UNREAD', 'COURSE', 'SYSTEM'];

function formatRelativeTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '-';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
}

function resolveTone(item) {
    const severity = String(item?.severity || item?.payload?.severity || 'info').toLowerCase();
    if (severity === 'critical') return { color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', label: 'Critical' };
    if (severity === 'warning') return { color: 'text-[#B45309]', bg: 'bg-[#FFFBEB]', label: 'Warning' };
    return { color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF]', label: 'Info' };
}

export default function NotificationsPage() {
    const router = useRouter();
    const [filter, setFilter] = React.useState('ALL');
    const [items, setItems] = React.useState([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [totalCount, setTotalCount] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    const loadNotifications = React.useCallback(async ({ targetPage = 1, targetFilter = 'ALL', append = false } = {}) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                limit: '20',
                page: String(targetPage),
                filter: targetFilter,
            });
            const res = await fetch(`/api/notifications?${params.toString()}`, {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Failed to load notifications');
            const nextItems = Array.isArray(data?.items) ? data.items : [];

            setItems((prev) => {
                if (!append) return nextItems;
                const byId = new Map(prev.map((item) => [Number(item?.id || 0), item]));
                for (const item of nextItems) {
                    byId.set(Number(item?.id || 0), item);
                }
                return Array.from(byId.values());
            });
            setUnreadCount(Number(data?.unreadCount || 0));
            setTotalCount(Number(data?.totalCount || 0));
            setPage(targetPage);
        } catch (err) {
            setError(err?.message || 'Failed to load notifications');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadNotifications({ targetPage: 1, targetFilter: filter, append: false });
    }, [filter, loadNotifications]);

    const markAllRead = React.useCallback(async () => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'MARK_ALL_READ' }),
            });
            if (!res.ok) return;
            setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
            setUnreadCount(0);
        } catch {
            // ignore
        }
    }, []);

    const markRead = React.useCallback(async (notificationId) => {
        const id = Number(notificationId || 0);
        if (!Number.isInteger(id) || id <= 0) return;
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'MARK_READ', notificationId: id }),
            });
            if (!res.ok) return;
            setItems((prev) => prev.map((item) => (
                Number(item?.id || 0) === id
                    ? { ...item, readAt: item.readAt || new Date().toISOString() }
                    : item
            )));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch {
            // ignore
        }
    }, []);

    const onOpenNotification = React.useCallback(async (item) => {
        if (!item?.readAt) {
            await markRead(item.id);
        }
        const actionUrl = String(item?.actionUrl || item?.payload?.actionUrl || '').trim();
        if (actionUrl.startsWith('/')) {
            router.push(actionUrl);
        }
    }, [markRead, router]);

    const hasMore = items.length < totalCount;

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FFFFFF] to-[#F6F8FF]">
            <Navbar />
            <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:py-8">
                <div className="rounded-2xl border border-[#D1E3FB] bg-white p-4 sm:p-6 shadow-sm">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-[#052143]">All Notifications</h1>
                            <p className="text-sm text-[#6B778B]">Unread: {unreadCount}</p>
                        </div>
                        <button
                            type="button"
                            onClick={markAllRead}
                            className="h-10 rounded-xl border border-[#D1E3FB] px-4 text-sm font-medium text-[#687EFF] hover:bg-[#F6F8FF]"
                        >
                            Mark all as read
                        </button>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                        {FILTERS.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setFilter(item)}
                                className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide ${
                                    filter === item
                                        ? 'bg-[#687EFF] text-white'
                                        : 'border border-[#D1E3FB] bg-white text-[#6B778B] hover:bg-[#F8FAFF]'
                                }`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[#EEF2FF]">
                        {loading && (
                            <div className="p-6 text-sm text-[#6B778B]">Loading notifications...</div>
                        )}
                        {!loading && error && (
                            <div className="p-6 text-sm text-[#DC2626]">{error}</div>
                        )}
                        {!loading && !error && items.length === 0 && (
                            <div className="p-6 text-sm text-[#6B778B]">No notifications found.</div>
                        )}

                        {!loading && !error && items.map((item) => {
                            const tone = resolveTone(item);
                            const category = String(item?.category || item?.payload?.category || 'SYSTEM').toUpperCase();
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onOpenNotification(item)}
                                    className={`flex w-full items-start gap-3 border-b border-[#EEF2FF] px-4 py-4 text-left last:border-b-0 hover:bg-[#F8FAFF] ${
                                        item?.readAt ? 'opacity-75' : ''
                                    }`}
                                >
                                    <div className={`mt-0.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${tone.bg} ${tone.color}`}>
                                        {tone.label}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-sm font-semibold text-[#052143]">{item?.title || 'Notification'}</h3>
                                            <span className="rounded-full border border-[#D1E3FB] px-2 py-0.5 text-[10px] font-semibold text-[#6B778B]">
                                                {category}
                                            </span>
                                            {!item?.readAt && (
                                                <span className="rounded-full bg-[#FFECEC] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
                                                    UNREAD
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm text-[#6B778B]">{item?.message || '-'}</p>
                                        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                                            {formatRelativeTime(item?.createdAt)}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {!loading && !error && hasMore && (
                        <div className="mt-4 flex justify-center">
                            <button
                                type="button"
                                onClick={() => loadNotifications({ targetPage: page + 1, targetFilter: filter, append: true })}
                                className="h-10 rounded-xl border border-[#D1E3FB] px-4 text-sm font-medium text-[#687EFF] hover:bg-[#F6F8FF]"
                            >
                                Load more
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

