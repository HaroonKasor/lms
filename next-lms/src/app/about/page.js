'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import FadeIn from '@/components/ui/FadeIn';
import PublicFooter from '@/components/layout/PublicFooter';

export default function AboutPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const categories = [
        { label: 'All Categories', count: null, active: true },
        { label: 'Development', count: 15 },
        { label: 'Business', count: 10 },
        { label: 'Marketing', count: 8 },
        { label: 'Technology', count: 14 },
    ];

    const blogs = [
        {
            id: 1,
            title: "Why Online Learning is the Future of Education",
            date: "Nov 02, 2024",
            category: "Technology",
            readTime: "5 Min Read",
            comments: 105,
            author: "Jordan Walk",
            authorRole: "Education Specialist",
            image: "/messageImage_1772443005375.png" // placeholder
        },
        {
            id: 2,
            title: "Top 10 Web Development Trends in 2025",
            date: "Mar 15, 2024",
            category: "Development",
            readTime: "5 Min Read",
            comments: 24,
            author: "David Millar",
            authorRole: "Senior Developer",
            image: "/messageImage_1772443033023.png" // placeholder
        },
        {
            id: 3,
            title: "Why UX Design Matters More Than Ever",
            date: "Feb 28, 2024",
            category: "Design",
            readTime: "5 Min Read",
            comments: 15,
            desc: "User experience is the key to product success in the digital age. Learn why investing in UX design is crucial for your business.",
            author: "Wade Warren",
            authorRole: "UX Designer",
            image: "/messageImage_1772443052524.png" // placeholder
        },
        {
            id: 4,
            title: "How to Start a Career in Data Science",
            date: "Feb 15, 2024",
            category: "Career",
            readTime: "5 Min Read",
            comments: 32,
            desc: "A step-by-step guide for aspiring data scientists. Learn the essential skills and tools you need to break into this exciting field.",
            author: "Jenny Wilson",
            authorRole: "Data Scientist",
            image: "/messageImage_1772443005375.png" // placeholder
        },
        {
            id: 5,
            title: "Mastering React Hooks: A Complete Guide",
            date: "Jan 20, 2024",
            category: "Development",
            readTime: "5 Min Read",
            comments: 18,
            desc: "React Hooks have revolutionized how we write React components. Learn everything you need to know about useState, useEffec...",
            author: "David Millar",
            authorRole: "Senior Developer",
            image: "/messageImage_1772443033023.png" // placeholder
        },
        {
            id: 6,
            title: "The Ultimate Digital Marketing Strategy for 2025",
            date: "Jan 10, 2024",
            category: "Marketing",
            readTime: "5 Min Read",
            comments: 20,
            desc: "Stay ahead of the competition with these proven digital marketing strategies for 2025. From SEO to social media, we cover it all.",
            author: "Sarah Johnson",
            authorRole: "Marketing Director",
            image: "/messageImage_1772443052524.png" // placeholder
        }
    ];

    const Header = () => (
        <>
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
                        <Link href="/products" className="text-[#052143] font-normal text-[18px] leading-[150%] flex items-center gap-1 hover:text-[#F87A53] transition-colors">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" stroke="currentColor"><path d="M6 0v12M0 6h12" strokeWidth="2" /></svg>
                            Products
                        </Link>
                        <Link href="/home-courses" className="text-[#052143] font-normal text-[18px] leading-[150%] flex items-center gap-1 hover:text-[#F87A53] transition-colors">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" stroke="currentColor"><path d="M6 0v12M0 6h12" strokeWidth="2" /></svg>
                            Courses
                        </Link>
                        <Link href="/about" className="text-[#F87A53] font-normal text-[18px] leading-[150%] hover:text-[#F87A53] transition-colors">About Us</Link>
                        <Link href="/contact" className="text-[#052143] font-normal text-[18px] leading-[150%] hover:text-[#F87A53] transition-colors">Contact</Link>
                    </nav>

                    {/* Search & Sign In */}
                    <div className="hidden lg:flex items-center gap-5">
                        <div className="flex items-center border-[3px] border-[#D1E3FB] rounded-full bg-white h-[48px] w-[305px] pl-5 pr-[6px] py-[6px]">
                            <input type="text" placeholder="LMS" className="flex-1 bg-transparent text-[16px] text-[#052143] placeholder:text-[#6B778B] outline-none font-normal" />
                            <button className="h-[36px] px-3 bg-[#F87A53] text-white rounded-full flex items-center gap-[6px] text-[16px] font-normal relative overflow-hidden">
                                <span className="relative z-10">Search</span>
                                <svg className="relative z-10" width="12" height="12" viewBox="0 0 24 24" fill="white">
                                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                                </svg>
                            </button>
                        </div>
                        <Link href="/login" className="flex items-center gap-2 group">
                            <div className="w-[40px] h-[40px] border border-[#052143] rounded-full flex items-center justify-center relative overflow-hidden transition-colors group-hover:border-[#F87A53]">
                                <svg className="relative z-10 transition-colors group-hover:fill-[#F87A53]" width="15" height="12" viewBox="0 0 24 24" fill="#052143">
                                    <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[#052143] font-medium text-[18px] leading-[100%] group-hover:text-[#F87A53] transition-colors">Sign in</span>
                                <span className="text-[#6B778B] font-normal text-[14px]">Register</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </header>
        </>
    );

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-[#f8f9ff] text-[#052143] flex flex-col">
            <Header />

            {/* Hero Section */}
            <div className="relative w-full h-[220px] lg:h-[280px] bg-[#f8f6ff] flex items-center overflow-hidden border-b border-[#F2F4FF]">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#687EFF 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(104, 126, 255, 0.2))' }}></div>

                {/* Decorative Elements */}
                <div className="absolute right-[5%] bottom-[10%] opacity-80">
                    <span className="text-3xl filter brightness-110">🌸</span>
                </div>

                <FadeIn direction="up" className="w-full max-w-[1290px] mx-auto px-6 relative z-10">
                    <h1 className="text-[#052143] font-bold text-[48px] lg:text-[56px] leading-[1.2] mb-3">Our Blog</h1>
                    <div className="flex items-center gap-2 text-[#6B778B] text-[15px]">
                        <Link href="/" className="hover:text-[#687EFF] transition-colors">Home</Link>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                        <span className="text-[#687EFF] font-medium">Blog</span>
                    </div>
                </FadeIn>

                {/* Left side vertical text banner */}
                <div className="absolute left-0 top-0 h-full w-[40px] bg-[#687EFF] flex items-center justify-center">
                    <div className="transform -rotate-90 whitespace-nowrap text-white/70 text-[10px] tracking-[4px] font-semibold uppercase">
                        facebook // instagram // linkedin // twitter
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-[1290px] mx-auto px-6 py-16 flex flex-col lg:flex-row gap-8 lg:gap-12 relative z-10">

                {/* Main Blog Area (Left) */}
                <FadeIn direction="right" className="flex-1 flex flex-col gap-8">

                    {/* Blog Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {blogs.map((blog) => (
                            <div key={blog.id} className="bg-white rounded-[20px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#eaedf5] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-300 group flex flex-col p-5">

                                {/* Top Image Area (Mock graphic) */}
                                <div className="relative h-[220px] w-full bg-[#1b233a] rounded-2xl flex items-center justify-center overflow-hidden mb-5">
                                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-sm text-[#052143] text-[12px] font-bold px-3 py-1.5 rounded-full shadow-sm">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        {blog.date}
                                    </div>

                                    {/* Mock Graphic inside the card for the generic "boy at computer" */}
                                    <div className="relative z-10 opacity-90 group-hover:scale-105 transition-transform duration-500 w-[180px] h-[140px] pt-8 bg-transparent">
                                        {/* Monitor */}
                                        <div className="w-[120px] h-[80px] bg-[#2a344f] rounded-t-xl mx-auto border-4 border-[#3a4666] flex flex-col relative z-20">
                                            {/* Screen contents mock */}
                                            <div className="flex-1 bg-[#1a2133] p-2 flex flex-col gap-1.5">
                                                <div className="w-full h-2 bg-[#ff5252] rounded-full"></div>
                                                <div className="w-3/4 h-2 bg-[#2196f3] rounded-full"></div>
                                                <div className="w-5/6 h-2 bg-[#ffeb3b] rounded-full"></div>
                                            </div>
                                        </div>
                                        {/* Character mock */}
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70px] h-[90px] bg-transparent z-30 flex flex-col items-center">
                                            <div className="w-[40px] h-[40px] bg-[#ffecb3] rounded-full relative z-30">
                                                {/* Hair */}
                                                <div className="absolute top-[-5px] w-full h-[20px] bg-[#f87a53] rounded-t-full"></div>
                                                {/* Glasses */}
                                                <div className="absolute top-[15px] left-[5px] w-[12px] h-[12px] border-2 border-[#1a2133] rounded-full"></div>
                                                <div className="absolute top-[15px] right-[5px] w-[12px] h-[12px] border-2 border-[#1a2133] rounded-full"></div>
                                            </div>
                                            {/* Body */}
                                            <div className="w-[60px] h-[50px] bg-[#f87a53] rounded-t-3xl relative z-20 -mt-2">
                                                <div className="absolute inset-x-0 mx-auto w-2 h-full bg-white/20"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                </div>

                                {/* Content */}
                                <div className="flex flex-col flex-1">
                                    {/* Meta Tags */}
                                    <div className="flex items-center gap-4 text-[13px] text-[#9BA5B7] font-medium mb-4 flex-wrap">
                                        <div className="flex items-center gap-1.5 hover:text-[#687EFF] cursor-pointer transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                            {blog.category}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {blog.readTime}
                                        </div>
                                        <div className="flex items-center gap-1.5 hover:text-[#052143] cursor-pointer transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                            {blog.comments} Comments
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-[20px] text-[#052143] leading-[1.4] mb-3 hover:text-[#687EFF] cursor-pointer transition-colors line-clamp-2">{blog.title}</h3>

                                    {blog.desc && (
                                        <p className="text-[#6B778B] text-[15px] leading-relaxed mb-6 line-clamp-2">
                                            {blog.desc}
                                        </p>
                                    )}

                                    {/* Author Info */}
                                    <div className="flex items-center gap-3 mt-auto pt-6 border-t border-dashed border-[#eaedf5]">
                                        <div className="w-10 h-10 rounded-full bg-[#f8f9ff] border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                            <svg className="w-6 h-6 text-[#9BA5B7]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-[#052143] font-bold text-[14px] leading-tight hover:text-[#687EFF] cursor-pointer transition-colors">{blog.author}</h4>
                                            <p className="text-[#9BA5B7] text-[12px]">{blog.authorRole}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                </FadeIn>

                {/* Sidebar (Right) */}
                <FadeIn direction="left" delay={120} className="w-full lg:w-[320px] shrink-0 flex flex-col gap-8">

                    {/* Search Widget */}
                    <div className="bg-[#fdfdfd] border border-[#eaedf5] rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                        <h3 className="font-bold text-[#052143] text-[18px] mb-4">Search</h3>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search posts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-[#cfd6e4] rounded-lg px-4 py-3 text-[14px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors"
                            />
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA5B7] hover:text-[#687EFF]">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </button>
                        </div>
                    </div>

                    {/* Categories Widget */}
                    <div className="bg-[#fdfdfd] border border-[#eaedf5] rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                        <h3 className="font-bold text-[#052143] text-[18px] mb-5">Categories</h3>
                        <div className="flex flex-col gap-2">
                            {categories.map((cat, i) => (
                                <Link
                                    key={i}
                                    href="#"
                                    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all ${cat.active ? 'bg-[#687EFF] text-white shadow-md shadow-[#687EFF]/20 font-medium' : 'bg-transparent text-[#6B778B] hover:bg-[#f6f8fb] hover:text-[#052143]'}`}
                                >
                                    <span className="text-[15px]">{cat.label}</span>
                                    {cat.count !== null && (
                                        <span className={`text-[13px] font-medium ${cat.active ? 'text-white/80' : 'text-[#9BA5B7]'}`}>({cat.count})</span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>

                </FadeIn>
            </main>

            <PublicFooter className="mt-auto" />
        </div>
    );
}



