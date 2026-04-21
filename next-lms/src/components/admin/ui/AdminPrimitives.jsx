'use client';

import React from 'react';
import { BadgeCheck, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function cn(...values) {
    return values.filter(Boolean).join(' ');
}

export const adminInputClass = 'h-[42px] w-full rounded-xl border border-[#DDE4FF] bg-white px-3 text-[14px] text-[#1E293B] outline-none transition focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20';
export const adminTextareaClass = 'w-full rounded-xl border border-[#DDE4FF] bg-white px-3 py-3 text-[14px] text-[#1E293B] outline-none transition focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20';
export const adminSelectClass = adminInputClass;
export const adminSecondaryButtonClass = 'inline-flex h-[42px] items-center justify-center rounded-xl border border-[#DDE4FF] bg-white px-4 text-[14px] font-medium text-[#475569] transition hover:bg-[#F8FAFF]';
export const adminDangerButtonClass = 'inline-flex h-[42px] items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-[14px] font-medium text-rose-600 transition hover:bg-rose-50';
export const adminPrimaryButtonClass = 'inline-flex h-[42px] items-center justify-center rounded-xl bg-[#687EFF] px-4 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(104,126,255,0.22)] transition hover:bg-[#5A6FE0] disabled:cursor-not-allowed disabled:opacity-60';

export function AdminPageHeader({ title, description, action }) {
    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
                <h1 className="text-[24px] font-semibold leading-tight text-[#0F2243] sm:text-[28px] lg:text-[30px]">{title}</h1>
                {description ? <p className="mt-1 text-[14px] text-[#64748B]">{description}</p> : null}
            </div>
            {action ? <div className="w-full md:w-auto shrink-0">{action}</div> : null}
        </div>
    );
}

export function AdminCard({ title, action, children, contentClassName = '', headerTone = 'primary' }) {
    const primary = headerTone === 'primary';
        return (
        <section className="overflow-hidden rounded-[20px] border border-[#D1E3FB] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            {title ? (
                <div className={cn(
                    'flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5',
                    primary
                        ? 'border-[#7D95FF] bg-[linear-gradient(90deg,#687EFF_0%,#8092FF_100%)] text-white'
                        : 'border-[#EEF2FF] bg-white text-[#1E293B]'
                )}>
                    <div className={cn('text-[16px] font-semibold', primary ? 'text-white' : 'text-[#1E293B]')}>{title}</div>
                    {action ? <div className="shrink-0">{action}</div> : null}
                </div>
            ) : null}
            <div className={cn('p-4 sm:p-5', contentClassName)}>{children}</div>
        </section>
    );
}

export function AdminToolbar({ left, right, className = '' }) {
    return (
        <div className={cn('mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between', className)}>
            <div className="flex flex-wrap items-center gap-2">{left}</div>
            <div className="flex flex-wrap items-center gap-2">{right}</div>
        </div>
    );
}

export function AdminEntriesControl({ value, onChange, label = 'records' }) {
    return (
        <div className="flex items-center gap-2 text-[14px] text-[#64748B]">
            <select
                className="h-[38px] rounded-xl border border-[#DDE4FF] bg-white px-3 text-[13px] text-[#334155] outline-none focus:border-[#687EFF]"
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            >
                {[10, 20, 50, 100].map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
            <span>{label}</span>
        </div>
    );
}

export function AdminSearchInput({ value, onChange, placeholder, className = '' }) {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={cn('h-[38px] w-full rounded-xl border border-[#DDE4FF] bg-white px-3 text-[13px] text-[#334155] outline-none transition focus:border-[#687EFF] focus:ring-2 focus:ring-[#687EFF]/20 lg:w-[320px]', className)}
        />
    );
}

export function AdminTableWrap({ children }) {
    return <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-[16px] border border-[#E8EEFF] [scrollbar-gutter:stable_both-edges]">{children}</div>;
}

export function AdminTable({ children, className = '' }) {
    return <table className={cn('w-full min-w-[620px] md:min-w-[820px] text-left text-[13px]', className)}>{children}</table>;
}

export function AdminTableHead({ children }) {
    return <thead className="border-b border-[#E8EEFF] bg-[#F8FAFF] text-[#334155]">{children}</thead>;
}

export function AdminTh({ children, className = '' }) {
    return <th className={cn('px-3 py-2.5 text-[12px] font-semibold sm:px-4 sm:py-3 sm:text-[13px]', className)}>{children}</th>;
}

export function AdminTd({ children, className = '' }) {
    return <td className={cn('px-3 py-2.5 text-[12px] align-top text-[#475569] sm:px-4 sm:py-3 sm:text-[13px]', className)}>{children}</td>;
}

export function AdminBodyStateRow({ colSpan, children, tone = 'muted' }) {
    const toneClass = tone === 'error' ? 'text-rose-600' : 'text-[#64748B]';
    return (
        <tr>
            <td colSpan={colSpan} className={cn('px-4 py-10 text-center text-[13px]', toneClass)}>
                {children}
            </td>
        </tr>
    );
}

export function AdminStatusPill({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }) {
    return (
        <span className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
            active ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
        )}>
            {active ? activeLabel : inactiveLabel}
        </span>
    );
}

