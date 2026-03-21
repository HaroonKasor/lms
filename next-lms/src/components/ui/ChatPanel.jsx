"use client";

import { useState, useRef, useEffect } from "react";

const quickActions = [
    "Summarize this page",
    "Give me a hint",
    "Define Terms",
];

function TypingIndicator() {
    return (
        <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-[11px]">
                ✦
            </div>
            <div className="rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "240ms" }} />
                </div>
            </div>
        </div>
    );
}

function MessageBubble({ message }) {
    const isUser = message.role === "user";
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
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
    );
}

export default function ChatPanel({ isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

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

    const sendMessage = async (rawText) => {
        const text = String(rawText || "").trim();
        if (!text || isLoading) return;

        const userMsg = { role: "user", content: text };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: newMessages }),
            });
            const data = await res.json();
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: res.ok ? data.content : (data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่ครับ") },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้งครับ" },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = () => {
        sendMessage(input);
    };

    const handleQuickAction = (label) => {
        sendMessage(label);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed top-[80px] right-0 z-[90] h-[calc(100vh-80px)] w-[320px] bg-white border-l border-gray-200 flex flex-col shadow-2xl"
            style={{ animation: "chatPanelSlideIn 0.25s ease-out" }}
        >
            <style>{`
                @keyframes chatPanelSlideIn {
                    from { opacity: 0; transform: translateX(18px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>

            <div className="flex items-center gap-3 px-4 h-[52px] min-h-[52px] border-b border-gray-100">
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

            <div className="flex-1 overflow-y-auto p-4">
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
                        <div className="px-0 pb-2">
                            {quickActions.map((action, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleQuickAction(action)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group text-left"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#8B5CF6] transition-colors">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                    <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">{action}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div>
                        {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
                        {isLoading && <TypingIndicator />}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-gray-100">
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
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className={`p-1.5 rounded-lg transition-all ${input.trim() && !isLoading
                            ? "text-violet-600 hover:bg-violet-100"
                            : "text-gray-300"
                            }`}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
