'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
    const params = useSearchParams();
    const token = useMemo(() => String(params?.get('token') || '').trim(), [params]);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!token) {
            setError('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง');
            return;
        }
        if (!password || password.length < 8) {
            setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
            return;
        }
        if (password !== confirmPassword) {
            setError('ยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password, confirmPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
                return;
            }
            setSuccess('ตั้งรหัสผ่านใหม่สำเร็จแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
            setPassword('');
            setConfirmPassword('');
        } catch {
            setError('ไม่สามารถรีเซ็ตรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex font-['Outfit',sans-serif] overflow-hidden relative">
            {/* Back to Home Button */}
            <Link href="/" className="absolute top-6 left-6 sm:top-8 sm:left-8 z-50 flex items-center justify-center gap-2 bg-white hover:bg-[#F5F7FF] text-[#687EFF] px-5 py-2.5 rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
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

            <div className="w-full lg:w-1/2 flex items-center justify-center bg-[#ECEEFF] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(135deg, rgba(104,126,255,0.10) 0%, rgba(255,255,255,0) 60%)' }}></div>
                <div className="absolute -left-20 bottom-1/3 w-[300px] h-[400px] bg-[#FFA7C3] blur-[200px] opacity-30"></div>

                <div className="w-full max-w-[497px] px-8 relative z-10">
                    <h1 className="text-[40px] font-semibold text-[#052143] mb-2 capitalize leading-[150%]">Reset Password</h1>
                    <p className="text-[#6B778B] text-[16px] mb-8">Set your new password.</p>

                    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-2xl text-sm">
                                {success}
                            </div>
                        )}

                        <div className="flex flex-col gap-4">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">New Password</label>
                            <input
                                type="password"
                                placeholder="Enter new password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]"
                            />
                        </div>

                        <div className="flex flex-col gap-4">
                            <label className="text-[#052143] font-medium text-xl leading-[120%]">Confirm Password</label>
                            <input
                                type="password"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full h-[50px] bg-white border border-[#D1E3FB] rounded-full px-[22px] py-[6px] text-[16px] text-[#052143] outline-none focus:border-[#687EFF] transition-colors placeholder:text-[#6B778B]"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-[47px] flex items-center justify-center rounded-full text-white font-medium text-[18px] leading-[130%] transition-all hover:opacity-90 relative overflow-hidden disabled:opacity-50"
                            style={{ background: '#F87A53' }}
                        >
                            <span className="relative z-10">{loading ? 'Resetting...' : 'Reset Password'}</span>
                            <div className="absolute right-[6px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] bg-white/30 rounded-full"></div>
                        </button>
                    </form>

                    <div className="flex items-center justify-center gap-1 mt-6">
                        <span className="text-[#6B778B] text-[16px] font-normal leading-[130%]">Back to</span>
                        <Link href="/login" className="text-[#687EFF] font-medium text-[16px] leading-[130%] hover:underline transition-colors">Sign in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
