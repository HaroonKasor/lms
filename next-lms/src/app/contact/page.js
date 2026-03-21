'use client';

import React from 'react';
import Link from 'next/link';
import FadeIn from '@/components/ui/FadeIn';
import PublicFooter from '@/components/layout/PublicFooter';

function ContactHeader() {
    return (
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
                        <Link href="/about" className="text-[#052143] font-normal text-[18px] leading-[150%] hover:text-[#F87A53] transition-colors">About Us</Link>
                        <Link href="/contact" className="text-[#F87A53] font-normal text-[18px] leading-[150%] hover:text-[#F87A53] transition-colors">Contact</Link>
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
}

export default function ContactPage() {
    const officeMap = {
        label: 'SkillUp Office',
        address: 'Bangkok, Thailand',
        embedUrl: 'https://www.google.com/maps?q=13.7563,100.5018&z=15&output=embed',
        openUrl: 'https://www.google.com/maps?q=13.7563,100.5018',
    };

    const contactInfo = [
        {
            icon: "🏠", // Placeholder for address icon
            title: "Our Address",
            details: ["3149 New Creek Road,", "Huntsville,", "Alabama, USA"]
        },
        {
            icon: "📱", // Placeholder for phone icon
            title: "Contact Number",
            details: ["+12001234567", "+9100012345896"]
        },
        {
            icon: "✉️", // Placeholder for email icon
            title: "Email Address",
            details: ["info@domain.com", "support@domain.com"]
        },
        {
            icon: "⏰", // Placeholder for schedule icon
            title: "Class Schedule",
            details: ["10:00 AM - 6:00 PM", "Monday - Friday"]
        }
    ];

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-[#f8f9ff] text-[#052143] flex flex-col">
            <ContactHeader />

            {/* Hero Section */}
            <div className="relative w-full h-[280px] lg:h-[360px] bg-[#f8f6ff] flex flex-col justify-center pb-20 lg:pb-28 overflow-hidden border-b border-[#F2F4FF]">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#687EFF 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(104, 126, 255, 0.2))' }}></div>

                {/* Decorative Elements */}
                <div className="absolute right-[5%] bottom-[10%] opacity-80">
                    <span className="text-3xl filter brightness-110">🌸</span>
                </div>

                <FadeIn direction="up" className="w-full max-w-[1290px] mx-auto px-6 relative z-10">
                    <h1 className="text-[#052143] font-bold text-[48px] lg:text-[56px] leading-[1.2] mb-3">Contact Us</h1>
                    <div className="flex items-center gap-2 text-[#6B778B] text-[15px]">
                        <Link href="/" className="hover:text-[#687EFF] transition-colors">Home</Link>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                        <span className="text-[#687EFF] font-medium">Contact</span>
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
            <main className="flex-1 w-full max-w-[1290px] mx-auto px-6 py-16 flex flex-col gap-16 relative z-10">

                {/* Contact Info Cards Grid */}
                <FadeIn direction="up" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-2">
                    {contactInfo.map((info, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-8 flex flex-col items-center text-center shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-[#eaedf5] hover:-translate-y-2 transition-transform duration-300">
                            <div className="w-16 h-16 rounded-full bg-[#fdf8dd] border-4 border-[#fffcef] flex items-center justify-center text-2xl mb-6 shadow-sm">
                                {info.icon}
                            </div>
                            <h3 className="text-[#052143] font-bold text-[20px] mb-4">{info.title}</h3>
                            <div className="flex flex-col gap-1 text-[#6B778B] text-[15px] leading-relaxed">
                                {info.details.map((detail, i) => (
                                    <span key={i}>{detail}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </FadeIn>

                {/* Office Map Section */}
                <FadeIn direction="up" delay={80}>
                    <div className="bg-white border border-[#eaedf5] rounded-[24px] p-6 lg:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                            <div>
                                <span className="text-[#F87A53] font-bold text-[12px] uppercase tracking-[0.18em]">GET IN TOUCH</span>
                                <h3 className="text-[#052143] font-bold text-[30px] leading-[1.2] mt-2">
                                    We&apos;re Here to Help and<br />Ready to Hear from You
                                </h3>
                                <p className="text-[#6B778B] text-[15px] mt-2">{officeMap.label} • {officeMap.address}</p>
                            </div>
                            <a
                                href={officeMap.openUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center gap-2 h-[44px] px-5 rounded-full bg-[#687EFF] hover:bg-[#5A6DE6] text-white text-[14px] font-medium transition-colors"
                            >
                                Open in Google Maps
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M7 17L17 7"></path>
                                    <path d="M7 7h10v10"></path>
                                </svg>
                            </a>
                        </div>

                        <div className="w-full h-[340px] lg:h-[420px] rounded-2xl overflow-hidden border border-[#D1E3FB]">
                            <iframe
                                src={officeMap.embedUrl}
                                className="w-full h-full"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="SkillUp office map"
                            />
                        </div>
                    </div>
                </FadeIn>

                {/* Form & Image Section */}
                <FadeIn direction="up" delay={120} className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-stretch bg-transparent pt-8 pb-12">

                    {/* Left side image */}
                    <div className="lg:w-1/2 rounded-[24px] overflow-hidden shadow-lg relative min-h-[400px] bg-slate-200">
                        {/* Course Image Placeholder */}
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/hero-student.png')" }}></div>
                        <div className="absolute inset-0 bg-black/10"></div>

                        {/* Optional text overlaid on image to mimic "Course" text in design */}
                        {/* <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-10">
                            <h2 className="text-[#052143] text-6xl font-black drop-shadow-md">Course</h2>
                        </div> */}
                    </div>

                    {/* Right side form */}
                    <div className="lg:w-1/2 flex flex-col justify-center">
                        <span className="text-[#F87A53] font-bold text-[14px] uppercase tracking-wider mb-4">GET IN TOUCH</span>
                        <h2 className="text-[#052143] text-[40px] font-bold leading-[1.2] mb-8">
                            Our Office
                        </h2>

                        <form className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#052143] font-bold text-[15px]">Full Name <span className="text-[#F87A53]">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="John Doe"
                                        className="w-full bg-[#fdfdfd] border border-[#eaedf5] rounded-lg px-4 py-3 text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#052143] font-bold text-[15px]">Email Address <span className="text-[#F87A53]">*</span></label>
                                    <input
                                        type="email"
                                        placeholder="johndomain.com"
                                        className="w-full bg-[#fdfdfd] border border-[#eaedf5] rounded-lg px-4 py-3 text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[#052143] font-bold text-[15px]">Subject <span className="text-[#F87A53]">*</span></label>
                                <input
                                    type="text"
                                    placeholder="Write about your enquiry"
                                    className="w-full bg-[#fdfdfd] border border-[#eaedf5] rounded-lg px-4 py-3 text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[#052143] font-bold text-[15px]">Message <span className="text-[#F87A53]">*</span></label>
                                <textarea
                                    rows="5"
                                    placeholder="Write Your Message"
                                    className="w-full bg-[#fdfdfd] border border-[#eaedf5] rounded-lg px-4 py-3 text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors resize-none"
                                ></textarea>
                            </div>

                            <button type="button" className="bg-[#F87A53] text-white px-8 py-3.5 rounded-md font-bold text-[15px] self-start flex items-center gap-2 hover:bg-[#e66c45] transition-colors shadow-md shadow-[#F87A53]/20 mt-2">
                                Submit Message
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </button>
                        </form>
                    </div>

                </FadeIn>
            </main>

            <PublicFooter className="mt-auto" />
        </div>
    );
}



