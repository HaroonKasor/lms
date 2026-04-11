'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';

const SUPPORTED_VARIANTS = ['nova', 'orbit', 'minimal'];

export default function LoadScreen({
    text = 'Loading...',
    className = '',
    variant = 'minimal',
    subtitle = 'Please wait while we prepare your learning space',
}) {
    const activeVariant = SUPPORTED_VARIANTS.includes(variant) ? variant : 'minimal';

    useEffect(() => {
        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevBodyHeight = document.body.style.height;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            // Restore exactly what the page had before lock.
            document.body.style.overflow = prevBodyOverflow || '';
            document.body.style.height = prevBodyHeight || '';
            document.documentElement.style.overflow = prevHtmlOverflow || '';
        };
    }, []);

    const renderLoader = () => {
        if (activeVariant === 'orbit') {
            return (
                <div className="orbit-loader" aria-hidden="true">
                    <div className="orbit-center">
                        <Image src="/skillup_logo.png" alt="" width={28} height={28} className="brand-mark" />
                    </div>
                    <span className="orbit-dot dot-1"></span>
                    <span className="orbit-dot dot-2"></span>
                    <span className="orbit-dot dot-3"></span>
                </div>
            );
        }

        if (activeVariant === 'minimal') {
            return (
                <div className="minimal-loader" aria-hidden="true">
                    <span className="minimal-bar bar-1"></span>
                    <span className="minimal-bar bar-2"></span>
                    <span className="minimal-bar bar-3"></span>
                    <span className="minimal-bar bar-4"></span>
                    <span className="minimal-bar bar-5"></span>
                </div>
            );
        }

        return (
            <div className="nova-loader" aria-hidden="true">
                <span className="nova-ring ring-a"></span>
                <span className="nova-ring ring-b"></span>
                <div className="nova-core">
                    <Image src="/skillup_logo.png" alt="" width={30} height={30} className="brand-mark" />
                </div>
            </div>
        );
    };

    return (
        <div
            className={`loadscreen-overlay variant-${activeVariant} fixed inset-0 z-[9999] flex items-center justify-center p-6 backdrop-blur-xl ${className}`.trim()}
            role="status"
            aria-live="polite"
            aria-label={text}
        >
            <div className="loadscreen-glow" aria-hidden="true"></div>

            <div className="loadscreen-card">
                <div className="brand-chip">SkillUp LMS</div>
                {renderLoader()}

                <div className="text-wrap">
                    <p className="loadscreen-title">{text}</p>
                    <p className="loadscreen-subtitle">{subtitle}</p>
                </div>

                <div className="progress-track" aria-hidden="true">
                    <span className="progress-shine"></span>
                </div>
            </div>

            <style jsx>{`
                .loadscreen-overlay {
                    --ls-navy: #052143;
                    --ls-primary: #687eff;
                    --ls-accent: #f87a53;
                    --ls-card: rgba(255, 255, 255, 0.84);
                    --ls-border: rgba(209, 227, 251, 0.95);
                    --ls-text-main: #052143;
                    --ls-text-sub: #6b778b;
                }

                .variant-nova {
                    background:
                        radial-gradient(1000px 500px at 15% -10%, rgba(104, 126, 255, 0.2), transparent 62%),
                        radial-gradient(800px 420px at 85% 110%, rgba(248, 122, 83, 0.17), transparent 60%),
                        linear-gradient(180deg, rgba(5, 33, 67, 0.5) 0%, rgba(9, 25, 57, 0.58) 100%);
                }

                .variant-orbit {
                    background:
                        radial-gradient(900px 440px at 50% -10%, rgba(104, 126, 255, 0.22), transparent 62%),
                        radial-gradient(700px 390px at 20% 110%, rgba(248, 122, 83, 0.2), transparent 64%),
                        linear-gradient(180deg, rgba(4, 22, 46, 0.62) 0%, rgba(2, 16, 34, 0.7) 100%);
                }

                .variant-minimal {
                    --ls-card: rgba(255, 255, 255, 0.9);
                    --ls-border: rgba(209, 227, 251, 0.8);
                    background:
                        radial-gradient(900px 450px at 10% 0%, rgba(104, 126, 255, 0.15), transparent 64%),
                        radial-gradient(700px 380px at 100% 100%, rgba(248, 122, 83, 0.14), transparent 62%),
                        linear-gradient(180deg, rgba(5, 33, 67, 0.46) 0%, rgba(9, 25, 57, 0.48) 100%);
                }

                .loadscreen-glow {
                    position: absolute;
                    width: min(72vw, 760px);
                    height: min(72vw, 760px);
                    border-radius: 999px;
                    background: radial-gradient(circle at center, rgba(104, 126, 255, 0.23), transparent 65%);
                    filter: blur(10px);
                    transform: translateY(-4%);
                    animation: float-glow 4s ease-in-out infinite;
                }

                .loadscreen-card {
                    position: relative;
                    width: min(92vw, 480px);
                    border-radius: 26px;
                    background: var(--ls-card);
                    border: 1px solid var(--ls-border);
                    box-shadow: 0 28px 80px rgba(5, 33, 67, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.65);
                    padding: 30px 28px 24px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 18px;
                }

                .variant-minimal .loadscreen-card {
                    box-shadow: 0 20px 60px rgba(5, 33, 67, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.65);
                }

                .loadscreen-card::before {
                    content: '';
                    position: absolute;
                    inset: 1px;
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.55);
                    pointer-events: none;
                }

                .brand-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    letter-spacing: 0.14em;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #4765f4;
                    padding: 6px 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(104, 126, 255, 0.22);
                    background: rgba(104, 126, 255, 0.08);
                }

                .brand-mark {
                    width: 28px;
                    height: 28px;
                    object-fit: contain;
                }

                .nova-loader {
                    width: 92px;
                    height: 92px;
                    position: relative;
                    display: grid;
                    place-items: center;
                }

                .nova-ring {
                    position: absolute;
                    border-radius: 999px;
                    border: 2px solid rgba(104, 126, 255, 0.24);
                    animation: spin 1.25s linear infinite;
                }

                .ring-a {
                    inset: 0;
                    border-top-color: #687eff;
                    border-right-color: #f87a53;
                }

                .ring-b {
                    inset: 12px;
                    border-left-color: #687eff;
                    border-bottom-color: #f87a53;
                    animation-duration: 1.8s;
                    animation-direction: reverse;
                }

                .nova-core,
                .orbit-center {
                    width: 54px;
                    height: 54px;
                    border-radius: 999px;
                    background: linear-gradient(145deg, #ffffff 0%, #f1f5ff 100%);
                    border: 1px solid rgba(104, 126, 255, 0.25);
                    box-shadow: 0 10px 24px rgba(104, 126, 255, 0.2);
                    display: grid;
                    place-items: center;
                    animation: pulse 1.8s ease-in-out infinite;
                }

                .orbit-loader {
                    width: 94px;
                    height: 94px;
                    border-radius: 999px;
                    position: relative;
                    display: grid;
                    place-items: center;
                    animation: spin 2.4s linear infinite;
                }

                .orbit-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 999px;
                    position: absolute;
                    box-shadow: 0 0 0 6px rgba(104, 126, 255, 0.1);
                }

                .dot-1 {
                    top: 0;
                    left: 42px;
                    background: #687eff;
                }

                .dot-2 {
                    top: 64px;
                    right: -1px;
                    background: #f87a53;
                }

                .dot-3 {
                    left: -1px;
                    bottom: 22px;
                    background: #1dba9f;
                }

                .minimal-loader {
                    width: min(88vw, 260px);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    height: 32px;
                }

                .minimal-bar {
                    flex: 1;
                    min-width: 10px;
                    height: 8px;
                    border-radius: 999px;
                    background: rgba(104, 126, 255, 0.2);
                    transform-origin: center;
                    animation: minimal-wave 1.05s ease-in-out infinite;
                }

                .bar-1 {
                    animation-delay: 0s;
                }

                .bar-2 {
                    animation-delay: 0.1s;
                }

                .bar-3 {
                    animation-delay: 0.2s;
                }

                .bar-4 {
                    animation-delay: 0.3s;
                }

                .bar-5 {
                    animation-delay: 0.4s;
                }

                .text-wrap {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                .loadscreen-title {
                    margin: 0;
                    color: var(--ls-text-main);
                    font-size: 18px;
                    font-weight: 700;
                    letter-spacing: 0.01em;
                    line-height: 1.35;
                }

                .loadscreen-subtitle {
                    margin: 0;
                    color: var(--ls-text-sub);
                    font-size: 13px;
                    font-weight: 500;
                    line-height: 1.5;
                }

                .progress-track {
                    width: 100%;
                    height: 8px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, rgba(104, 126, 255, 0.18) 0%, rgba(248, 122, 83, 0.2) 100%);
                    overflow: hidden;
                    position: relative;
                }

                .variant-minimal .progress-track {
                    background: rgba(104, 126, 255, 0.14);
                }

                .progress-shine {
                    position: absolute;
                    inset: 0;
                    width: 42%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, #687eff 50%, rgba(255, 255, 255, 0) 100%);
                    filter: saturate(120%);
                    animation: slide 1.45s ease-in-out infinite;
                }

                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                @keyframes pulse {
                    0%,
                    100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.06);
                    }
                }

                @keyframes minimal-wave {
                    0%,
                    100% {
                        transform: scaleY(1);
                        background: rgba(104, 126, 255, 0.2);
                    }
                    50% {
                        transform: scaleY(1.8);
                        background: rgba(104, 126, 255, 0.56);
                    }
                }

                @keyframes slide {
                    0% {
                        transform: translateX(-125%);
                    }
                    100% {
                        transform: translateX(290%);
                    }
                }

                @keyframes float-glow {
                    0%,
                    100% {
                        transform: translateY(-4%) scale(1);
                    }
                    50% {
                        transform: translateY(-1%) scale(1.03);
                    }
                }

                @media (max-width: 640px) {
                    .loadscreen-card {
                        border-radius: 22px;
                        padding: 26px 20px 20px;
                        gap: 16px;
                    }

                    .brand-chip {
                        font-size: 10px;
                        letter-spacing: 0.12em;
                    }

                    .loadscreen-title {
                        font-size: 16px;
                    }

                    .loadscreen-subtitle {
                        font-size: 12px;
                    }

                    .nova-loader,
                    .orbit-loader {
                        width: 78px;
                        height: 78px;
                    }

                    .ring-b {
                        inset: 9px;
                    }

                    .nova-core,
                    .orbit-center {
                        width: 46px;
                        height: 46px;
                    }

                    .brand-mark {
                        width: 24px;
                        height: 24px;
                    }

                    .dot-1 {
                        left: 34px;
                    }

                    .dot-2 {
                        top: 53px;
                    }

                    .minimal-loader {
                        height: 24px;
                        gap: 6px;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .loadscreen-glow,
                    .nova-ring,
                    .nova-core,
                    .orbit-loader,
                    .orbit-center,
                    .minimal-bar,
                    .progress-shine {
                        animation: none;
                    }
                }
            `}</style>
        </div>
    );
}
