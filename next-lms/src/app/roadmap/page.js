'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';

export default function RoadmapPage() {
    const tracks = [
        {
            title: 'UI/UX Design Master',
            status: 'In Progress',
            progress: 65,
            steps: [
                { title: 'Foundations of Design', completed: true, icon: '🎨' },
                { title: 'Typography & Colors', completed: true, icon: '✨' },
                { title: 'Figma Masterclass', completed: true, icon: '💎' },
                { title: 'Advanced Prototyping', completed: false, icon: '🌀' },
                { title: 'Portfolio Project', completed: false, icon: '📁' }
            ]
        },
        {
            title: 'Frontend Developer',
            status: 'Not Started',
            progress: 0,
            steps: [
                { title: 'HTML & CSS Basics', completed: false, icon: '📄' },
                { title: 'JavaScript Essentials', completed: false, icon: '🟨' },
                { title: 'React.js Deep Dive', completed: false, icon: '⚛️' },
                { title: 'Next.js & App Router', completed: false, icon: '🚀' },
                { title: 'Final Capstone', completed: false, icon: '🏁' }
            ]
        }
    ];

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
                    <div className="flex flex-col gap-12">
                        <div>
                            <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">Learning Roadmap</h1>
                            <p className="text-slate-500 font-bold ml-1 uppercase tracking-widest text-xs">Your personal path to mastery</p>
                        </div>

                        <div className="flex flex-col gap-10">
                            {tracks.map((track, trackIdx) => (
                                <div key={trackIdx} className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[3rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                                        <div>
                                            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{track.title}</h2>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest ${track.progress > 0 ? 'bg-indigo-100 text-indigo-600 border border-indigo-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                                    {track.status}
                                                </span>
                                                <span className="text-slate-400 font-bold text-sm">{track.progress}% Mastery</span>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-64 h-3 bg-slate-200/50 rounded-full border border-white overflow-hidden">
                                            <div className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.4)] transition-all duration-1000" style={{ width: `${track.progress}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Roadmap Steps */}
                                    <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
                                        {/* Connector Line (Desktop) */}
                                        <div className="hidden md:block absolute top-[44px] left-[50px] right-[50px] h-1.5 bg-slate-100 rounded-full -z-0">
                                            <div className="h-full bg-indigo-500/20 rounded-full" style={{ width: `${track.progress}%` }}></div>
                                        </div>

                                        {track.steps.map((step, stepIdx) => (
                                            <div key={stepIdx} className="flex-1 flex flex-col items-center text-center relative z-10 group">
                                                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center text-3xl mb-4 transition-all duration-500 border-4 ${step.completed ? 'bg-indigo-600 text-white border-white shadow-[0_0_25px_rgba(79,70,229,0.3)]' : 'bg-white text-slate-300 border-slate-50 shadow-sm opacity-50 group-hover:opacity-100'}`}>
                                                    {step.icon}
                                                    {step.completed && (
                                                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg animate-bounce">
                                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className={`font-black tracking-tight text-sm leading-tight max-w-[120px] ${step.completed ? 'text-slate-900' : 'text-slate-400'}`}>
                                                    {step.title}
                                                </h3>
                                            </div>
                                        ))}
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


