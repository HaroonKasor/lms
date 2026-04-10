'use client';

import {
    CheckCircle,
    Circle,
    CircleDot,
    ChevronDown,
    ChevronRight,
    BookOpen,
    X,
} from 'lucide-react';
import { useState } from 'react';

export default function LearningLessonSidebar({ lessons, activeLesson, onSelectLesson, onClose }) {
    const [expandedModules, setExpandedModules] = useState(
        lessons.map((m) => m.id)
    );

    const toggleModule = (moduleId) => {
        setExpandedModules((prev) =>
            prev.includes(moduleId)
                ? prev.filter((id) => id !== moduleId)
                : [...prev, moduleId]
        );
    };

    const totalLessons = lessons.flatMap((m) => m.items).length;
    const completedLessons = lessons
        .flatMap((m) => m.items)
        .filter((l) => l.completed).length;

    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return (
        <aside className="w-full h-full bg-white border-r border-gray-200 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-violet-600" />
                        <h2 className="text-sm font-semibold text-gray-800">Course Content</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                    >
                        <X size={16} className="text-gray-400" />
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-violet-600 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium text-gray-500">
                        {completedLessons}/{totalLessons}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
                {lessons.map((module) => (
                    <div key={module.id} className="mb-1">
                        <button
                            onClick={() => toggleModule(module.id)}
                            className="w-full flex items-center gap-2 px-5 py-2.5 text-left hover:bg-gray-50 transition-colors"
                        >
                            {expandedModules.includes(module.id) ? (
                                <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                            ) : (
                                <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {module.module}
                            </span>
                        </button>

                        {expandedModules.includes(module.id) && (
                            <div className="pb-1">
                                {module.items.map((lesson) => {
                                    const isActive = lesson.id === activeLesson;
                                    const normalizedStatus = String(lesson?.status || '').toLowerCase();
                                    const displayStatus = normalizedStatus || (lesson.completed ? 'completed' : 'not_started');
                                    const isInProgress = displayStatus === 'in_progress';
                                    const isCompleted = displayStatus === 'completed';
                                    const isAttempted = displayStatus === 'attempted';
                                    const rawDuration = String(lesson?.duration || '').trim();
                                    const hideDuration =
                                        !rawDuration ||
                                        rawDuration === '--:--' ||
                                        rawDuration === '-:- -' ||
                                        rawDuration === '-:--' ||
                                        rawDuration === '--' ||
                                        rawDuration === '-';
                                    const statusText = String(lesson?.statusLabel || '').trim();
                                    const metaText = hideDuration
                                        ? (statusText || '')
                                        : (statusText ? `${statusText} • ${rawDuration}` : rawDuration);
                                    return (
                                        <button
                                            key={lesson.id}
                                            onClick={() => onSelectLesson(lesson.id)}
                                            className={`w-full flex items-center gap-3 pl-8 pr-5 py-2.5 text-left transition-all duration-200 group
                        ${
                            isActive
                                ? 'bg-violet-50 border-l-[3px] border-violet-600 pl-[29px]'
                                : 'hover:bg-gray-50 border-l-[3px] border-transparent'
                        }
                      `}
                                        >
                                            <div className="flex-shrink-0">
                                                {isInProgress || isActive ? (
                                                    <div className="w-4 h-4 rounded-full border-2 border-violet-500 flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                                    </div>
                                                ) : isCompleted ? (
                                                    <CheckCircle size={16} className="text-emerald-500" />
                                                ) : isAttempted ? (
                                                    <CircleDot size={16} className="text-amber-500" />
                                                ) : (
                                                    <Circle size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p
                                                    className={`text-sm leading-tight truncate ${
                                                        isInProgress || isActive
                                                            ? 'font-medium text-violet-700'
                                                            : isCompleted
                                                                ? 'text-gray-500'
                                                                : 'text-gray-700 group-hover:text-gray-900'
                                                    }`}
                                                >
                                                    {lesson.title}
                                                </p>
                                                {metaText && (
                                                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                                                        {metaText}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </aside>
    );
}
