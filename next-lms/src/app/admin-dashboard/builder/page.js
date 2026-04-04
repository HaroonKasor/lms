'use client';

import React, { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';
import {
    AdminCard,
    AdminPageHeader,
    adminDangerButtonClass,
    adminInputClass,
    adminPrimaryButtonClass,
    adminSecondaryButtonClass,
} from '@/components/admin/ui/AdminPrimitives';

export default function CourseBuilderPage() {
    const [chapters, setChapters] = useState([
        { id: 1, title: 'Introduction to Web Design', lessons: ['Basic HTML', 'CSS Fundamentals'] },
        { id: 2, title: 'Visual Hierarchy', lessons: ['Contrast & Scale', 'Color Theory'] }
    ]);

    const totalLessons = useMemo(() => chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0), [chapters]);

    const addChapter = () => {
        setChapters((current) => ([
            ...current,
            {
                id: Date.now(),
                title: 'New Chapter Title',
                lessons: ['New Lesson 1']
            }
        ]));
    };

    const removeChapter = (chapterId) => {
        setChapters((current) => current.filter((chapter) => chapter.id !== chapterId));
    };

    const addLesson = (chapterId) => {
        setChapters((current) => current.map((chapter) => {
            if (chapter.id !== chapterId) return chapter;
            return {
                ...chapter,
                lessons: [...chapter.lessons, `New Lesson ${chapter.lessons.length + 1}`]
            };
        }));
    };

    const removeLesson = (chapterId, lessonIndex) => {
        setChapters((current) => current.map((chapter) => {
            if (chapter.id !== chapterId) return chapter;
            return {
                ...chapter,
                lessons: chapter.lessons.filter((_, index) => index !== lessonIndex)
            };
        }));
    };

    const updateChapterTitle = (chapterId, value) => {
        setChapters((current) => current.map((chapter) => (
            chapter.id === chapterId ? { ...chapter, title: value } : chapter
        )));
    };

    const updateLessonTitle = (chapterId, lessonIndex, value) => {
        setChapters((current) => current.map((chapter) => {
            if (chapter.id !== chapterId) return chapter;
            return {
                ...chapter,
                lessons: chapter.lessons.map((lesson, index) => (index === lessonIndex ? value : lesson))
            };
        }));
    };

    return (
        <AdminShell>
            <div className="flex w-full flex-col gap-6">
                <AdminPageHeader
                    eyebrow="Curriculum workspace"
                    title="Course Builder"
                    description="Organise chapters and lessons inside the refreshed admin shell without changing any backend wiring yet."
                    actions={(
                        <div className="flex flex-wrap gap-3">
                            <button type="button" className={adminSecondaryButtonClass}>Save draft</button>
                            <button type="button" onClick={addChapter} className={adminPrimaryButtonClass}>Add new chapter</button>
                        </div>
                    )}
                />

                <div className="grid gap-4 md:grid-cols-3">
                    <AdminCard className="border-[#D8E7FA] bg-[linear-gradient(135deg,_#F8FBFF_0%,_#F0F7FF_100%)]">
                        <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#6F88A7]">Chapters</div>
                        <div className="mt-3 text-[34px] font-semibold tracking-[-0.03em] text-[#052143]">{chapters.length}</div>
                        <p className="mt-2 text-sm leading-6 text-[#60738E]">A clear snapshot of the curriculum structure we are shaping inside this builder.</p>
                    </AdminCard>
                    <AdminCard className="border-[#E3DBFF] bg-[linear-gradient(135deg,_#FCFBFF_0%,_#F4F1FF_100%)]">
                        <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#7A6FA8]">Lessons</div>
                        <div className="mt-3 text-[34px] font-semibold tracking-[-0.03em] text-[#1D275F]">{totalLessons}</div>
                        <p className="mt-2 text-sm leading-6 text-[#6B6791]">Keeps the lesson count visible so the page feels purposeful even before persistence work lands.</p>
                    </AdminCard>
                    <AdminCard className="border-[#DDF3EA] bg-[linear-gradient(135deg,_#FAFFFD_0%,_#F1FBF6_100%)]">
                        <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#4F8A72]">Shell status</div>
                        <div className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-[#113B2D]">Pattern aligned</div>
                        <p className="mt-2 text-sm leading-6 text-[#557768]">This builder now matches the new admin shell, so we can evolve behavior later without another layout reset.</p>
                    </AdminCard>
                </div>

                <div className="grid grid-cols-1 gap-5">
                    {chapters.map((chapter, chapterIndex) => (
                        <AdminCard key={chapter.id} className="overflow-hidden p-0">
                            <div className="border-b border-[#E6EEF8] bg-[linear-gradient(180deg,_#FFFFFF_0%,_#FAFCFF_100%)] px-6 py-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex min-w-0 flex-1 items-start gap-4">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[#DCE8F8] bg-[#F8FBFF] text-[15px] font-semibold text-[#0B2447]">
                                            {chapterIndex + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6F88A7]">Chapter title</label>
                                            <input
                                                value={chapter.title}
                                                onChange={(event) => updateChapterTitle(chapter.id, event.target.value)}
                                                className={adminInputClass}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <button type="button" onClick={() => addLesson(chapter.id)} className={adminSecondaryButtonClass}>Add lesson</button>
                                        <button type="button" onClick={() => removeChapter(chapter.id)} className={adminDangerButtonClass}>Remove chapter</button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 px-6 py-6">
                                {chapter.lessons.map((lesson, lessonIndex) => (
                                    <div key={`${chapter.id}-${lessonIndex}`} className="rounded-[22px] border border-[#E6EEF8] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(14,42,90,0.04)]">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6F88A7]">Lesson {lessonIndex + 1}</label>
                                                <input
                                                    value={lesson}
                                                    onChange={(event) => updateLessonTitle(chapter.id, lessonIndex, event.target.value)}
                                                    className={adminInputClass}
                                                />
                                            </div>
                                            <button type="button" onClick={() => removeLesson(chapter.id, lessonIndex)} className={adminDangerButtonClass}>Remove lesson</button>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => addLesson(chapter.id)}
                                    className="w-full rounded-[20px] border border-dashed border-[#C8D9F1] bg-[#FAFCFF] px-5 py-4 text-sm font-semibold text-[#426A9B] transition hover:border-[#7EA5DB] hover:bg-[#F3F8FF]"
                                >
                                    Add lesson to this chapter
                                </button>
                            </div>
                        </AdminCard>
                    ))}
                </div>
            </div>
        </AdminShell>
    );
}
