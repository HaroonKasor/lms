'use client';

import Image from 'next/image';
import { X, Menu, Send, ChevronRight, Sparkles, BookOpen, Lightbulb, FileText } from 'lucide-react';
import { useMemo, useRef, useState, useEffect } from 'react';
import { getUser } from '@/lib/auth';

const STUDY_ACTIONS = [
    {
        icon: FileText,
        label: 'สรุปบทนี้',
        prompt: 'สรุปบทที่กำลังเรียนนี้แบบสั้นๆ เป็นหัวข้อสำคัญ 3-5 ข้อ พร้อมตัวอย่างใช้งานจริง 1 ตัวอย่าง',
        intent: 'course_detail',
    },
    {
        icon: Lightbulb,
        label: 'ขอ Hint',
        prompt: 'ขอ Hint สั้นๆ สำหรับบทนี้ โดยไม่เฉลยคำตอบตรงๆ',
        intent: 'quiz_hint_only',
    },
    {
        icon: BookOpen,
        label: 'ฉันค้างตรงไหน',
        prompt: 'จากบทที่กำลังเรียน ช่วยวิเคราะห์ว่าฉันน่าจะค้างตรงไหน และควรทำอะไรต่อทีละขั้นแบบสั้นๆ',
        intent: 'course_detail',
    },
];

const ASSESSMENT_ACTIONS = [
    { icon: Lightbulb, label: 'ขอ Hint', prompt: 'ขอ Hint เท่านั้น ห้ามเฉลยคำตอบสุดท้าย', intent: 'quiz_hint_only' },
    { icon: BookOpen, label: 'อธิบายแนวคิด', prompt: 'อธิบายแนวคิดหลักที่ต้องใช้กับข้อนี้ โดยไม่เฉลยคำตอบ', intent: 'quiz_hint_only' },
    { icon: FileText, label: 'วิธีคิดทีละขั้น', prompt: 'ช่วยบอกวิธีคิดทีละขั้นสำหรับโจทย์ลักษณะนี้ โดยไม่เฉลยคำตอบ', intent: 'quiz_hint_only' },
];

const ASSESSMENT_TITLE_PATTERN = /(quiz|exam|test|assessment|แบบทดสอบ|ข้อสอบ|post[- ]?test|pre[- ]?test|midterm|final)/i;
const YOUTUBE_HOST_PATTERN = /(?:youtube\.com|youtu\.be)/i;
const MAX_OUTLINE_ITEMS = 40;
const MAX_FEEDBACK_REASON_CHARS = 300;

function isYoutubeSource(input) {
    const value = String(input || '').trim();
    if (!value) return false;
    if (YOUTUBE_HOST_PATTERN.test(value)) return true;
    return /^[a-zA-Z0-9_-]{11}$/.test(value);
}

function normalizeLessonOutline(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item, index) => {
            if (typeof item === 'string') {
                const title = String(item || '').trim();
                if (!title) return null;
                return {
                    index: index + 1,
                    title,
                    status: '',
                };
            }
            const title = String(item?.title || item?.name || '').trim();
            if (!title) return null;
            const idx = Number(item?.index);
            return {
                index: Number.isInteger(idx) && idx > 0 ? idx : index + 1,
                title,
                status: String(item?.status || '').trim(),
            };
        })
        .filter(Boolean)
        .slice(0, MAX_OUTLINE_ITEMS);
}

function createMessageId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildRecentConversationForFeedback(messages, assistantMessageId) {
    const index = messages.findIndex((item) => item?.id === assistantMessageId);
    if (index < 0) return [];
    const start = Math.max(0, index - 5);
    const slice = messages.slice(start, index + 1);
    return slice.map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.content || '').slice(0, 1200),
    }));
}

