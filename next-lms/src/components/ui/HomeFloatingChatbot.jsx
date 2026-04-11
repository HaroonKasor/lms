'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import ChatPanel from '@/components/ui/ChatPanel';
import { buildChatTeaserRouteKey, resolveChatTeaserMessage } from '@/lib/chat-teaser';

const CHAT_OPEN_STORAGE_KEY = 'lms_ui_chat_open';
const CHAT_TEASER_LAST_SHOWN_KEY = 'lms_ui_chat_teaser_last_shown_v1';
const CHAT_TEASER_DISMISSED_PREFIX = 'lms_ui_chat_teaser_dismissed_v1';
const CHAT_TEASER_COOLDOWN_MS = 45 * 60 * 1000;
const CHAT_TEASER_AUTO_HIDE_MS = 7000;

export default function HomeFloatingChatbot() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [showTeaser, setShowTeaser] = useState(false);
    const teaserMessage = useMemo(() => resolveChatTeaserMessage(pathname, false), [pathname]);
    const teaserRouteKey = useMemo(() => buildChatTeaserRouteKey(pathname), [pathname]);

    useEffect(() => {
        try {
            setOpen(localStorage.getItem(CHAT_OPEN_STORAGE_KEY) === '1');
        } catch {
            setOpen(false);
        } finally {
            setReady(true);
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        try {
            if (open) {
                localStorage.setItem(CHAT_OPEN_STORAGE_KEY, '1');
            } else {
                localStorage.removeItem(CHAT_OPEN_STORAGE_KEY);
            }
        } catch {
            // ignore storage errors
        }
    }, [open, ready]);

    useEffect(() => {
        const onScroll = () => {
            setCollapsed(window.scrollY > 140);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!ready || open || collapsed || !teaserMessage) {
            setShowTeaser(false);
            return undefined;
        }

        let revealTimer = null;
        try {
            const now = Date.now();
            const lastShownAt = Number(localStorage.getItem(CHAT_TEASER_LAST_SHOWN_KEY) || 0);
            const dismissKey = `${CHAT_TEASER_DISMISSED_PREFIX}:guest:${teaserRouteKey}`;
            const dismissed = localStorage.getItem(dismissKey) === '1';
            if (dismissed || now - lastShownAt < CHAT_TEASER_COOLDOWN_MS) {
                setShowTeaser(false);
                return undefined;
            }

            revealTimer = setTimeout(() => {
                setShowTeaser(true);
                try {
                    localStorage.setItem(CHAT_TEASER_LAST_SHOWN_KEY, String(Date.now()));
                } catch {
                    // ignore storage write errors
                }
            }, 900);
        } catch {
            setShowTeaser(false);
        }

        return () => {
            if (revealTimer) clearTimeout(revealTimer);
        };
    }, [ready, open, collapsed, teaserMessage, teaserRouteKey]);

    useEffect(() => {
        if (!showTeaser) return undefined;
        const timer = setTimeout(() => setShowTeaser(false), CHAT_TEASER_AUTO_HIDE_MS);
        return () => clearTimeout(timer);
    }, [showTeaser]);

    const dismissTeaser = (persistDismiss = true) => {
        setShowTeaser(false);
        if (!persistDismiss) return;
        try {
            localStorage.setItem(`${CHAT_TEASER_DISMISSED_PREFIX}:guest:${teaserRouteKey}`, '1');
        } catch {
            // ignore storage write errors
        }
    };

    return (
        <>
            <style>{`
                @keyframes homeChatFloat {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                    100% { transform: translateY(0px); }
                }
                @keyframes homeChatPulse {
                    0% { transform: scale(1); opacity: 0.45; }
                    70% { transform: scale(1.25); opacity: 0; }
                    100% { transform: scale(1.25); opacity: 0; }
                }
            `}</style>

            <div className={`fixed right-4 z-[88] transition-all duration-300 sm:right-6 ${collapsed ? 'bottom-3 sm:bottom-4' : 'bottom-5 sm:bottom-6'}`}>
                {showTeaser ? (
                    <div className="absolute bottom-[calc(100%+10px)] right-0 w-[240px] max-w-[82vw] rounded-xl border border-[#D9E3FF] bg-white px-3 py-2.5 shadow-[0_14px_34px_rgba(8,20,55,0.14)]">
                        <button
                            type="button"
                            onClick={() => dismissTeaser(true)}
                            className="absolute right-2 top-1.5 text-[16px] leading-none text-[#92A1BC] hover:text-[#5D6B86]"
                            aria-label="Dismiss suggestion"
                        >
                            ×
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                dismissTeaser(true);
                                setOpen(true);
                            }}
                            className="block w-full pr-5 text-left text-[12px] leading-5 text-[#243B66]"
                        >
                            {teaserMessage}
                        </button>
                        <span
                            aria-hidden="true"
                            className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-[#D9E3FF] bg-white"
                        />
                    </div>
                ) : null}
                <button
                    type="button"
                    onClick={() => {
                        dismissTeaser(false);
                        setOpen((prev) => !prev);
                    }}
                    title="Open SkillBot"
                    aria-label="Open SkillBot"
                    className={`group relative flex items-center justify-center transition-transform duration-300 hover:scale-105 focus:outline-none ${collapsed ? 'h-[42px] w-[42px]' : 'h-[62px] w-[62px]'}`}
                    style={{ animation: collapsed ? 'none' : 'homeChatFloat 3.2s ease-in-out infinite' }}
                >
                    {!open ? (
                        <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-0 rounded-full border border-[#A8B7FF]/50 ${collapsed ? 'hidden' : ''}`}
                            style={{ animation: 'homeChatPulse 2.4s ease-out infinite' }}
                        />
                    ) : null}
                    <img
                        src="/chatbothome.png"
                        alt="SkillBot"
                        className={`object-contain drop-shadow-[0_8px_20px_rgba(8,20,55,0.32)] transition-all duration-300 ${collapsed ? 'h-[42px] w-[42px]' : 'h-[62px] w-[62px]'}`}
                    />
                </button>
            </div>

            <ChatPanel
                isOpen={open}
                onClose={() => setOpen(false)}
                variant="compact"
                showQuickActions={false}
            />
        </>
    );
}
