'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();
    const [mobileOpenForPath, setMobileOpenForPath] = useState('');
    const mobileOpen = mobileOpenForPath === pathname;
    const isActive = (path) => pathname === path;
    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/products', label: 'Products', plus: true },
        { href: '/home-courses', label: 'Courses', plus: true },
        { href: '/about', label: 'About Us' },
        { href: '/contact', label: 'Contact' },
    ];

    const closeMobileMenu = () => setMobileOpenForPath('');
    const toggleMobileMenu = () => {
        setMobileOpenForPath((value) => (value === pathname ? '' : pathname));
    };

    return (
        <header className="sticky top-0 z-40 w-full border-b border-dashed border-[#CDD0CE] bg-white/90 backdrop-blur-sm">
            <div className="mx-auto flex h-[72px] w-full max-w-[1290px] items-center justify-between px-4 sm:h-[80px] sm:px-6">
                <Link href="/" className="shrink-0">
                    <img src="/skillup_logo.png" alt="SkillUp" className="h-[44px] w-[44px] object-contain sm:h-[48px] sm:w-[48px]" />
                </Link>

                <nav className="hidden items-center gap-6 lg:flex">
                    {navLinks.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`font-normal text-[18px] leading-[150%] transition-colors ${isActive(item.href) ? 'text-[#F87A53]' : 'text-[#052143] hover:text-[#F87A53]'}`}
                        >
                            <span className="inline-flex items-center gap-1">
                                {item.plus ? (
                                    <svg width="10" height="10" viewBox="0 0 12 12" fill={isActive(item.href) ? '#F87A53' : 'currentColor'} stroke={isActive(item.href) ? '#F87A53' : 'currentColor'}>
                                        <path d="M6 0v12M0 6h12" strokeWidth="2" />
                                    </svg>
                                ) : null}
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>

                <div className="hidden items-center gap-5 lg:flex">
                    <div className="flex h-[48px] w-[305px] items-center rounded-full border-[3px] border-[#D1E3FB] bg-white py-[6px] pl-5 pr-[6px]">
                        <input
                            type="text"
                            placeholder="LMS"
                            className="flex-1 bg-transparent text-[16px] font-normal leading-[100%] text-[#052143] placeholder:text-[#6B778B] outline-none"
                        />
                        <button className="relative flex h-[36px] items-center gap-[6px] overflow-hidden rounded-full bg-[#F87A53] px-3 text-[16px] font-normal text-white">
                            <span className="relative z-10">Search</span>
                            <svg className="relative z-10" width="12" height="12" viewBox="0 0 24 24" fill="white">
                                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                            </svg>
                            <div className="absolute right-[8px] top-1/2 h-[24px] w-[24px] -translate-y-1/2 rounded-full bg-white/20"></div>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/login" aria-label="Sign in" className="group relative flex h-[40px] w-[40px] items-center justify-center overflow-hidden rounded-full border border-[#052143] transition-colors hover:border-[#F87A53]">
                            <svg className="relative z-10 transition-colors group-hover:fill-[#F87A53]" width="15" height="12" viewBox="0 0 24 24" fill="#052143">
                                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                            <div className="absolute bottom-[-4px] right-[-4px] h-[24px] w-[24px] rounded-full bg-[#F87A53]"></div>
                        </Link>
                        <div className="flex flex-col">
                            <Link href="/login" className="text-[18px] font-medium leading-[100%] text-[#052143] transition-colors hover:text-[#F87A53]">Sign in</Link>
                            <Link href="/register" className="text-[14px] font-normal leading-[100%] text-[#6B778B] transition-colors hover:text-[#F87A53]">Register</Link>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 lg:hidden">
                    <Link
                        href="/login"
                        className="rounded-full border border-[#D1E3FB] px-3 py-2 text-[13px] font-medium text-[#052143] hover:border-[#687EFF] hover:text-[#687EFF]"
                    >
                        Sign in
                    </Link>
                    <button
                        type="button"
                        onClick={toggleMobileMenu}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D1E3FB] text-[#052143] hover:border-[#687EFF] hover:text-[#687EFF]"
                        aria-label="Toggle menu"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            {mobileOpen ? (
                <div className="border-t border-[#E8EEFF] bg-white px-4 pb-4 pt-3 lg:hidden">
                    <div className="mb-3 flex items-center gap-2 rounded-full border-[2px] border-[#D1E3FB] bg-white px-3 py-2">
                        <input
                            type="text"
                            placeholder="Search courses"
                            className="w-full bg-transparent text-[14px] text-[#052143] placeholder:text-[#6B778B] outline-none"
                        />
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B778B" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </div>
                    <nav className="grid gap-1">
                        {navLinks.map((item) => (
                            <Link
                                key={`mobile-${item.href}`}
                                href={item.href}
                                onClick={closeMobileMenu}
                                className={`rounded-xl px-3 py-2 text-[15px] font-medium transition-colors ${
                                    isActive(item.href)
                                        ? 'bg-[#EEF2FF] text-[#687EFF]'
                                        : 'text-[#052143] hover:bg-[#F8FAFF]'
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <Link
                            href="/login"
                            onClick={closeMobileMenu}
                            className="inline-flex items-center justify-center rounded-xl border border-[#D1E3FB] px-3 py-2 text-[14px] font-medium text-[#052143]"
                        >
                            Log in
                        </Link>
                        <Link
                            href="/register"
                            onClick={closeMobileMenu}
                            className="inline-flex items-center justify-center rounded-xl bg-[#687EFF] px-3 py-2 text-[14px] font-semibold text-white"
                        >
                            Register
                        </Link>
                    </div>
                </div>
            ) : null}
        </header>
    );
}
