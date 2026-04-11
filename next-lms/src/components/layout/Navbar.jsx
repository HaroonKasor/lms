'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import ChatPanel from '@/components/ui/ChatPanel';
import { clearUser, getRememberMePreference, getUser, saveUser } from '@/lib/auth';
import { buildChatTeaserRouteKey, resolveChatTeaserMessage } from '@/lib/chat-teaser';

const DEFAULT_AVATAR_URL = '/images/default-avatar.svg';
const NOTIFICATION_POLLING_MS = 30000;
const NOTIFICATION_REQUEST_TIMEOUT_MS = 4500;
const CHAT_TEASER_LAST_SHOWN_KEY = 'lms_ui_chat_teaser_last_shown_v1';
const CHAT_TEASER_DISMISSED_PREFIX = 'lms_ui_chat_teaser_dismissed_v1';
const CHAT_TEASER_COOLDOWN_MS = 45 * 60 * 1000;
const CHAT_TEASER_AUTO_HIDE_MS = 7000;

function formatRelativeTime(value, nowMs = Date.now()) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '-';
    const diffMs = nowMs - date.getTime();
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

function getNotificationTone(input) {
    const type = typeof input === 'object' ? input?.type : input;
    const severity = String(
        (typeof input === 'object' ? (input?.severity || input?.payload?.severity) : '') || 'info'
    ).toLowerCase();
    const iconSvg = (kind) => {
        if (kind === 'critical') {
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            );
        }
        if (kind === 'warning') {
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
            );
        }
        if (kind === 'certificate') {
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                </svg>
            );
        }
        if (kind === 'enrollment') {
            return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
            );
        }
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
        );
    };
    if (severity === 'critical') return { color: 'bg-[#FEE2E2]', iconClass: 'text-[#DC2626]', icon: iconSvg('critical') };
    if (severity === 'warning') return { color: 'bg-[#FFF7ED]', iconClass: 'text-[#B45309]', icon: iconSvg('warning') };
    const key = String(type || '').toUpperCase();
    if (key.includes('CERTIFICATE')) return { color: 'bg-[#FFF3E0]', iconClass: 'text-[#D97706]', icon: iconSvg('certificate') };
    if (key.includes('ENROLLMENT')) return { color: 'bg-[#E3E7FF]', iconClass: 'text-[#425CF2]', icon: iconSvg('enrollment') };
    return { color: 'bg-[#E8F7F3]', iconClass: 'text-[#0F766E]', icon: iconSvg('default') };
}

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [relativeNowMs, setRelativeNowMs] = useState(0);
    const isAdmin = user?.role === 'admin';
    const canAccessBackend = user?.role === 'admin' || user?.role === 'instructor';
    const isPublicPage = ['/', '/about', '/contact'].includes(pathname);

    const isActive = (path) => pathname === path;
    const [showProducts, setShowProducts] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const [notificationToasts, setNotificationToasts] = useState([]);
    const [showChat, setShowChat] = useState(false);
    const [showChatTeaser, setShowChatTeaser] = useState(false);
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [chatPrefLoaded, setChatPrefLoaded] = useState(false);
    const productsRef = useRef(null);
    const userMenuRef = useRef(null);
    const notificationRef = useRef(null);
    const chatRef = useRef(null);
    const mobileMenuRef = useRef(null);
    const mobileMenuButtonRef = useRef(null);
    const notificationSnapshotRef = useRef({ initialized: false, ids: new Set() });
    const toastTimersRef = useRef(new Map());
    const notificationRequestInFlightRef = useRef(false);
    const userSyncAttemptedRef = useRef(false);
    const chatTeaserRouteKey = React.useMemo(() => buildChatTeaserRouteKey(pathname), [pathname]);
    const chatTeaserMessage = React.useMemo(
        () => resolveChatTeaserMessage(pathname, Boolean(user)),
        [pathname, user]
    );
    const chatTeaserUserScope = React.useMemo(() => {
        const id = String(user?.id || user?.username || user?.email || 'guest').trim() || 'guest';
        return `user:${id}`;
    }, [user]);

    const readStoredUser = React.useCallback(() => {
        const current = getUser();
        setUser(current);
        return current;
    }, []);

    const syncUserFromServer = React.useCallback(async () => {
        try {
            const res = await fetch('/api/users/profile', {
                cache: 'no-store',
                credentials: 'include',
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    clearUser();
                    setUser(null);
                }
                return null;
            }
            const data = await res.json();
            const fallbackRemember = typeof window !== 'undefined'
                ? Boolean(localStorage.getItem('lms_user'))
                : false;
            const remember = getRememberMePreference(fallbackRemember);
            saveUser(data, { remember });
            setUser(data);
            return data;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        setIsHydrated(true);
        const current = readStoredUser();
        if (!current) {
            void syncUserFromServer();
        }
    }, [readStoredUser, syncUserFromServer]);

    useEffect(() => {
        if (!isHydrated) return;
        if (user) {
            userSyncAttemptedRef.current = false;
            return;
        }
        if (userSyncAttemptedRef.current) return;
        userSyncAttemptedRef.current = true;
        void syncUserFromServer();
    }, [isHydrated, user, syncUserFromServer]);

    useEffect(() => {
        if (!isHydrated) return undefined;
        setRelativeNowMs(Date.now());
        const timer = setInterval(() => {
            setRelativeNowMs(Date.now());
        }, 30000);
        return () => clearInterval(timer);
    }, [isHydrated]);

    const dismissToast = React.useCallback((toastId) => {
        const id = Number(toastId || 0);
        if (!Number.isInteger(id) || id <= 0) return;
        const timer = toastTimersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            toastTimersRef.current.delete(id);
        }
        setNotificationToasts((prev) => prev.filter((toast) => Number(toast?.id || 0) !== id));
    }, []);

    const pushNotificationToasts = React.useCallback((newItems = []) => {
        const limited = (newItems || []).slice(0, 3);
        if (limited.length === 0) return;

        setNotificationToasts((prev) => {
            const byId = new Map(prev.map((toast) => [Number(toast?.id || 0), toast]));
            for (const item of limited) {
                const id = Number(item?.id || 0);
                if (!Number.isInteger(id) || id <= 0) continue;
                if (!byId.has(id)) byId.set(id, item);
            }
            return Array.from(byId.values()).slice(-4);
        });

        for (const item of limited) {
            const id = Number(item?.id || 0);
            if (!Number.isInteger(id) || id <= 0) continue;
            if (toastTimersRef.current.has(id)) continue;
            const timer = setTimeout(() => {
                dismissToast(id);
            }, 7000);
            toastTimersRef.current.set(id, timer);
        }
    }, [dismissToast]);

    const loadNotifications = React.useCallback(async (options = {}) => {
        const suppressToast = Boolean(options?.suppressToast);
        const showLoader = Boolean(options?.showLoader);
        if (!user) {
            setNotifications([]);
            setUnreadNotificationCount(0);
            setNotificationToasts([]);
            notificationSnapshotRef.current = { initialized: false, ids: new Set() };
            return;
        }
        if (notificationRequestInFlightRef.current) return;
        notificationRequestInFlightRef.current = true;

        const controller = new AbortController();
        const abortTimer = setTimeout(() => {
            try {
                controller.abort();
            } catch {
                // ignore abort errors
            }
        }, NOTIFICATION_REQUEST_TIMEOUT_MS);

        try {
            if (showLoader) setLoadingNotifications(true);
            const res = await fetch('/api/notifications?limit=20', {
                cache: 'no-store',
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const items = Array.isArray(data?.items) ? data.items : [];
            setNotifications(items);
            setUnreadNotificationCount(Number(data?.unreadCount || 0));

            const snapshot = notificationSnapshotRef.current;
            const nextIds = new Set(items.map((item) => Number(item?.id || 0)).filter((id) => Number.isInteger(id) && id > 0));
            if (!snapshot.initialized) {
                notificationSnapshotRef.current = { initialized: true, ids: nextIds };
                return;
            }

            if (!suppressToast) {
                const newItems = items.filter((item) => !snapshot.ids.has(Number(item?.id || 0)));
                if (newItems.length > 0) {
                    pushNotificationToasts(newItems);
                }
            }
            notificationSnapshotRef.current = { initialized: true, ids: nextIds };
        } catch {
            // ignore notification fetch failure
        } finally {
            clearTimeout(abortTimer);
            notificationRequestInFlightRef.current = false;
            if (showLoader) setLoadingNotifications(false);
        }
    }, [user, pushNotificationToasts]);

    const markAllNotificationsRead = React.useCallback(async () => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'MARK_ALL_READ' }),
            });
            if (!res.ok) return;
            setUnreadNotificationCount(0);
            setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
        } catch {
            // ignore mark-all failure
        }
    }, []);

    const markNotificationRead = React.useCallback(async (notificationId) => {
        const id = Number(notificationId || 0);
        if (!Number.isInteger(id) || id <= 0) return;
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'MARK_READ', notificationId: id }),
            });
            if (!res.ok) return;
            setNotifications((prev) => prev.map((item) => (
                Number(item?.id || 0) === id
                    ? { ...item, readAt: item.readAt || new Date().toISOString() }
                    : item
            )));
            setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
        } catch {
            // ignore mark-read failure
        }
    }, []);

    useEffect(() => () => {
        for (const timer of toastTimersRef.current.values()) {
            clearTimeout(timer);
        }
        toastTimersRef.current.clear();
    }, []);

    // Load user from localStorage and keep it synced across pages/tabs.
    useEffect(() => {
        const onStorage = (event) => {
            if (event?.key && event.key !== 'lms_user') return;
            readStoredUser();
        };
        const onUserUpdated = () => readStoredUser();

        window.addEventListener('storage', onStorage);
        window.addEventListener('lms_user_updated', onUserUpdated);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('lms_user_updated', onUserUpdated);
        };
    }, [readStoredUser]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('lms_ui_chat_open') === '1';
            setShowChat(saved);
        } catch {
            // ignore storage read errors
        } finally {
            setChatPrefLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!chatPrefLoaded) return;
        try {
            if (showChat) {
                localStorage.setItem('lms_ui_chat_open', '1');
            } else {
                localStorage.removeItem('lms_ui_chat_open');
            }
        } catch { }
    }, [showChat, chatPrefLoaded]);

    useEffect(() => {
        if (!chatPrefLoaded || isPublicPage || !user || showChat || !chatTeaserMessage) {
            setShowChatTeaser(false);
            return undefined;
        }

        let revealTimer = null;
        try {
            const now = Date.now();
            const lastShownAt = Number(localStorage.getItem(CHAT_TEASER_LAST_SHOWN_KEY) || 0);
            const dismissKey = `${CHAT_TEASER_DISMISSED_PREFIX}:${chatTeaserUserScope}:${chatTeaserRouteKey}`;
            const dismissed = localStorage.getItem(dismissKey) === '1';
            if (dismissed || now - lastShownAt < CHAT_TEASER_COOLDOWN_MS) {
                setShowChatTeaser(false);
                return undefined;
            }

            revealTimer = setTimeout(() => {
                setShowChatTeaser(true);
                try {
                    localStorage.setItem(CHAT_TEASER_LAST_SHOWN_KEY, String(Date.now()));
                } catch {
                    // ignore storage write errors
                }
            }, 900);
        } catch {
            setShowChatTeaser(false);
        }

        return () => {
            if (revealTimer) clearTimeout(revealTimer);
        };
    }, [chatPrefLoaded, isPublicPage, user, showChat, chatTeaserMessage, chatTeaserRouteKey, chatTeaserUserScope]);

    useEffect(() => {
        if (!showChatTeaser) return undefined;
        const timer = setTimeout(() => setShowChatTeaser(false), CHAT_TEASER_AUTO_HIDE_MS);
        return () => clearTimeout(timer);
    }, [showChatTeaser]);

    useEffect(() => {
        setShowMobileNav(false);
    }, [pathname]);

    useEffect(() => {
        if (isPublicPage || !user) return undefined;

        let active = true;
        const pull = async (options = {}) => {
            if (!active) return;
            await loadNotifications(options);
        };

        const onWindowFocus = () => {
            pull({ suppressToast: false });
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                pull({ suppressToast: false });
            }
        };

        pull({ suppressToast: false });
        const intervalId = setInterval(() => {
            pull({ suppressToast: false });
        }, NOTIFICATION_POLLING_MS);
        window.addEventListener('focus', onWindowFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            active = false;
            clearInterval(intervalId);
            window.removeEventListener('focus', onWindowFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [isPublicPage, user, loadNotifications]);

    useEffect(() => {
        if (!showNotifications) return;
        loadNotifications({ showLoader: true, suppressToast: true });
    }, [showNotifications, loadNotifications]);

    // Force-close chatbot only when entering learning player route.
    useEffect(() => {
        const isLearnRoute = /^\/courses\/[^/]+\/learn\/?$/.test(String(pathname || ''));
        if (!isLearnRoute) return;
        const timer = setTimeout(() => setShowChat(false), 0);
        try {
            localStorage.removeItem('lms_ui_chat_open');
        } catch { }
        return () => clearTimeout(timer);
    }, [pathname]);

    const dismissChatTeaser = (persistDismiss = true) => {
        setShowChatTeaser(false);
        if (!persistDismiss) return;
        try {
            localStorage.setItem(`${CHAT_TEASER_DISMISSED_PREFIX}:${chatTeaserUserScope}:${chatTeaserRouteKey}`, '1');
        } catch {
            // ignore storage write errors
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store',
                keepalive: true,
            });
            await fetch('/api/auth/logout', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                keepalive: true,
            });
        } catch { }
        clearUser();
        localStorage.removeItem('lms_ui_chat_open');
        setUser(null);
        setShowUserMenu(false);
        setShowNotifications(false);
        setNotifications([]);
        setUnreadNotificationCount(0);
        setShowChat(false);
        setShowChatTeaser(false);
        if (typeof window !== 'undefined') {
            window.location.replace(`/login?force=1&loggedOut=1&t=${Date.now()}`);
            return;
        }
        router.push('/login?force=1&loggedOut=1');
    };

    const displayName = user?.fullName || user?.username || 'User';
    const shortName = displayName.length > 15 ? displayName.slice(0, 12) + '...' : displayName;
    const avatarUrl = String(user?.avatar || '').trim() || DEFAULT_AVATAR_URL;

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (productsRef.current && !productsRef.current.contains(e.target)) {
                setShowProducts(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setShowUserMenu(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
            if (
                showMobileNav &&
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(e.target) &&
                mobileMenuButtonRef.current &&
                !mobileMenuButtonRef.current.contains(e.target)
            ) {
                setShowMobileNav(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMobileNav]);

    // Nav items for logged-in users
    const navItems = [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/my-learning', label: 'My Learning' },
        { href: '/courses', label: 'Courses' },
        { href: '/training-results', label: 'Training Results' },
    ];

    return (
        <>
            <header className="w-full h-[80px] bg-white flex items-center justify-between shrink-0 z-40 relative sticky top-0 font-['Outfit',sans-serif] border-b border-[#eaedf5] px-3 sm:px-4 md:px-6 lg:px-10 xl:px-14 2xl:px-20">

            {/* Left: Logo + Nav */}
            <div className="flex min-w-0 items-center gap-3 sm:gap-6 lg:gap-10 xl:gap-16">
                {/* Logo */}
                <Link href={isPublicPage ? '/' : '/dashboard'} className="flex items-center shrink-0">
                    <img src="/skillup_logo.png" alt="SkillUp" className="w-[48px] h-[48px] object-contain" />
                </Link>

                {/* Nav Links */}
                <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
                    {isPublicPage ? (
                        <>
                            <Link href="#features" className="text-[#052143] font-normal text-base xl:text-lg hover:text-[#687EFF] transition-colors">
                                Features
                            </Link>
                            <Link href="#testimonials" className="text-[#052143] font-normal text-base xl:text-lg hover:text-[#687EFF] transition-colors">
                                Testimonials
                            </Link>
                            <Link href="#pricing" className="text-[#052143] font-normal text-base xl:text-lg hover:text-[#687EFF] transition-colors">
                                Pricing
                            </Link>
                            <Link href="/about" className="text-[#052143] font-normal text-base xl:text-lg hover:text-[#687EFF] transition-colors">
                                About
                            </Link>
                            <Link href="/contact" className="text-[#052143] font-normal text-base xl:text-lg hover:text-[#687EFF] transition-colors">
                                Contact
                            </Link>
                        </>
                    ) : (
                        <>
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`text-lg transition-colors relative ${isActive(item.href)
                                        ? 'font-semibold text-[#687EFF]'
                                        : 'font-normal text-[#052143] hover:text-[#687EFF]'
                                        }`}
                                >
                                    {item.label}

                                </Link>
                            ))}
                            {canAccessBackend && (
                                <Link
                                    href="/admin-dashboard"
                                    className={`text-lg transition-colors relative ${isActive('/admin-dashboard')
                                        ? 'font-semibold text-[#687EFF]'
                                        : 'font-normal text-[#052143] hover:text-[#687EFF]'
                                        }`}
                                >
                                    Backend

                                </Link>
                            )}
                        </>
                    )}
                </nav>
            </div>

            {/* Right: Actions & User Profile */}
            <div className="relative flex items-center gap-2 sm:gap-3 shrink-0">
                {isPublicPage ? (
                    <div className="hidden sm:flex items-center gap-4 shrink-0">
                        <Link href="/login" className="text-[#052143] hover:text-[#687EFF] font-medium transition-colors text-lg">
                            Log in
                        </Link>
                        <Link href="/register" className="bg-[#687EFF] hover:bg-[#5a6ee6] text-white px-6 py-2.5 rounded-full font-medium transition-all text-lg">
                            Start for free
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Grid Icon (3x3) with Dropdown */}
                        <div className="relative hidden md:block" ref={productsRef}>
                            <div
                                className="cursor-pointer shrink-0 w-8 h-8 flex items-center justify-center hover:opacity-70 transition-opacity"
                                onClick={() => setShowProducts(!showProducts)}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#052143" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                </svg>
                            </div>

                            {/* My Products Dropdown */}
                            {showProducts && (
                                <div className="absolute top-full right-0 mt-3 w-[min(367px,calc(100vw-1.5rem))] bg-white border border-[#D9DEFF] rounded-2xl shadow-[0_2px_5px_5px_rgba(0,0,0,0.05)] z-50 p-5 sm:p-7">
                                    <h3 className="text-[#052143] font-medium text-xl mb-6">My Products</h3>
                                    <div className="flex flex-col gap-6">
                                        {[
                                            {
                                                name: 'Professinal LMS',
                                                bg: 'rgba(104, 126, 255, 0.3)',
                                                iconColor: '#425CF2',
                                                icon: (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#425CF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                                    </svg>
                                                )
                                            },
                                            {
                                                name: 'Digital Testbank System',
                                                bg: 'rgba(158, 102, 255, 0.3)',
                                                iconColor: '#7C3AED',
                                                icon: (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#7C3AED">
                                                        <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" opacity="0.6" />
                                                        <rect x="2" y="3" width="20" height="18" rx="2" fill="none" stroke="#7C3AED" strokeWidth="2" />
                                                        <path d="M8 3v18" stroke="#7C3AED" strokeWidth="2" />
                                                    </svg>
                                                )
                                            },
                                            {
                                                name: 'Achievement & Performance Ma...',
                                                bg: 'rgba(249, 115, 22, 0.3)',
                                                iconColor: '#F97316',
                                                icon: (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                                    </svg>
                                                )
                                            },
                                            {
                                                name: 'Knowledge Management System',
                                                bg: 'rgba(36, 178, 174, 0.25)',
                                                iconColor: '#24B2AE',
                                                icon: (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#24B2AE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M9 18h6" />
                                                        <path d="M10 22h4" />
                                                        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                                                    </svg>
                                                )
                                            },
                                            {
                                                name: 'Academy Management System',
                                                bg: 'rgba(255, 102, 122, 0.3)',
                                                iconColor: '#FF667A',
                                                icon: (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF667A">
                                                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-5v5h-2v-5H6v-2h5V7h2v5h5v2z" opacity="0.4" />
                                                        <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#FF667A" strokeWidth="1.5" />
                                                        <path d="M8 12l3 3 5-6" fill="none" stroke="#FF667A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )
                                            },
                                        ].map((product, i) => (
                                            <div key={i} className="flex items-center gap-[23px] cursor-pointer hover:opacity-80 transition-opacity">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: product.bg }}>
                                                    {product.icon}
                                                </div>
                                                <span className="text-[#052143] font-medium text-base">{product.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Vertical Divider */}
                        <div className="hidden md:block w-[1.2px] h-[47px] bg-[#D1E3FB] mx-5"></div>

                        {/* User Profile with Dropdown */}
                        <div className="relative" ref={userMenuRef}>
                            <div
                                className="flex items-center gap-3 cursor-pointer shrink-0 group"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                            >
                                <img
                                    src={avatarUrl}
                                    alt={shortName}
                                    className="w-[40px] h-[40px] rounded-full object-cover border border-[#052143]"
                                    onError={(event) => {
                                        const image = event.currentTarget;
                                        if (image.dataset.fallbackApplied === '1') return;
                                        image.dataset.fallbackApplied = '1';
                                        image.src = DEFAULT_AVATAR_URL;
                                    }}
                                />
                                <span className="text-[#052143] font-medium text-lg hidden sm:block group-hover:text-[#687EFF] transition-colors">{shortName}</span>
                                <svg className="w-[10.5px] h-[6px] ml-1 hidden sm:block shrink-0" viewBox="0 0 11 6" fill="none">
                                    <path d="M1 1L5.5 5L10 1" stroke="#052143" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>

                            {/* User Dropdown */}
                            {showUserMenu && (
                                <div className="absolute top-full right-0 mt-3 w-[min(220px,calc(100vw-1.5rem))] bg-white border border-[#D9DEFF] rounded-2xl shadow-[0_2px_5px_5px_rgba(0,0,0,0.05)] z-50 overflow-hidden">
                                    {/* User Info */}
                                    <div className="px-5 pt-5 pb-4">
                                        <p className="text-[#052143] font-medium text-base">{displayName}</p>
                                        <p className="text-[#6B778B] text-sm">{user?.email || ''}</p>
                                    </div>

                                    {/* Menu Items */}
                                    <div className="border-t border-[#F2F2F7]">
                                        <Link
                                            href="/profile"
                                            className="flex items-center gap-3 px-5 py-3 hover:bg-[#F6F8FF] transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#052143" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            <span className="text-[#052143] text-base">Profile</span>
                                        </Link>
                                        <Link
                                            href="/my-learning"
                                            className="flex items-center gap-3 px-5 py-3 hover:bg-[#F6F8FF] transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#052143" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                                <path d="M8 21h8" />
                                                <path d="M12 17v4" />
                                            </svg>
                                            <span className="text-[#052143] text-base">My Learning</span>
                                        </Link>
                                    </div>

                                    {/* Logout */}
                                    <div className="border-t border-[#F2F2F7]">
                                        <button
                                            type="button"
                                            className="flex items-center gap-3 px-5 py-3 w-full hover:bg-[#FFF5F5] transition-colors"
                                            onClick={handleLogout}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF383C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                                <polyline points="16,17 21,12 16,7" />
                                                <line x1="21" y1="12" x2="9" y2="12" />
                                            </svg>
                                            <span className="text-[#FF383C] font-medium text-base">Logout</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notification Icon */}
                        <div className="relative ml-1 sm:ml-5" ref={notificationRef}>
                            <button
                                type="button"
                                onClick={() => setShowNotifications((v) => !v)}
                                className="cursor-pointer shrink-0 flex items-center justify-center hover:scale-110 transition-transform"
                                title="Notifications"
                            >
                                <div className="relative">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#052143" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                    </svg>
                                    {unreadNotificationCount > 0 && (
                                        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white text-[10px] leading-[14px] text-white font-semibold text-center">
                                            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                                        </div>
                                    )}
                                </div>
                            </button>

                            {/* Notification Popover */}
                            {showNotifications && (
                                <div className="absolute top-full right-0 mt-4 w-80 bg-white border border-[#D1E3FB] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 overflow-hidden">
                                    <div className="p-5 border-b border-dashed border-[#D1E3FB] flex justify-between items-center">
                                        <h3 className="font-semibold text-[#052143] text-lg">Notifications</h3>
                                        <span className="text-xs bg-[#E3E7FF] text-[#687EFF] font-semibold px-2 py-1 rounded-full">
                                            {unreadNotificationCount} NEW
                                        </span>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto">
                                        {loadingNotifications && (
                                            <div className="p-5 text-sm text-[#6B778B]">Loading notifications...</div>
                                        )}
                                        {!loadingNotifications && notifications.length === 0 && (
                                            <div className="p-5 text-sm text-[#6B778B]">No notifications yet</div>
                                        )}
                                        {!loadingNotifications && notifications.map((notification) => {
                                            const tone = getNotificationTone(notification);
                                            const actionUrl = String(notification?.actionUrl || notification?.payload?.actionUrl || '').trim();
                                            return (
                                                <button
                                                    key={notification.id}
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!notification?.readAt) {
                                                            await markNotificationRead(notification.id);
                                                        }
                                                        if (actionUrl.startsWith('/')) {
                                                            router.push(actionUrl);
                                                            setShowNotifications(false);
                                                        }
                                                    }}
                                                    className={`w-full text-left p-4 hover:bg-[#F6F8FF] transition-colors border-b border-[#F6F8FF] flex items-start gap-3 ${notification?.readAt ? 'opacity-80' : ''}`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl ${tone.color} ${tone.iconClass || ''} flex items-center justify-center shrink-0`}>
                                                        {tone.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm text-[#052143] mb-1">{notification?.title || 'Notification'}</h4>
                                                        <p className="text-[#6B778B] text-xs leading-relaxed mb-2">{notification?.message || '-'}</p>
                                                        <span className="text-[10px] font-medium text-[#6B778B] uppercase tracking-wider">
                                                            {isHydrated ? formatRelativeTime(notification?.createdAt, relativeNowMs) : '-'}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="p-4 text-center border-t border-dashed border-[#D1E3FB]">
                                        <div className="flex items-center justify-between gap-3">
                                            <button
                                                type="button"
                                                onClick={markAllNotificationsRead}
                                                className="text-xs font-medium text-[#687EFF] hover:text-[#5a6ee6] transition-colors"
                                            >
                                                Mark all as read
                                            </button>
                                            <Link
                                                href="/notifications"
                                                onClick={() => setShowNotifications(false)}
                                                className="text-xs font-medium text-[#687EFF] hover:text-[#5a6ee6] transition-colors"
                                            >
                                                View all
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* AI Chat Icon */}
                        <div className="relative ml-1 sm:ml-4" ref={chatRef}>
                            {showChatTeaser ? (
                                <div className="hidden sm:block absolute right-0 top-[calc(100%+10px)] w-[250px] rounded-xl border border-[#D9E3FF] bg-white px-3 py-2.5 shadow-[0_14px_34px_rgba(8,20,55,0.14)] z-40">
                                    <button
                                        type="button"
                                        onClick={() => dismissChatTeaser(true)}
                                        className="absolute right-2 top-1.5 text-[16px] leading-none text-[#92A1BC] hover:text-[#5D6B86]"
                                        aria-label="Dismiss suggestion"
                                    >
                                        ×
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            dismissChatTeaser(true);
                                            setShowChat(true);
                                        }}
                                        className="block w-full pr-5 text-left text-[12px] leading-5 text-[#243B66]"
                                    >
                                        {chatTeaserMessage}
                                    </button>
                                    <span
                                        aria-hidden="true"
                                        className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-l border-t border-[#D9E3FF] bg-white"
                                    />
                                </div>
                            ) : null}
                            <button
                                onClick={() => {
                                    dismissChatTeaser(false);
                                    setShowChat((v) => !v);
                                }}
                                title="SkillBot AI Assistant"
                                className="cursor-pointer shrink-0 flex items-center justify-center hover:opacity-80 transition-opacity focus:outline-none"
                            >
                                <img src="/images/ai-assistant-icon.jpg" alt="AI Chat" className="w-[32px] h-[29px] object-contain" />
                            </button>
                            <ChatPanel isOpen={showChat} onClose={() => setShowChat(false)} />
                        </div>
                    </>
                )}

                {isPublicPage ? (
                    <Link
                        href="/login"
                        className="inline-flex sm:hidden items-center justify-center rounded-full border border-[#D1E3FB] px-3 py-1.5 text-[13px] font-medium text-[#052143]"
                    >
                        Log in
                    </Link>
                ) : null}

                <button
                    ref={mobileMenuButtonRef}
                    type="button"
                    onClick={() => setShowMobileNav((value) => !value)}
                    className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-full border border-[#D1E3FB] text-[#052143] hover:border-[#687EFF] hover:text-[#687EFF] transition-colors"
                    aria-label="Toggle menu"
                    aria-expanded={showMobileNav}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
            </div>
            </header>

            {showMobileNav ? (
                <div className="lg:hidden fixed inset-0 z-[65] bg-black/30 px-3 pt-[84px]">
                    <div
                        ref={mobileMenuRef}
                        className="ml-auto w-full max-w-[340px] rounded-2xl border border-[#D1E3FB] bg-white p-3 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
                    >
                        <nav className="grid gap-1">
                            {(isPublicPage
                                ? [
                                    { href: '/about', label: 'About' },
                                    { href: '/contact', label: 'Contact' },
                                    { href: '/pricing', label: 'Pricing' },
                                ]
                                : [
                                    ...navItems,
                                    ...(canAccessBackend ? [{ href: '/admin-dashboard', label: 'Backend' }] : []),
                                ]
                            ).map((item) => (
                                <Link
                                    key={`mobile-nav-${item.href}`}
                                    href={item.href}
                                    onClick={() => setShowMobileNav(false)}
                                    className={`rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
                                        isActive(item.href)
                                            ? 'bg-[#EEF2FF] text-[#687EFF]'
                                            : 'text-[#052143] hover:bg-[#F7F9FF]'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        {!isPublicPage ? (
                            <div className="mt-3 border-t border-[#ECF1FF] pt-3">
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="inline-flex w-full items-center justify-center rounded-xl border border-[#FFD6D7] px-3 py-2.5 text-[14px] font-semibold text-[#FF383C] hover:bg-[#FFF5F5]"
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#ECF1FF] pt-3">
                                <Link
                                    href="/login"
                                    onClick={() => setShowMobileNav(false)}
                                    className="inline-flex items-center justify-center rounded-xl border border-[#D1E3FB] px-3 py-2.5 text-[14px] font-medium text-[#052143]"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/register"
                                    onClick={() => setShowMobileNav(false)}
                                    className="inline-flex items-center justify-center rounded-xl bg-[#687EFF] px-3 py-2.5 text-[14px] font-semibold text-white"
                                >
                                    Register
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {!isPublicPage && notificationToasts.length > 0 && (
                <div className="fixed top-24 right-3 sm:right-6 z-[70] flex w-[360px] max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] flex-col gap-3 pointer-events-none">
                    {notificationToasts.slice().reverse().map((toast) => {
                        const tone = getNotificationTone(toast);
                        const toastId = Number(toast?.id || 0);
                        const actionUrl = String(toast?.actionUrl || toast?.payload?.actionUrl || '').trim();
                        return (
                            <div
                                key={toastId}
                                role="button"
                                tabIndex={0}
                                onClick={async () => {
                                    if (!toast?.readAt) {
                                        await markNotificationRead(toastId);
                                    }
                                    dismissToast(toastId);
                                    if (actionUrl.startsWith('/')) {
                                        router.push(actionUrl);
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        event.currentTarget.click();
                                    }
                                }}
                                className="pointer-events-auto cursor-pointer rounded-2xl border border-[#D1E3FB] bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5"
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.color} ${tone.iconClass || ''}`}>
                                        {tone.icon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="line-clamp-1 text-sm font-semibold text-[#052143]">
                                                {toast?.title || 'Notification'}
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    dismissToast(toastId);
                                                }}
                                                className="text-xs font-semibold text-[#6B778B] hover:text-[#052143]"
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6B778B]">
                                            {toast?.message || '-'}
                                        </p>
                                        <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-[#6B778B]">
                                            {isHydrated ? formatRelativeTime(toast?.createdAt, relativeNowMs) : '-'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