function TypingIndicator() {
    return (
        <div className="flex items-center gap-2">
            <div className="h-6 w-6 shrink-0 rounded-full bg-[#111827] text-white flex items-center justify-center shadow-sm">
                <Sparkles size={12} />
            </div>
            <div className="rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2.5">
                <div className="space-y-1.5">
                    <div className="h-2 w-[165px] rounded-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 animate-pulse" />
                    <div
                        className="h-2 w-[125px] rounded-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 animate-pulse"
                        style={{ animationDelay: '120ms' }}
                    />
                </div>
            </div>
        </div>
    );
}

function ThumbsUpIcon({ className = 'h-3.5 w-3.5' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 10V5a3 3 0 0 0-3-3l-3.5 8" />
            <path d="M7.5 10H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3.5a2 2 0 0 0 1.9-1.4L11 14h7a2 2 0 0 0 1.93-2.52l-1-4A2 2 0 0 0 17 6h-4.2" />
        </svg>
    );
}

function ThumbsDownIcon({ className = 'h-3.5 w-3.5' }) {
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
    if (!canSubmitFeedback || !String(message?.content || '').trim()) return null;

    if (message?.feedback?.rating) {
        const isHelpful = message.feedback.rating === 'up';
        return (
            <div className="mt-1 ml-8 inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                {isHelpful ? <ThumbsUpIcon className="h-3.5 w-3.5" /> : <ThumbsDownIcon className="h-3.5 w-3.5" />}
                <span>Thanks for your feedback ({isHelpful ? 'Helpful' : 'Not helpful'})</span>
            </div>
        );
    }

    const pickedRating = draft?.rating === 'up' || draft?.rating === 'down' ? draft.rating : '';
    const reason = String(draft?.reason || '');
    return (
        <div className="mt-1 ml-8 max-w-[85%] rounded-xl border border-gray-200 bg-white p-2">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPickRating('up')}
                    disabled={isSubmitting}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${pickedRating === 'up'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <ThumbsUpIcon />
                        Helpful
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => onPickRating('down')}
                    disabled={isSubmitting}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${pickedRating === 'down'
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
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
                            {isSubmitting ? 'Submitting...' : 'Submit feedback'}
                        </button>
                    </div>
                    {errorText ? <p className="mt-1 text-[11px] text-rose-500">{errorText}</p> : null}
                </div>
            ) : null}
        </div>
    );
}

