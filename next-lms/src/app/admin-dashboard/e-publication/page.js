'use client';

import React from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import { AdminCard, AdminPageHeader, adminPrimaryButtonClass, adminSecondaryButtonClass } from '@/components/admin/ui/AdminPrimitives';

function PublicationIcon() {
    return (
        <svg className="h-7 w-7 text-[#6C4DFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h9l3 3v15H6z" />
            <path d="M15 3v4h4" />
            <path d="M9 13h6" />
            <path d="M9 17h6" />
            <path d="M9 9h2" />
        </svg>
    );
}

const sections = [
    {
        title: 'Publication overview',
        description: 'Space for ebook, PDF, and rich publication assets once the module moves beyond the placeholder stage.'
    },
    {
        title: 'Editorial workflow',
        description: 'Room for review state, ownership, and release history while keeping the current shell neat and consistent.'
    },
    {
        title: 'Reusable content canvas',
        description: 'The page now shares the same admin rhythm as manage-user, reports, and the refreshed dashboard experience.'
    }
];

export default function EPublicationPage() {
    return (
        <AdminShell>
            <div className="flex w-full flex-col gap-6">
                <AdminPageHeader
                    eyebrow="Admin workspace"
                    title="e-Publication"
                    description="A refined holding page for the publication module, styled with the same shell primitives so the admin experience stays visually unified."
                    actions={(
                        <div className="flex flex-wrap gap-3">
                            <button type="button" className={adminSecondaryButtonClass}>Preview structure</button>
                            <button type="button" className={adminPrimaryButtonClass}>Prepare module</button>
                        </div>
                    )}
                />

                <AdminCard className="overflow-hidden p-0">
                    <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
                        <div className="border-b border-[#E6EEF8] bg-[radial-gradient(circle_at_top_right,_rgba(108,77,255,0.14),_transparent_42%),linear-gradient(135deg,_#FCFBFF_0%,_#F3F0FF_100%)] p-8 lg:border-b-0 lg:border-r">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-[0_18px_40px_rgba(108,77,255,0.12)]">
                                <PublicationIcon />
                            </div>
                            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-[#052143]">Publication workspace prepared</h2>
                            <p className="mt-3 max-w-[640px] text-[15px] leading-7 text-[#5B6B83]">
                                We have the sidebar entry in place, and now the page itself follows the same layout grammar as the rest of the new admin shell. That means we can layer real publication tooling here without another UI reset later.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#406180]">
                                <span className="rounded-full border border-[#DDD4FF] bg-white px-4 py-2">Structured placeholder</span>
                                <span className="rounded-full border border-[#DDD4FF] bg-white px-4 py-2">Pattern-matched cards</span>
                                <span className="rounded-full border border-[#DDD4FF] bg-white px-4 py-2">Ready for real content</span>
                            </div>
                        </div>

                        <div className="p-8">
                            <div className="grid gap-4">
                                {sections.map((item) => (
                                    <div key={item.title} className="rounded-[22px] border border-[#E9E2FF] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(28,24,84,0.04)]">
                                        <h3 className="text-[17px] font-semibold text-[#0B2447]">{item.title}</h3>
                                        <p className="mt-2 text-[14px] leading-6 text-[#60738E]">{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </AdminCard>
            </div>
        </AdminShell>
    );
}
