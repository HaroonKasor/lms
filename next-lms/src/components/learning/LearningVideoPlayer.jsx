'use client';

import Image from 'next/image';
import { ArrowLeft, Menu } from 'lucide-react';

export default function LearningVideoPlayer({
    lessonTitle,
    sidebarOpen,
    onToggleSidebar,
    onToggleAi,
    aiPanelOpen,
    onBack,
    children,
}) {
    return (
        <div className="flex-1 flex flex-col h-full min-w-0 bg-white transition-[width,flex-basis] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
            <header className="flex items-center gap-2 px-3 sm:px-5 h-[50px] min-h-[50px] sm:h-[52px] sm:min-h-[52px] border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {!sidebarOpen && (
                        <button
                            type="button"
                            onClick={onToggleSidebar}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Open lesson sidebar"
                        >
                            <Menu size={18} className="text-gray-500" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-1.5 sm:gap-2 text-violet-600 hover:text-violet-700 transition-colors group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                        <span className="hidden sm:inline text-sm font-medium">My LMS</span>
                    </button>
                </div>

                <h1 className="min-w-0 flex-1 px-2 text-center text-xs sm:text-sm font-semibold text-gray-800 truncate">
                    {lessonTitle || 'Select a Lesson'}
                </h1>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onToggleAi}
                        aria-label="Toggle AI assistant"
                        className={`p-1.5 rounded-lg transition-colors ${
                            aiPanelOpen ? 'bg-violet-50' : 'hover:bg-gray-100'
                        }`}
                    >
                        <Image
                            src="/images/ai-assistant-icon.jpg"
                            alt="LMS bot"
                            width={24}
                            height={22}
                            className="object-contain shrink-0"
                        />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="relative flex-1 min-w-0 overflow-hidden bg-gray-900" style={{ willChange: 'width,transform' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
