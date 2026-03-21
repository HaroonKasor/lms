'use client';

import React, { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';

export default function PricingPage() {
    const [isAnnual, setIsAnnual] = useState(true);

    const plans = [
        {
            name: "Free",
            description: "Perfect for getting started and exploring the platform basics.",
            price: "$0",
            period: "/ forever",
            features: [
                "Access to 10 introductory courses",
                "Community forum access",
                "Basic progress tracking",
                "Standard video player"
            ],
            notIncluded: [
                "Verifiable certificates",
                "1-on-1 mentorship",
                "Live peer coding",
                "Offline downloads"
            ],
            buttonText: "Get Started",
            popular: false,
            color: "from-zinc-500 to-zinc-700",
            border: "border-white/10"
        },
        {
            name: "Pro",
            description: "Everything you need to accelerate your learning and build real skills.",
            price: isAnnual ? "$19" : "$29",
            period: "/ month",
            features: [
                "Unlimited access to ALL courses",
                "Verifiable blockchain certificates",
                "Interactive live peer coding",
                "Advanced progress analytics",
                "Offline video downloads"
            ],
            notIncluded: [
                "1-on-1 expert mentorship",
                "Custom learning paths"
            ],
            buttonText: "Start 7-Day Free Trial",
            popular: true,
            color: "from-blue-600 to-cyan-500",
            border: "border-blue-500/50",
            glow: "shadow-[0_0_30px_rgba(56,189,248,0.2)]"
        },
        {
            name: "Enterprise",
            description: "Custom solutions for teams and organizations of all sizes.",
            price: "Custom",
            period: "",
            features: [
                "Everything in Pro",
                "Dedicated success manager",
                "1-on-1 expert mentorship",
                "Custom learning paths",
                "Advanced team analytics",
                "SSO & API integrations"
            ],
            notIncluded: [],
            buttonText: "Contact Sales",
            popular: false,
            color: "from-purple-600 to-pink-500",
            border: "border-white/10"
        }
    ];

    return (
        <div className="min-h-screen bg-zinc-950 font-sans overflow-x-hidden flex flex-col relative text-white selection:bg-cyan-500/30">
            <Navbar />

            {/* Background Ambient Glows */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[60%] h-[40%] rounded-full bg-blue-600/10 blur-[150px] mix-blend-screen animate-pulse"></div>
            </div>

            <main className="relative flex-1 w-full max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-32 z-10">
                {/* Header */}
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 tracking-tight leading-tight">
                        Simple, transparent <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">pricing</span>
                    </h1>
                    <p className="text-lg text-zinc-400 font-medium mb-10">
                        Choose the plan that's right for your learning journey. Upgrade or downgrade at any time.
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-4">
                        <span className={`text-sm font-bold ${!isAnnual ? 'text-white' : 'text-zinc-500'}`}>Monthly</span>
                        <button 
                            onClick={() => setIsAnnual(!isAnnual)}
                            className="w-16 h-8 rounded-full bg-zinc-800 border border-zinc-700 relative flex items-center p-1 transition-colors hover:border-zinc-500"
                        >
                            <div className={`w-6 h-6 rounded-full bg-blue-500 shadow-md transition-transform duration-300 ${isAnnual ? 'translate-x-8' : 'translate-x-0'}`}></div>
                        </button>
                        <span className={`text-sm font-bold flex items-center gap-2 ${isAnnual ? 'text-white' : 'text-zinc-500'}`}>
                            Annually <span className="bg-blue-500/20 text-blue-400 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full">Save 20%</span>
                        </span>
                    </div>
                </div>

                {/* Pricing Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {plans.map((plan, idx) => (
                        <div key={idx} className={`relative flex flex-col bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 lg:p-10 border ${plan.border} ${plan.glow || ''} transition-all duration-300 hover:bg-white/10 hover:-translate-y-2`}>
                            
                            {plan.popular && (
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_0_15px_rgba(56,189,248,0.5)]">
                                    Most Popular
                                </div>
                            )}

                            <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                            <p className="text-zinc-400 text-sm font-medium mb-6 min-h-[40px]">{plan.description}</p>
                            
                            <div className="flex items-baseline gap-2 mb-8">
                                <span className="text-5xl font-black text-white">{plan.price}</span>
                                <span className="text-zinc-500 font-bold">{plan.period}</span>
                            </div>

                            <button className={`w-full py-4 rounded-xl font-extrabold text-sm mb-8 transition-all hover:scale-[1.02] active:scale-[0.98] ${plan.popular ? `bg-gradient-to-r ${plan.color} text-white shadow-[0_0_20px_rgba(56,189,248,0.3)]` : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                {plan.buttonText}
                            </button>

                            <div className="flex flex-col gap-4 mt-auto">
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">What's included</p>
                                {plan.features.map((feat, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                        <span className="text-sm font-medium text-white">{feat}</span>
                                    </div>
                                ))}
                                
                                {plan.notIncluded.length > 0 && (
                                    <>
                                        <div className="w-full h-px bg-white/10 my-2"></div>
                                        {plan.notIncluded.map((feat, i) => (
                                            <div key={i} className="flex items-start gap-3 opacity-50">
                                                <svg className="w-5 h-5 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                <span className="text-sm font-medium text-zinc-400">{feat}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}


