'use client';

import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';

export default function LearnerAnalyticsDashboard() {
    return (
        <div className="min-h-screen bg-[#f8fafc] text-[#111827]">
            <Navbar />
            <main className="mx-auto max-w-6xl px-4 py-8">
                <FadeIn direction="up">
                    <h1 className="text-3xl font-bold">Learning Analytics</h1>
                    <p className="mt-2 text-sm text-[#64748b]">
                        Analytics dashboard is ready for your production data.
                    </p>
                </FadeIn>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FadeIn direction="up" delay={80} className="rounded-xl bg-white p-5 shadow-sm">
                        <p className="text-sm text-[#64748b]">Courses Enrolled</p>
                        <p className="mt-1 text-3xl font-semibold">0</p>
                    </FadeIn>
                    <FadeIn direction="up" delay={140} className="rounded-xl bg-white p-5 shadow-sm">
                        <p className="text-sm text-[#64748b]">Completed Courses</p>
                        <p className="mt-1 text-3xl font-semibold">0</p>
                    </FadeIn>
                    <FadeIn direction="up" delay={200} className="rounded-xl bg-white p-5 shadow-sm">
                        <p className="text-sm text-[#64748b]">Learning Hours</p>
                        <p className="mt-1 text-3xl font-semibold">0</p>
                    </FadeIn>
                </div>
            </main>
        </div>
    );
}
