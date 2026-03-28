 'use client';

import Link from 'next/link';
import FadeIn from '@/components/ui/FadeIn';
import { useState } from 'react';

export default function PublicFooter({ className = '' }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubscribe = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized) {
            setError('Please enter your email.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            setError('Invalid email format.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: normalized,
                    source: 'footer',
                }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                setError(data.error || 'Unable to subscribe right now.');
                return;
            }

            if (data.state === 'already_subscribed') {
                setSuccess('This email is already subscribed.');
            } else {
                setSuccess('Thanks for subscribing!');
            }
            setEmail('');
        } catch {
            setError('Unable to subscribe right now.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <footer className={`w-full bg-[#052143] text-white relative z-20 ${className}`.trim()}>
            <div className="max-w-[1290px] mx-auto px-6 pt-16 pb-8">
                <FadeIn direction="up">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
                        <div className="lg:col-span-1">
                            <Link href="/" className="flex items-center gap-2 mb-5">
                                <img src="/skillup_logo.png" alt="SkillUp" className="h-[50px] w-[50px] object-contain" />
                                <span className="text-white font-bold text-lg">SkillUp</span>
                            </Link>
                            <p className="text-white/60 text-[14px] leading-[170%] mb-5">Empowering learners worldwide to achieve their goals through innovative online education.</p>
                            <div className="flex gap-3">
                                {['FB', 'IG', 'IN', 'YT'].map((s, i) => (
                                    <a key={i} href="#" className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:bg-[#687EFF] hover:text-white hover:border-[#687EFF] transition-all text-[10px] font-bold">{s}</a>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-white font-semibold text-[16px] mb-5">Platform</h4>
                            <ul className="space-y-3 text-white/60 text-[14px]">
                                <li><Link href="/home-courses" className="hover:text-white transition-colors">Browse Courses</Link></li>
                                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Testimonials</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-semibold text-[16px] mb-5">Quick Link</h4>
                            <ul className="space-y-3 text-white/60 text-[14px]">
                                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                                <li><a href="#" className="hover:text-white transition-colors">Partners</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-semibold text-[16px] mb-5">Useful Links</h4>
                            <ul className="space-y-3 text-white/60 text-[14px]">
                                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-semibold text-[16px] mb-5">Newsletter</h4>
                            <p className="text-white/60 text-[14px] leading-[170%] mb-4">Subscribe to get updates on new courses and features.</p>
                            <form className="flex flex-col gap-3" onSubmit={handleSubscribe}>
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        placeholder="Your email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        className="flex-1 h-[42px] bg-white/10 border border-white/20 rounded-full px-4 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-[#687EFF] transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="h-[42px] px-5 bg-[#F87A53] text-white rounded-full text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Sending...' : 'Subscribe'}
                                    </button>
                                </div>
                                {error && <p className="text-red-300 text-[13px]">{error}</p>}
                                {success && <p className="text-emerald-300 text-[13px]">{success}</p>}
                            </form>
                        </div>
                    </div>
                </FadeIn>

                <FadeIn direction="up" delay={120}>
                    <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-white/40 text-[13px]">© 2026 SkillUp. All rights reserved.</p>
                        <div className="flex gap-6 text-[13px] text-white/40">
                            <a href="#" className="hover:text-white transition-colors">Terms</a>
                            <a href="#" className="hover:text-white transition-colors">Privacy</a>
                            <a href="#" className="hover:text-white transition-colors">Cookies</a>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </footer>
    );
}
