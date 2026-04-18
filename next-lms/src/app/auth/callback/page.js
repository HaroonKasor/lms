'use client';

import React from 'react';
import { beginChatSession, saveUser, setRememberMePreference } from '@/lib/auth';

function normalizeNextPath(value) {
    const next = String(value || '').trim();
    if (!next) return '';
    if (!next.startsWith('/')) return '';
    if (next.startsWith('//')) return '';
    return next;
}

export default function AuthCallbackPage() {
    const [message, setMessage] = React.useState('Signing you in...');

    React.useEffect(() => {
        let isMounted = true;

        async function run() {
            try {
                const params = new URLSearchParams(window.location.search);
                const next = normalizeNextPath(params.get('next'));
                const remember = params.get('rm') === '1';

                const res = await fetch('/api/auth/me', { cache: 'no-store' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.user) {
                    window.location.assign(`/login?error=oauth_hydrate_failed${next ? `&next=${encodeURIComponent(next)}` : ''}`);
                    return;
                }

                saveUser(data.user, { remember });
                beginChatSession({ remember });
                setRememberMePreference(remember);

                const role = String(data.user.role || '').toLowerCase();
                const defaultPath = role === 'admin' || role === 'instructor' ? '/admin-dashboard' : '/dashboard';
                window.location.assign(next || defaultPath);
            } catch (err) {
                console.error('[auth/callback] failed', err);
                if (isMounted) setMessage('Sign-in failed. Redirecting...');
                window.location.assign('/login?error=oauth_callback_failed');
            }
        }

        run();
        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F5F7FF] font-['Outfit',sans-serif]">
            <div className="bg-white rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.08)] px-8 py-10 w-full max-w-[420px] text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-[#687EFF]/10 flex items-center justify-center mb-4">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v4" />
                        <path d="M12 18v4" />
                        <path d="M4.93 4.93l2.83 2.83" />
                        <path d="M16.24 16.24l2.83 2.83" />
                        <path d="M2 12h4" />
                        <path d="M18 12h4" />
                        <path d="M4.93 19.07l2.83-2.83" />
                        <path d="M16.24 7.76l2.83-2.83" />
                    </svg>
                </div>
                <div className="text-[#052143] text-[18px] font-semibold mb-2">Please wait</div>
                <div className="text-[#6B778B] text-[15px]">{message}</div>
            </div>
        </div>
    );
}

