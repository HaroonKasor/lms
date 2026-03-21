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
            <header className="flex items-center justify-between px-5 h-[52px] min-h-[52px] border-b border-gray-100 bg-white">
                <div className="flex items-center gap-3">
                    {!sidebarOpen && (
                        <button
                            onClick={onToggleSidebar}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors mr-1"
                        >
                            <Menu size={18} className="text-gray-500" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-2 text-violet-600 hover:text-violet-700 transition-colors group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                        <span className="text-sm font-medium">My LMS</span>
                    </button>
                </div>

                <h1 className="text-sm font-semibold text-gray-800 absolute left-1/2 -translate-x-1/2 max-w-md truncate">
                    {lessonTitle || 'Select a Lesson'}
                </h1>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleAi}
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
