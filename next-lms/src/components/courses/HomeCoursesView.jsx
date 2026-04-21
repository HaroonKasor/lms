'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import FadeIn from '@/components/ui/FadeIn';
import PublicFooter from '@/components/layout/PublicFooter';
import HomeFloatingChatbot from '@/components/ui/HomeFloatingChatbot';

export default function HomeCoursesView() {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [currentPage, setCurrentPage] = useState(1);

    const categories = [
        { label: 'Development', count: 150 },
        { label: 'Business', count: 20 },
        { label: 'Design', count: 120 },
        { label: 'Marketing', count: 60 },
        { label: 'Music', count: 45 },
        { label: 'Photography', count: 20 },
    ];

    const courses = [
        {
            id: 1,
            title: "Full Web Development Bootcamp 2025",
            category: "Digital Skills Mastery",
            lessons: 85,
            duration: "45h 30m",
            rating: 4.8,
            price: 49.99,
            oldPrice: 99.99,
            image: "/images/hero-student.png", // placeholder
            bgColor: "bg-[#F87A53]"
        },
        {
            id: 2,
            title: "Complete UX/UI Design Masterclass",
            category: "Graphic Design Basics",
            lessons: 64,
            duration: "28h 15m",
            rating: 4.5,
            price: 39.99,
            oldPrice: null,
            image: "/images/idea-icon.png", // placeholder
            bgColor: "bg-[#FFC224]"
        },
        {
            id: 3,
            title: "Data Science with Python",
            category: "Digital Skills Mastery",
            lessons: 92,
            duration: "50h 00m",
            rating: 4.8,
            price: 59.99,
            oldPrice: 89.99,
            image: "/images/hero-student.png", // placeholder
            bgColor: "bg-[#F87A53]"
        },
        {
            id: 4,
            title: "Digital Marketing Strategy 2025",
            category: "Strategic Planning Fundamentals",
            lessons: 30,
            duration: "12h 45m",
            rating: 4.6,
            price: 29.99,
            oldPrice: null,
            image: "/images/hero-student.png", // placeholder
            bgColor: "bg-[#F87A53]"
        },
        {
            id: 5,
            title: "Photography Masterclass: A Complete Guide",
            category: "Graphic Design Basics",
            lessons: 120,
            duration: "22h 00m",
            rating: 4.9,
            price: 89.99,
            oldPrice: 120.00,
            image: "/images/idea-icon.png", // placeholder
            bgColor: "bg-[#FFC224]"
        },
        {
            id: 6,
            title: "Advanced React & TypeScript",
            category: "Digital Skills Mastery",
            lessons: 78,
            duration: "55h 20m",
            rating: 4.8,
            price: 69.99,
            oldPrice: 129.99,
            image: "/images/hero-student.png", // placeholder
            bgColor: "bg-[#F87A53]"
        },
    ];

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-[#f8f9ff] text-[#052143] flex flex-col">
            <Header />

            {/* Hero Section */}
            <div className="relative w-full h-[220px] sm:h-[250px] xl:h-[280px] bg-[#fdf5f9] flex items-center overflow-hidden border-b border-[#F2F4FF]">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#F87A53 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(248, 122, 83, 0.2))' }}></div>

                {/* Decorative Elements */}
                <div className="absolute right-[5%] bottom-[10%] opacity-80">
                    <span className="text-3xl filter brightness-110">🌸</span>
                </div>
                <div className="absolute right-[15%] top-[10%] opacity-50">
                    <span className="text-2xl filter blur-[1px]">🌸</span>
                </div>

                <FadeIn direction="up" className="w-full max-w-[1290px] mx-auto px-4 sm:px-6 relative z-10">
                    <h1 className="text-[#052143] font-bold text-[40px] sm:text-[48px] xl:text-[56px] leading-[1.2] mb-3">Courses</h1>
                    <div className="flex items-center gap-2 text-[#6B778B] text-[15px]">
                        <Link href="/" className="hover:text-[#687EFF] transition-colors">Home</Link>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                        <span className="text-[#687EFF] font-medium">Courses</span>
                    </div>
                </FadeIn>

                {/* Left side vertical text banner */}
                <div className="absolute left-0 top-0 hidden h-full w-[40px] bg-[#687EFF] items-center justify-center xl:flex">
                    <div className="transform -rotate-90 whitespace-nowrap text-white/70 text-[10px] tracking-[4px] font-semibold uppercase">
                        facebook // instagram // linkedin // twitter
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-[1290px] mx-auto px-4 sm:px-6 py-10 sm:py-14 xl:py-16 flex flex-col xl:flex-row gap-8 xl:gap-12 relative z-10">

                {/* Sidebar Filters */}
                <FadeIn direction="right" className="w-full xl:w-[280px] shrink-0 flex flex-col gap-8">
                    {/* Search */}
                    <div className="bg-[#fdfdfd] border border-[#eaedf5] rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                        <h3 className="font-bold text-[#052143] text-[18px] mb-4 relative pb-2 inline-block">
                            Search
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#687EFF] rounded-full"></div>
                        </h3>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search courses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#f6f8fb] border border-[#eaedf5] rounded-lg px-4 py-3 pb-[11px] text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors"
                            />
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA5B7] hover:text-[#687EFF]">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </button>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="bg-[#fdfdfd] border border-[#eaedf5] rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                        <h3 className="font-bold text-[#052143] text-[18px] mb-5 relative pb-2 inline-block">
                            Categories
                            <div className="absolute bottom-0 left-0 w-[50%] h-[2px] bg-[#687EFF] rounded-full"></div>
                        </h3>
                        <div className="flex flex-col gap-3">
                            {categories.map((cat, i) => (
                                <label key={i} className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 border border-[#cfd6e4] rounded flex flex-col items-center justify-center group-hover:border-[#687EFF] transition-colors"></div>
                                        <span className="text-[#6B778B] text-[15px] group-hover:text-[#052143] transition-colors">{cat.label}</span>
                                    </div>
                                    <span className="text-[#9BA5B7] text-[13px] bg-[#f6f8fb] px-2 py-0.5 rounded-md">{cat.count}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Price Filter */}
                    <div className="bg-[#fdfdfd] border border-[#eaedf5] rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                        <h3 className="font-bold text-[#052143] text-[18px] mb-5 relative pb-2 inline-block">
                            Price Filter
                            <div className="absolute bottom-0 left-0 w-[50%] h-[2px] bg-[#687EFF] rounded-full"></div>
                        </h3>
                        <div className="pt-2 pb-6">
                            <div className="w-full h-[6px] bg-[#eef0f7] rounded-full relative">
                                <div className="absolute left-0 top-0 h-full w-[100%] bg-[#687EFF] rounded-full"></div>
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#687EFF] rounded-full shadow-sm"></div>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#687EFF] rounded-full shadow-sm"></div>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-[#052143] font-semibold text-[14px] bg-[#f6f8fb] px-3 py-1 rounded-md">$0</span>
                                <span className="text-[#052143] font-semibold text-[14px] bg-[#f6f8fb] px-3 py-1 rounded-md">$100</span>
                            </div>
                        </div>
                    </div>

                    {/* Ratings */}
                    <div className="bg-[#fdfdfd] border border-[#eaedf5] rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                        <h3 className="font-bold text-[#052143] text-[18px] mb-5 relative pb-2 inline-block">
                            Ratings
                            <div className="absolute bottom-0 left-0 w-[50%] h-[2px] bg-[#687EFF] rounded-full"></div>
                        </h3>
                        <div className="flex flex-col gap-3">
                            {['5 Stars', '4 Stars & Up', '3 Stars & Up'].map((rating, i) => (
                                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                                    <div className="w-4 h-4 border border-[#cfd6e4] rounded flex items-center justify-center group-hover:border-[#687EFF] transition-colors"></div>
                                    <span className="text-[#6B778B] text-[15px] group-hover:text-[#052143] transition-colors">{rating}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Level */}
                    <div className="bg-[#fdfdfd] border border-[#eaedf5] rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                        <h3 className="font-bold text-[#052143] text-[18px] mb-5 relative pb-2 inline-block">
                            Level
                            <div className="absolute bottom-0 left-0 w-[50%] h-[2px] bg-[#687EFF] rounded-full"></div>
                        </h3>
                        <div className="flex flex-col gap-3">
                            {['All Levels', 'Beginner', 'Intermediate', 'Expert'].map((level, i) => (
                                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                                    <div className="w-4 h-4 border border-[#cfd6e4] rounded flex items-center justify-center group-hover:border-[#687EFF] transition-colors"></div>
                                    <span className="text-[#6B778B] text-[15px] group-hover:text-[#052143] transition-colors">{level}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 flex justify-center">
                        <button className="text-[#6B778B] text-[14px] font-medium hover:text-[#052143]">
                            Reset Filters
                        </button>
                    </div>
                </FadeIn>

                {/* Main Content Area */}
                <FadeIn direction="left" delay={120} className="flex-1 flex flex-col gap-8">
                    {/* Top Bar Options */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4">
                        <p className="text-[#052143] font-medium text-[15px]">Showing 1-6 of 20 Results</p>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[#052143] text-[14px] font-semibold mr-1">Sort by:</span>
                                <div className="relative">
                                    <select className="appearance-none bg-transparent text-[#6B778B] text-[14px] outline-none cursor-pointer pr-5 font-medium">
                                        <option>Latest Release</option>
                                        <option>Most Popular</option>
                                    </select>
                                    <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B778B] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button className="w-8 h-8 rounded-md bg-[#687EFF] text-white flex items-center justify-center">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                </button>
                                <button className="w-8 h-8 rounded-md bg-white border border-[#cfd6e4] text-[#9BA5B7] hover:border-[#687EFF] hover:text-[#687EFF] flex items-center justify-center">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Course Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {courses.map((course) => (
                            <div key={course.id} className="bg-white rounded-[20px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#eaedf5] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-300 group flex flex-col items-center">

                                {/* Top Image Area */}
                                <div className={`relative h-[180px] w-full ${course.bgColor} flex items-center justify-center overflow-hidden`}>
                                    {/* Mock graphic for public cards */}
                                    <div className="w-[120px] h-[90px] bg-white rounded-md shadow-md flex flex-col overflow-hidden relative z-10">
                                        <div className="h-3 bg-gray-200 border-b border-gray-100 flex items-center px-1.5 gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                        </div>
                                        <div className="flex-1 bg-white p-2">
                                            <div className="w-full h-2 bg-gray-100 mb-1 rounded"></div>
                                            <div className="w-3/4 h-2 bg-gray-100 mb-2 rounded"></div>
                                            <div className="flex gap-1 mt-auto h-8">
                                                <div className="w-1/2 bg-blue-50 rounded-sm"></div>
                                                <div className="w-1/2 bg-blue-50 rounded-sm"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <svg className="absolute bottom-0 left-0 w-full opacity-50" viewBox="0 0 1440 320" preserveAspectRatio="none"><path fill="#ffffff" fillOpacity="0.3" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,149.3C672,149,768,203,864,224C960,245,1056,235,1152,213.3C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex flex-col flex-1 w-full relative">
                                    <div className="flex items-start justify-between text-[11px] font-medium text-[#6B778B] mb-3">
                                        <span className="text-[#F87A53] w-[35%] tracking-wide leading-[130%]">{course.category}</span>
                                        <div className="flex flex-col gap-1 w-[30%]">
                                            <div className="flex items-center gap-1 opacity-80">
                                                <svg className="w-3.5 h-3.5 text-[#687EFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                                <span>{course.lessons} <br />Lessons</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 w-[30%]">
                                            <div className="flex items-center gap-1 opacity-80">
                                                <svg className="w-3.5 h-3.5 text-[#6B778B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                <span>{course.duration.split(' ')[0]} <br />{course.duration.split(' ')[1]}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-[16px] text-[#052143] leading-[140%] mb-4 hover:text-[#687EFF] cursor-pointer transition-colors h-[44px] line-clamp-2">{course.title}</h3>

                                    {/* Rating & Heart */}
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5 text-[#FFC224] -mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                            <span className="text-[#052143] font-bold text-[12px]">({course.rating} Reviews)</span>
                                        </div>
                                        <button className="w-[30px] h-[30px] rounded-full border border-[#D1E3FB] flex items-center justify-center text-[#687EFF] hover:bg-[#687EFF] hover:text-white transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                        </button>
                                    </div>

                                    {/* Action & Price */}
                                    <div className="flex items-center justify-between mt-auto">
                                        <button className="bg-[#687EFF] text-white px-5 py-[9px] rounded-full font-medium text-[13px] hover:bg-[#5a6ee6] transition-colors shadow-sm tracking-wide">
                                            View Details
                                        </button>
                                        <div className="flex items-end gap-1.5">
                                            <span className="text-[#F87A53] font-bold text-[18px] leading-none">${course.price}</span>
                                            {course.oldPrice && (
                                                <span className="text-[#9BA5B7] text-[12px] line-through font-normal leading-none mb-0.5">${course.oldPrice}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-center gap-2 mt-8">
                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#9BA5B7] bg-[#fdfdfd] border border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:text-[#687EFF] transition-colors">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                        {[1, 2, 3, 4].map(p => (
                            <button
                                key={p}
                                onClick={() => setCurrentPage(p)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] transition-all shadow-sm ${currentPage === p
                                    ? 'bg-[#687EFF] text-white shadow-[#687EFF]/30'
                                    : 'bg-white border text-[#052143] hover:border-[#687EFF] hover:text-[#687EFF]'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#9BA5B7] bg-[#fdfdfd] border border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:text-[#687EFF] transition-colors">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                    </div>

                </FadeIn>
            </main>

            <PublicFooter className="mt-auto" />
            <HomeFloatingChatbot />
        </div>
    );
}


