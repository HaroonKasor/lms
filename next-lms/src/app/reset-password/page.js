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
        <div className="min-h-screen w-full flex font-['Outfit',sans-serif] overflow-hidden">
            <div className="hidden lg:flex w-1/2 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #3C59FC 0%, #687EFF 100%)' }}>
                <div className="absolute w-[900px] h-[120px] bg-white/10 -rotate-45 -top-10 -left-40"></div>
                <div className="absolute w-[1800px] h-[120px] bg-white/10 -rotate-45 top-20 left-40"></div>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '22px 22px' }}></div>
                <div className="absolute -left-20 bottom-20 w-[400px] h-[400px] bg-white/[0.08] rotate-45"></div>
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

