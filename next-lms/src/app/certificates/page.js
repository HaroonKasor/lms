'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import FadeIn from '@/components/ui/FadeIn';
import LoadScreen from '@/components/ui/LoadScreen';
import {
    CERTIFICATE_ASPECT_RATIO,
    CERTIFICATE_HOLDER_RATIO,
    CERTIFICATE_LAYOUT,
    CERTIFICATE_SIGNATURE_IMAGE,
    CERTIFICATE_TEMPLATE_IMAGE,
    formatCertificateDate,
} from '@/lib/certificate-layout';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
        const templateUrl = `${window.location.origin}${CERTIFICATE_TEMPLATE_IMAGE}`;
        const signatureUrl = `${window.location.origin}${CERTIFICATE_SIGNATURE_IMAGE}`;
        const recipient = escapeHtml(cert.recipientName || cert.userId || '-');
        const courseName = escapeHtml(cert.courseName || '-');
        const issuedDate = formatCertificateDate(cert.issuedAt);
        const certNo = escapeHtml(cert.certificateNo || '-');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html><head><title>Certificate</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Noto+Serif+Thai:wght@500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
                @page { size: A4 landscape; margin: 0; }
                html, body { margin: 0; padding: 0; background: #eef2ff; }
                body {
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: 'Noto Sans Thai', 'Outfit', sans-serif;
                    overflow: hidden;
                }
                .viewer {
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 10px;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                .holder {
                    position: relative;
                    width: min(96vw, calc(96vh * ${CERTIFICATE_HOLDER_RATIO}));
                    aspect-ratio: ${CERTIFICATE_ASPECT_RATIO};
                }
                .cert {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    container-type: inline-size;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                .template {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: fill;
                }
                .field {
                    position: absolute;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: #22304a;
                    text-rendering: optimizeLegibility;
                    -webkit-font-smoothing: antialiased;
                }
                .name {
                    left: ${CERTIFICATE_LAYOUT.recipient.left};
                    top: ${CERTIFICATE_LAYOUT.recipient.top};
                    width: ${CERTIFICATE_LAYOUT.recipient.width};
                    min-height: 132px;
                    font-family: 'Noto Serif Thai', 'Noto Sans Thai', serif;
                    font-size: ${CERTIFICATE_LAYOUT.recipient.fontSizePrint};
                    line-height: 1.12;
                    font-weight: 600;
                    color: #2e3e76;
                    letter-spacing: 0.2px;
                    word-break: break-word;
                }
                .course {
                    left: ${CERTIFICATE_LAYOUT.course.left};
                    top: ${CERTIFICATE_LAYOUT.course.top};
                    width: ${CERTIFICATE_LAYOUT.course.width};
                    min-height: 120px;
                    font-family: 'Noto Serif Thai', 'Noto Sans Thai', serif;
                    font-size: ${CERTIFICATE_LAYOUT.course.fontSizePrint};
                    line-height: 1.18;
                    font-weight: 600;
                    color: #2e3e76;
                    word-break: break-word;
                }
                .date {
                    left: ${CERTIFICATE_LAYOUT.date.left};
                    top: ${CERTIFICATE_LAYOUT.date.top};
                    width: ${CERTIFICATE_LAYOUT.date.width};
                    font-size: ${CERTIFICATE_LAYOUT.date.fontSizePrint};
                    line-height: 1.18;
                    font-weight: 500;
                    color: #5a6781;
                }
                .signature {
                    position: absolute;
                    left: ${CERTIFICATE_LAYOUT.signature.left};
                    top: ${CERTIFICATE_LAYOUT.signature.top};
                    transform: translate(-50%, -50%);
                    width: ${CERTIFICATE_LAYOUT.signature.width};
                    max-height: ${CERTIFICATE_LAYOUT.signature.maxHeight};
                    object-fit: contain;
                }
                .cert-no {
                    position: absolute;
                    left: ${CERTIFICATE_LAYOUT.certificateNo.left};
                    bottom: ${CERTIFICATE_LAYOUT.certificateNo.bottom};
                    font-size: ${CERTIFICATE_LAYOUT.certificateNo.fontSizePrint};
                    letter-spacing: 0.6px;
                    color: #5a6781;
                    font-family: 'Noto Sans Thai', 'Outfit', sans-serif;
                }
                @media print {
                    html, body { background: white; overflow: visible; }
                    .viewer { width: auto; height: auto; overflow: visible; padding: 0; }
                    .holder {
                        width: 297mm !important;
                        height: 210mm !important;
                        aspect-ratio: auto;
                    }
                    .cert { box-shadow: none; }
                }
            </style>
            </head><body>
            <div class="viewer">
              <div class="holder">
                <div class="cert">
                    <img class="template" src="${templateUrl}" alt="Certificate template" />
                    <div class="field name">${recipient}</div>
                    <div class="field course">${courseName}</div>
                    <div class="field date">${issuedDate}</div>
                    <img class="signature" src="${signatureUrl}" alt="Signature" />
                    <div class="cert-no">No. ${certNo}</div>
                </div>
              </div>
            </div>
            <script>
              (function () {
                if (document.fonts && document.fonts.ready) {
                  document.fonts.ready.then(function () {
                    setTimeout(function () { window.print(); }, 350);
                  });
                } else {
                  setTimeout(function () { window.print(); }, 350);
                }
              })();
            </script>
            </body></html>
        `);
        printWindow.document.close();
        setPrinting(false);
    };

    return (
        <div className="bg-white border border-[#D1E3FB] rounded-2xl overflow-hidden hover:shadow-lg transition-all">
            {/* Certificate Preview */}
            <div
                className="relative p-8 text-center border-b border-[#D1E3FB] bg-center bg-cover"
                style={{ backgroundImage: "url('/images/certificate-template-achievement.png')" }}
            >
                <div className="absolute inset-0 bg-white/45 pointer-events-none"></div>
                <div className="relative text-[#687EFF] text-xl font-bold font-serif mb-1">Certificate</div>
                <div className="relative text-[#6B778B] text-[10px] tracking-[3px] uppercase mb-4">of Completion</div>
                <div className="relative text-[#052143] font-semibold text-lg border-b border-[#687EFF] inline-block pb-1 mb-2">
                    {cert.recipientName || cert.userId}
                </div>
                <div className="relative text-[#334155] text-sm">{cert.courseName}</div>
            </div>

            {/* Info */}
            <div className="p-5 flex items-center justify-between">
                <div>
                    <div className="text-[#6B778B] text-xs mb-0.5">
                        Issued: {formatCertificateDate(cert.issuedAt)}
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


