"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { getChatSessionId, getUser } from "@/lib/auth";

const DEFAULT_QUICK_ACTIONS = [
    { label: "Summarize this page", prompt: "Summarize this page", context: { intent: "course_detail" } },
    { label: "Give me a hint", prompt: "Give me a hint" },
    { label: "Define Terms", prompt: "Define Terms" },
    {
        label: "About SkillUp",
        prompt: "About SkillUp",
        context: { intent: "about_skillup" },
    },
    {
        label: "สรุปสถานะการเรียนของฉัน",
        prompt: "สรุปสถานะการเรียนของฉัน",
        context: { intent: "my_learning_progress" },
    },
];

const LEARNING_PAGE_QUICK_ACTIONS = [
    {
        label: "สรุปบทนี้",
        prompt: "สรุปบทที่กำลังเรียนนี้แบบสั้นๆ เป็นหัวข้อสำคัญ 3-5 ข้อ พร้อมตัวอย่างใช้งานจริง 1 ตัวอย่าง",
        context: { intent: "course_detail" },
    },
    {
        label: "ขอ Hint",
        prompt: "ขอ Hint สั้นๆ สำหรับบทนี้ โดยไม่เฉลยคำตอบตรงๆ",
        context: { intent: "quiz_hint_only" },
    },
    {
        label: "ฉันค้างตรงไหน",
        prompt: "จากบทที่กำลังเรียน ช่วยวิเคราะห์ว่าฉันน่าจะค้างตรงไหน และควรทำอะไรต่อทีละขั้นแบบสั้นๆ",
        context: { intent: "course_detail" },
    },
];

function resolveQuickActionsByPath(pathname) {
    const path = String(pathname || "").toLowerCase();
    const isLearningPage = /^\/courses\/[^/]+\/learn(?:\/|$)/i.test(path);
    return isLearningPage ? LEARNING_PAGE_QUICK_ACTIONS : DEFAULT_QUICK_ACTIONS;
}
const CHAT_HISTORY_KEY_PREFIX = "lms_ui_chat_history_v1";
const MAX_HISTORY_MESSAGES = 40;
const MAX_FEEDBACK_REASON_CHARS = 300;

function createMessageId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeFeedback(raw) {
    if (!raw || typeof raw !== "object") return null;
    const rating = raw.rating === "up" || raw.rating === "down" ? raw.rating : "";
    if (!rating) return null;
    const submittedAt = String(raw.submittedAt || "").trim() || new Date().toISOString();
    return {
        rating,
        reason: String(raw.reason || "").trim().slice(0, MAX_FEEDBACK_REASON_CHARS),
        submittedAt,
        feedbackId: String(raw.feedbackId || "").trim() || null,
    };
}

function getUserChatStorageKey() {
    try {
        const user = getUser();
        const id = String(user?.id || user?.username || user?.email || "guest").trim() || "guest";
        const sessionId = String(getChatSessionId() || "").trim() || "legacy";
        return `${CHAT_HISTORY_KEY_PREFIX}:${id}:${sessionId}`;
    } catch {
        return `${CHAT_HISTORY_KEY_PREFIX}:guest:legacy`;
    }
}

function sanitizeMessages(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item) => item && (item.role === "user" || item.role === "assistant"))
        .map((item) => ({
            id: String(item.id || createMessageId()),
            role: item.role,
            content: String(item.content || "").trim(),
            createdAt: String(item.createdAt || "").trim() || new Date().toISOString(),
            feedback: sanitizeFeedback(item.feedback),
            intent: String(item.intent || "").trim().slice(0, 60) || null,
            provider: String(item.provider || "").trim().slice(0, 80) || null,
            intentConfidence: Number.isFinite(Number(item.intentConfidence))
                ? Math.max(0, Math.min(1, Number(item.intentConfidence)))
                : null,
        }))
        .filter((item) => item.content.length > 0)
        .slice(-MAX_HISTORY_MESSAGES);
}

function buildRecentConversationForFeedback(messages, assistantMessageId) {
    const index = messages.findIndex((item) => item?.id === assistantMessageId);
    if (index < 0) return [];
    const start = Math.max(0, index - 5);
    const slice = messages.slice(start, index + 1);
    return slice.map((item) => ({
        role: item.role,
        content: String(item.content || "").slice(0, 1200),
    }));
}

