'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';

export default function TestimonialsPage() {
    const testimonials = [
        {
            name: "Sarah Jenkins",
            role: "UX Designer",
            company: "TechFlow",
            image: "1",
            content: "This platform completely changed how I approach my career development. The courses are not just theoretical; they dive deep into practical applications that I use every single day at work.",
            rating: 5,
            color: "border-blue-500/30"
        },
        {
            name: "Marcus Chen",
            role: "Senior Developer",
            company: "StartupInc",
            image: "11",
            content: "The level of detail in the advanced programming modules is unmatched. I've tried other platforms, but the interactive peer-coding feature here is what really solidified my learning.",
            rating: 5,
            color: "border-purple-500/30"
        },
        {
            name: "Elena Rodriguez",
            role: "Marketing Director",
            company: "Growth Co",
            image: "5",
            content: "I enrolled my entire team. The dashboard makes it incredibly easy to track everyone's progress, and the bite-sized lessons perfectly fit into our busy schedules.",
            rating: 4.5,
            color: "border-orange-500/30"
        },
        {
            name: "David Kim",
            role: "Data Analyst",
            company: "FinTech Solutions",
            image: "8",
            content: "Finally, a platform that understands how adults learn. The combination of video, text, and interactive quizzes kept me engaged throughout the entire Data Science track.",
            rating: 5,
            color: "border-emerald-500/30"
        },
        {
            name: "Anita Patel",
            role: "Freelance Writer",
            company: "Self-Employed",
            image: "9",
            content: "The verifiable certificates I earned here directly helped me land three new clients this month. The quality of instruction is world-class.",
            rating: 5,
            color: "border-pink-500/30"
        },
        {
            name: "James Wilson",
            role: "Product Manager",
            company: "Innovate LLC",
            image: "12",
            content: "I love the clean, distraction-free interface. The dark mode is easy on the eyes during late-night study sessions, and the mobile experience is flawless.",
            rating: 4.5,
            color: "border-cyan-500/30"
        }
    ];

    return (
        <div className="min-h-screen bg-zinc-950 font-sans overflow-x-hidden flex flex-col relative text-white selection:bg-orange-500/30">
            <Navbar />

            {/* Background Ambient Glows */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-orange-600/10 blur-[150px] mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/10 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDelay: '3s' }}></div>
            </div>

            <main className="relative flex-1 w-full max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-32 z-10">
                {/* Header */}
                <div className="text-center mb-20 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                        <span className="text-orange-400 font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                            <span className="text-lg">⭐️</span> Over 10,000 Happy Students
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 tracking-tight leading-tight">
                        Don't just take <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">our word</span> for it.
                    </h1>
                    <p className="text-lg text-zinc-400 font-medium">
                        Hear from the thousands of learners who have transformed their careers and leveled up their skills using our platform.
                    </p>
                </div>

                {/* Testimonials Masonry / Grid */}
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                    {testimonials.map((review, idx) => (
                        <div key={idx} className={`break-inside-avoid bg-white/5 backdrop-blur-xl rounded-3xl p-8 border ${review.color} hover:bg-white/10 transition-all duration-300 group shadow-lg hover:shadow-2xl hover:-translate-y-1`}>
                            
                            {/* Rating */}
                            <div className="flex gap-1 mb-6">
                                {[...Array(5)].map((_, i) => (
                                    <svg key={i} className={`w-5 h-5 ${i < Math.floor(review.rating) ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 'text-zinc-700'}`} fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                    </svg>
                                ))}
                            </div>

                            {/* Content */}
                            <p className="text-zinc-300 font-medium leading-relaxed mb-8 text-lg">
                                "{review.content}"
                            </p>

                            {/* Author */}
                            <div className="flex items-center gap-4 mt-auto">
                                <img src={`https://i.pravatar.cc/100?img=${review.image}`} alt={review.name} className="w-12 h-12 rounded-full border-2 border-zinc-700 group-hover:border-white/50 transition-colors shadow-sm object-cover" />
                                <div>
                                    <h4 className="font-bold text-white text-md">{review.name}</h4>
                                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{review.role} · {review.company}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Call to Action */}
                <div className="mt-20 flex justify-center">
                    <Link href="/home-courses" className="px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 text-white rounded-xl font-extrabold justify-center text-lg transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.5)] hover:-translate-y-1 flex items-center gap-3">
                        Join Our Community Today
                    </Link>
                </div>

            </main>
        </div>
    );
}


