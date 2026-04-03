'use client';

import React from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import { AdminCard, AdminPageHeader, adminPrimaryButtonClass, adminSecondaryButtonClass } from '@/components/admin/ui/AdminPrimitives';

function LinkIcon() {
    return (
        <svg className="h-7 w-7 text-[#0F5BDC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.43" />
            <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.41-1.41" />
        </svg>
    );
}

const checkpoints = [
    {
        title: 'Integration catalog',
        description: 'A clean entry point for third-party connectors, API credentials, and environment-specific connection status.'
    },
    {
        title: 'Health overview',
        description: 'We can surface sync issues, webhook delivery state, and retry controls here without changing the shell again.'
    },
    {
        title: 'Rollout ready shell',
        description: 'This page now follows the same spacing, cards, and action rhythm as the rest of the refreshed admin experience.'
    }
];

export default function ConnectionPage() {
    const [health, setHealth] = React.useState(null);
    const [healthError, setHealthError] = React.useState('');
    const [loading, setLoading] = React.useState(true);

    const loadHealth = React.useCallback(async () => {
        setLoading(true);
        setHealthError('');
        try {
            const res = await fetch('/api/health', { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(String(data?.error || 'Health check failed'));
            }
            setHealth(data || null);
        } catch (err) {
            setHealthError(String(err?.message || 'Health check failed'));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadHealth();
    }, [loadHealth]);

    const dbOk = Boolean(health?.checks?.database?.ok);
    const mailOk = Boolean(health?.checks?.mail?.configured);
    const statusPillClass = health?.status === 'ok'
        ? 'bg-[#ECFDF3] text-[#037847] border-[#ABEFC6]'
        : 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]';

    return (
        <AdminShell>
            <div className="flex w-full flex-col gap-6">
                <AdminPageHeader
                    eyebrow="Admin workspace"
                    title="Connection"
                    description="Connection center now exposes real runtime health, so deployment and integration issues can be detected from inside the admin dashboard."
                    actions={(
                        <div className="flex flex-wrap gap-3">
                            <button type="button" className={adminSecondaryButtonClass} onClick={loadHealth}>
                                Refresh health
                            </button>
                            <button type="button" className={adminPrimaryButtonClass}>Plan integrations</button>
                        </div>
                    )}
                />

                <AdminCard className="overflow-hidden p-0">
                    <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="border-b border-[#E6EEF8] bg-[radial-gradient(circle_at_top_left,_rgba(15,91,220,0.12),_transparent_45%),linear-gradient(135deg,_#F8FBFF_0%,_#EEF5FF_100%)] p-8 lg:border-b-0 lg:border-r">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-[0_18px_40px_rgba(15,91,220,0.12)]">
                                <LinkIcon />
                            </div>
                            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-[#052143]">Connection center is ready</h2>
                            <p className="mt-3 max-w-[640px] text-[15px] leading-7 text-[#5B6B83]">
                                This page follows the same admin pattern, and now includes live backend health signals (database reachability, mail readiness, and app URL) for safer production operations.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#406180]">
                                <span className="rounded-full border border-[#CFE0F5] bg-white px-4 py-2">Unified header</span>
                                <span className="rounded-full border border-[#CFE0F5] bg-white px-4 py-2">Consistent action bar</span>
                                <span className="rounded-full border border-[#CFE0F5] bg-white px-4 py-2">Live health check</span>
                            </div>
                        </div>

                        <div className="p-8">
                            <div className="mb-4 flex items-center justify-between rounded-[16px] border border-[#E6EEF8] bg-[#F8FBFF] px-4 py-3">
                                <div className="text-sm text-[#53637A]">Runtime status</div>
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass}`}>
                                    {health?.status === 'ok' ? 'Healthy' : 'Degraded'}
                                </span>
                            </div>
                            <div className="grid gap-4">
                                {checkpoints.map((item) => (
                                    <div key={item.title} className="rounded-[22px] border border-[#E6EEF8] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(14,42,90,0.04)]">
                                        <h3 className="text-[17px] font-semibold text-[#0B2447]">{item.title}</h3>
                                        <p className="mt-2 text-[14px] leading-6 text-[#60738E]">{item.description}</p>
                                    </div>
                                ))}
                                <div className="rounded-[22px] border border-[#E6EEF8] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(14,42,90,0.04)]">
                                    <h3 className="text-[17px] font-semibold text-[#0B2447]">Live checks</h3>
                                    {loading ? (
                                        <p className="mt-2 text-[14px] text-[#60738E]">Loading health data...</p>
                                    ) : (
                                        <div className="mt-3 space-y-2 text-[14px] text-[#60738E]">
                                            <p>Database: <span className={dbOk ? 'text-[#037847] font-semibold' : 'text-[#B42318] font-semibold'}>{dbOk ? 'Connected' : 'Disconnected'}</span></p>
                                            <p>Mail config: <span className={mailOk ? 'text-[#037847] font-semibold' : 'text-[#B42318] font-semibold'}>{mailOk ? 'Configured' : 'Missing config'}</span></p>
                                            <p>App URL: <span className="font-medium text-[#0B2447]">{health?.checks?.appUrl || '-'}</span></p>
                                            <p>Latency: <span className="font-medium text-[#0B2447]">{Number(health?.totalLatencyMs || 0)} ms</span></p>
                                        </div>
                                    )}
                                    {healthError ? (
                                        <p className="mt-3 text-[13px] text-[#B42318]">{healthError}</p>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </AdminCard>
            </div>
        </AdminShell>
    );
}