function TypingIndicator() {
    return (
        <div className="flex items-start gap-2">
            <img
                src="/chatbothome.png"
                alt="SkillBot"
                className="h-6 w-6 shrink-0 object-contain"
            />
            <div className="rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "240ms" }} />
                </div>
            </div>
        </div>
    );
}

function ThumbsUpIcon({ className = "h-3.5 w-3.5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 10V5a3 3 0 0 0-3-3l-3.5 8" />
            <path d="M7.5 10H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3.5a2 2 0 0 0 1.9-1.4L11 14h7a2 2 0 0 0 1.93-2.52l-1-4A2 2 0 0 0 17 6h-4.2" />
        </svg>
    );
}

function ThumbsDownIcon({ className = "h-3.5 w-3.5" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 14v5a3 3 0 0 0 3 3l3.5-8" />
            <path d="M16.5 14H20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.5a2 2 0 0 0-1.9 1.4L13 10H6a2 2 0 0 0-1.93 2.52l1 4A2 2 0 0 0 7 18h4.2" />
        </svg>
    );
}

function AssistantFeedbackBox({
    message,
    canSubmitFeedback,
    draft,
    isSubmitting,
    errorText,
    onPickRating,
    onReasonChange,
    onSubmit,
}) {
    if (!canSubmitFeedback) return null;

    if (message?.feedback?.rating) {
        const isHelpful = message.feedback.rating === "up";
        return (
            <div className="mt-1 ml-8 inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                {isHelpful ? <ThumbsUpIcon className="h-3.5 w-3.5" /> : <ThumbsDownIcon className="h-3.5 w-3.5" />}
                <span>Thanks for your feedback ({isHelpful ? "Helpful" : "Not helpful"})</span>
            </div>
        );
    }

    const pickedRating = draft?.rating === "up" || draft?.rating === "down" ? draft.rating : "";
    const reason = String(draft?.reason || "");
    return (
        <div className="mt-1 ml-8 max-w-[85%] rounded-xl border border-gray-200 bg-white p-2">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPickRating("up")}
                    disabled={isSubmitting}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${pickedRating === "up"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <ThumbsUpIcon />
                        Helpful
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => onPickRating("down")}
                    disabled={isSubmitting}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${pickedRating === "down"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <ThumbsDownIcon />
                        Not helpful
                    </span>
                </button>
            </div>
            {pickedRating ? (
                <div className="mt-2">
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => onReasonChange(e.target.value)}
                        placeholder="Additional reason (optional)"
                        disabled={isSubmitting}
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-violet-300"
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[11px] text-gray-400">{reason.length}/{MAX_FEEDBACK_REASON_CHARS}</span>
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={isSubmitting}
                            className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs text-white disabled:opacity-60"
                        >
                            {isSubmitting ? "Submitting..." : "Submit feedback"}
                        </button>
                    </div>
                    {errorText ? <p className="mt-1 text-[11px] text-rose-500">{errorText}</p> : null}
                </div>
            ) : null}
        </div>
    );
}

