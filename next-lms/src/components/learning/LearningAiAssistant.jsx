'use client';

import Image from 'next/image';
import { X, Menu, Send, ChevronRight, Sparkles, BookOpen, Lightbulb, FileText } from 'lucide-react';
import { useState } from 'react';

const quickActions = [
    { icon: FileText, label: 'Summarize this page' },
    { icon: Lightbulb, label: 'Give me a hint' },
    { icon: BookOpen, label: 'Define Terms' },
];

export default function LearningAiAssistant({ onClose }) {
    const [message, setMessage] = useState('');
    const [chatMessages, setChatMessages] = useState([]);

    const handleSend = () => {
        if (!message.trim()) return;
        setChatMessages((prev) => [
            ...prev,
            { role: 'user', text: message },
            {
                role: 'assistant',
                text: "I'd be happy to help. Ask me about this lesson's content, summary, or key concepts.",
            },
        ]);
        setMessage('');
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
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Ask me anything about this lesson, get summaries, or explore concepts.
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
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="px-4 pb-2">
                {quickActions.map((action, index) => (
                    <button key={index} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group text-left">
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
                        className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!message.trim()}
                        className={`p-1.5 rounded-lg transition-all ${message.trim() ? 'text-violet-600 hover:bg-violet-100' : 'text-gray-300'}`}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
