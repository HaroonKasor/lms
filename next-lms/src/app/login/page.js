'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { saveUser, getRememberMePreference, setRememberMePreference } from '@/lib/auth';

export default function Login() {
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        setRememberMe(getRememberMePreference(false));
    }, []);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('timeout') === '1') {
            setError('Session หมดเวลาเพราะไม่มีการใช้งาน กรุณาเข้าสู่ระบบใหม่');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!username || !password) {
            setError('กรุณากรอก Username และ Password');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, rememberMe }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                saveUser(data.user, { remember: rememberMe });
                setRememberMePreference(rememberMe);
                // Admin goes to admin dashboard, user goes to learner dashboard
                const nextPath = typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('next')
                    : null;
                const defaultPath = data.user.role === 'admin' ? '/admin-dashboard' : '/dashboard';
                // Force full-page navigation so Safari reliably commits auth cookie
                // before hitting protected routes like /enroll/qr.
                if (typeof window !== 'undefined') {
                    window.location.assign(nextPath || defaultPath);
                    return;
                }
            } else {
                setError(data.error || 'Login failed');
            }
        } catch {
            setError('Connection error');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen w-full flex font-['Outfit',sans-serif] overflow-hidden">

            {/* Left Side - Blue Gradient with Logo */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #3C59FC 0%, #687EFF 100%)' }}>
                <div className="absolute w-[900px] h-[120px] bg-white/10 -rotate-45 -top-10 -left-40"></div>
                <div className="absolute w-[1800px] h-[120px] bg-white/10 -rotate-45 top-20 left-40"></div>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '22px 22px' }}></div>
                <div className="absolute -left-20 bottom-20 w-[400px] h-[400px] bg-white/[0.08] rotate-45"></div>
                <div className="w-full relative z-10"></div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-[#ECEEFF] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(135deg, rgba(104,126,255,0.10) 0%, rgba(255,255,255,0) 60%)' }}></div>
                <div className="absolute -left-20 bottom-1/3 w-[300px] h-[400px] bg-[#FFA7C3] blur-[200px] opacity-30"></div>

                <div className="w-full max-w-[497px] px-8 relative z-10">
                    <h1 className="text-[40px] font-semibold text-[#052143] mb-8 capitalize leading-[150%]">Sign In</h1>

                    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm">
                                {error}
                            </div>
                        )}

                        {/* Username Field */}
                        <div className="flex flex-col gap-4">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">Username</label>
                            <input type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]" />
                        </div>

                        {/* Password Field */}
                        <div className="flex flex-col gap-4">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">Password</label>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} placeholder="Enter Password" value={password} onChange={(e) => setPassword(e.target.value)}
                                    className="password-input w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] pr-14 text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[#6B778B] hover:text-[#052143] transition-colors">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={showPassword ? '#687EFF' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forget password */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="sr-only"
                                />
                                <span className={`w-[18px] h-[18px] rounded-[6px] border-2 border-[#687EFF] flex items-center justify-center transition-colors ${rememberMe ? 'bg-[#687EFF]' : 'bg-transparent'}`}>
                                    {rememberMe && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </span>
                                <span className="text-[#6B778B] text-[16px] font-normal leading-[130%]">Remember Me</span>
                            </label>
                            <Link href="/forgot-password" className="text-[#687EFF] text-[16px] font-normal leading-[130%] hover:underline transition-colors">Forget password?</Link>
                        </div>

                        {/* Sign In Button */}
                        <button type="submit" disabled={loading}
                            className="w-full h-[47px] flex items-center justify-center rounded-full text-white font-medium text-[18px] leading-[130%] transition-all hover:opacity-90 relative overflow-hidden disabled:opacity-50"
                            style={{ background: '#F87A53' }}>
                            <span className="relative z-10">{loading ? 'Signing in...' : 'Sign in'}</span>
                            <div className="absolute right-[6px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] bg-white/30 rounded-full"></div>
                        </button>
                    </form>

                    <div className="flex items-center justify-center gap-1 mt-6">
                        <span className="text-[#6B778B] text-[16px] font-normal leading-[130%]">Don&apos;t have an account?</span>
                        <Link href="/register" className="text-[#687EFF] font-medium text-[16px] leading-[130%] hover:underline transition-colors">Sign up</Link>
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


