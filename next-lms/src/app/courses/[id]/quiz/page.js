'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';

export default function QuizPage() {
    const params = useParams();
    const courseId = params.id;

    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/quizzes?courseId=${courseId}`);
                if (res.ok) setQuizzes(await res.json());
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        load();
    }, [courseId]);

    const startQuiz = async (quizId) => {
        try {
            const res = await fetch(`/api/quizzes?id=${quizId}`);
            if (res.ok) {
                const quiz = await res.json();
                setSelectedQuiz(quiz);
                // Parse questions but remove correctAnswer for display
                const qs = quiz.questions.map(q => ({
                    ...q,
                    displayOptions: q.options,
                }));
                setQuestions(qs);
                setAnswers({});
                setResult(null);
                setStarted(true);
            }
        } catch (e) { console.error(e); }
    };

    const handleAnswer = (qIndex, value) => {
        setAnswers(prev => ({ ...prev, [qIndex]: value }));
    };

    const handleSubmit = async () => {
        if (Object.keys(answers).length < questions.length) {
            alert('กรุณาตอบคำถามให้ครบทุกข้อ');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quizId: selectedQuiz.id,
                    answers,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setResult(data.attempt);
            }
        } catch (e) { alert(e.message); }
        setSubmitting(false);
    };

    // Result Screen
    if (result) {
        const certificateStatus = String(result?.certificate?.status || '').toUpperCase();
        const hasPendingApproval = certificateStatus === 'PENDING_APPROVAL';
        const hasIssuedCertificate = certificateStatus === 'ISSUED';

        return (
            <div className="min-h-screen font-['Outfit',sans-serif]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
                <Navbar />
                <main className="max-w-[700px] mx-auto px-6 pt-12 pb-24">
                    <FadeIn direction="up">
                        <div className="bg-white border border-[#D1E3FB] rounded-3xl p-8 text-center">
                            <div className="text-7xl mb-6">{result.passed ? '🎉' : '😕'}</div>
                            <h1 className="text-3xl font-bold text-[#052143] mb-2">
                                {result.passed ? 'ยินดีด้วย! คุณผ่านแล้ว' : 'ไม่ผ่าน ลองอีกครั้ง'}
                            </h1>
                            <p className="text-[#6B778B] mb-6">{selectedQuiz?.title}</p>

                            <div className={`inline-flex items-center gap-4 px-8 py-4 rounded-2xl mb-8 ${result.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                <div>
                                    <div className={`text-4xl font-bold ${result.passed ? 'text-green-600' : 'text-red-600'}`}>{result.score}%</div>
                                    <div className="text-sm text-[#6B778B]">คะแนนของคุณ</div>
                                </div>
                                <div className="w-px h-12 bg-gray-200"></div>
                                <div>
                                    <div className="text-4xl font-bold text-[#052143]">{result.correct}/{result.total}</div>
                                    <div className="text-sm text-[#6B778B]">ถูกต้อง</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-4">
                                {result.passed ? (
                                    <>
                                        <Link href="/my-courses" className="bg-[#687EFF] hover:bg-[#5a6fe0] text-white px-6 py-3 rounded-full text-sm font-medium transition-colors">
                                            หลักสูตรของฉัน
                                        </Link>
                                        {hasIssuedCertificate && (
                                            <Link href="/certificates" className="bg-[#1DBA9F] hover:bg-[#18a58c] text-white px-6 py-3 rounded-full text-sm font-medium transition-colors">
                                                🏆 ดูใบประกาศ
                                            </Link>
                                        )}
                                        {hasPendingApproval && (
                                            <span className="inline-flex items-center px-6 py-3 rounded-full text-sm font-medium bg-[#E2E8F0] text-[#64748B]">
                                                ⏳ รอแอดมินอนุมัติใบประกาศ
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { setResult(null); setAnswers({}); }}
                                            className="bg-[#F87A53] hover:bg-[#e06a45] text-white px-6 py-3 rounded-full text-sm font-medium transition-colors">
                                            ลองอีกครั้ง
                                        </button>
                                        <Link href={`/courses/${courseId}`} className="text-[#687EFF] underline text-sm">กลับหน้าหลักสูตร</Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </FadeIn>
                </main>
            </div>
        );
    }

    // Quiz Taking Screen
    if (started && selectedQuiz) {
        return (
            <div className="min-h-screen font-['Outfit',sans-serif]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
                <Navbar />
                <main className="max-w-[800px] mx-auto px-6 pt-8 pb-24">
                    <FadeIn direction="up">
                        <div className="flex items-center justify-between mb-6">
                            <h1 className="text-2xl font-bold text-[#052143]">{selectedQuiz.title}</h1>
                            <span className="text-sm text-[#6B778B] bg-white px-3 py-1.5 rounded-full border border-[#D1E3FB]">
                                {Object.keys(answers).length}/{questions.length} ข้อ
                            </span>
                        </div>

                        <div className="flex flex-col gap-6">
                            {questions.map((q, idx) => (
                                <div key={idx} className="bg-white border border-[#D1E3FB] rounded-2xl p-6">
                                    <div className="flex items-start gap-3 mb-4">
                                        <span className="bg-[#687EFF] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{idx + 1}</span>
                                        <h3 className="text-[#052143] font-medium text-lg leading-relaxed">{q.question}</h3>
                                    </div>
                                    <div className="flex flex-col gap-2 pl-11">
                                        {q.displayOptions?.map((opt, oi) => (
                                            <label key={oi}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${answers[idx] === oi
                                                    ? 'border-[#687EFF] bg-[#687EFF]/5'
                                                    : 'border-[#D1E3FB] hover:border-[#687EFF]/50 hover:bg-[#F6F8FF]'
                                                    }`}>
                                                <input type="radio" name={`q${idx}`} checked={answers[idx] === oi}
                                                    onChange={() => handleAnswer(idx, oi)} className="accent-[#687EFF] w-4 h-4" />
                                                <span className="text-[#334155]">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center mt-8">
                            <button onClick={handleSubmit} disabled={submitting}
                                className="bg-[#687EFF] hover:bg-[#5a6fe0] text-white px-10 py-3.5 rounded-full text-lg font-medium transition-colors disabled:opacity-50">
                                {submitting ? 'กำลังส่ง...' : 'ส่งคำตอบ'}
                            </button>
                        </div>
                    </FadeIn>
                </main>
            </div>
        );
    }

    // Quiz List Screen
    if (loading) {
        return <LoadScreen text="Loading quiz..." variant="minimal" />;
    }

    return (
        <div className="min-h-screen font-['Outfit',sans-serif]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
            <Navbar />
            <main className="max-w-[800px] mx-auto px-6 pt-8 pb-24">
                <FadeIn direction="up">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-[#052143]">แบบทดสอบ</h1>
                            <p className="text-[#6B778B] mt-1">เลือกแบบทดสอบที่ต้องการทำ</p>
                        </div>
                        <Link href={`/courses/${courseId}`} className="text-[#687EFF] text-sm hover:underline flex items-center gap-1">
                            ← กลับหลักสูตร
                        </Link>
                    </div>

                    {quizzes.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-[#D1E3FB]">
                            <div className="text-6xl mb-4">📝</div>
                            <h3 className="text-xl text-[#052143] font-medium mb-2">ยังไม่มีแบบทดสอบ</h3>
                            <p className="text-[#6B778B]">แบบทดสอบจะเพิ่มโดยผู้สอน</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {quizzes.map(quiz => (
                                <div key={quiz.id} className="bg-white border border-[#D1E3FB] rounded-2xl p-6 flex items-center justify-between hover:shadow-md transition-all">
                                    <div>
                                        <h3 className="text-[#052143] font-medium text-lg">{quiz.title}</h3>
                                        <p className="text-[#6B778B] text-sm mt-1">
                                            เกณฑ์ผ่าน: {quiz.passingScore}%
                                            {quiz.timeLimit > 0 && ` • เวลา: ${quiz.timeLimit} นาที`}
                                        </p>
                                    </div>
                                    <button onClick={() => startQuiz(quiz.id)}
                                        className="bg-[#F87A53] hover:bg-[#e06a45] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors">
                                        เริ่มทำ →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </FadeIn>
            </main>
        </div>
    );
}

