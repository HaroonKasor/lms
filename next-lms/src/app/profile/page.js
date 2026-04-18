'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { getRememberMePreference, getUser, saveUser } from '@/lib/auth';

const DEFAULT_AVATAR_URL = '/images/default-avatar.svg';

export default function ProfilePage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState('');
    const fileInputRef = useRef(null);


    const uploadAvatarBlob = useCallback(async (blob) => {
        if (!blob) throw new Error('Invalid avatar image');
        const formData = new FormData();
        const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
        formData.append('file', blob, `avatar.${ext}`);

        const res = await fetch('/api/users/profile/avatar', {
            method: 'POST',
            body: formData,
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.avatar) {
            throw new Error(data?.error || 'Failed to upload avatar');
        }

        setUser((prev) => (prev ? { ...prev, avatar: data.avatar } : prev));
        setAvatarMessage('Profile image updated');

        try {
            const current = getUser();
            if (current) {
                const fallbackRemember = typeof window !== 'undefined'
                    ? Boolean(localStorage.getItem('lms_user'))
                    : false;
                const remember = getRememberMePreference(fallbackRemember);
                saveUser({ ...current, avatar: data.avatar }, { remember });
                window.dispatchEvent(new Event('lms_user_updated'));
            }
        } catch {
            // ignore storage errors
        }
    }, []);


    useEffect(() => {
        const loadProfile = async () => {
            try {
                setLoading(true);
                setError('');

                const currentUser = getUser();
                const res = await fetch('/api/users/profile', {
                    cache: 'no-store',
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to load profile');
                }

                setUser(data);
                try {
                    const fallbackRemember = typeof window !== 'undefined'
                        ? Boolean(localStorage.getItem('lms_user'))
                        : false;
                    const remember = getRememberMePreference(fallbackRemember);
                    saveUser(
                        {
                            ...(currentUser || {}),
                            ...data,
                            id: Number(data?.id || currentUser?.id || 0) || undefined,
                            username: data?.username || currentUser?.username || '',
                            email: data?.email || currentUser?.email || '',
                            fullName: data?.fullName || currentUser?.fullName || '',
                        },
                        { remember }
                    );
                    window.dispatchEvent(new Event('lms_user_updated'));
                } catch {
                    // ignore storage sync errors
                }
            } catch (err) {
                setError(err.message || 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, []);

    const handleChooseAvatar = () => {
        if (uploadingAvatar) return;
        fileInputRef.current?.click();
    };

    const handleAvatarChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setAvatarMessage('');
        if (fileInputRef.current) fileInputRef.current.value = '';

        setUploadingAvatar(true);
        try {
            await uploadAvatarBlob(file);
        } catch (uploadErr) {
            setAvatarMessage(uploadErr?.message || 'Failed to upload avatar');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const profile = useMemo(() => {
        if (!user) {
            return {
                name: '-',
                email: '-',
                role: '-',
                memberSince: '-',
                enrolledCourses: 0,
                completedCourses: 0,
                certificates: 0,
                avatar: '',
            };
        }

        const name = user.fullName?.trim() || user.username || '-';
        const role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '-';
        const memberSince = user.createdAt
            ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : '-';

        return {
            name,
            email: user.email || '-',
            role,
            memberSince,
            enrolledCourses: user.enrolledCourses ?? 0,
            completedCourses: user.completedCourses ?? 0,
            certificates: user.certificates ?? 0,
            avatar: String(user.avatar || '').trim() || DEFAULT_AVATAR_URL,
        };
    }, [user]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#F6F8FF] to-[#F6F8FF] font-['Outfit',sans-serif]">
            <Navbar />

            <main className="w-full max-w-[1200px] mx-auto px-6 pt-10 pb-20">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-[#052143] font-bold text-3xl mb-1">Profile</h1>
                    <p className="text-[#6B778B] text-base">View your account information and learning stats</p>
                </div>

                {/* Main Content - Two Column */}
                <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">

                    {/* Left Column - User Card */}
                    <div className="relative overflow-hidden bg-white border border-[#D1E3FB] rounded-2xl p-8 flex flex-col items-center shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#EEF2FF] via-transparent to-transparent pointer-events-none" />

                        {/* Avatar */}
                        <div className="relative mb-6">
                            <div className="w-[128px] h-[128px] rounded-full flex items-center justify-center overflow-hidden border border-[#D1E3FB] bg-white" style={{ background: 'linear-gradient(135deg, #E8D5E0 0%, #D4B8C8 100%)' }}>
                                <img src={profile.avatar} alt={profile.name} className="block w-full h-full object-cover" />
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                            <button
                                type="button"
                                onClick={handleChooseAvatar}
                                disabled={uploadingAvatar}
                                aria-label="Change profile photo"
                                title={uploadingAvatar ? 'Uploading...' : 'Change profile photo'}
                                className="absolute right-1 bottom-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#687EFF] text-white shadow-[0_16px_30px_rgba(104,126,255,0.32)] border-4 border-white transition hover:-translate-y-0.5 hover:bg-[#5A6DE6] disabled:opacity-60"
                            >
                                {uploadingAvatar ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
                                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.35" />
                                        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Name */}
                        <h2 className="text-[#052143] font-semibold text-xl mb-2">{profile.name}</h2>

                        {/* Role Badge */}
                        <span className="inline-block px-5 py-1.5 bg-[#E8F0FE] text-[#687EFF] text-sm font-medium rounded-full mb-8">
                            {profile.role}
                        </span>

                        {/* Stats */}
                        <div className="w-full flex flex-col gap-0">
                            {/* Enrolled Courses */}
                            <div className="flex items-center justify-between py-4 border-t border-[#F2F2F7]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#E3E7FF] flex items-center justify-center">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#687EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="3" width="20" height="14" rx="2" />
                                            <path d="M8 21h8" />
                                            <path d="M12 17v4" />
                                        </svg>
                                    </div>
                                    <span className="text-[#052143] text-sm font-medium">Enrolled Courses</span>
                                </div>
                                <span className="text-[#052143] font-semibold text-base">{profile.enrolledCourses}</span>
                            </div>

                            {/* Completed Courses */}
                            <div className="flex items-center justify-between py-4 border-t border-[#F2F2F7]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#FFF3E0] flex items-center justify-center">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="8" r="7" />
                                            <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
                                        </svg>
                                    </div>
                                    <span className="text-[#052143] text-sm font-medium">Completed Courses</span>
                                </div>
                                <span className="text-[#052143] font-semibold text-base">{profile.completedCourses}</span>
                            </div>

                            {/* Certificates Earned */}
                            <div className="flex items-center justify-between py-4 border-t border-[#F2F2F7]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#FFE8E8] flex items-center justify-center">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF667A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="8" r="7" />
                                            <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
                                        </svg>
                                    </div>
                                    <span className="text-[#052143] text-sm font-medium">Certificates Earned</span>
                                </div>
                                <span className="text-[#052143] font-semibold text-base">{profile.certificates}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="flex flex-col gap-6">
                        {/* Personal Information */}
                        <div className="bg-white border border-[#D1E3FB] rounded-2xl p-8 relative">
                            {/* Online indicator */}
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                                <div className="w-5 h-5 rounded-full bg-white border-2 border-[#D1E3FB] flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}></div>
                                </div>
                            </div>

                            <h3 className="text-[#052143] font-bold text-xl mb-6">Personal Information</h3>

                            <div className="flex flex-col gap-6">
                                {/* Full Name */}
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#F6F8FF] flex items-center justify-center shrink-0 mt-0.5">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B778B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[#687EFF] text-sm font-medium mb-0.5">Full Name</p>
                                        <p className="text-[#052143] font-semibold text-base">{profile.name}</p>
                                    </div>
                                </div>

                                {/* Email Address */}
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#F6F8FF] flex items-center justify-center shrink-0 mt-0.5">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B778B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="4" width="20" height="16" rx="2" />
                                            <path d="M22 7l-10 7L2 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[#687EFF] text-sm font-medium mb-0.5">Email Address</p>
                                        <p className="text-[#052143] font-semibold text-base">{profile.email}</p>
                                    </div>
                                </div>

                                {/* Member Since */}
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#F6F8FF] flex items-center justify-center shrink-0 mt-0.5">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B778B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" />
                                            <path d="M16 2v4" />
                                            <path d="M8 2v4" />
                                            <path d="M3 10h18" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[#687EFF] text-sm font-medium mb-0.5">Member Since</p>
                                        <p className="text-[#052143] font-semibold text-base">{profile.memberSince}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Account Type */}
                        <div className="bg-white border border-[#D1E3FB] rounded-2xl p-8">
                            <h3 className="text-[#052143] font-bold text-xl mb-4">Account Type</h3>

                            <div className="bg-[#F6F8FF] rounded-xl p-5 flex items-center justify-between">
                                <div>
                                    <p className="text-[#6B778B] text-sm mb-1">Current Plan</p>
                                    <h4 className="text-[#052143] font-bold text-lg mb-1">Student Account</h4>
                                    <p className="text-[#6B778B] text-sm">Access to all courses and learning materials</p>
                                </div>
                                <div className="shrink-0 ml-4">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6B778B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Note Banner */}
                <div className="mt-8 bg-[#F6F8FF] border border-[#D1E3FB] rounded-xl px-6 py-4 flex items-start gap-3">
                    <div className="w-6 h-6 rounded bg-[#687EFF] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">i</span>
                    </div>
                    <div>
                        <p className="text-[#052143] font-semibold text-sm mb-0.5">Note</p>
                        <p className="text-[#6B778B] text-sm">
                            {loading && 'Loading profile... '}
                            {error && <span className="text-red-500">{error}. </span>}
                            {avatarMessage && <span className={avatarMessage.includes('updated') ? 'text-[#10B981]' : 'text-red-500'}>{avatarMessage}. </span>}
                            You can update your profile photo here. Other profile fields are currently not editable.
                        </p>
                    </div>
                </div>

            </main>
        </div>
    );
}