function MessageBubble({
    message,
    canSubmitFeedback,
    feedbackDraft,
    feedbackSubmitting,
    feedbackError,
    onPickRating,
    onReasonChange,
    onSubmitFeedback,
}) {
    const isUser = message.role === "user";
    return (
        <div className={`mb-3 ${isUser ? "text-right" : "text-left"}`}>
            <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isUser
                        ? "bg-violet-600 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-700 rounded-bl-md"
                        }`}
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                    {message.content}
                </div>
            </div>
            {!isUser ? (
                <AssistantFeedbackBox
                    message={message}
                    canSubmitFeedback={canSubmitFeedback}
                    draft={feedbackDraft}
                    isSubmitting={feedbackSubmitting}
                    errorText={feedbackError}
                    onPickRating={(rating) => onPickRating(message.id, rating)}
                    onReasonChange={(value) => onReasonChange(message.id, value)}
                    onSubmit={() => onSubmitFeedback(message)}
                />
            ) : null}
        </div>
    );
}

function QuickActionChips({ onSelect, disabled, actions = [] }) {
    return (
        <div className="px-3 py-2 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {actions.map((action, index) => (
                    <button
                        key={index}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(action)}
                        className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    >
                        {action?.label || "-"}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function ChatPanel({ isOpen, onClose, variant = "sidebar", showQuickActions = true }) {
    const pathname = usePathname();
    const quickActions = useMemo(() => resolveQuickActionsByPath(pathname), [pathname]);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [storageKey, setStorageKey] = useState(`${CHAT_HISTORY_KEY_PREFIX}:guest:legacy`);
    const [feedbackDrafts, setFeedbackDrafts] = useState({});
    const [feedbackSubmitting, setFeedbackSubmitting] = useState({});
    const [feedbackErrors, setFeedbackErrors] = useState({});
    const [canSubmitFeedback, setCanSubmitFeedback] = useState(false);
    const chatHistoryLoadedRef = useRef(false);
    const activeRequestRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const syncUserState = () => {
            const currentUser = getUser();
            setCanSubmitFeedback(Boolean(currentUser));
            setStorageKey(getUserChatStorageKey());
        };
        const onStorage = (event) => {
            if (event?.key && event.key !== "lms_user" && event.key !== "lms_chat_session_id") return;
            syncUserState();
        };

        syncUserState();
        window.addEventListener("lms_user_updated", syncUserState);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener("lms_user_updated", syncUserState);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            const parsed = saved ? JSON.parse(saved) : [];
            setMessages(sanitizeMessages(parsed));
        } catch {
            setMessages([]);
        } finally {
            chatHistoryLoadedRef.current = true;
        }
        setFeedbackDrafts({});
        setFeedbackSubmitting({});
        setFeedbackErrors({});
    }, [storageKey]);

    useEffect(() => {
        if (!chatHistoryLoadedRef.current) return;
        try {
            const normalized = sanitizeMessages(messages);
            if (normalized.length === 0) {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, JSON.stringify(normalized));
            }
        } catch {
            // ignore storage write errors
        }
    }, [messages, storageKey]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isLoading]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    useEffect(() => () => {
        if (activeRequestRef.current) {
            activeRequestRef.current.abort();
        }
    }, []);

    const sendMessage = async (rawText, options = {}) => {
        const text = String(rawText || "").trim();
        if (!text || isLoading) return;

        if (activeRequestRef.current) {
            activeRequestRef.current.abort();
            activeRequestRef.current = null;
        }

        const userMsg = {
            id: createMessageId(),
            role: "user",
            content: text,
            createdAt: new Date().toISOString(),
        };
        const assistantId = createMessageId();
        const assistantMsg = {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            feedback: null,
            intent: null,
            provider: null,
            intentConfidence: null,
        };
        const newMessages = [...messages, userMsg, assistantMsg];
        const requestMessages = [...messages, userMsg].map((item) => ({
            role: item.role,
            content: item.content,
        }));
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);
        let streamedText = "";

        const applyAssistantUpdate = (updateFn) => {
            setMessages((prev) =>
                prev.map((item) => {
                    if (item.id !== assistantId) return item;
                    return updateFn(item);
                })
            );
        };

        try {
            const controller = new AbortController();
            activeRequestRef.current = controller;
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    messages: requestMessages,
                    stream: true,
                    context: {
                        ...(options?.context && typeof options.context === "object" ? options.context : {}),
                        pagePath: typeof window !== "undefined" ? window.location.pathname : "",
                    },
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(String(data?.error || "เกิดข้อผิดพลาด กรุณาลองใหม่ครับ"));
            }

            const contentType = String(res.headers.get("content-type") || "").toLowerCase();
            const isStream = contentType.includes("application/x-ndjson");
            if (isStream && res.body) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";
                    for (const rawLine of lines) {
                        const line = String(rawLine || "").trim();
                        if (!line) continue;
                        let event = null;
                        try {
                            event = JSON.parse(line);
                        } catch {
                            continue;
                        }
                        if (event?.type === "delta") {
                            const delta = String(event?.text || "");
                            if (!delta) continue;
                            streamedText += delta;
                            applyAssistantUpdate((item) => ({ ...item, content: streamedText }));
                        } else if (event?.type === "final") {
                            const meta = event?.meta && typeof event.meta === "object" ? event.meta : {};
                            applyAssistantUpdate((item) => ({
                                ...item,
                                intent: String(meta?.intent || "").trim() || null,
                                provider: String(meta?.provider || "").trim() || null,
                                intentConfidence: Number.isFinite(Number(meta?.intentConfidence))
                                    ? Math.max(0, Math.min(1, Number(meta.intentConfidence)))
                                    : null,
                            }));
                        } else if (event?.type === "error") {
                            throw new Error(String(event?.error || "stream_error"));
                        }
                    }
                }
            } else {
                const data = await res.json().catch(() => ({}));
                const content = String(data?.content || "").trim();
                streamedText = content;
                applyAssistantUpdate((item) => ({
                    ...item,
                    content: content || "ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้งครับ",
                    intent: String(data?.meta?.intent || "").trim() || null,
                    provider: String(data?.meta?.provider || "").trim() || null,
                    intentConfidence: Number.isFinite(Number(data?.meta?.intentConfidence))
                        ? Math.max(0, Math.min(1, Number(data.meta.intentConfidence)))
                        : null,
                }));
            }

            if (!streamedText.trim()) {
                applyAssistantUpdate((item) => ({
                    ...item,
                    content: "ไม่พบข้อความตอบกลับ ลองถามใหม่อีกครั้งได้เลยครับ",
                }));
            }
        } catch {
            if (activeRequestRef.current?.signal?.aborted) {
                if (!streamedText.trim()) {
                    applyAssistantUpdate((item) => ({
                        ...item,
                        content: "หยุดการตอบแล้วครับ",
                    }));
                }
            } else {
                applyAssistantUpdate((item) => ({
                    ...item,
                    content: streamedText.trim() || "ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้งครับ",
                }));
            }
        } finally {
            activeRequestRef.current = null;
            setIsLoading(false);
        }
    };

    const submitFeedback = async (message) => {
        const messageId = String(message?.id || "");
        if (!messageId) return;
        if (!canSubmitFeedback) return;
        if (feedbackSubmitting[messageId]) return;
        if (message?.feedback?.rating) return;

        const draft = feedbackDrafts[messageId] || {};
        const rating = draft.rating === "up" || draft.rating === "down" ? draft.rating : "";
        if (!rating) {
            setFeedbackErrors((prev) => ({ ...prev, [messageId]: "Please choose Helpful or Not helpful before submitting." }));
            return;
        }
        const reason = String(draft.reason || "").slice(0, MAX_FEEDBACK_REASON_CHARS).trim();

        setFeedbackSubmitting((prev) => ({ ...prev, [messageId]: true }));
        setFeedbackErrors((prev) => ({ ...prev, [messageId]: "" }));
        try {
            const res = await fetch("/api/chat-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messageId,
                    rating,
                    reason,
                    assistantMessage: String(message.content || ""),
                    conversation: buildRecentConversationForFeedback(messages, messageId),
                    pagePath: typeof window !== "undefined" ? window.location.pathname : "",
                    intent: String(message?.intent || "").trim(),
                    provider: String(message?.provider || "").trim(),
                    intentConfidence: Number(message?.intentConfidence || 0),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Please sign in to submit feedback.");
                }
                throw new Error(String(data?.error || "Unable to submit feedback."));
            }

            setMessages((prev) =>
                prev.map((item) => (
                    item.id === messageId
                        ? {
                            ...item,
                            feedback: {
                                rating,
                                reason,
                                submittedAt: String(data?.submittedAt || new Date().toISOString()),
                                feedbackId: String(data?.feedbackId || ""),
                            },
                        }
                        : item
                ))
            );
            setFeedbackDrafts((prev) => {
                const next = { ...prev };
                delete next[messageId];
                return next;
            });
        } catch (err) {
            setFeedbackErrors((prev) => ({ ...prev, [messageId]: String(err?.message || "Feedback submission failed.") }));
        } finally {
            setFeedbackSubmitting((prev) => ({ ...prev, [messageId]: false }));
        }
    };

    const handleSend = () => {
        sendMessage(input);
    };

    const handleStop = () => {
        if (activeRequestRef.current) {
            activeRequestRef.current.abort();
        }
    };

    const handleQuickAction = (action) => {
        sendMessage(action?.prompt || action?.label, { context: action?.context || {} });
    };

    const handlePickRating = (messageId, rating) => {
        setFeedbackDrafts((prev) => {
            const current = prev[messageId] || {};
            return {
                ...prev,
                [messageId]: {
                    rating,
                    reason: String(current.reason || ""),
                },
            };
        });
        setFeedbackErrors((prev) => ({ ...prev, [messageId]: "" }));
    };

    const handleReasonChange = (messageId, value) => {
        const reason = String(value || "").slice(0, MAX_FEEDBACK_REASON_CHARS);
        setFeedbackDrafts((prev) => ({
            ...prev,
            [messageId]: {
                rating: prev?.[messageId]?.rating || "",
                reason,
            },
        }));
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    const isCompact = variant === "compact";
    const panelClassName = isCompact
        ? "fixed bottom-[92px] right-3 z-[90] h-[min(66vh,520px)] w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_26px_60px_rgba(15,23,42,0.22)] sm:bottom-[96px] sm:right-5"
        : "fixed top-[80px] right-0 z-[90] h-[calc(100vh-80px)] w-[88vw] max-w-[340px] border-l border-gray-200 bg-white shadow-2xl sm:w-[320px]";
    const panelAnimationName = isCompact ? "chatCompactIn" : "chatPanelSlideIn";
    const headerClassName = isCompact
        ? "flex items-center gap-3 px-3.5 h-[50px] min-h-[50px] border-b border-gray-100"
        : "flex items-center gap-3 px-4 h-[52px] min-h-[52px] border-b border-gray-100";
    const bodyClassName = isCompact ? "flex-1 overflow-y-auto p-3" : "flex-1 overflow-y-auto p-4";
    const inputWrapClassName = isCompact ? "p-2.5 border-t border-gray-100" : "p-3 border-t border-gray-100";

    return (
        <div
            className={`${panelClassName} flex flex-col`}
            style={{ animation: `${panelAnimationName} 0.22s ease-out` }}
        >
            <style>{`
                @keyframes chatPanelSlideIn {
                    from { opacity: 0; transform: translateX(18px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes chatCompactIn {
                    from { opacity: 0; transform: translateY(10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            <div className={headerClassName}>
                <button className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <div className="flex items-center gap-2 flex-1">
                    <img
                        src="/images/ai-assistant-icon.jpg"
                        alt="LMS bot"
                        className="w-8 h-7 object-contain shrink-0"
                    />
                    <span className="text-sm font-semibold text-gray-700">LMS bot</span>
                </div>
                <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div className={bodyClassName}>
                {messages.length === 0 ? (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center mb-4 text-violet-500 text-xl">
                                ✦
                            </div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">How can I help?</h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Ask me anything about this lesson, get summaries, or explore concepts.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div>
                        {messages.map((msg, i) => (
                            <MessageBubble
                                key={msg.id || i}
                                message={msg}
                                canSubmitFeedback={canSubmitFeedback}
                                feedbackDraft={feedbackDrafts[msg.id] || null}
                                feedbackSubmitting={Boolean(feedbackSubmitting[msg.id])}
                                feedbackError={feedbackErrors[msg.id] || ""}
                                onPickRating={handlePickRating}
                                onReasonChange={handleReasonChange}
                                onSubmitFeedback={submitFeedback}
                            />
                        ))}
                        {isLoading && messages[messages.length - 1]?.content === "" ? <TypingIndicator /> : null}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {showQuickActions ? <QuickActionChips onSelect={handleQuickAction} disabled={isLoading} actions={quickActions} /> : null}

            <div className={inputWrapClassName}>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything"
                        disabled={isLoading}
                        className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none disabled:opacity-60"
                    />
                    {isLoading ? (
                        <button
                            type="button"
                            onClick={handleStop}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-all"
                            title="Stop"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className={`p-1.5 rounded-lg transition-all ${input.trim()
                                ? "text-violet-600 hover:bg-violet-100"
                                : "text-gray-300"
                                }`}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
