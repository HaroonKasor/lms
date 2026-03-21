'use client';

import React, { useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';
import FadeIn from '@/components/ui/FadeIn';

export default function CourseBuilderPage() {
    const [chapters, setChapters] = useState([
        { id: 1, title: 'Introduction to Web Design', lessons: ['Basic HTML', 'CSS Fundamentals'] },
        { id: 2, title: 'Visual Hierarchy', lessons: ['Contrast & Scale', 'Color Theory'] }
    ]);

    const addChapter = () => {
        const newChapter = {
            id: Date.now(),
            title: 'New Chapter Title',
            lessons: ['New Lesson 1']
        };
        setChapters([...chapters, newChapter]);
    };

    return (
        <AdminLmsDashboard>
            <FadeIn direction="up">
                <div className="flex flex-col gap-8 w-full">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-[32px] font-medium text-[#052143] leading-[150%]">Course Builder</h1>
                            <p className="text-slate-500 font-medium">Create and manage your course curriculum</p>
                        </div>
                        <button
                            onClick={addChapter}
                            className="bg-[#687EFF] text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-500/20 hover:-translate-y-1 transition-all"
                        >
                            + Add New Chapter
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {chapters.map((chapter, i) => (
                            <div key={chapter.id} className="bg-white border border-[#D1E3FB] rounded-[2rem] p-8 shadow-sm group hover:border-[#687EFF]/40 transition-all">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#052143] font-black border border-slate-100">
                                            {i + 1}
                                        </div>
                                        <input
                                            defaultValue={chapter.title}
                                            className="text-xl font-bold text-[#052143] bg-transparent border-none focus:outline-none focus:ring-2 ring-[#687EFF]/20 rounded-lg px-2"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                        <button className="p-2 text-slate-400 hover:text-[#687EFF] transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 pl-14">
                                    {chapter.lessons.map((lesson, j) => (
                                        <div key={j} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl group/lesson hover:bg-white hover:border-[#687EFF]/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                <span className="font-bold text-slate-600 group-hover/lesson:text-[#052143] transition-colors">{lesson}</span>
                                            </div>
                                            <button className="opacity-0 group-hover/lesson:opacity-100 text-xs font-black text-rose-500 uppercase tracking-widest transition-opacity">Remove</button>
                                        </div>
                                    ))}
                                    <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:border-[#687EFF]/40 hover:text-[#687EFF] transition-all">
                                        + Add lesson to this chapter
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </FadeIn>
        </AdminLmsDashboard>
    );
}

