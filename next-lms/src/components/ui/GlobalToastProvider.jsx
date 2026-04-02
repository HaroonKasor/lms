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
                icon={({ type }) => renderToastIcon(type)}
                className="global-toast-container"
                toastClassName={(context) => {
                    const type = String(context?.type || 'info');
                    return `global-toast global-toast--${type}`;
                }}
                progressClassName={(context) => {
                    const type = String(context?.type || 'info');
                    return `global-toast-progress global-toast-progress--${type}`;
                }}
                bodyClassName="global-toast-body"
            />

            <style jsx global>{`
                .global-toast-container.Toastify__toast-container--top-right {
                    top: 92px;
                    right: 20px;
                    width: min(380px, calc(100vw - 32px));
                    z-index: 90;
                }

                .global-toast {
                    min-height: 0;
                    margin-bottom: 12px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    color: #6b7280;
                    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
                    padding: 0;
                }

                .global-toast-body {
                    margin: 0;
                    padding: 14px 14px 14px 12px;
                }

                .global-toast .Toastify__close-button {
                    align-self: flex-start;
                    color: #9ca3af;
                    opacity: 0.9;
                    margin-top: 6px;
                    margin-right: 4px;
                }

                .global-toast .Toastify__close-button:hover {
                    color: #6b7280;
                    opacity: 1;
                }

                .global-toast-progress {
                    height: 4px;
                }

                .global-toast--info {
                    border-color: #dbeafe;
                }

                .global-toast--error {
                    border-color: #fecdd3;
                }

                .global-toast--success {
                    border-color: #bbf7d0;
                }

                .global-toast--warning {
                    border-color: #fde68a;
                }

                .global-toast-progress--info {
                    background: #60a5fa;
                }

                .global-toast-progress--error {
                    background: #f87171;
                }

                .global-toast-progress--success {
                    background: #4ade80;
                }

                .global-toast-progress--warning {
                    background: #facc15;
                }

                @media (max-width: 640px) {
                    .global-toast-container.Toastify__toast-container--top-right {
                        top: 82px;
                        right: 12px;
                        width: min(380px, calc(100vw - 24px));
                    }
                }
            `}</style>
        </>
    );
}
