'use client';

import React from 'react';
import Link from 'next/link';
import FadeIn from '@/components/ui/FadeIn';
import PublicFooter from '@/components/layout/PublicFooter';

export default function ProductsPage() {
    const products = [
        {
            title: "SkillUp LMS",
            desc: "All-in-One Platform for Smarter Digital Learning",
            icon: "📈",
            variant: "open"
        },
        {
            title: "SkillUp DTS",
            desc: "Accelerate your journey through professional digital testbank",
            icon: "📝",
            variant: "open"
        },
        {
            title: "SkillUp AMS",
            desc: "Integrated system for managing academic assets and resources.",
            icon: "💰",
            variant: "try"
        },
        {
            title: "SkillUp KSM",
            desc: "Smart solutions for efficient knowledge sharing management.",
            icon: "👑",
            variant: "try"
        },
        {
            title: "SkillUp Academy",
            desc: "Advanced courses designed to level up your career skills.",
            icon: "🎓",
            variant: "try"
        },
        {
            title: "SkillUp JMS",
            desc: "Optimized framework for managing complex job-related workflows.",
            icon: "📊",
            variant: "try"
        },
        {
            title: "Special Function",
            desc: "Custom-built features tailored to your specific educational requirements.",
            icon: "⭐",
            variant: "try"
        },
        {
            title: "Math Singapore",
            desc: "Mathematics curriculum based on Singapore's proven pedagogy.",
            icon: "🔢",
            variant: "try"
        }
    ];

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-[#f8f9ff] text-[#052143] relative overflow-x-hidden flex flex-col">

            {/* Header - Logo & Menu Bar */}
            <header className="w-full h-[80px] bg-white/80 backdrop-blur-sm flex items-center justify-center z-40 relative border-b border-dashed border-[#CDD0CE]">
                <div className="w-full max-w-[1290px] px-6 flex items-center justify-between h-full">
                    {/* Logo */}
                    <Link href="/" className="shrink-0">
                        <img src="/skillup_logo.png" alt="SkillUp" className="h-[48px] w-[48px] object-contain" />
                    </Link>

                    {/* Nav Links */}
                    <nav className="hidden lg:flex items-center gap-6">
                        <Link href="/" className="text-[#052143] font-normal text-[18px] leading-[150%] hover:text-[#F87A53] transition-colors">Home</Link>
                        <Link href="/products" className="text-[#F87A53] font-normal text-[18px] leading-[150%] flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="#F87A53"><path d="M6 0v12M0 6h12" stroke="#F87A53" strokeWidth="2" /></svg>
                            Products
                        </Link>
                        <Link href="/home-courses" className="text-[#052143] font-normal text-[18px] leading-[150%] flex items-center gap-1 hover:text-[#F87A53] transition-colors">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="#052143"><path d="M6 0v12M0 6h12" stroke="#052143" strokeWidth="2" /></svg>
                            Courses
                        </Link>
                        <Link href="/about" className="text-[#052143] font-normal text-[18px] leading-[150%] hover:text-[#F87A53] transition-colors">About Us</Link>
                        <Link href="/contact" className="text-[#052143] font-normal text-[18px] leading-[150%] hover:text-[#F87A53] transition-colors">Contact</Link>
                    </nav>

                    {/* Search & Sign In */}
                    <div className="hidden lg:flex items-center gap-5">
                        {/* Search Bar */}
                        <div className="flex items-center border-[3px] border-[#D1E3FB] rounded-full bg-white h-[48px] w-[305px] pl-5 pr-[6px] py-[6px]">
                            <input
                                type="text"
                                placeholder="LMS"
                                className="flex-1 bg-transparent text-[16px] text-[#052143] placeholder:text-[#6B778B] outline-none font-normal leading-[100%]"
                            />
                            <button className="h-[36px] px-3 bg-[#F87A53] text-white rounded-full flex items-center gap-[6px] text-[16px] font-normal relative overflow-hidden">
                                <span className="relative z-10">Search</span>
                                <svg className="relative z-10" width="12" height="12" viewBox="0 0 24 24" fill="white">
                                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                                </svg>
                                <div className="absolute right-[8px] top-1/2 -translate-y-1/2 w-[24px] h-[24px] bg-white/20 rounded-full"></div>
                            </button>
                        </div>

                        {/* Sign In Button */}
                        <Link href="/login" className="flex items-center gap-2 group">
                            <div className="w-[40px] h-[40px] border border-[#052143] rounded-full flex items-center justify-center relative overflow-hidden transition-colors group-hover:border-[#F87A53]">
                                <svg className="relative z-10 transition-colors group-hover:fill-[#F87A53]" width="15" height="12" viewBox="0 0 24 24" fill="#052143">
                                    <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                                <div className="absolute right-[-4px] bottom-[-4px] w-[24px] h-[24px] bg-[#F87A53] rounded-full"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[#052143] font-medium text-[18px] leading-[100%] group-hover:text-[#F87A53] transition-colors">Sign in</span>
                                <span className="text-[#6B778B] font-normal text-[14px] leading-[100%]">Register</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-[1290px] mx-auto px-6 py-16 relative z-10">
                {/* Background Decor */}
                <div className="absolute inset-0 pointer-events-none z-[-1] overflow-hidden">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#fcecf3] rounded-full blur-[100px] opacity-70"></div>
                    <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#eef0ff] rounded-full blur-[100px] opacity-70"></div>
                </div>

                <FadeIn direction="up">
                    <div className="text-center mb-16 relative">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm border border-blue-50 mb-6">
                            <span className="text-lg">🎓</span>
                            <span className="text-[#687EFF] font-semibold text-[15px] italic">Products</span>
                        </div>

                        <h1 className="text-[#052143] font-bold text-[48px] md:text-[56px] leading-[1.1] tracking-tight">
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
                <FadeIn direction="up" delay={120} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
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
        </div>
    );
}



