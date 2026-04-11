'use client';

import Image from 'next/image';
import { X, Menu, Send, ChevronRight, Sparkles, BookOpen, Lightbulb, FileText } from 'lucide-react';
import { useMemo, useRef, useState, useEffect } from 'react';

const STUDY_ACTIONS = [
    { icon: FileText, label: 'Summarize this page', prompt: 'Summarize this lesson into key takeaways.', intent: 'course_detail' },
    { icon: Lightbulb, label: 'Give me a hint', prompt: 'Give me a short hint to understand this lesson better.' },
    { icon: BookOpen, label: 'Define Terms', prompt: 'List important terms from this lesson and define each briefly.' },
];
const VIDEO_STUDY_ACTION = {
    icon: FileText,
    label: 'Summarize this video',
    prompt: 'Summarize this lesson video in simple Thai. Include key concepts and practical examples.',
    intent: 'video_summary',
    useVideoTranscript: true,
};

const ASSESSMENT_ACTIONS = [
    { icon: Lightbulb, label: 'Give me a hint', prompt: 'Give me a hint only, no direct final answer.', intent: 'quiz_hint_only' },
    { icon: BookOpen, label: 'Explain concept', prompt: 'Explain the core concept I need for this question without giving the final answer.', intent: 'quiz_hint_only' },
    { icon: FileText, label: 'How to think', prompt: 'Show a step-by-step thinking method for solving similar questions.', intent: 'quiz_hint_only' },
];

const ASSESSMENT_TITLE_PATTERN = /(quiz|exam|test|assessment|แบบทดสอบ|ข้อสอบ|post[- ]?test|pre[- ]?test|midterm|final)/i;
const YOUTUBE_HOST_PATTERN = /(?:youtube\.com|youtu\.be)/i;
const MAX_OUTLINE_ITEMS = 40;

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

function TypingIndicator() {
    return (
        <div className="flex items-start gap-2">
            <Image
                src="/chatbothome.png"
                alt="SkillBot"
                width={24}
                height={24}
                className="h-6 w-6 shrink-0 object-contain"
            />
            <div className="rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
            </div>
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
        return [VIDEO_STUDY_ACTION, ...STUDY_ACTIONS];
    }, [isAssessmentMode, hasYouTubeLesson]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isLoading]);

    const sendMessage = async (rawText, options = {}) => {
        const text = String(rawText || '').trim();
        if (!text || isLoading) return;

        const nextMessages = [...chatMessages, { role: 'user', content: text }];
        setChatMessages(nextMessages);
        setMessage('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: nextMessages,
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
            const data = await res.json();
            setChatMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: res.ok ? data.content : (data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่ครับ'),
                },
            ]);
        } catch {
            setChatMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้งครับ' },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = () => {
        sendMessage(message);
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
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                        ))}
                        {isLoading && <TypingIndicator />}
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
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !message.trim()}
                        className={`p-1.5 rounded-lg transition-all ${
                            message.trim() && !isLoading ? 'text-violet-600 hover:bg-violet-100' : 'text-gray-300'
                        }`}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
