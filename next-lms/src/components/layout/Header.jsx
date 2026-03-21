'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();
    const isActive = (path) => pathname === path;

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
                        <Link href="/" className={`font-normal text-[18px] leading-[150%] transition-colors ${isActive('/') ? 'text-[#F87A53]' : 'text-[#052143] hover:text-[#F87A53]'}`}>Home</Link>
                        <Link href="/products" className={`font-normal text-[18px] leading-[150%] flex items-center gap-1 transition-colors ${isActive('/products') ? 'text-[#F87A53]' : 'text-[#052143] hover:text-[#F87A53]'}`}>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill={isActive('/products') ? '#F87A53' : 'currentColor'} stroke={isActive('/products') ? '#F87A53' : 'currentColor'}><path d="M6 0v12M0 6h12" strokeWidth="2" /></svg>
                            Products
                        </Link>
                        <Link href="/home-courses" className={`font-normal text-[18px] leading-[150%] flex items-center gap-1 transition-colors ${isActive('/home-courses') ? 'text-[#F87A53]' : 'text-[#052143] hover:text-[#F87A53]'}`}>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill={isActive('/home-courses') ? '#F87A53' : 'currentColor'} stroke={isActive('/home-courses') ? '#F87A53' : 'currentColor'}><path d="M6 0v12M0 6h12" strokeWidth="2" /></svg>
                            Courses
                        </Link>
                        <Link href="/about" className={`font-normal text-[18px] leading-[150%] transition-colors ${isActive('/about') ? 'text-[#F87A53]' : 'text-[#052143] hover:text-[#F87A53]'}`}>About Us</Link>
                        <Link href="/contact" className={`font-normal text-[18px] leading-[150%] transition-colors ${isActive('/contact') ? 'text-[#F87A53]' : 'text-[#052143] hover:text-[#F87A53]'}`}>Contact</Link>
                    </nav>

                    {/* Search & Sign In */}
                    <div className="hidden lg:flex items-center gap-5">
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
        </>
    );
}




