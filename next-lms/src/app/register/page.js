'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearUser, setRememberMePreference } from '@/lib/auth';
import { sanitizeRegisterInput, validateRegisterInput } from '@/lib/validation/register';

export default function Register() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const payload = sanitizeRegisterInput({
            username,
            email,
            password,
            fullName,
            phone,
        });
        const validation = validateRegisterInput(payload);
        if (!validation.valid) {
            setError(validation.error);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                clearUser();
                setRememberMePreference(false);
                router.push(`/login?registered=1&username=${encodeURIComponent(payload.username)}`);
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch {
            setError('Connection error');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen w-full flex font-['Outfit',sans-serif] overflow-hidden relative">

            {/* Back to Home Button */}
            <Link href="/" className="absolute top-6 left-6 sm:top-8 sm:left-8 z-50 flex items-center justify-center gap-2 bg-white hover:bg-[#F5F7FF] text-[#687EFF] px-5 py-2.5 rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                <span className="font-bold text-[15px]">Home</span>
            </Link>

            {/* Left Side - Blue Gradient with Logo and Character */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #1279F2 0%, #0D69D5 100%)' }}>
                <div className="absolute w-[1200px] h-[150px] bg-white/[0.06] -rotate-[12deg] -top-10 -left-10"></div>
                <div className="absolute w-[1800px] h-[250px] bg-white/[0.04] -rotate-[12deg] top-[25%] -left-10"></div>
                <div className="absolute w-[1500px] h-[200px] bg-white/[0.05] -rotate-[12deg] bottom-[15%] -left-10"></div>
                
                {/* Faint Logo */}
                <div className="absolute top-[45%] left-[20%] w-[420px] opacity-[0.12] z-10 pointer-events-none">
                    <img src="/skillup_logo.png" alt="SkillUp Logo" className="w-full h-auto object-contain brightness-0 invert" />
                </div>

                {/* Character Image */}
                <div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-center z-20 pointer-events-none">
                    <img src="/Studen_01.png" alt="Student" className="max-h-[85%] w-auto object-contain" />
                </div>
            </div>

            {/* Right Side - Register Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-[#ECEEFF] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(135deg, rgba(104,126,255,0.10) 0%, rgba(255,255,255,0) 60%)' }}></div>
                <div className="absolute -left-20 bottom-1/3 w-[300px] h-[400px] bg-[#FFA7C3] blur-[200px] opacity-30"></div>

                <div className="w-full max-w-[497px] px-8 relative z-10">
                    <h1 className="text-[40px] font-semibold text-[#052143] mb-8 capitalize leading-[150%]">Sign Up</h1>

                    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm">
                                {error}
                            </div>
                        )}

                        {/* Full Name */}
                        <div className="flex flex-col gap-3">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">Full Name</label>
                            <input type="text" placeholder="Enter your full name" value={fullName} onChange={(e) => setFullName(e.target.value)}
                                className="w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]" />
                        </div>

                        {/* Username */}
                        <div className="flex flex-col gap-3">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">Username</label>
                            <input
                                type="text"
                                placeholder="Choose a username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                minLength={3}
                                maxLength={30}
                                pattern="[A-Za-z0-9._-]{3,30}"
                                title="3-30 characters: letters, numbers, ., _, -"
                                className="w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]" />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-3">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">Email</label>
                            <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                className="w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]" />
                        </div>

                        {/* Phone */}
                        <div className="flex flex-col gap-3">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">Phone Number</label>
                            <input
                                type="tel"
                                placeholder="Enter your phone number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                maxLength={20}
                                pattern="[0-9]{8,20}"
                                title="Use digits only (8-20 digits)"
                                inputMode="numeric"
                                className="w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]" />
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-3">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">Password</label>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} placeholder="Enter Password" value={password} onChange={(e) => setPassword(e.target.value)}
                                    required minLength={8} maxLength={72}
                                    className="password-input w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] pr-14 text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]" />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[#6B778B] hover:text-[#052143] transition-colors"
                                >
                                    {showPassword ? (
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#687EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94C16.18 19.16 14.16 20 12 20c-6.5 0-10-6-10-6 1.06-1.82 2.46-3.42 4.09-4.67" />
                                            <path d="M9.9 4.24A10.7 10.7 0 0 1 12 4c6.5 0 10 6 10 6a16.9 16.9 0 0 1-2.16 2.89" />
                                            <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
                                            <path d="M2 2l20 20" />
                                        </svg>
                                    ) : (
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <p className="text-[12px] text-[#6B778B] leading-[130%]">
                                Use 8-72 characters with letters and numbers, and no spaces.
                            </p>
                        </div>

                        {/* Sign Up Button */}
                        <button type="submit" disabled={loading}
                            className="w-full h-[47px] flex items-center justify-center rounded-full text-white font-medium text-[18px] leading-[130%] transition-all hover:opacity-90 relative overflow-hidden mt-2 disabled:opacity-50"
                            style={{ background: '#F87A53' }}>
                            <span className="relative z-10">{loading ? 'Creating account...' : 'Sign Up'}</span>
                            <div className="absolute right-[6px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] bg-white/30 rounded-full"></div>
                        </button>
                    </form>

                    <div className="flex items-center justify-center gap-1 mt-6">
                        <span className="text-[#6B778B] text-[16px] font-normal leading-[130%]">Already have an account?</span>
                        <Link href="/login" className="text-[#687EFF] font-medium text-[16px] leading-[130%] hover:underline transition-colors">Sign In</Link>
                    </div>
                </div>
            </div>
            <style jsx global>{`
                .password-input::-ms-reveal,
                .password-input::-ms-clear,
                .password-input::-webkit-credentials-auto-fill-button,
                .password-input::-webkit-contacts-auto-fill-button {
                    display: none !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
            `}</style>
        </div>
    );
}


