"use client";

import { useEffect, useMemo, useState } from "react";
import { Cookie } from "lucide-react";
import {
    COOKIE_CONSENT_COOKIE_NAME,
    COOKIE_CONSENT_ID_STORAGE_KEY,
    COOKIE_CONSENT_MAX_AGE_SECONDS,
    COOKIE_CONSENT_SCHEMA_VERSION,
    COOKIE_CONSENT_STORAGE_KEY,
    normalizeConsentCategories,
    normalizeConsentChoice,
    resolveCookiePolicyVersion,
} from "@/lib/cookie-consent";

const POLICY_VERSION = resolveCookiePolicyVersion();

function safeParseConsent(rawValue) {
    if (!rawValue) return null;
    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== "object") return null;
        if (Number(parsed.version) !== COOKIE_CONSENT_SCHEMA_VERSION) return null;
        if (String(parsed.policyVersion || "") !== POLICY_VERSION) return null;
        const choice = normalizeConsentChoice(parsed.choice);
        return {
            ...parsed,
            choice,
            categories: normalizeConsentCategories(parsed.categories),
        };
    } catch {
        return null;
    }
}

function readConsentFromCookie() {
    if (typeof document === "undefined") return null;
    const cookieParts = document.cookie.split("; ");
    const target = cookieParts.find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));
    if (!target) return null;
    const encodedValue = target.slice(COOKIE_CONSENT_COOKIE_NAME.length + 1);
    try {
        const decoded = decodeURIComponent(encodedValue);
        return safeParseConsent(decoded);
    } catch {
        return null;
    }
}

function writeConsentToCookie(payload) {
    if (typeof document === "undefined") return;
    const encodedValue = encodeURIComponent(JSON.stringify(payload));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${encodedValue}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function readConsentFromStorage() {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
        return safeParseConsent(raw);
    } catch {
        return null;
    }
}

function writeConsentToStorage(payload) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // ignore storage write failures (private mode, blocked storage, etc.)
    }
}

