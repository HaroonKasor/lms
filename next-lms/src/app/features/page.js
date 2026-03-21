'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';

export default function FeaturesPage() {
    const features = [
        {
            title: "Interactive Video Player",
            description: "Go beyond static videos. Our player supports inline quizzes, bookmarks, and interactive transcripts that highlight as you watch.",
            icon: "🎬",
            color: "from-blue-500 to-cyan-400",
            shadow: "rgba(56,189,248,0.2)",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20"
        },
        {
            title: "Smart Learning Paths",
            description: "AI-driven curriculum that adapts to your skill level. Skip what you know and focus on what you need to master next.",
            icon: "🧠",
            color: "from-purple-500 to-pink-500",
            shadow: "rgba(217,70,239,0.2)",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20"
        },
        {
            title: "Live Peer Coding",
            description: "Collaborate in real-time with other students. Share environments, run code together, and solve complex problems as a team.",
            icon: "💻",
            color: "from-orange-400 to-red-500",
            shadow: "rgba(249,115,22,0.2)",
            bg: "bg-orange-500/10",
            border: "border-orange-500/20"
        },
        {
            title: "Verifiable Credentials",
            description: "Earn blockchain-backed certificates upon course completion. Share them directly to LinkedIn with one click.",
            icon: "🏆",
            color: "from-emerald-400 to-teal-500",
            shadow: "rgba(16,185,129,0.2)",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20"
        }
    ];

    return (
        <div className="min-h-screen bg-zinc-950 font-sans overflow-x-hidden flex flex-col relative text-white selection:bg-purple-500/30">
            <Navbar />

            {/* Background Ambient Glows */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-20%] right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[150px] mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <main className="relative flex-1 w-full max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-32 z-10">
                {/* Header */}
                <div className="text-center mb-20 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
                        <span className="text-purple-400 font-bold text-sm tracking-widest uppercase">Platform Capabilities</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 tracking-tight leading-tight">
                        Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Deep Work</span>
                    </h1>
                    <p className="text-lg text-zinc-400 font-medium">
                        Everything you need to build skills faster, retain knowledge longer, and showcase your achievements to the world.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                    {features.map((feature, idx) => (
                        <div key={idx} className="bg-white/5 backdrop-blur-xl rounded-[32px] p-8 lg:p-10 border border-white/10 hover:bg-white/10 transition-colors group relative overflow-hidden shadow-2xl">
                            {/* Decorative Top Line */}
                            <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity`} style={{boxShadow: `0 0 15px ${feature.shadow}`}}></div>
                            
                            {/* Inner ambient glow */}
                            <div className={`absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-0 group-hover:opacity-30 transition-opacity duration-700 ${feature.bg.replace('/10', '')}`}></div>

                            <div className={`w-16 h-16 rounded-2xl ${feature.bg} border ${feature.border} flex items-center justify-center text-3xl mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500 ease-out relative z-10`}>
                                {feature.icon}
                            </div>

                            <h3 className="text-2xl font-extrabold text-white mb-4 relative z-10 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400">
                                {feature.title}
                            </h3>
                            
                            <p className="text-zinc-400 font-medium leading-relaxed relative z-10">
                                {feature.description}
                            </p>
                            
                            <div className="mt-8 pt-6 border-t border-white/10 flex items-center text-sm font-bold text-white relative z-10 group/link cursor-pointer w-fit">
                                Explore feature 
                                <svg className="w-4 h-4 ml-2 group-hover/link:translate-x-1.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-24 text-center bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-[3rem] p-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
                    <h2 className="text-3xl font-black mb-6 relative z-10">Ready to transform your learning?</h2>
                    <Link href="/home-courses" className="inline-flex px-8 py-4 bg-white text-zinc-950 rounded-xl font-extrabold justify-center text-lg transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:-translate-y-1 items-center gap-3 relative z-10">
                        View All Courses
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                    </Link>
                </div>
            </main>
        </div>
    );
}


