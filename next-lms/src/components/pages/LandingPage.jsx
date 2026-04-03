'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import FadeIn from '@/components/ui/FadeIn';
import Header from '@/components/layout/Header';
import PublicFooter from '@/components/layout/PublicFooter';

const NumberCounter = ({ end, duration = 2000, suffix = '', prefix = '', decimals = 0 }) => {
    const [count, setCount] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const domRef = useRef();

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        });
        if (domRef.current) observer.observe(domRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;

        let startTimestamp = null;
        let animationFrameId;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            const easeProgress = 1 - Math.pow(1 - progress, 4);
            setCount(easeProgress * end);

            if (progress < 1) {
                animationFrameId = window.requestAnimationFrame(step);
            } else {
                setCount(end);
            }
        };

        animationFrameId = window.requestAnimationFrame(step);
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [isVisible, end, duration]);

    return (
        <span ref={domRef}>
            {prefix}{(count).toFixed(decimals)}{suffix}
        </span>
    );
};

export default function LandingPage() {
    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-white text-[#052143] relative">
            <Header />

            {/* 02. Hero Section */}
            <section className="relative z-10 w-full overflow-hidden min-h-[620px] lg:min-h-[680px]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
                {/* Decorative background elements */}
                <div className="absolute left-0 top-0 w-full h-full pointer-events-none">
                    {/* Pink/purple gradient blobs */}
                    <div className="absolute left-[-15%] bottom-[5%] h-[260px] w-[260px] rounded-full opacity-25 sm:left-[-5%] sm:h-[350px] sm:w-[350px]" style={{ background: 'radial-gradient(circle, rgba(248,83,212,0.4) 0%, transparent 70%)' }}></div>
                    <div className="absolute right-[15%] top-[5%] h-[140px] w-[140px] rounded-full opacity-10 sm:h-[200px] sm:w-[200px]" style={{ background: 'radial-gradient(circle, rgba(248,83,212,0.3) 0%, transparent 70%)' }}></div>
                    <div className="absolute left-[30%] top-[10%] h-[100px] w-[100px] rounded-full opacity-10 sm:h-[150px] sm:w-[150px]" style={{ background: 'radial-gradient(circle, rgba(255,194,36,0.3) 0%, transparent 70%)' }}></div>
                    {/* Bottom pink stripe */}
                    <div className="absolute bottom-0 left-[-100px] right-[-100px] hidden h-[132px] border-y-2 border-[rgba(248,83,212,0.26)] bg-[rgba(248,83,212,0.07)] sm:block"></div>
                </div>

                <div className="relative z-10 mx-auto flex w-full max-w-[1290px] flex-col items-center px-4 pb-0 pt-10 sm:px-6 lg:flex-row lg:items-end lg:pt-16">

                    {/* Left Content */}
                    <div className="flex flex-1 flex-col items-center pb-8 text-center lg:items-start lg:pb-24 lg:text-left">
                        {/* Light bulb icon */}
                        <FadeIn direction="right" delay={80} className="mb-6 mix-blend-multiply lg:mb-8">
                            <img src="/images/idea-icon.png" alt="idea" className="h-[64px] w-[64px] object-contain mix-blend-multiply sm:h-[80px] sm:w-[80px]" />
                        </FadeIn>

                        <FadeIn direction="right" className="flex flex-col items-center lg:items-start">
                            {/* Headline */}
                            <h1 className="mb-5 text-[40px] font-bold italic leading-[112%] text-[#052143] sm:text-[48px] lg:mb-6 lg:text-[68px]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                All-In-One<br />
                                Platform For<br />
                                <span className="relative inline-block">
                                    <span className="text-[#F87A53]">Smarter Learning</span>
                                    {/* Underline decoration */}
                                    <svg className="absolute -bottom-3 left-0 w-full" height="10" viewBox="0 0 400 10" fill="none" preserveAspectRatio="none">
                                        <path d="M2 7C60 2 140 1 200 4C260 7 340 6 398 3" stroke="#3C59FC" strokeWidth="2.5" strokeLinecap="round" />
                                    </svg>
                                </span>
                            </h1>

                            {/* Description */}
                            <p className="mb-7 max-w-[520px] text-[15px] leading-[170%] text-[#6B778B] not-italic sm:mb-10 sm:text-[16px]">
                                ผู้เชี่ยวชาญด้านระบบการเรียนรู้และบริหารสถาบัน (LMS, LRS) มากกว่า 10 ปี
                                ช่วยให้องค์กรของคุณเรียนรู้อย่างมีประสิทธิภาพ ด้วยระบบที่ออกแบบเพื่อคุณ
                            </p>

                            {/* Buttons */}
                            <div className="flex flex-wrap items-center justify-center gap-3 not-italic lg:justify-start lg:gap-4">
                                <Link href="/register" className="relative flex min-w-[180px] items-center justify-center gap-2 overflow-hidden rounded-full bg-[#F87A53] px-6 py-3.5 text-[15px] font-medium text-white shadow-[0_4px_15px_rgba(248,122,83,0.3)] transition-opacity hover:opacity-90 sm:min-w-0 sm:px-7 sm:text-[16px]">
                                    <span className="relative z-10 text-lg">»</span>
                                    <span className="relative z-10">Get Started</span>
                                    <div className="absolute right-[6px] top-1/2 -translate-y-1/2 w-[36px] h-[36px] bg-white/20 rounded-full"></div>
                                </Link>

                                <button className="flex items-center gap-2 rounded-full border border-[#D1E3FB] bg-white px-4 py-3 text-[14px] font-medium text-[#052143] shadow-sm transition-colors hover:border-[#687EFF] sm:px-5 sm:py-3.5 sm:text-[16px]">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFC224"><path d="M12 2l2.09 6.26L20.5 9.27l-4.91 3.82L17.18 20 12 16.77 6.82 20l1.59-6.91L3.5 9.27l6.41-1.01L12 2z"/></svg>
                                    <span className="font-semibold italic">Quality Course</span>
                                </button>

                                <button className="flex items-center gap-2 rounded-full border border-[#D1E3FB] bg-white px-4 py-3 text-[14px] font-medium text-[#052143] shadow-sm transition-colors hover:border-[#687EFF] sm:px-5 sm:py-3.5 sm:text-[16px]">
                                    <svg width="18" height="18" fill="none" stroke="#F87A53" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                                    <span className="font-semibold italic">Suitable Price</span>
                                </button>
                            </div>
                        </FadeIn>
                    </div>

                    <FadeIn direction="up" delay={220} className="relative mb-8 w-full max-w-[420px] lg:hidden">
                        <img
                            src="/images/hero-student.png"
                            alt="Student"
                            className="mx-auto w-full max-w-[320px] object-contain"
                        />
                        <div className="absolute right-2 top-2 rounded-xl bg-white/95 px-3 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.12)]">
                            <p className="text-[12px] font-bold text-[#052143]">2000+</p>
                            <p className="text-[10px] text-[#687EFF]">Enrolled Students</p>
                        </div>
                    </FadeIn>

                    {/* Right Image & Decorations */}
                    <div className="flex-1 relative w-full min-h-[550px] lg:min-h-[620px] hidden lg:flex items-end justify-center">
                        <FadeIn direction="left" delay={200} className="absolute inset-0 z-0 pointer-events-none">
                            {/* Concentric circles - larger and more visible */}
                            <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[rgba(109,13,212,0.08)]"></div>
                            <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-[rgba(109,13,212,0.1)]"></div>
                            <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full border border-[rgba(109,13,212,0.12)]"></div>

                            {/* Decorative half-ellipses */}
                            <div className="absolute right-[-20px] top-[8%] w-[140px] h-[260px] border-2 border-[rgba(104,126,255,0.4)] rounded-full"></div>
                            <div className="absolute left-[5%] top-[5%] w-[120px] h-[240px] border-2 border-[rgba(104,126,255,0.3)] rounded-full"></div>
                        </FadeIn>

                        {/* Star decoration */}
                        <FadeIn direction="down" delay={260} className="absolute left-[10%] top-[3%] z-20">
                            <img src="/images/star-icon.png" alt="star" className="w-[50px] h-[50px] object-contain mix-blend-multiply" />
                        </FadeIn>

                        {/* Hero Image - larger, anchored to bottom */}
                        <div className="flex items-end justify-center w-full relative z-20">
                            <img
                                src="/images/hero-student.png"
                                alt="Student"
                                className="w-[520px] max-w-full h-auto object-contain"
                            />
                        </div>

                        <FadeIn direction="up" delay={400} className="absolute inset-0 z-20 pointer-events-none">
                            {/* 2000+ Enrolled Student badge */}
                            <div className="absolute right-[0px] top-[20%] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] rounded-2xl px-5 py-4 flex items-center gap-3 pointer-events-auto mix-blend-normal">
                                <div className="flex -space-x-2">
                                    <img src="https://i.pravatar.cc/40?img=1" className="w-9 h-9 rounded-full border-2 border-white" alt="" />
                                    <img src="https://i.pravatar.cc/40?img=5" className="w-9 h-9 rounded-full border-2 border-white" alt="" />
                                </div>
                                <div>
                                    <p className="text-[#052143] font-bold text-[15px]">2000+</p>
                                    <p className="text-[#687EFF] text-xs font-medium">Enrolled Student</p>
                                </div>
                                <div className="absolute -top-2 -right-2 w-5 h-5 text-[#687EFF]">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.09 6.26L20.5 9.27l-4.91 3.82L17.18 20 12 16.77 6.82 20l1.59-6.91L3.5 9.27l6.41-1.01L12 2z" /></svg>
                                </div>
                            </div>

                            {/* Course Card */}
                            <div className="absolute right-[8%] bottom-[8%] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] rounded-xl p-3 w-[170px] pointer-events-auto mix-blend-normal">
                                <div className="w-full h-[65px] bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg mb-2"></div>
                                <p className="text-[#052143] font-bold text-xs leading-tight">Digital Skills Mastery</p>
                                <p className="text-[#6B778B] text-[10px] mt-1">Somchai /
                                    <span className="text-amber-400 ml-1">★★★★</span>
                                </p>
                            </div>
                        </FadeIn>
                    </div>
                </div>
            </section>


            {/* Discover the Platform Section */}
            <section className="w-full relative z-20 bg-[#F6F8FF] py-14 sm:py-20">
                <div className="mx-auto max-w-[1290px] px-4 sm:px-6">
                    <FadeIn direction="up">
                        <div className="flex flex-col lg:flex-row items-center gap-16">
                            {/* Left Content */}
                            <div className="flex-1">
                                <span className="text-[#687EFF] font-medium text-[14px] uppercase tracking-wider mb-3 block">About us</span>
                                <h2 className="mb-8 text-[30px] font-bold italic leading-[130%] text-[#052143] sm:mb-10 sm:text-[36px] lg:text-[42px]">
                                    Discover the Platform That<br />
                                    Redefines <span className="text-[#F87A53] relative inline-block">Learning
                                        <svg className="absolute -bottom-2 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none" preserveAspectRatio="none"><path d="M1 4C40 1 80 1 100 3C140 5 180 4 199 2" stroke="#3C59FC" strokeWidth="2" strokeLinecap="round" /></svg>
                                    </span>
                                </h2>

                                <div className="flex flex-col gap-8">
                                    {[
                                        { num: '01', title: 'Fun And Experimental System', desc: 'Interactive learning with gamification' },
                                        { num: '02', title: 'Ai Powered Management System', desc: 'Smart tools for educators and teams' },
                                        { num: '03', title: 'Knowledge Building Management', desc: 'Structured content for mastery' },
                                        { num: '04', title: 'Arbitrary Design/Interface', desc: 'Customizable look and feel' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-start gap-5 group cursor-pointer">
                                            <div className="w-[44px] h-[44px] rounded-xl bg-[#687EFF] text-white flex items-center justify-center font-bold text-[16px] shrink-0 group-hover:bg-[#F87A53] transition-colors">
                                                {item.num}
                                            </div>
                                            <div>
                                                <h4 className="text-[#052143] font-medium text-[20px] leading-[150%] group-hover:text-[#687EFF] transition-colors">{item.title}</h4>
                                                <p className="text-[#6B778B] text-[14px] leading-[150%]">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Image */}
                            <div className="flex-1 relative">
                                <div className="rounded-[20px] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                                    <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=450&fit=crop" alt="Learning Platform" className="w-full h-[450px] object-cover" />
                                </div>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* Our Story Section */}
            <section className="w-full relative z-20 bg-white py-14 sm:py-20">
                <div className="mx-auto max-w-[1290px] px-4 sm:px-6">
                    <FadeIn direction="up">
                        <div className="flex flex-col lg:flex-row items-center gap-16">
                            {/* Left - Image with Stats */}
                            <div className="relative flex-1">
                                <div className="h-[320px] w-full max-w-[340px] overflow-hidden rounded-[20px] sm:h-[400px]">
                                    <img src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=340&h=400&fit=crop" alt="Our Story" className="w-full h-full object-cover rounded-[20px] border-4 border-[#687EFF]" />
                                </div>
                                {/* Stats badges */}
                                <div className="absolute -bottom-4 left-3 z-10 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] sm:left-[50px] sm:px-6 sm:py-4">
                                    <span className="text-[#687EFF] font-bold text-[32px]">10+</span>
                                    <span className="text-[#6B778B] text-[14px] leading-tight">Years of<br />Experience</span>
                                </div>
                                <div className="absolute -right-2 top-3 z-10 hidden items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] sm:flex sm:-right-[20px] sm:top-[30px] sm:px-6 sm:py-4">
                                    <span className="text-[#F87A53] font-bold text-[32px]">30+</span>
                                    <span className="text-[#6B778B] text-[14px] leading-tight">Expert<br />Instructors</span>
                                </div>
                            </div>

                            {/* Right Content */}
                            <div className="flex-1">
                                <span className="text-[#687EFF] font-medium text-[14px] uppercase tracking-wider mb-3 block">Our Story</span>
                                <h2 className="mb-6 text-[30px] font-bold italic leading-[130%] text-[#052143] sm:text-[36px] lg:text-[42px]">
                                    Our Story: Built On Values,<br />
                                    Driven By <span className="text-[#F87A53] relative inline-block">Innovation
                                        <svg className="absolute -bottom-2 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none" preserveAspectRatio="none"><path d="M1 4C40 1 80 1 100 3C140 5 180 4 199 2" stroke="#3C59FC" strokeWidth="2" strokeLinecap="round" /></svg>
                                    </span>
                                </h2>

                                <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <div>
                                        <h4 className="text-[#052143] font-medium text-[16px] mb-2 flex items-center gap-1.5">
                                            <svg width="15" height="15" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                            Our Mission
                                        </h4>
                                        <p className="text-[#6B778B] text-[14px] leading-[160%]">To make high-quality education accessible to everyone through innovative technology.</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[#052143] font-medium text-[16px] mb-2 flex items-center gap-1.5">
                                            <svg width="15" height="15" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
                                            Our Vision
                                        </h4>
                                        <p className="text-[#6B778B] text-[14px] leading-[160%]">A world where learning knows no boundaries and every learner reaches their potential.</p>
                                    </div>
                                </div>

                                <Link href="/about" className="inline-flex items-center gap-2 px-6 py-3 bg-[#687EFF] text-white rounded-full text-[16px] font-medium hover:opacity-90 transition-opacity">
                                    Read More
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M5.88 4.12L13.76 12l-7.88 7.88L8 22l10-10L8 2l-2.12 2.12z" /></svg>
                                </Link>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* SkillUp's Courses Section */}
            <section className="w-full relative z-20 py-14 sm:py-20" style={{ background: 'linear-gradient(180deg, #F6F8FF 0%, #FFFFFF 100%)' }}>
                <div className="mx-auto max-w-[1290px] px-4 sm:px-6">
                    <FadeIn direction="up">
                        <div className="text-center mb-14">
                            <span className="text-[#687EFF] font-medium text-[14px] uppercase tracking-wider mb-3 block">Our Courses</span>
                            <h2 className="text-[#052143] font-bold italic text-[36px] lg:text-[42px] leading-[130%]">
                                SkillUp's Courses<br />
                                Grow Faster, Learn <span className="text-[#F87A53] relative inline-block">Better
                                    <svg className="absolute -bottom-2 left-0 w-full" height="6" viewBox="0 0 120 6" fill="none" preserveAspectRatio="none"><path d="M1 4C30 1 60 1 80 3C100 5 110 4 119 2" stroke="#3C59FC" strokeWidth="2" strokeLinecap="round" /></svg>
                                </span>
                            </h2>
                        </div>
                    </FadeIn>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { title: 'Full Stack Development BKD', img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=240&fit=crop', category: 'Development', price: '฿2,500' },
                            { title: 'Complete UI / UX Design Masterclass', img: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=240&fit=crop', category: 'Design', price: '฿1,800' },
                            { title: 'Data Science Full Course', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=240&fit=crop', category: 'Data Science', price: '฿3,200' },
                        ].map((course, i) => (
                            <FadeIn key={i} delay={i * 150} direction="up">
                                <Link href="/home-courses" className="block bg-white border border-[#D1E3FB] rounded-[20px] overflow-hidden hover:shadow-lg hover:-translate-y-2 transition-all duration-300 group">
                                    <div className="h-[200px] overflow-hidden">
                                        <img src={course.img} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                    <div className="p-6">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="px-3 py-1 bg-[#F6F8FF] text-[#687EFF] rounded-full text-[12px] font-medium">{course.category}</span>
                                        </div>
                                        <h3 className="text-[#052143] font-medium text-[18px] leading-[140%] mb-3 group-hover:text-[#687EFF] transition-colors">{course.title}</h3>
                                        <div className="flex items-center justify-between pt-3 border-t border-dashed border-[#D1E3FB]">
                                            <span className="text-[#687EFF] font-bold text-[18px]">{course.price}</span>
                                            <span className="text-[#F87A53] font-medium text-[14px] flex items-center gap-1">
                                                View Details
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#F87A53"><path d="M5.88 4.12L13.76 12l-7.88 7.88L8 22l10-10L8 2l-2.12 2.12z" /></svg>
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* Our Clients */}
            <section className="w-full relative z-20 overflow-hidden bg-white py-14 sm:py-20">
                <style>{`
                    @keyframes infinite-scroll {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .animate-marquee {
                        animation: infinite-scroll 60s linear infinite;
                        width: max-content;
                    }
                    .animate-marquee:hover {
                        animation-play-state: paused;
                    }
                `}</style>
                <div className="max-w-[1920px] mx-auto">
                    <FadeIn direction="up">
                        <div className="text-center mb-14">
                            <span className="text-[#687EFF] font-medium text-[14px] uppercase tracking-wider mb-3 block">Our Clients</span>
                            <h2 className="text-[#052143] font-bold italic text-[36px] lg:text-[42px] leading-[130%]">
                                Trusted By Leading <span className="text-[#F87A53]">Organizations</span>
                            </h2>
                        </div>
                    </FadeIn>

                    {/* Continuous Auto-scrolling Slider */}
                    <FadeIn direction="up" delay={120}>
                        <div className="flex overflow-hidden w-full relative pb-8">
                            {/* Gradient masks for smooth fade on edges */}
                            <div className="absolute left-0 top-0 bottom-0 w-[100px] md:w-[200px] z-10 bg-gradient-to-r from-white to-transparent pointer-events-none"></div>
                            <div className="absolute right-0 top-0 bottom-0 w-[100px] md:w-[200px] z-10 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>

                            <div className="flex items-center gap-[48px] md:gap-[100px] animate-marquee">
                                {/* Duplicate list for seamless scrolling */}
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-[48px] pl-[48px] md:gap-[100px] md:pl-[100px]">
                                        {[
                                            'client_logo_02_bluepeak.png',
                                            'client_logo_01_novalearn.png',
                                            'client_logo_07_brightedge.png',
                                            'client_logo_06_metrolabs.png',
                                            'client_logo_05_zenbyte.png',
                                            'client_logo_04_cloudmint.png',
                                            'client_logo_03_atlasworks.png'
                                        ].map((img, idx) => (
                                            <div key={idx} className="h-[68px] w-[170px] flex-none opacity-80 grayscale-[50%] transition-all duration-300 hover:grayscale-0 hover:opacity-100 sm:h-[80px] sm:w-[213px]">
                                                <img
                                                    src={`/${img}`}
                                                    alt={`Client ${idx + 1}`}
                                                    className="w-full h-full object-contain mix-blend-multiply"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* Pick A Course Section */}
            <section className="w-full relative z-20 bg-[#F6F8FF] py-14 sm:py-20">
                <div className="mx-auto max-w-[1290px] px-4 sm:px-6">
                    <FadeIn direction="up">
                        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:mb-14 md:flex-row md:items-end">
                            <div>
                                <span className="text-[#687EFF] font-medium text-[14px] uppercase tracking-wider mb-3 block">Featured</span>
                                <h2 className="text-[30px] font-bold italic leading-[130%] text-[#052143] sm:text-[36px] lg:text-[42px]">
                                    Pick A Course To Get Started
                                </h2>
                            </div>
                            <Link href="/home-courses" className="hidden md:flex items-center gap-2 text-[#687EFF] font-medium hover:underline">
                                View All
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="#687EFF"><path d="M5.88 4.12L13.76 12l-7.88 7.88L8 22l10-10L8 2l-2.12 2.12z" /></svg>
                            </Link>
                        </div>
                    </FadeIn>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { title: 'Top Python & Machine Learning Link', img: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=400&h=200&fit=crop', price: '฿4,900', tag: 'Best Seller' },
                            { title: 'Learning Java Programming Foundation', img: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=200&fit=crop', price: '฿2,900', tag: 'Popular' },
                            { title: 'Complete Full Stack Course', img: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=200&fit=crop', price: '฿3,500', tag: 'New' },
                        ].map((course, i) => (
                            <FadeIn key={i} delay={i * 150} direction="up">
                                <Link href="/home-courses" className="block bg-white border border-[#D1E3FB] rounded-[20px] overflow-hidden hover:shadow-lg hover:-translate-y-2 transition-all duration-300 group">
                                    <div className="h-[180px] overflow-hidden relative">
                                        <img src={course.img} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <span className="absolute top-4 left-4 px-3 py-1 bg-[#F87A53] text-white rounded-full text-[12px] font-medium">{course.tag}</span>
                                    </div>
                                    <div className="p-6">
                                        <h3 className="text-[#052143] font-medium text-[18px] leading-[140%] mb-4 group-hover:text-[#687EFF] transition-colors">{course.title}</h3>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#687EFF] font-bold text-[20px]">{course.price}</span>
                                            <span className="px-4 py-2 bg-[#687EFF] text-white rounded-full text-[13px] font-medium hover:bg-[#F87A53] transition-colors">Enroll Now</span>
                                        </div>
                                    </div>
                                </Link>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Bar - Blue Gradient */}
            <section className="w-full relative z-20 overflow-hidden bg-[#687EFF] py-12 sm:py-16">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 left-[10%] w-[200px] h-[200px] rounded-full bg-white/20 blur-[80px]"></div>
                    <div className="absolute bottom-0 right-[20%] w-[300px] h-[300px] rounded-full bg-white/10 blur-[100px]"></div>
                </div>
                <div className="relative z-10 mx-auto max-w-[1290px] px-4 sm:px-6">
                    <FadeIn direction="up">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            {[
                                { value: 30000, suffix: '+', label: 'Enrolled Students' },
                                { value: 4000, suffix: '+', label: 'Verified Courses' },
                                { value: 120, suffix: '+', label: 'Expert Instructors' },
                                { value: 100, suffix: '%', label: 'Satisfaction Rate' },
                            ].map((stat, i) => (
                                <div key={i} className="text-center">
                                    <div className="mb-2 text-[34px] font-bold leading-[100%] text-white sm:text-[42px] md:text-[52px]">
                                        <NumberCounter end={stat.value} suffix={stat.suffix} />
                                    </div>
                                    <p className="text-white/80 text-[16px] font-normal">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* Testimonials */}
            <section className="w-full relative z-20 bg-white py-14 sm:py-20">
                <div className="mx-auto max-w-[1290px] px-4 sm:px-6">
                    <FadeIn direction="up">
                        <div className="text-center mb-14">
                            <span className="text-[#687EFF] font-medium text-[14px] uppercase tracking-wider mb-3 block">Testimonials</span>
                            <h2 className="text-[30px] font-bold italic leading-[130%] text-[#052143] sm:text-[36px] lg:text-[42px]">
                                What They Say About Us
                            </h2>
                        </div>
                    </FadeIn>

                    <FadeIn direction="up" delay={120}>
                        <div className="max-w-[800px] mx-auto">
                            <div className="relative rounded-[20px] border border-[#D1E3FB] bg-white p-6 sm:p-10">
                            <div className="text-[#687EFF] mb-6">
                                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
                            </div>
                            <p className="text-[#052143] text-[18px] leading-[170%] mb-8">
                                "This platform completely transformed how our organization approaches learning. The courses are well-structured, the UI is intuitive, and the support team is incredibly responsive. We've seen a 40% improvement in team performance since adopting SkillUp."
                            </p>
                            <div className="flex items-center gap-4">
                                <img src="https://i.pravatar.cc/60?img=12" className="w-14 h-14 rounded-full border-2 border-[#687EFF]" alt="" />
                                <div>
                                    <h4 className="text-[#052143] font-bold text-[18px]">Jessica Russell</h4>
                                    <div className="flex items-center gap-1 mt-1">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#FFC224"><path d="M12 2l2.09 6.26L20.5 9.27l-4.91 3.82L17.18 20 12 16.77 6.82 20l1.59-6.91L3.5 9.27l6.41-1.01L12 2z" /></svg>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Navigation dots */}
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <div className="w-3 h-3 rounded-full bg-[#687EFF]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#D1E3FB]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#D1E3FB]"></div>
                            </div>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            <PublicFooter />

        </div>
    );
}


