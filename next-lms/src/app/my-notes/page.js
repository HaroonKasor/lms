'use client';

import React, { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';

export default function MyNotesPage() {
    const [selectedCourse, setSelectedCourse] = useState('all');

    const notes = [
        {
            id: 1,
            course: 'Advanced UI/UX Design Principles',
            lesson: 'Color Psychology in Web',
            content: 'Use deep indigo for trust and cyan for technology feeling. Avoid pure red in high-frequency interactive areas to reduce anxiety.',
            date: '2h ago',
            color: 'border-indigo-500'
        },
        {
            id: 2,
            course: 'Modern Frontend Development',
            lesson: 'Next.js App Router',
            content: 'Server components by default. Use "use client" only when client interaction (state, effects) is needed.',
            date: '1 day ago',
            color: 'border-blue-500'
        },
        {
            id: 3,
            course: 'Advanced UI/UX Design Principles',
            lesson: 'Typography Hierarchy',
            content: 'Line height should be 1.5x the font size for body text. Headings need tight tracking for premium feel.',
            date: '3 days ago',
            color: 'border-indigo-500'
        }
    ];

    const courses = ['Advanced UI/UX Design Principles', 'Modern Frontend Development', 'Graphic Design Masterclass'];

    const filteredNotes = selectedCourse === 'all' ? notes : notes.filter(n => n.course === selectedCourse);

    return (
        <div className="min-h-screen font-sans bg-slate-50 text-slate-800 relative overflow-x-hidden selection:bg-indigo-500/30">
            <Navbar />

            {/* Premium Ambient Background */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/40 via-slate-50 to-slate-100/20">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-200/30 blur-[130px] mix-blend-multiply animate-[pulse_8s_ease-in-out_infinite]"></div>
                <div className="absolute top-[30%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-200/40 blur-[150px] mix-blend-multiply animate-[pulse_10s_ease-in-out_infinite]" style={{ animationDelay: '2s' }}></div>
            </div>

            <main className="w-full max-w-7xl mx-auto relative z-10 pt-12 pb-24 px-6">
                <FadeIn direction="up">
                    <div className="flex flex-col gap-10">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div>
                                <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">My Notes</h1>
                                <p className="text-slate-500 font-bold ml-1 uppercase tracking-widest text-xs">Knowledge captured during your journey</p>
                            </div>

                            <div className="flex items-center gap-4 bg-white/40 backdrop-blur-xl border border-white/60 p-2 rounded-2xl shadow-sm">
                                <button
                                    onClick={() => setSelectedCourse('all')}
                                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${selectedCourse === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    All Courses
                                </button>
                                {courses.map((c, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedCourse(c)}
                                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${selectedCourse === c ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        {c.split(' ')[0]}...
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredNotes.map((note) => (
                                <div key={note.id} className={`bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col hover:bg-white hover:shadow-xl transition-all duration-500 group border-l-8 ${note.color}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors border border-slate-100">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{note.date}</span>
                                    </div>

                                    <h3 className="font-extrabold text-slate-900 mb-1 leading-tight">{note.lesson}</h3>
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-6">{note.course}</p>

                                    <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-100 flex-1 relative">
                                        <p className="text-slate-600 font-medium italic leading-relaxed">
                                            "{note.content}"
                                        </p>
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-200"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-100"></div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex items-center justify-between">
                                        <button className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            View Lesson
                                        </button>
                                        <div className="flex gap-2">
                                            <button className="w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                            </button>
                                            <button className="w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </FadeIn>
            </main>
        </div>
    );
}


