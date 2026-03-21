'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';

export default function CertificatesPage() {
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/certificates');
                if (res.ok) setCertificates(await res.json());
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        load();
    }, []);

    if (loading) {
        return <LoadScreen text="Loading certificates..." variant="minimal" />;
    }

    return (
        <div className="min-h-screen font-['Outfit',sans-serif]" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)' }}>
            <Navbar />

            <main className="max-w-[1200px] mx-auto px-6 pt-8 pb-24">
                <FadeIn direction="up">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="text-4xl">🏆</div>
                        <div>
                            <h1 className="text-3xl font-bold text-[#052143]">ประกาศนียบัตร</h1>
                            <p className="text-[#6B778B]">ประกาศนียบัตรที่คุณได้รับจากการเรียน</p>
                        </div>
                    </div>

                    {certificates.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-[#D1E3FB]">
                            <div className="text-6xl mb-4">📜</div>
                            <h3 className="text-xl text-[#052143] font-medium mb-2">ยังไม่มีประกาศนียบัตร</h3>
                            <p className="text-[#6B778B]">เรียนให้จบหลักสูตรเพื่อรับประกาศนียบัตร</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {certificates.map(cert => (
                                <CertificateCard key={cert.id} cert={cert} />
                            ))}
                        </div>
                    )}
                </FadeIn>
            </main>
        </div>
    );
}

function CertificateCard({ cert }) {
    const [printing, setPrinting] = useState(false);

    const handlePrint = () => {
        setPrinting(true);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html><head><title>Certificate</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;600&display=swap');
                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
                .cert {
                    width: 900px; min-height: 620px; background: white; position: relative;
                    border: 3px solid #687EFF; padding: 60px; text-align: center;
                    font-family: 'Outfit', sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                .cert::before {
                    content: ''; position: absolute; inset: 10px; border: 1px solid #D1E3FB;
                }
                .cert-title { font-family: 'Playfair Display', serif; font-size: 42px; color: #687EFF; margin-bottom: 10px; }
                .cert-subtitle { font-size: 16px; color: #6B778B; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 40px; }
                .cert-name { font-size: 32px; font-weight: 600; color: #052143; border-bottom: 2px solid #687EFF; display: inline-block; padding-bottom: 8px; margin-bottom: 20px; }
                .cert-course { font-size: 20px; color: #334155; margin-bottom: 30px; }
                .cert-date { font-size: 14px; color: #6B778B; }
                .cert-no { font-size: 12px; color: #6B778B; position: absolute; bottom: 20px; right: 30px; font-family: monospace; }
                .cert-badge { font-size: 60px; margin-bottom: 10px; }
                @media print { body { background: white; } .cert { box-shadow: none; } }
            </style>
            </head><body>
            <div class="cert">
                <div class="cert-badge">🏆</div>
                <div class="cert-title">Certificate</div>
                <div class="cert-subtitle">of Completion</div>
                <p style="color:#6B778B;margin-bottom:15px;">This is to certify that</p>
                <div class="cert-name">${cert.recipientName || cert.userId}</div>
                <p style="color:#6B778B;margin-bottom:5px;">has successfully completed the course</p>
                <div class="cert-course">${cert.courseName}</div>
                <div class="cert-date">Issued on: ${new Date(cert.issuedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div class="cert-no">No. ${cert.certificateNo}</div>
            </div>
            <script>setTimeout(() => { window.print(); }, 500);</script>
            </body></html>
        `);
        printWindow.document.close();
        setPrinting(false);
    };

    return (
        <div className="bg-white border border-[#D1E3FB] rounded-2xl overflow-hidden hover:shadow-lg transition-all">
            {/* Certificate Preview */}
            <div className="relative bg-gradient-to-br from-[#687EFF]/10 to-[#1DBA9F]/10 p-8 text-center border-b border-[#D1E3FB]">
                <div className="absolute inset-4 border border-[#D1E3FB] rounded-lg pointer-events-none"></div>
                <div className="text-5xl mb-3">🏆</div>
                <div className="text-[#687EFF] text-xl font-bold font-serif mb-1">Certificate</div>
                <div className="text-[#6B778B] text-[10px] tracking-[3px] uppercase mb-4">of Completion</div>
                <div className="text-[#052143] font-semibold text-lg border-b border-[#687EFF] inline-block pb-1 mb-2">
                    {cert.recipientName || cert.userId}
                </div>
                <div className="text-[#334155] text-sm">{cert.courseName}</div>
            </div>

            {/* Info */}
            <div className="p-5 flex items-center justify-between">
                <div>
                    <div className="text-[#6B778B] text-xs mb-0.5">
                        ออกเมื่อ: {new Date(cert.issuedAt).toLocaleDateString('th-TH')}
                    </div>
                    <div className="text-[#6B778B] text-xs font-mono">No. {cert.certificateNo}</div>
                </div>
                <button onClick={handlePrint} disabled={printing}
                    className="bg-[#687EFF] hover:bg-[#5a6fe0] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50">
                    🖨 พิมพ์ใบประกาศ
                </button>
            </div>
        </div>
    );
}


