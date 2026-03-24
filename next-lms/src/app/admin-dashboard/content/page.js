'use client';

import React, { useState, useEffect, useRef } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

export default function ContentManagementPage() {
    const [view, setView] = useState('CONTENT_LIST');
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Upload state
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadMessage, setUploadMessage] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const dragCounterRef = useRef(0);

    const headerClass = "bg-[#687EFF] px-4 py-3 flex items-center justify-between text-white font-medium text-[15px]";
    const appOrigin = React.useMemo(() => {
        const candidates = [
            process.env.NEXT_PUBLIC_XAPI_OBJECT_BASE_URL,
            process.env.NEXT_PUBLIC_APP_URL,
            typeof window !== 'undefined' ? window.location.origin : '',
        ];
        for (const candidate of candidates) {
            const raw = String(candidate || '').trim();
            if (!raw) continue;
            const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
            try {
                return new URL(withProtocol).origin;
            } catch {
                // Try next candidate.
            }
        }
        return 'https://example.invalid';
    }, []);

    const getContentRootLaunchUrl = (content) => {
        const contentId = String(content?.id || '').trim();
        if (contentId) return `/content/${contentId}`;
        return content?.entryPoint ? `/${content.entryPoint}` : '#';
    };

    const resolveActivityUrl = (content, launch) => {
        if (!launch) return getContentRootLaunchUrl(content);
        if (/^https?:\/\//i.test(launch)) return launch;
        const normalizedLaunch = String(launch).replace(/\\/g, '/');
        const baseDir = (content?.entryPoint || '').split('/').slice(0, -1).join('/');
        if (/^\/?content\//i.test(normalizedLaunch)) {
            const normalizedContentPath = normalizedLaunch
                .replace(/^\/+/, '')
                .replace(/^content\//i, 'content/');
            return `/${normalizedContentPath}`;
        }
        try {
            const joined = new URL(normalizedLaunch.replace(/^\//, ''), `${appOrigin}/${baseDir}/`);
            return `${joined.pathname}${joined.search}${joined.hash}`;
        } catch {
            return getContentRootLaunchUrl(content);
        }
    };

    const resolveSafeLaunchUrl = async (candidateUrl, fallbackUrl) => {
        const candidates = [candidateUrl, fallbackUrl].filter((x) => x && x !== '#');
        if (candidates.length === 0) return '#';

        for (const candidate of candidates) {
            if (/^https?:\/\//i.test(candidate)) return candidate;
            const localPath = candidate.startsWith('/') ? candidate : `/${candidate}`;
            try {
                const res = await fetch(`/api/content/resolve?src=${encodeURIComponent(localPath)}`, { cache: 'no-store' });
                const data = await res.json().catch(() => null);
                const resolved = String(data?.resolvedSrc || '').trim();
                // Only trust resolved path when API confirms it is valid.
                if (res.ok && resolved) return resolved;
                if (res.ok) return localPath;
            } catch {
                // ignore and try next candidate
            }
        }

        const last = candidates[candidates.length - 1];
        return last.startsWith('/') || /^https?:\/\//i.test(last) ? last : `/${last}`;
    };

    const openLaunchWindow = (url, fallbackUrl) => {
        const w = window.screen?.availWidth || window.innerWidth || 1600;
        const h = window.screen?.availHeight || window.innerHeight || 900;
        const features = `left=0,top=0,width=${w},height=${h}`;
        const win = window.open('about:blank', '_blank', features);
        if (win) {
            win.focus();
            try {
                win.moveTo(0, 0);
                win.resizeTo(w, h);
            } catch {
                // Some browsers block move/resize; opening in new tab still works.
            }
            (async () => {
                const safeUrl = await resolveSafeLaunchUrl(url, fallbackUrl);
                if (!safeUrl || safeUrl === '#') {
                    try { win.close(); } catch { }
                    return;
                }
                const launchUrl = `/launch?src=${encodeURIComponent(safeUrl)}&autoplay=1`;
                win.location.href = launchUrl;
            })();
        }
    };

    // Load contents from API
    const loadContents = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/content/upload');
            if (res.ok) {
                const data = await res.json();
                setContents(data);
            }
        } catch (err) {
            console.error('Failed to load contents:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadContents(); }, []);

    const handleSelectedFile = (file) => {
        if (!file) return;

        const isZipByMime = ['application/zip', 'application/x-zip-compressed'].includes(file.type);
        const isZipByName = /\.zip$/i.test(file.name || '');

        if (!isZipByMime && !isZipByName) {
            setUploadFile(null);
            setUploadMessage('❌ รองรับเฉพาะไฟล์ .zip (TinCan/xAPI Package)');
            setUploadProgress(0);
            return;
        }

        setUploadFile(file);
        setUploadMessage('');
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        setIsDragging(true);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragging(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragging(false);

        const droppedFile = e.dataTransfer?.files?.[0] || null;
        handleSelectedFile(droppedFile);
    };

    // Handle file upload
    const handleUpload = async () => {
        if (!uploadFile) {
            setUploadMessage('กรุณาเลือกไฟล์ก่อน');
            return;
        }
        if (!uploadTitle.trim()) {
            setUploadMessage('กรุณากรอกชื่อ Content');
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setUploadMessage('');

        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('title', uploadTitle);

            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 300);

            const res = await fetch('/api/content/upload', {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);

            if (res.ok) {
                const data = await res.json();
                setUploadProgress(100);
                setUploadMessage(`✅ อัปโหลดสำเร็จ! Content ID: ${data.content.id}`);

                // Reset form after 2s and go back
                setTimeout(() => {
                    setUploadFile(null);
                    setUploadTitle('');
                    setUploadProgress(0);
                    setUploadMessage('');
                    setView('CONTENT_LIST');
                    loadContents();
                }, 2000);
            } else {
                const err = await res.json();
                setUploadMessage(`❌ อัปโหลดล้มเหลว: ${err.error}`);
                setUploadProgress(0);
            }
        } catch (err) {
            setUploadMessage(`❌ Error: ${err.message}`);
            setUploadProgress(0);
        } finally {
            setUploading(false);
        }
    };

    // Handle delete
    const handleDelete = async (id) => {
        if (!confirm('ต้องการลบ content นี้หรือไม่?')) return;
        try {
            const res = await fetch(`/api/content/upload?id=${id}`, { method: 'DELETE' });
            if (res.ok) loadContents();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    // Launch content in player
    const handleLaunch = (content) => {
        const launchUrl = getContentRootLaunchUrl(content);
        openLaunchWindow(launchUrl, launchUrl);
    };

    // --- RENDER CONTENT LIST ---
    const renderContentList = () => (
        <div className="bg-white border border-[#D1E3FB] rounded-[8px] flex flex-col w-full overflow-hidden shadow-sm font-['Outfit',sans-serif]">
            <div className={headerClass}>
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM13 13v4h-2v-4H8l4-4 4 4h-3z"></path></svg>
                    Content
                </div>
                <button onClick={() => setView('CONTENT_CREATE')} className="text-white hover:bg-white/20 w-7 h-7 rounded flex items-center justify-center transition-colors text-xl leading-none font-bold pb-0.5">
                    +
                </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
                {/* Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center text-[13px] text-[#333]">
                    <div className="flex items-center gap-2">
                        <span>แสดง</span>
                        <select className="border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#687EFF]">
                            <option>10</option><option>25</option><option>50</option>
                        </select>
                        <span>รายการ</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <span>ค้นหา:</span>
                        <input type="text" className="border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#687EFF]" />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-[#E0E0E0]">
                    <table className="w-full text-left text-[13px] whitespace-nowrap md:whitespace-normal">
                        <thead className="border-b border-gray-200 text-[#333] font-semibold bg-[#FAFAFA]">
                            <tr>
                                <th className="p-2 border-r border-[#E0E0E0] text-center w-[60px]">ลำดับ</th>
                                <th className="p-2 border-r border-[#E0E0E0] w-[180px]">หลักสูตร</th>
                                <th className="p-2 border-r border-[#E0E0E0] w-[200px] text-center">UUID</th>
                                <th className="p-2 border-r border-[#E0E0E0] text-center">Activities</th>
                                <th className="p-2 border-r border-[#E0E0E0] text-center w-[80px]">Learn</th>
                                <th className="p-2 text-center w-[80px]">Tools</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-[#687EFF] border-t-transparent rounded-full animate-spin"></div>
                                        Loading...
                                    </div>
                                </td></tr>
                            ) : contents.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">
                                    ยังไม่มี content กด + เพื่อเพิ่ม
                                </td></tr>
                            ) : contents.map((content, idx) => (
                                <tr key={content.id} className="border-b border-gray-200 text-[#444] hover:bg-gray-50/50 align-top">
                                    <td className="p-2 border-r border-[#E0E0E0] text-center">{idx + 1}</td>
                                    <td className="p-2 border-r border-[#E0E0E0] break-words whitespace-normal font-medium">{content.title}</td>
                                    <td className="p-2 border-r border-[#E0E0E0] text-center text-[11px] font-mono text-gray-500">{content.id}</td>
                                    <td className="p-2 border-r border-[#E0E0E0]">
                                        {content.activities?.length > 0 ? (
                                            <ul className="list-disc pl-5">
                                                {content.activities.map((act, i) => (
                                                    <li key={i} className="mb-0.5">
                                                        <a
                                                            href={resolveActivityUrl(content, act.launch)}
                                                            className="inline-flex items-center gap-1 text-[#337ab7] hover:underline"
                                                            title={act.launch || ''}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const fallback = getContentRootLaunchUrl(content);
                                                                openLaunchWindow(resolveActivityUrl(content, act.launch), fallback);
                                                            }}
                                                        >
                                                            <span>{act.name || act}</span>
                                                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M14 3h7v7"></path>
                                                                <path d="M10 14L21 3"></path>
                                                                <path d="M21 14v7h-7"></path>
                                                                <path d="M3 10v11h11"></path>
                                                            </svg>
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-gray-400 text-[12px]">—</span>
                                        )}
                                    </td>
                                    <td className="p-2 border-r border-[#E0E0E0] text-center">
                                        <button onClick={() => handleLaunch(content)} className="text-[#5CB85C] hover:text-green-700" title="Learn">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </button>
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => handleDelete(content.id)} className="text-red-400 hover:text-red-600" title="Delete">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    // --- RENDER CONTENT CREATE ---
    const renderContentCreate = () => (
        <div className="bg-white flex flex-col w-full min-h-[calc(100vh-200px)] font-['Outfit',sans-serif] rounded-[8px] border border-[#D1E3FB] shadow-sm overflow-hidden">
            <div className={headerClass}>
                <span>Upload Content</span>
            </div>
            <div className="p-8 flex flex-col gap-8 text-[#334155] text-[15px] pt-10">
                {/* Content Title */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-gray-100 pb-8">
                    <label className="font-semibold text-[#052143] text-[16px] sm:w-[150px]">Content Title :</label>
                    <input
                        type="text"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Enter your content title here..."
                        className="flex-1 max-w-[500px] border border-[#E1E5EC] rounded-[8px] px-4 py-3 outline-none focus:border-[#687EFF] focus:ring-4 focus:ring-[#687EFF]/10 transition-all bg-[#FAFAFA]"
                    />
                </div>

                {/* Upload Area */}
                <div className="flex flex-col gap-4">
                    <div
                        className={`w-full max-w-[690px] border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center py-12 px-6 transition-all group cursor-pointer relative ${uploadFile
                            ? 'border-[#1DBA9F] bg-[#F0FDF9]'
                            : isDragging
                                ? 'border-[#687EFF] bg-[#EEF2FF]'
                                : 'border-[#A0BCE0] bg-[#F8FAFC] hover:bg-[#F0F5FA] hover:border-[#687EFF]'
                            }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip"
                            onChange={(e) => handleSelectedFile(e.target.files?.[0] || null)}
                            className="hidden"
                        />

                        {uploadFile ? (
                            <>
                                <div className="w-[64px] h-[64px] bg-[#1DBA9F] rounded-full shadow-sm flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-[18px] font-medium text-[#052143] mb-1">{uploadFile.name}</h3>
                                <p className="text-[14px] text-[#6B778B]">
                                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB — Click to change file
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="w-[64px] h-[64px] bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8 text-[#687EFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <h3 className="text-[18px] font-medium text-[#052143] mb-1 group-hover:text-[#687EFF] transition-colors">
                                    Drag & Drop your TinCan package here
                                </h3>
                                <p className="text-[14px] text-[#6B778B] text-center mb-6">
                                    Supported format: .zip (TinCan/xAPI Package)
                                </p>
                                <span className="bg-[#687EFF] text-white font-medium px-6 py-2.5 rounded-[8px] shadow-sm">
                                    Select File
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                {uploadProgress > 0 && (
                    <div className="w-full max-w-[690px]">
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#687EFF] to-[#1DBA9F] rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-[13px] text-[#6B778B] mt-2">{uploadProgress}% uploaded</p>
                    </div>
                )}

                {/* Message */}
                {uploadMessage && (
                    <div className={`max-w-[690px] p-4 rounded-[8px] text-[14px] ${uploadMessage.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
                            uploadMessage.includes('❌') ? 'bg-red-50 text-red-800 border border-red-200' :
                                'bg-yellow-50 text-yellow-800 border border-yellow-200'
                        }`}>
                        {uploadMessage}
                    </div>
                )}

                {/* Actions */}
                <div className="mt-6 pt-6 flex gap-4 border-t border-gray-100 max-w-[690px] justify-end">
                    <button
                        onClick={() => {
                            setView('CONTENT_LIST');
                            setUploadFile(null);
                            setUploadTitle('');
                            setUploadProgress(0);
                            setUploadMessage('');
                            setIsDragging(false);
                        }}
                        className="bg-white text-[#6B778B] hover:text-[#052143] border border-[#E1E5EC] hover:bg-gray-50 px-8 py-3 rounded-[8px] font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className={`px-8 py-3 rounded-[8px] font-medium shadow-sm flex items-center gap-2 transition-all ${uploading
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-[#1DBA9F] hover:bg-teal-600 text-white hover:shadow-md hover:-translate-y-0.5'
                            }`}
                    >
                        {uploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Uploading...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                Start Upload
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-6 font-['Outfit',sans-serif]">
                <h1 className="text-[28px] font-medium text-[#052143] leading-[150%]">Content</h1>
                {view === 'CONTENT_LIST' && renderContentList()}
                {view === 'CONTENT_CREATE' && renderContentCreate()}
                <div className="text-center text-[#6B778B] text-[13px] py-4">Copyright © 2024</div>
            </div>
        </AdminLmsDashboard>
    );
}