function getConsentId() {
    if (typeof window === "undefined") return null;
    try {
        const existing = String(window.localStorage.getItem(COOKIE_CONSENT_ID_STORAGE_KEY) || "").trim();
        if (existing) return existing;
        const next = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `consent_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        window.localStorage.setItem(COOKIE_CONSENT_ID_STORAGE_KEY, next);
        return next;
    } catch {
        return null;
    }
}

function buildConsentPayload({ analytics, marketing, source = "banner" }) {
    const categories = {
        necessary: true,
        analytics: Boolean(analytics),
        marketing: Boolean(marketing),
    };
    let choice = "custom";
    if (categories.analytics && categories.marketing) choice = "all";
    if (!categories.analytics && !categories.marketing) choice = "essential";

    return {
        consentId: getConsentId(),
        version: COOKIE_CONSENT_SCHEMA_VERSION,
        policyVersion: POLICY_VERSION,
        choice,
        timestamp: new Date().toISOString(),
        source,
        categories,
    };
}

async function syncConsentToServer(payload) {
    try {
        await fetch("/api/cookie-consent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ consent: payload }),
            keepalive: true,
        });
    } catch {
        // best effort logging only
    }
}

export default function CookieConsentBanner() {
    const [hydrated, setHydrated] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
    const [marketingEnabled, setMarketingEnabled] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            const cookieConsent = readConsentFromCookie();
            const storageConsent = readConsentFromStorage();
            const existingConsent = cookieConsent || storageConsent;
            if (existingConsent) {
                const categories = normalizeConsentCategories(existingConsent.categories);
                setAnalyticsEnabled(categories.analytics);
                setMarketingEnabled(categories.marketing);
                setShowBanner(false);
            } else {
                setShowBanner(true);
            }
            setHydrated(true);
        });
        return () => window.cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const openSettings = () => setShowSettings(true);
        window.addEventListener("open-cookie-settings", openSettings);
        return () => window.removeEventListener("open-cookie-settings", openSettings);
    }, []);

    const cookiePolicySummary = useMemo(
        () =>
            "We use necessary cookies for login and security. You can manage optional Analytics and Marketing cookies any time.",
        [],
    );

    async function persistConsent(payload) {
        writeConsentToCookie(payload);
        writeConsentToStorage(payload);
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("cookie-consent-updated", {
                    detail: payload,
                }),
            );
        }
        await syncConsentToServer(payload);
    }

    async function applyConsent({ analytics, marketing, source }) {
        setSaving(true);
        const payload = buildConsentPayload({ analytics, marketing, source });
        await persistConsent(payload);
        setAnalyticsEnabled(Boolean(analytics));
        setMarketingEnabled(Boolean(marketing));
        setShowBanner(false);
        setShowSettings(false);
        setSaving(false);
    }

    if (!hydrated) return null;

    return (
        <>
            {showBanner ? (
                <div className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4">
                    <div className="mx-auto w-full max-w-[980px] rounded-2xl border border-indigo-100 bg-white/95 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.2)] backdrop-blur">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div className="min-w-0">
                                <p className="text-base font-semibold text-slate-900">Cookie Notice</p>
                                <p className="mt-1 text-sm leading-relaxed text-slate-600">{cookiePolicySummary}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowSettings(true)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
                                >
                                    <Cookie size={16} aria-hidden="true" />
                                    <span>Cookie settings</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyConsent({ analytics: false, marketing: false, source: "banner_reject" })}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                    disabled={saving}
                                >
                                    Reject non-essential
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyConsent({ analytics: true, marketing: true, source: "banner_accept_all" })}
                                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-70"
                                    disabled={saving}
                                >
                                    Accept all
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {!showBanner ? (
                <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    aria-label="Cookie settings"
                    title="Cookie settings"
                    className="fixed bottom-4 left-4 z-[85] inline-flex h-11 w-11 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-700 shadow-[0_8px_24px_rgba(15,23,42,0.15)] transition hover:bg-indigo-50"
                >
                    <Cookie size={18} aria-hidden="true" />
                </button>
            ) : null}

            {showSettings ? (
                <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 p-4">
                    <div className="w-full max-w-[560px] rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.3)]">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Cookie Settings</h2>
                                <p className="mt-1 text-sm text-slate-600">Choose which optional cookies we can use.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSettings(false)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-4 space-y-3">
                            <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-3">
                                <span>
                                    <span className="block text-sm font-semibold text-slate-900">Necessary</span>
                                    <span className="block text-xs text-slate-600">Required for login, security, and core site functions.</span>
                                </span>
                                <input type="checkbox" checked disabled className="mt-1 h-4 w-4 accent-indigo-600" />
                            </label>

                            <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-3">
                                <span>
                                    <span className="block text-sm font-semibold text-slate-900">Analytics</span>
                                    <span className="block text-xs text-slate-600">Help us improve site quality and performance.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={analyticsEnabled}
                                    onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                                    className="mt-1 h-4 w-4 accent-indigo-600"
                                />
                            </label>

                            <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-3">
                                <span>
                                    <span className="block text-sm font-semibold text-slate-900">Marketing</span>
                                    <span className="block text-xs text-slate-600">Personalized content and campaign tracking.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={marketingEnabled}
                                    onChange={(event) => setMarketingEnabled(event.target.checked)}
                                    className="mt-1 h-4 w-4 accent-indigo-600"
                                />
                            </label>
                        </div>

                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => applyConsent({ analytics: false, marketing: false, source: "settings_reject" })}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                disabled={saving}
                            >
                                Reject non-essential
                            </button>
                            <button
                                type="button"
                                onClick={() => applyConsent({ analytics: true, marketing: true, source: "settings_accept_all" })}
                                className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                                disabled={saving}
                            >
                                Accept all
                            </button>
                            <button
                                type="button"
                                onClick={() => applyConsent({ analytics: analyticsEnabled, marketing: marketingEnabled, source: "settings_save" })}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-70"
                                disabled={saving}
                            >
                                Save preferences
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
