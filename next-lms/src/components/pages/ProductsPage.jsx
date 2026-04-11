'use client';

import React from 'react';
import FadeIn from '@/components/ui/FadeIn';
import Header from '@/components/layout/Header';
import PublicFooter from '@/components/layout/PublicFooter';
import HomeFloatingChatbot from '@/components/ui/HomeFloatingChatbot';

export default function ProductsPage() {
    const products = [
        {
            title: "SkillUp LMS",
            desc: "All-in-One Platform for Smarter Digital Learning",
            icon: <svg width="26" height="26" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
            variant: "open"
        },
        {
            title: "SkillUp DTS",
            desc: "Accelerate your journey through professional digital testbank",
            icon: <svg width="26" height="26" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
            variant: "open"
        },
        {
            title: "SkillUp AMS",
            desc: "Integrated system for managing academic assets and resources.",
            icon: <svg width="26" height="26" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
            variant: "try"
        },
        {
            title: "SkillUp KSM",
            desc: "Smart solutions for efficient knowledge sharing management.",
            icon: <svg width="26" height="26" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
            variant: "try"
        },
        {
            title: "SkillUp Academy",
            desc: "Advanced courses designed to level up your career skills.",
            icon: <svg width="26" height="26" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
            variant: "try"
        },
        {
            title: "SkillUp JMS",
            desc: "Optimized framework for managing complex job-related workflows.",
            icon: <svg width="26" height="26" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
            variant: "try"
        },
        {
            title: "Special Function",
            desc: "Custom-built features tailored to your specific educational requirements.",
            icon: <svg width="26" height="26" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
            variant: "try"
        },
        {
            title: "Math Singapore",
            desc: "Mathematics curriculum based on Singapore's proven pedagogy.",
            icon: <svg width="26" height="26" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
            variant: "try"
        }
    ];

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-[#f8f9ff] text-[#052143] relative overflow-x-hidden flex flex-col">
            <Header />

            {/* Main Content */}
            <main className="relative z-10 mx-auto flex-1 w-full max-w-[1290px] px-4 py-12 sm:px-6 sm:py-16">
                {/* Background Decor */}
                <div className="absolute inset-0 pointer-events-none z-[-1] overflow-hidden">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#fcecf3] rounded-full blur-[100px] opacity-70"></div>
                    <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#eef0ff] rounded-full blur-[100px] opacity-70"></div>
                </div>

                <FadeIn direction="up">
                    <div className="text-center mb-16 relative">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm border border-blue-50 mb-6">
                            <svg width="18" height="18" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            <span className="text-[#687EFF] font-semibold text-[15px] italic">Products</span>
                        </div>

                        <h1 className="text-[#052143] font-bold text-[32px] leading-[1.15] tracking-tight sm:text-[42px] md:text-[56px]">
                            Explore Our World's Class
                            <br />
                            Best <span className="relative inline-block mx-2 text-[#b0bbcc]">
                                Courses
                                <span className="absolute left-0 top-1/2 w-full h-[3px] bg-[#687EFF] -translate-y-1/2 rotate-[-2deg]"></span>
                            </span>
                            <span className="inline-block bg-[#687EFF] text-white px-5 py-[-2px] rounded-[100px] transform -rotate-1 relative top-[-4px]">
                                Products
                            </span>
                        </h1>
                    </div>
                </FadeIn>

                {/* Cards Grid */}
                <FadeIn direction="up" delay={120} className="grid grid-cols-1 gap-6 pb-14 md:grid-cols-2 lg:grid-cols-3 lg:gap-8 lg:pb-20">
                    {products.map((p, i) => (
                        <div key={i} className="bg-white rounded-[24px] p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)] border border-[#eff2f9] hover:shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col group">
                            {/* Icon */}
                            <div className="w-[52px] h-[52px] rounded-[16px] bg-[#f8f9ff] flex items-center justify-center text-[24px] mb-6 group-hover:scale-110 transition-transform">
                                {p.icon}
                            </div>

                            {/* Content */}
                            <h3 className="font-bold text-[22px] text-[#052143] mb-3">{p.title}</h3>
                            <p className="text-[#6B778B] text-[15px] leading-[1.6] mb-8 flex-1">
                                {p.desc}
                            </p>

                            {/* Footer Buttons */}
                            <div className="mt-auto">
                                {p.variant === 'open' ? (
                                    <button className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#F87A53] text-[#F87A53] font-semibold hover:bg-[#F87A53] hover:text-white transition-colors group/btn">
                                        Open
                                        <svg className="transform group-hover/btn:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                            <polyline points="12 5 19 12 12 19"></polyline>
                                        </svg>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <button className="px-6 py-2.5 rounded-full bg-[#F87A53] text-white font-semibold hover:opacity-90 transition-opacity">
                                            Try it now
                                        </button>
                                        <button className="flex items-center gap-2 text-[#052143] font-semibold text-[15px] hover:text-[#687EFF] transition-colors">
                                            Learn More
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </FadeIn>
            </main>

            <PublicFooter className="mt-auto" />
            <HomeFloatingChatbot />
        </div>
    );
}



