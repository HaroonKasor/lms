'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { clearUser } from '@/lib/auth';

const IDLE_TIMEOUT_MS = 90 * 60 * 1000; // 1h30m
const TOUCH_THROTTLE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;
const PROTECTED_PREFIXES = [
    '/dashboard',
    '/my-learning',
    '/my-courses',
    '/my-notes',
    '/training-results',
    '/profile',
    '/learner-dashboard',
    '/courses',
    '/admin-dashboard',
];

function isProtectedPath(pathname) {
    return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function buildTimeoutLoginUrl() {
    const nextPath = `${window.location.pathname}${window.location.search || ''}`;
    const search = new URLSearchParams({
        timeout: '1',
        next: nextPath,
    });
    return `/login?${search.toString()}`;
}

export default function IdleSessionGuard() {
    const pathname = usePathname() || '';
    const enabled = isProtectedPath(pathname);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return undefined;

        let disposed = false;
        let touchInFlight = false;
        let logoutTriggered = false;
        let lastActivityAt = Date.now();
        let lastTouchAt = 0;

        const forceLogout = async () => {
            if (disposed || logoutTriggered) return;
            logoutTriggered = true;
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                    keepalive: true,
                });
            } catch {
                // best effort logout
            }
            clearUser();
            window.location.assign(buildTimeoutLoginUrl());
        };

        const touchSession = async (force = false) => {
            if (disposed || logoutTriggered || touchInFlight) return;
            const now = Date.now();
            if (!force && now - lastTouchAt < TOUCH_THROTTLE_MS) return;

            touchInFlight = true;
            try {
                const res = await fetch('/api/auth/touch', {
                    method: 'POST',
                    credentials: 'include',
                    keepalive: true,
                });
                if (res.status === 401) {
                    await forceLogout();
                    return;
                }
                if (res.ok) {
                    lastTouchAt = Date.now();
                }
            } catch {
                // ignore transient network issues
            } finally {
                touchInFlight = false;
            }
        };

        const onActivity = () => {
            lastActivityAt = Date.now();
            touchSession(false);
        };

        const events = [
            'mousemove',
            'mousedown',
            'keydown',
            'scroll',
            'touchstart',
            'pointerdown',
            'focus',
        ];

        for (const eventName of events) {
            window.addEventListener(eventName, onActivity, { passive: true });
        }
        document.addEventListener('visibilitychange', onActivity);

        const checker = window.setInterval(() => {
            if (Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) {
                forceLogout();
            }
        }, CHECK_INTERVAL_MS);

        // Initialize fresh activity timestamp for the current protected page.
        touchSession(true);

        return () => {
            disposed = true;
            window.clearInterval(checker);
            document.removeEventListener('visibilitychange', onActivity);
            for (const eventName of events) {
                window.removeEventListener(eventName, onActivity);
            }
        };
    }, [enabled]);

    return null;
}
