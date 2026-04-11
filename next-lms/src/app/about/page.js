'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import FadeIn from '@/components/ui/FadeIn';
import Header from '@/components/layout/Header';
import PublicFooter from '@/components/layout/PublicFooter';
import HomeFloatingChatbot from '@/components/ui/HomeFloatingChatbot';

export default function AboutPage() {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const teamMembers = [
        { name: 'นางสาวสุพรรษา นาคประเสริฐ' },
        { name: 'นายเอกธพงษ์ ลอนหิน' },
        { name: 'นายฮารูน กาซอร์' },
    ];

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-[#f8f9ff] text-[#052143] flex flex-col">
            <Header />

            {/* Hero Section (Banner) */}
            <div className="relative w-full h-[190px] sm:h-[220px] lg:h-[280px] bg-[#f8f6ff] flex items-center overflow-hidden border-b border-[#F2F4FF]">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#687EFF 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(104, 126, 255, 0.2))' }}></div>

                {/* Decorative Elements */}
                <div className="absolute right-[5%] bottom-[10%] opacity-80">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
                        <circle cx="18" cy="18" r="5" fill="#687EFF" />
                        <circle cx="18" cy="7" r="4" fill="#C4B5FD" />
                        <circle cx="18" cy="29" r="4" fill="#C4B5FD" />
                        <circle cx="7" cy="18" r="4" fill="#C4B5FD" />
                        <circle cx="29" cy="18" r="4" fill="#C4B5FD" />
                        <circle cx="10" cy="10" r="3" fill="#DDD6FE" />
                        <circle cx="26" cy="10" r="3" fill="#DDD6FE" />
                        <circle cx="10" cy="26" r="3" fill="#DDD6FE" />
                        <circle cx="26" cy="26" r="3" fill="#DDD6FE" />
                    </svg>
                </div>

                <FadeIn direction="up" className="w-full max-w-[1290px] mx-auto px-4 sm:px-6 relative z-10">
                    <h1 className="text-[#052143] font-bold text-[34px] sm:text-[44px] lg:text-[56px] leading-[1.2] mb-3">Our Blog</h1>
                    <div className="flex items-center gap-2 text-[#6B778B] text-[15px]">
                        <Link href="/" className="hover:text-[#687EFF] transition-colors">Home</Link>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                        <span className="text-[#687EFF] font-medium">Blog</span>
                    </div>
                </FadeIn>

                {/* Left side vertical text banner */}
                <div className="absolute left-0 top-0 h-full w-[40px] bg-[#687EFF] items-center justify-center hidden lg:flex">
                    <div className="transform -rotate-90 whitespace-nowrap text-white/70 text-[10px] tracking-[4px] font-semibold uppercase">
                        facebook // instagram // linkedin // twitter
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-[1290px] mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-16 relative z-10 bg-white shadow-sm rounded-none md:rounded-xl md:my-8 md:-mt-10 overflow-hidden">
                
                {/* Top Section */}
                <FadeIn direction="up" className="bg-[#F6F7FA] rounded-[30px] p-6 sm:p-8 md:p-12 lg:p-16 flex flex-col-reverse lg:flex-row items-center gap-10">
                    <div className="flex-1 flex flex-col gap-6 text-[#052143] font-sans text-[14px] md:text-[15px] leading-[1.8] font-medium">
                        <p>
                            SkillUp is a web-based Learning Management System (LMS) developed as a senior capstone project by students of Ramkhamhaeng University, Faculty of Engineering, Department of Computer and Electronics Engineering. This project was initiated to respond to the growing need for a practical, flexible, and learner-centered digital education platform that supports both formal and self-directed learning.
                        </p>
                        <p>
                            The main objective of SkillUp is to provide an accessible, user-friendly, and effective online learning environment where learners can study at their own pace, access learning materials conveniently, and monitor their progress through a structured learning flow. We designed the platform to reduce common barriers in online education, such as fragmented content access, unclear progress visibility, and limited learner support during study sessions.
                        </p>
                        <p>
                            SkillUp includes essential LMS capabilities such as course discovery, enrollment workflows, section-based lesson delivery, progress tracking, quiz and learning activity support, and certificate-related processes. In addition, the platform integrates AI-assisted features to help learners summarize content, clarify difficult concepts, and receive guided learning support in context. These AI features are designed to support understanding and learning confidence while maintaining appropriate academic integrity in assessment scenarios.
                        </p>
                        <p>
                            From a technical perspective, the project emphasizes practical software engineering implementation, including role-based access control, session-based authentication, administrative reporting modules, and operational APIs for learning data management. The system is structured for maintainability and future extension, allowing additional capabilities such as richer analytics, recommendation logic, and deeper personalization in subsequent phases.
                        </p>
                        <p>
                            Beyond technical implementation, SkillUp reflects our commitment to educational impact. We believe learning should be available to everyone, anywhere, and at any time. Through this project, we aim to encourage continuous learning, strengthen digital skills, and contribute to a more inclusive and effective learning ecosystem for students and lifelong learners.
                        </p>
                        <div className="rounded-[16px] bg-white border border-[#E6EBFF] px-4 py-3">
                            <h3 className="text-[16px] font-semibold text-[#052143] mb-1.5">Project Information</h3>
                            <p className="text-[#4D5A75] text-[14px] leading-[1.7]">
                                Project Type: Senior Project (Capstone)
                                <br />
                                Institution: Ramkhamhaeng University
                                <br />
                                Faculty: Faculty of Engineering
                                <br />
                                Department: Computer and Electronics Engineering
                            </p>
                        </div>
                        <div className="rounded-[16px] bg-white border border-[#E6EBFF] px-4 py-3">
                            <h3 className="text-[16px] font-semibold text-[#052143] mb-1.5">Project Team</h3>
                            <p className="text-[#4D5A75] text-[14px] leading-[1.7]">
                                1. Miss Suppansa Nakprasert
                                <br />
                                2. Mr. Ekthaphong Lonhin
                                <br />
                                3. Mr. Haroon Kasor
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 flex justify-center w-full">
                        <img 
                            src="/images/messageImage_1775491769297.png" 
                            alt="About SkillUp" 
                            className="w-full max-w-[500px] object-contain flex fallback-image-container rounded-[20px]" 
                            onError={(e) => {
                                e.target.style.display='none';
                                e.target.nextSibling.style.display='flex';
                            }} 
                        />
                        <div className="hidden w-full max-w-[500px] h-[300px] bg-[#EAEDF5] rounded-[20px] flex-col items-center justify-center text-[#94a3b8] shadow-inner text-center px-6">
                            <span className="text-[14px] mt-2 text-[#052143] font-medium">Please add 'about-hero.png' to /public/images/</span>
                        </div>
                    </div>
                </FadeIn>

                {/* Bottom Interactive Section */}
                <FadeIn direction="up" delay={200} className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20 px-4 md:px-10 lg:px-20 pb-10 mt-16">
                    
                    {/* Left: Buttons */}
                    <div className="flex flex-col gap-6 w-full lg:w-[360px] z-20">
                        {teamMembers.map((member, idx) => (
                            <button
                                key={idx}
                                onMouseEnter={() => setHoveredIndex(idx)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                className={`w-full h-[60px] rounded-full text-white text-[22px] font-medium transition-all duration-300 shadow-[0_4px_12px_rgba(72,113,243,0.2)] ${
                                    hoveredIndex === idx
                                        ? 'bg-[#1e3b8a] scale-[1.02]' 
                                        : 'bg-[#4871f3] hover:bg-[#3d63da]'
                                }`}
                            >
                                {member.name}
                            </button>
                        ))}
                    </div>

                    {/* Right: Characters Illustration */}
                    <div className="flex-1 flex justify-center items-end h-[450px] relative w-full">
                        <div className="w-full max-w-[600px] h-full flex justify-center relative items-end pb-4">
                            {[
                                { file: "messageImage_1775491727482.png", btnIdx: 1 }, // Left - Male (Corresponds to Button 2)
                                { file: "messageImage_1775491739744.png", btnIdx: 0 }, // Middle - Female (Corresponds to Button 1)
                                { file: "messageImage_1775491747525.png", btnIdx: 2 }  // Right - Male (Corresponds to Button 3)
                            ].map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`relative flex items-end justify-center transition-all duration-300 ${
                                        hoveredIndex === null 
                                          ? 'opacity-100' 
                                          : hoveredIndex === item.btnIdx 
                                            ? 'opacity-100' 
                                            : 'opacity-20'
                                    } ${
                                        idx === 0 ? '-mr-10 z-10' : 
                                        idx === 1 ? 'z-20 scale-105' : 
                                        '-ml-10 z-10'
                                    }`}
                                >
                                    <img 
                                        src={`/images/${item.file}`} 
                                        alt={teamMembers[item.btnIdx].name} 
                                        className="h-[420px] w-auto origin-bottom object-contain transition-transform duration-300 rounded-[20px]" 
                                        onError={(e) => {
                                            e.target.style.display='none';
                                            e.target.nextSibling.style.display='flex';
                                        }} 
                                    />
                                    <div className="hidden w-full h-[340px] bg-slate-100 rounded-[20px] flex-col items-center justify-center pb-8 border border-slate-200">
                                        <span className="text-slate-400 font-medium text-[12px] text-center">{item.file}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </FadeIn>

            </main>

            <PublicFooter className="mt-auto" />
            <HomeFloatingChatbot />
        </div>
    );
}
