'use client';

import React from 'react';
import Link from 'next/link';
import FadeIn from '@/components/ui/FadeIn';
import Header from '@/components/layout/Header';
import PublicFooter from '@/components/layout/PublicFooter';
import HomeFloatingChatbot from '@/components/ui/HomeFloatingChatbot';

export default function ContactPage() {
    const [fullName, setFullName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [subject, setSubject] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState('');

    const officeMap = {
        label: 'SkillUp Office',
        address: 'Bangkok, Thailand',
        embedUrl: 'https://www.google.com/maps?q=13.7563,100.5018&z=15&output=embed',
        openUrl: 'https://www.google.com/maps?q=13.7563,100.5018',
    };

    const contactInfo = [
        {
            icon: <svg width="28" height="28" fill="none" stroke="#B87D20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
            title: "Our Address",
            details: ["3149 New Creek Road,", "Huntsville,", "Alabama, USA"]
        },
        {
            icon: <svg width="28" height="28" fill="none" stroke="#B87D20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
            title: "Contact Number",
            details: ["+12001234567", "+9100012345896"]
        },
        {
            icon: <svg width="28" height="28" fill="none" stroke="#B87D20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
            title: "Email Address",
            details: ["info@domain.com", "support@domain.com"]
        },
        {
            icon: <svg width="28" height="28" fill="none" stroke="#B87D20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
            title: "Class Schedule",
            details: ["10:00 AM - 6:00 PM", "Monday - Friday"]
        }
    ];

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const payload = {
            fullName: String(fullName || '').trim(),
            email: String(email || '').trim().toLowerCase(),
            subject: String(subject || '').trim(),
            message: String(message || '').trim(),
        };

        if (!payload.fullName || !payload.email || !payload.subject || !payload.message) {
            setError('Please fill in all required fields.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
            setError('Invalid email format.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(data.error || 'Unable to send message. Please try again.');
                return;
            }
            setSuccess('Your message has been sent successfully.');
            setFullName('');
            setEmail('');
            setSubject('');
            setMessage('');
        } catch {
            setError('Unable to send message. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen font-['Outfit',sans-serif] bg-[#f8f9ff] text-[#052143] flex flex-col">
            <Header />

            {/* Hero Section */}
            <div className="relative w-full h-[220px] sm:h-[280px] xl:h-[360px] bg-[#f8f6ff] flex flex-col justify-center pb-8 sm:pb-20 xl:pb-28 overflow-hidden border-b border-[#F2F4FF]">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#687EFF 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(104, 126, 255, 0.2))' }}></div>

                <div className="absolute right-[5%] bottom-[10%] opacity-60">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="18" cy="18" r="5" fill="#687EFF"/>
                        <circle cx="18" cy="7" r="4" fill="#C4B5FD"/>
                        <circle cx="18" cy="29" r="4" fill="#C4B5FD"/>
                        <circle cx="7" cy="18" r="4" fill="#C4B5FD"/>
                        <circle cx="29" cy="18" r="4" fill="#C4B5FD"/>
                        <circle cx="10" cy="10" r="3" fill="#DDD6FE"/>
                        <circle cx="26" cy="10" r="3" fill="#DDD6FE"/>
                        <circle cx="10" cy="26" r="3" fill="#DDD6FE"/>
                        <circle cx="26" cy="26" r="3" fill="#DDD6FE"/>
                    </svg>
                </div>

                <FadeIn direction="up" className="w-full max-w-[1290px] mx-auto px-4 sm:px-6 relative z-10">
                    <h1 className="text-[#052143] font-bold text-[34px] sm:text-[44px] xl:text-[56px] leading-[1.2] mb-3">Contact Us</h1>
                    <div className="flex items-center gap-2 text-[#6B778B] text-[15px]">
                        <Link href="/" className="hover:text-[#687EFF] transition-colors">Home</Link>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                        <span className="text-[#687EFF] font-medium">Contact</span>
                    </div>
                </FadeIn>

                {/* Left side vertical text banner */}
                <div className="absolute left-0 top-0 h-full w-[40px] bg-[#687EFF] items-center justify-center hidden xl:flex">
                    <div className="transform -rotate-90 whitespace-nowrap text-white/70 text-[10px] tracking-[4px] font-semibold uppercase">
                        facebook // instagram // linkedin // twitter
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-[1290px] mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-12 sm:gap-16 relative z-10">

                {/* Contact Info Cards Grid */}
                <FadeIn direction="up" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-2">
                    {contactInfo.map((info, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-8 flex flex-col items-center text-center shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-[#eaedf5] hover:-translate-y-2 transition-transform duration-300">
                            <div className="w-16 h-16 rounded-full bg-[#fdf8dd] border-4 border-[#fffcef] flex items-center justify-center mb-6 shadow-sm">
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
                    <div className="bg-white border border-[#eaedf5] rounded-[24px] p-6 xl:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
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

                        <div className="w-full h-[340px] xl:h-[420px] rounded-2xl overflow-hidden border border-[#D1E3FB]">
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
                <FadeIn direction="up" delay={120} className="flex flex-col xl:flex-row gap-12 xl:gap-20 items-stretch bg-transparent pt-8 pb-12">

                    {/* Left side image */}
                    <div className="xl:w-1/2 rounded-[24px] overflow-hidden shadow-lg relative min-h-[400px] bg-slate-200">
                        {/* Course Image Placeholder */}
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/hero-student.png')" }}></div>
                        <div className="absolute inset-0 bg-black/10"></div>

                        {/* Optional text overlaid on image to mimic "Course" text in design */}
                        {/* <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-10">
                            <h2 className="text-[#052143] text-6xl font-black drop-shadow-md">Course</h2>
                        </div> */}
                    </div>

                    {/* Right side form */}
                    <div className="xl:w-1/2 flex flex-col justify-center">
                        <span className="text-[#F87A53] font-bold text-[14px] uppercase tracking-wider mb-4">GET IN TOUCH</span>
                        <h2 className="text-[#052143] text-[40px] font-bold leading-[1.2] mb-8">
                            Our Office
                        </h2>

                        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                                    {success}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#052143] font-bold text-[15px]">Full Name <span className="text-[#F87A53]">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="John Doe"
                                        value={fullName}
                                        onChange={(event) => setFullName(event.target.value)}
                                        required
                                        maxLength={100}
                                        className="w-full bg-[#fdfdfd] border border-[#eaedf5] rounded-lg px-4 py-3 text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#052143] font-bold text-[15px]">Email Address <span className="text-[#F87A53]">*</span></label>
                                    <input
                                        type="email"
                                        placeholder="johndomain.com"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        required
                                        className="w-full bg-[#fdfdfd] border border-[#eaedf5] rounded-lg px-4 py-3 text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[#052143] font-bold text-[15px]">Subject <span className="text-[#F87A53]">*</span></label>
                                <input
                                    type="text"
                                    placeholder="Write about your enquiry"
                                    value={subject}
                                    onChange={(event) => setSubject(event.target.value)}
                                    required
                                    maxLength={200}
                                    className="w-full bg-[#fdfdfd] border border-[#eaedf5] rounded-lg px-4 py-3 text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[#052143] font-bold text-[15px]">Message <span className="text-[#F87A53]">*</span></label>
                                <textarea
                                    rows="5"
                                    placeholder="Write Your Message"
                                    value={message}
                                    onChange={(event) => setMessage(event.target.value)}
                                    required
                                    minLength={5}
                                    maxLength={5000}
                                    className="w-full bg-[#fdfdfd] border border-[#eaedf5] rounded-lg px-4 py-3 text-[15px] outline-none placeholder:text-[#9BA5B7] focus:border-[#687EFF] transition-colors resize-none"
                                ></textarea>
                            </div>

                            <button type="submit" disabled={loading} className="bg-[#F87A53] text-white px-8 py-3.5 rounded-md font-bold text-[15px] self-start flex items-center gap-2 hover:bg-[#e66c45] transition-colors shadow-md shadow-[#F87A53]/20 mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
                                {loading ? 'Sending...' : 'Submit Message'}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </button>
                        </form>
                    </div>

                </FadeIn>
            </main>

            <PublicFooter className="mt-auto" />
            <HomeFloatingChatbot />
        </div>
    );
}