export default function LearningAiAssistant({
    onClose,
    lessonTitle = '',
    lessonSrc = '',
    courseTitle = '',
    sectionTitle = '',
    activeLessonIndex = 0,
    totalLessons = 0,
    lessonOutline = [],
}) {
    const [message, setMessage] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [feedbackDrafts, setFeedbackDrafts] = useState({});
    const [feedbackSubmitting, setFeedbackSubmitting] = useState({});
    const [feedbackErrors, setFeedbackErrors] = useState({});
    const [canSubmitFeedback, setCanSubmitFeedback] = useState(false);
    const activeRequestRef = useRef(null);
    const messagesEndRef = useRef(null);

    const isAssessmentMode = useMemo(() => ASSESSMENT_TITLE_PATTERN.test(String(lessonTitle || '')), [lessonTitle]);
    const hasYouTubeLesson = useMemo(() => isYoutubeSource(lessonSrc), [lessonSrc]);
    const normalizedLessonOutline = useMemo(() => normalizeLessonOutline(lessonOutline), [lessonOutline]);
    const safeCourseTitle = useMemo(() => String(courseTitle || '').trim(), [courseTitle]);
    const safeSectionTitle = useMemo(() => String(sectionTitle || '').trim(), [sectionTitle]);
    const safeLessonTitle = useMemo(() => String(lessonTitle || '').trim(), [lessonTitle]);
    const safeActiveLessonIndex = useMemo(() => {
        const value = Number(activeLessonIndex);
        return Number.isInteger(value) && value > 0 ? value : 0;
    }, [activeLessonIndex]);
    const safeTotalLessons = useMemo(() => {
        const value = Number(totalLessons);
        return Number.isInteger(value) && value > 0 ? value : normalizedLessonOutline.length;
    }, [totalLessons, normalizedLessonOutline.length]);
    const quickActions = useMemo(() => {
        if (isAssessmentMode) return ASSESSMENT_ACTIONS;
        if (!hasYouTubeLesson) return STUDY_ACTIONS;
        return STUDY_ACTIONS.map((action, index) => {
            if (index !== 0) return action;
            return {
                ...action,
                prompt: 'สรุปวิดีโอบทนี้แบบสั้น กระชับ และเข้าใจง่าย พร้อมตัวอย่างใช้งานจริง 1 ตัวอย่าง',
                intent: 'video_summary',
                useVideoTranscript: true,
            };
        });
    }, [isAssessmentMode, hasYouTubeLesson]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isLoading]);

    useEffect(() => () => {
        if (activeRequestRef.current) {
            activeRequestRef.current.abort();
        }
    }, []);

    useEffect(() => {
        const syncUserState = () => {
            setCanSubmitFeedback(Boolean(getUser()));
        };
        const onStorage = (event) => {
            if (event?.key && event.key !== 'lms_user') return;
            syncUserState();
        };

        syncUserState();
        window.addEventListener('lms_user_updated', syncUserState);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener('lms_user_updated', syncUserState);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    const sendMessage = async (rawText, options = {}) => {
        const text = String(rawText || '').trim();
        if (!text || isLoading) return;

        if (activeRequestRef.current) {
            activeRequestRef.current.abort();
            activeRequestRef.current = null;
        }

        const userMessage = {
            id: createMessageId(),
            role: 'user',
            content: text,
            createdAt: new Date().toISOString(),
        };
        const assistantId = createMessageId();
        const assistantMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
            feedback: null,
            intent: null,
            provider: null,
            intentConfidence: null,
        };
        const nextMessages = [...chatMessages, userMessage, assistantMessage];
        const requestMessages = [...chatMessages, userMessage].map((item) => ({
            role: item.role,
            content: String(item.content || ''),
        }));
        setChatMessages(nextMessages);
        setMessage('');
        setIsLoading(true);
        let streamedText = '';

        const applyAssistant = (updater) => {
            setChatMessages((prev) => prev.map((item) => {
                if (item?.id !== assistantId) return item;
                return updater(item);
            }));
        };

        try {
            const controller = new AbortController();
            activeRequestRef.current = controller;
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    messages: requestMessages,
                    stream: true,
                    context: {
                        courseTitle: safeCourseTitle,
                        sectionTitle: safeSectionTitle,
                        lessonTitle: safeLessonTitle,
                        activeLessonIndex: safeActiveLessonIndex || undefined,
                        totalLessons: safeTotalLessons || undefined,
                        lessonOutline: normalizedLessonOutline,
                        isAssessment: isAssessmentMode,
                        lessonSrc: String(lessonSrc || '').trim(),
                        intent: String(options?.intent || '').trim(),
                        useVideoTranscript: Boolean(options?.useVideoTranscript),
                        pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
                    },
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(String(data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่ครับ'));
            }

            const contentType = String(res.headers.get('content-type') || '').toLowerCase();
            const isStream = contentType.includes('application/x-ndjson');
            if (isStream && res.body) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                const consumeEvent = (event) => {
                    if (event?.type === 'delta') {
                        const delta = String(event?.text || '');
                        if (!delta) return;
                        streamedText += delta;
                        applyAssistant((item) => ({ ...item, content: streamedText }));
                        return;
                    }
                    if (event?.type === 'final') {
                        const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
                        applyAssistant((item) => ({
                            ...item,
                            intent: String(meta?.intent || '').trim() || null,
                            provider: String(meta?.provider || '').trim() || null,
                            intentConfidence: Number.isFinite(Number(meta?.intentConfidence))
                                ? Math.max(0, Math.min(1, Number(meta.intentConfidence)))
                                : null,
                        }));
                        return;
                    }
                    if (event?.type === 'error') {
                        throw new Error(String(event?.error || 'stream_error'));
                    }
                };

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const rawLine of lines) {
                        const line = String(rawLine || '').trim();
                        if (!line) continue;
                        let event = null;
                        try {
                            event = JSON.parse(line);
                        } catch {
                            continue;
                        }
                        consumeEvent(event);
                    }
                }
                const trailing = String(buffer || '').trim();
                if (trailing) {
                    try {
                        consumeEvent(JSON.parse(trailing));
                    } catch {
                        // ignore trailing parse errors
                    }
                }
            } else {
                const data = await res.json().catch(() => ({}));
                const content = String(data?.content || '').trim();
                streamedText = content;
                applyAssistant((item) => ({
                    ...item,
                    content: content || 'เกิดข้อผิดพลาด กรุณาลองใหม่ครับ',
                    intent: String(data?.meta?.intent || '').trim() || null,
                    provider: String(data?.meta?.provider || '').trim() || null,
                    intentConfidence: Number.isFinite(Number(data?.meta?.intentConfidence))
                        ? Math.max(0, Math.min(1, Number(data.meta.intentConfidence)))
                        : null,
                }));
            }
            if (!streamedText.trim()) {
                applyAssistant((item) => ({ ...item, content: 'ไม่พบข้อความตอบกลับ ลองใหม่อีกครั้งได้เลยครับ' }));
            }
        } catch {
            if (activeRequestRef.current?.signal?.aborted) {
                if (!streamedText.trim()) {
                    applyAssistant((item) => ({ ...item, content: 'หยุดการตอบแล้วครับ' }));
                }
            } else {
                applyAssistant((item) => ({ ...item, content: streamedText.trim() || 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้งครับ' }));
            }
        } finally {
            activeRequestRef.current = null;
            setIsLoading(false);
        }
    };

    const submitFeedback = async (targetMessage) => {
        const messageId = String(targetMessage?.id || '');
        if (!messageId || !canSubmitFeedback) return;
        if (feedbackSubmitting[messageId]) return;
        if (targetMessage?.feedback?.rating) return;

        const draft = feedbackDrafts[messageId] || {};
        const rating = draft.rating === 'up' || draft.rating === 'down' ? draft.rating : '';
        if (!rating) {
            setFeedbackErrors((prev) => ({ ...prev, [messageId]: 'Please choose Helpful or Not helpful before submitting.' }));
            return;
        }
        const reason = String(draft.reason || '').slice(0, MAX_FEEDBACK_REASON_CHARS).trim();

        setFeedbackSubmitting((prev) => ({ ...prev, [messageId]: true }));
        setFeedbackErrors((prev) => ({ ...prev, [messageId]: '' }));
        try {
            const res = await fetch('/api/chat-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId,
                    rating,
                    reason,
                    assistantMessage: String(targetMessage.content || ''),
                    conversation: buildRecentConversationForFeedback(chatMessages, messageId),
                    pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
                    intent: String(targetMessage?.intent || '').trim(),
                    provider: String(targetMessage?.provider || '').trim(),
                    intentConfidence: Number(targetMessage?.intentConfidence || 0),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error('Please sign in to submit feedback.');
                }
                throw new Error(String(data?.error || 'Unable to submit feedback.'));
            }

            setChatMessages((prev) => prev.map((item) => (
                item.id === messageId
                    ? {
                        ...item,
                        feedback: {
                            rating,
                            reason,
                            submittedAt: String(data?.submittedAt || new Date().toISOString()),
                            feedbackId: String(data?.feedbackId || ''),
                        },
                    }
                    : item
            )));
            setFeedbackDrafts((prev) => {
                const next = { ...prev };
                delete next[messageId];
                return next;
            });
        } catch (err) {
            setFeedbackErrors((prev) => ({ ...prev, [messageId]: String(err?.message || 'Feedback submission failed.') }));
        } finally {
            setFeedbackSubmitting((prev) => ({ ...prev, [messageId]: false }));
        }
    };

    const handlePickRating = (messageId, rating) => {
        setFeedbackDrafts((prev) => {
            const current = prev[messageId] || {};
            return {
                ...prev,
                [messageId]: {
                    rating,
                    reason: String(current.reason || ''),
                },
            };
        });
        setFeedbackErrors((prev) => ({ ...prev, [messageId]: '' }));
    };

    const handleReasonChange = (messageId, value) => {
        const reason = String(value || '').slice(0, MAX_FEEDBACK_REASON_CHARS);
        setFeedbackDrafts((prev) => ({
            ...prev,
            [messageId]: {
                rating: prev?.[messageId]?.rating || '',
                reason,
            },
        }));
    };

    const handleSend = () => {
        sendMessage(message);
    };

    const handleStop = () => {
        if (activeRequestRef.current) {
            activeRequestRef.current.abort();
        }
    };

    return (
        <aside className="w-full h-full bg-white border-l border-gray-200 flex flex-col">
            <div className="flex items-center gap-3 px-4 h-[52px] min-h-[52px] border-b border-gray-100">
                <button className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                    <Menu size={16} className="text-gray-400" />
                </button>
                <div className="flex items-center gap-2 flex-1">
                    <Image
                        src="/images/ai-assistant-icon.jpg"
                        alt="LMS bot"
                        width={32}
                        height={29}
                        className="object-contain shrink-0"
                    />
                    <span className="text-sm font-semibold text-gray-700">LMS bot</span>
                </div>
                {isAssessmentMode ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                        Quiz Mode
                    </span>
                ) : null}
                <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                    <X size={16} className="text-gray-400" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center mb-4">
                            <Sparkles size={22} className="text-violet-500" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">How can I help?</h3>
                        {(safeCourseTitle || safeLessonTitle) ? (
                            <p className="text-[11px] text-violet-600 mb-1.5">
                                {safeCourseTitle ? `คอร์ส: ${safeCourseTitle}` : ''}
                                {safeLessonTitle ? ` | บทปัจจุบัน: ${safeLessonTitle}` : ''}
                                {safeTotalLessons > 0 ? ` (${safeActiveLessonIndex || 1}/${safeTotalLessons})` : ''}
                            </p>
                        ) : null}
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {isAssessmentMode
                                ? 'I can give hints and concept explanations without revealing direct final answers.'
                                : 'Ask me anything about this lesson, get summaries, or explore concepts.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {chatMessages.map((msg, i) => (
                            <div key={msg?.id || i}>
                                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-violet-600 text-white rounded-br-md'
                                                : 'bg-gray-100 text-gray-700 rounded-bl-md'
                                        }`}
                                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                                {msg.role === 'assistant' ? (
                                    <AssistantFeedbackBox
                                        message={msg}
                                        canSubmitFeedback={canSubmitFeedback}
                                        draft={feedbackDrafts[msg.id] || null}
                                        isSubmitting={Boolean(feedbackSubmitting[msg.id])}
                                        errorText={feedbackErrors[msg.id] || ''}
                                        onPickRating={(rating) => handlePickRating(msg.id, rating)}
                                        onReasonChange={(value) => handleReasonChange(msg.id, value)}
                                        onSubmit={() => submitFeedback(msg)}
                                    />
                                ) : null}
                            </div>
                        ))}
                        {isLoading && chatMessages[chatMessages.length - 1]?.content === '' ? <TypingIndicator /> : null}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="px-4 pb-2">
                {quickActions.map((action, index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => sendMessage(action.prompt || action.label, {
                            intent: action?.intent,
                            useVideoTranscript: action?.useVideoTranscript,
                        })}
                        disabled={isLoading}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group text-left disabled:opacity-50"
                    >
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-violet-400 transition-colors" />
                        <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">{action.label}</span>
                    </button>
                ))}
            </div>

            <div className="p-3 border-t border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
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
                            disabled={!message.trim()}
                            className={`p-1.5 rounded-lg transition-all ${
                                message.trim() ? 'text-violet-600 hover:bg-violet-100' : 'text-gray-300'
                            }`}
                        >
                            <Send size={16} />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}
