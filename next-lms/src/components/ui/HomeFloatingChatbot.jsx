'use client';

import { useEffect, useState } from 'react';
import ChatPanel from '@/components/ui/ChatPanel';

const CHAT_OPEN_STORAGE_KEY = 'lms_ui_chat_open';

export default function HomeFloatingChatbot() {
    const [open, setOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

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
                <button
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
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
