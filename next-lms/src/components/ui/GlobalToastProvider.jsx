'use client';

import React from 'react';
import { BadgeCheck, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function renderToastIcon(type) {
    if (type === 'success') return <BadgeCheck className="h-[18px] w-[18px] stroke-emerald-500" />;
    if (type === 'warning') return <TriangleAlert className="h-[18px] w-[18px] stroke-amber-500" />;
    if (type === 'error') return <CircleAlert className="h-[18px] w-[18px] stroke-rose-500" />;
    return <Info className="h-[18px] w-[18px] stroke-indigo-500" />;
}

function normalizeToastTone(value) {
    const tone = String(value || '').trim().toLowerCase();
    if (tone === 'success' || tone === 'warning' || tone === 'error') return tone;
    return 'info';
}

function getToastClassName(tone) {
    const normalized = normalizeToastTone(tone);
    if (normalized === 'success') return 'Toastify__toast admin-toast admin-toast--success';
    if (normalized === 'warning') return 'Toastify__toast admin-toast admin-toast--warning';
    if (normalized === 'error') return 'Toastify__toast admin-toast admin-toast--error';
    return 'Toastify__toast admin-toast admin-toast--info';
}

function getToastProgressClassName(tone) {
    const normalized = normalizeToastTone(tone);
    if (normalized === 'success') return 'Toastify__progress-bar Toastify__progress-bar--animated admin-toast-progress admin-toast-progress--success';
    if (normalized === 'warning') return 'Toastify__progress-bar Toastify__progress-bar--animated admin-toast-progress admin-toast-progress--warning';
    if (normalized === 'error') return 'Toastify__progress-bar Toastify__progress-bar--animated admin-toast-progress admin-toast-progress--error';
    return 'Toastify__progress-bar Toastify__progress-bar--animated admin-toast-progress admin-toast-progress--info';
}

export default function GlobalToastProvider() {
    return (
        <>
            <ToastContainer
                containerId="global-toast"
                position="top-right"
                newestOnTop
                closeOnClick
                pauseOnHover
                draggable
                autoClose={3200}
                hideProgressBar={false}
                closeButton
                rtl={false}
                icon={({ type }) => renderToastIcon(type)}
                className="admin-toast-container"
                toastClassName={(context) => {
                    const type = String(context?.type || 'info');
                    return getToastClassName(type);
                }}
                progressClassName={(context) => {
                    const type = String(context?.type || 'info');
                    return getToastProgressClassName(type);
                }}
                bodyClassName="admin-toast-body"
            />

            <style jsx global>{`
                .admin-toast-container.Toastify__toast-container--top-right {
                    top: 92px;
                    right: 20px;
                    width: min(360px, calc(100vw - 32px));
                    z-index: 70;
                }

                .admin-toast {
                    min-height: 0;
                    margin-bottom: 12px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    color: #6b7280;
                    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
                    padding: 0;
                    overflow: hidden;
                }

                .admin-toast-body {
                    margin: 0;
                    padding: 14px 14px 14px 12px;
                }

                .admin-toast .Toastify__close-button {
                    align-self: flex-start;
                    color: #9ca3af;
                    opacity: 0.9;
                    margin-top: 6px;
                    margin-right: 4px;
                }

                .admin-toast .Toastify__close-button:hover {
                    color: #6b7280;
                    opacity: 1;
                }

                .admin-toast-progress {
                    height: 4px;
                    position: absolute;
                    left: 0;
                    bottom: 0;
                    width: 100%;
                }

                .admin-toast--info {
                    border-color: #dbeafe;
                }

                .admin-toast--error {
                    border-color: #fecdd3;
                }

                .admin-toast--success {
                    border-color: #bbf7d0;
                }

                .admin-toast--warning {
                    border-color: #fde68a;
                }

                .admin-toast-progress--info {
                    background: #60a5fa;
                }

                .admin-toast-progress--error {
                    background: #f87171;
                }

                .admin-toast-progress--success {
                    background: #4ade80;
                }

                .admin-toast-progress--warning {
                    background: #facc15;
                }

                @media (max-width: 640px) {
                    .admin-toast-container.Toastify__toast-container--top-right {
                        top: 82px;
                        right: 12px;
                        width: min(360px, calc(100vw - 24px));
                    }
                }
            `}</style>
        </>
    );
}