export function AdminPagination({ currentPage, totalPages, onPageChange, totalItems, startRow, endRow }) {
    const pageNumbers = React.useMemo(() => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, 5];
        if (currentPage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
    }, [currentPage, totalPages]);

    return (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px] text-[#64748B]">
                Showing {startRow} to {endRow} of {totalItems} entries
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="h-9 rounded-xl border border-[#DDE4FF] bg-white px-3 text-[13px] text-[#334155] transition hover:bg-[#F8FAFF] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Prev
                </button>
                {pageNumbers.map((page) => (
                    <button
                        key={page}
                        type="button"
                        onClick={() => onPageChange(page)}
                        className={cn(
                            'h-9 min-w-9 rounded-xl border px-3 text-[13px] font-semibold transition',
                            currentPage === page
                                ? 'border-[#687EFF] bg-[#687EFF] text-white shadow-[0_8px_18px_rgba(104,126,255,0.18)]'
                                : 'border-[#DDE4FF] bg-white text-[#334155] hover:bg-[#F8FAFF]'
                        )}
                    >
                        {page}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="h-9 rounded-xl border border-[#DDE4FF] bg-white px-3 text-[13px] text-[#334155] transition hover:bg-[#F8FAFF] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

export function AdminInlineAlert({ tone = 'error', children }) {
    const toneClass = tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-rose-200 bg-rose-50 text-rose-700';
    return <div className={cn('rounded-xl border px-4 py-3 text-[13px]', toneClass)}>{children}</div>;
}

function normalizeToastTone(value) {
    const tone = String(value || '').trim().toLowerCase();
    if (tone === 'success' || tone === 'warning' || tone === 'error') return tone;
    return 'info';
}

function getToastClassName(tone) {
    const normalized = normalizeToastTone(tone);
    if (normalized === 'success') return 'admin-toast admin-toast--success';
    if (normalized === 'warning') return 'admin-toast admin-toast--warning';
    if (normalized === 'error') return 'admin-toast admin-toast--error';
    return 'admin-toast admin-toast--info';
}

function getToastProgressClassName(tone) {
    const normalized = normalizeToastTone(tone);
    if (normalized === 'success') return 'admin-toast-progress admin-toast-progress--success';
    if (normalized === 'warning') return 'admin-toast-progress admin-toast-progress--warning';
    if (normalized === 'error') return 'admin-toast-progress admin-toast-progress--error';
    return 'admin-toast-progress admin-toast-progress--info';
}

function getToastIcon(type) {
    if (type === 'success') return <BadgeCheck className="h-[18px] w-[18px] stroke-emerald-500" />;
    if (type === 'warning') return <TriangleAlert className="h-[18px] w-[18px] stroke-amber-500" />;
    if (type === 'error') return <CircleAlert className="h-[18px] w-[18px] stroke-rose-500" />;
    return <Info className="h-[18px] w-[18px] stroke-indigo-500" />;
}

export function AdminToastStack({ toasts = [], onDismiss }) {
    const toastIdMapRef = React.useRef(new Map());

    React.useEffect(() => {
        const items = Array.isArray(toasts) ? toasts : [];
        const nextKeys = new Set();

        for (const item of items) {
            const key = String(item?.id ?? '').trim();
            if (!key) continue;
            nextKeys.add(key);
            if (toastIdMapRef.current.has(key)) continue;

            const tone = normalizeToastTone(item?.tone);
            const content = (
                <div className="min-w-0 py-0.5">
                    {item?.title ? <div className="text-[12px] font-semibold text-[#475569]">{item.title}</div> : null}
                    <div className="text-[13px] text-[#6B7280]">{item?.message || ''}</div>
                </div>
            );

            const toastifyId = toast(content, {
                containerId: 'admin-toast-stack',
                toastId: `admin-toast-${key}`,
                type: tone,
                autoClose: 3200,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                className: getToastClassName(tone),
                progressClassName: getToastProgressClassName(tone),
                bodyClassName: 'admin-toast-body',
                onClose: () => {
                    onDismiss?.(item?.id);
                },
            });

            toastIdMapRef.current.set(key, toastifyId);
        }

        for (const [key, toastifyId] of toastIdMapRef.current.entries()) {
            if (nextKeys.has(key)) continue;
            toast.dismiss(toastifyId);
            toastIdMapRef.current.delete(key);
        }
    }, [toasts, onDismiss]);

    React.useEffect(() => () => {
        for (const toastifyId of toastIdMapRef.current.values()) {
            toast.dismiss(toastifyId);
        }
        toastIdMapRef.current.clear();
    }, []);

    return (
        <>
            <ToastContainer
                containerId="admin-toast-stack"
                position="top-right"
                newestOnTop
                hideProgressBar={false}
                closeButton
                icon={({ type }) => getToastIcon(type)}
                className="admin-toast-container"
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

export function AdminModal({ open, title, children, footer, width = 'max-w-[560px]' }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4">
            <div className={cn('w-full overflow-hidden rounded-[20px] border border-[#DDE4FF] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]', width)}>
                <div className="border-b border-[#EEF2FF] px-5 py-4">
                    <h2 className="text-[18px] font-semibold text-[#0F2243]">{title}</h2>
                </div>
                <div className="p-5">{children}</div>
                {footer ? <div className="border-t border-[#EEF2FF] bg-[#FBFCFF] px-5 py-4">{footer}</div> : null}
            </div>
        </div>
    );
}
