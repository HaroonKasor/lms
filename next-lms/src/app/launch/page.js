'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadScreen from '@/components/ui/LoadScreen';

function isDirectVideo(url = '') {
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function normalizeLaunchSrc(raw = '') {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;

    const noOrigin = value.replace(/^https?:\/\/[^/]+/i, '');
    const withSlash = noOrigin.startsWith('/') ? noOrigin : `/${noOrigin}`;
    return withSlash.replace(/^\/content\//i, '/content/');
}

function LaunchPageContent() {
    const searchParams = useSearchParams();
    const src = searchParams.get('src') || '';
    const autoplay = searchParams.get('autoplay') === '1';
    const videoRef = useRef(null);
    const iframeRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [resolvedSrc, setResolvedSrc] = useState('');
    const [resolving, setResolving] = useState(true);

    const decodedSrc = useMemo(() => {
        try {
            return decodeURIComponent(src);
        } catch {
            return src;
        }
    }, [src]);

    useEffect(() => {
        setIsReady(false);
    }, [resolvedSrc]);

    useEffect(() => {
        let cancelled = false;

        const resolveSrc = async () => {
            setResolving(true);
            const normalized = normalizeLaunchSrc(decodedSrc);
            if (!normalized) {
                if (!cancelled) {
                    setResolvedSrc('');
                    setResolving(false);
                }
                return;
            }

            if (/^https?:\/\//i.test(normalized)) {
                if (!cancelled) {
                    setResolvedSrc(normalized);
                    setResolving(false);
                }
                return;
            }

            const normalizedNoQuery = normalized.split(/[?#]/)[0];
            const indexLaunchMatch = normalizedNoQuery.match(/^\/content\/([^/]+)\/index\.html$/i);
            const normalizedLocalPreferred = indexLaunchMatch?.[1]
                ? `/content/${indexLaunchMatch[1]}`
                : normalized;

            const tryResolveCandidate = async (candidate, fallback) => {
                const fallbackSafe = normalizeLaunchSrc(fallback) || fallback;
                const res = await fetch(`/api/content/resolve?src=${encodeURIComponent(candidate)}`, { cache: 'no-store' });
                const data = await res.json().catch(() => null);
                const resolved = normalizeLaunchSrc(data?.resolvedSrc || '') || '';
                if (res.ok) {
                    return { ok: true, resolved: resolved || fallbackSafe };
                }
                return { ok: false, resolved: fallbackSafe };
            };

            try {
                const first = await tryResolveCandidate(normalizedLocalPreferred, normalizedLocalPreferred);
                let safe = first.resolved;
                let success = first.ok;

                // Some environments can temporarily fail the first lookup right after upload.
                // Retry with canonical index fallback for the same content id.
                if (!success) {
                    const localNoQuery = safe.split(/[?#]/)[0];
                    const match = localNoQuery.match(/^\/content\/([^/]+)\/?/i);
                    if (match?.[1]) {
                        const retryCandidates = [
                            `/content/${match[1]}/index.html`,
                            `/content/${match[1]}`,
                        ];

                        for (const retrySrc of retryCandidates) {
                            const retry = await tryResolveCandidate(retrySrc, safe);
                            safe = retry.resolved;
                            if (retry.ok) {
                                success = true;
                                break;
                            }
                        }
                    }
                }

                if (!cancelled) {
                    setResolvedSrc(safe);
                }
            } catch {
                if (!cancelled) {
                    setResolvedSrc(normalizedLocalPreferred);
                }
            } finally {
                if (!cancelled) {
                    setResolving(false);
                }
            }
        };

        resolveSrc();
        return () => {
            cancelled = true;
        };
    }, [decodedSrc]);

    useEffect(() => {
        if (!autoplay || !iframeRef.current || !resolvedSrc || isDirectVideo(resolvedSrc)) return;

        const tryPlayMediaInDocument = (doc, depth = 0) => {
            if (!doc || depth > 4) return false;
            const mediaNodes = Array.from(doc.querySelectorAll('video, audio'));
            for (const media of mediaNodes) {
                try {
                    media.muted = true;
                    media.setAttribute('autoplay', 'autoplay');
                    media.play?.().catch(() => { });
                    return true;
                } catch {
                    // ignore
                }
            }

            const childFrames = Array.from(doc.querySelectorAll('iframe'));
            for (const frame of childFrames) {
                try {
                    const childDoc = frame.contentWindow?.document;
                    if (tryPlayMediaInDocument(childDoc, depth + 1)) return true;
                } catch {
                    // Cross-origin frame; skip.
                }
            }
            return false;
        };

        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (tries > 20) {
                clearInterval(timer);
                return;
            }

            try {
                const doc = iframeRef.current?.contentWindow?.document;
                const played = tryPlayMediaInDocument(doc);
                if (played) {
                    clearInterval(timer);
                }
            } catch {
                // Cross-origin or not ready yet.
            }
        }, 400);

        return () => clearInterval(timer);
    }, [autoplay, resolvedSrc]);

    useEffect(() => {
        if (!autoplay || !resolvedSrc || !isDirectVideo(resolvedSrc)) return;
        const video = videoRef.current;
        if (!video) return;
        const triggerPlay = () => {
            video.muted = true;
            video.play?.().catch(() => { });
        };
        triggerPlay();
        video.addEventListener('loadedmetadata', triggerPlay);
        video.addEventListener('canplay', triggerPlay);
        return () => {
            video.removeEventListener('loadedmetadata', triggerPlay);
            video.removeEventListener('canplay', triggerPlay);
        };
    }, [autoplay, resolvedSrc]);

    if (!resolvedSrc) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center relative">
                <p className="z-10">Missing launch source</p>
                <LoadScreen text="Preparing launch..." variant="minimal" className="bg-[#0a0a0a]/55" />
            </div>
        );
    }

    if (isDirectVideo(resolvedSrc)) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <video
                    ref={videoRef}
                    src={resolvedSrc}
                    autoPlay={autoplay}
                    controls
                    muted={autoplay}
                    playsInline
                    className="w-screen h-screen object-contain bg-black"
                    onLoadedData={() => setIsReady(true)}
                />
                {(!isReady || resolving) && <LoadScreen text="Loading content..." variant="minimal" className="bg-[#0a0a0a]/55" />}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black relative">
            <iframe
                ref={iframeRef}
                src={resolvedSrc}
                className="w-screen h-screen border-0"
                allow="autoplay; fullscreen; accelerometer; camera; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-same-origin allow-scripts allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
                title="Content Launch"
                onLoad={() => setIsReady(true)}
            />
            {(!isReady || resolving) && <LoadScreen text="Loading content..." variant="minimal" className="bg-[#0a0a0a]/55" />}
        </div>
    );
}

export default function LaunchPage() {
    return (
        <Suspense
            fallback={
                <LoadScreen text="Loading launch content..." variant="minimal" className="bg-[#0a0a0a]/55" />
            }
        >
            <LaunchPageContent />
        </Suspense>
    );
}

