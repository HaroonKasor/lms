#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8080';
const USERNAME = process.env.E2E_USERNAME || '';
const PASSWORD = process.env.E2E_PASSWORD || '';
const COURSE_ID = String(process.env.E2E_COURSE_ID || '').trim();
const START_SERVER = String(process.env.E2E_START_SERVER || '').trim().toLowerCase() === 'true';
const DEV_PORT = Number(process.env.E2E_PORT || '8080');
const PAGE_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || '45000');

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 90000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(url, { method: 'GET' });
            if (res.status > 0) return;
        } catch {
            // retry
        }
        await wait(1000);
    }
    throw new Error(`Server did not become ready in ${timeoutMs}ms: ${url}`);
}

function spawnDevServer() {
    const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
    return spawn(process.execPath, [nextBin, 'dev', '--webpack', '--port', String(DEV_PORT), '-H', '127.0.0.1'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
    });
}

function killProcessTree(pid) {
    if (!pid) return Promise.resolve();
    if (process.platform === 'win32') {
        return new Promise((resolve) => {
            const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
            killer.on('close', () => resolve());
            killer.on('error', () => resolve());
        });
    }
    return new Promise((resolve) => {
        try {
            process.kill(-pid, 'SIGTERM');
        } catch {
            // ignore
        }
        resolve();
    });
}

async function fillLogin(page) {
    const usernameSelectors = [
        'input[name="username"]',
        'input[placeholder*="username" i]',
        'input[autocomplete="username"]',
    ];
    const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[autocomplete="current-password"]',
    ];

    let usernameFilled = false;
    for (const selector of usernameSelectors) {
        const el = page.locator(selector).first();
        if ((await el.count()) > 0) {
            await el.fill(USERNAME);
            usernameFilled = true;
            break;
        }
    }
    if (!usernameFilled) throw new Error('Cannot find username input');

    let passwordFilled = false;
    for (const selector of passwordSelectors) {
        const el = page.locator(selector).first();
        if ((await el.count()) > 0) {
            await el.fill(PASSWORD);
            passwordFilled = true;
            break;
        }
    }
    if (!passwordFilled) throw new Error('Cannot find password input');

    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').first();
    if ((await submitBtn.count()) > 0) {
        await submitBtn.click();
    } else {
        await page.keyboard.press('Enter');
    }
}

async function apiEnroll(page, courseId) {
    return page.evaluate(async (numericCourseId) => {
        const res = await fetch('/api/enrollments', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ courseId: Number(numericCourseId) }),
        });
        const payload = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, payload };
    }, courseId);
}

async function apiGetEnrollment(page, courseId) {
    return page.evaluate(async (numericCourseId) => {
        const res = await fetch(`/api/enrollments?courseId=${encodeURIComponent(String(numericCourseId))}&raw=1`, {
            cache: 'no-store',
        });
        const payload = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, payload };
    }, courseId);
}

async function run() {
    if (!USERNAME || !PASSWORD) throw new Error('Missing E2E_USERNAME or E2E_PASSWORD');
    if (!COURSE_ID) throw new Error('Missing E2E_COURSE_ID');

    let devServerProcess = null;
    if (START_SERVER) {
        console.log(`[e2e] starting dev server at ${BASE_URL}`);
        devServerProcess = spawnDevServer();
        await waitForServer(BASE_URL);
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const failures = [];
    const recordFail = (step, reason) => {
        failures.push({ step, reason });
        console.log(`[FAIL] ${step}: ${reason}`);
    };

    try {
        const loginUrl = new URL('/login', BASE_URL).toString();
        console.log(`[e2e] login: ${loginUrl}`);
        const loginResponse = await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
        if (!loginResponse || loginResponse.status() >= 400) {
            recordFail('login-page', `HTTP ${loginResponse ? loginResponse.status() : 'NO_RESPONSE'}`);
            return;
        }

        await fillLogin(page);
        await page.waitForURL((url) => !url.pathname.includes('/login'), {
            timeout: PAGE_TIMEOUT_MS,
            waitUntil: 'domcontentloaded',
        });
        console.log('[PASS] login');

        const numericCourseId = Number(COURSE_ID);
        if (!Number.isInteger(numericCourseId) || numericCourseId <= 0) {
            recordFail('course-id', `Invalid E2E_COURSE_ID: ${COURSE_ID}`);
            return;
        }

        console.log(`[e2e] enroll: courseId=${numericCourseId}`);
        const enrollResult = await apiEnroll(page, numericCourseId);
        if (!enrollResult.ok) {
            recordFail('enroll', `HTTP ${enrollResult.status} ${enrollResult.payload?.error || ''}`.trim());
            return;
        }
        console.log('[PASS] enroll');

        const enrollmentCheck = await apiGetEnrollment(page, numericCourseId);
        if (!enrollmentCheck.ok) {
            recordFail('enrollment-check', `HTTP ${enrollmentCheck.status} ${enrollmentCheck.payload?.error || ''}`.trim());
            return;
        }
        console.log('[PASS] enrollment-check');

        const learnUrl = new URL(`/courses/${numericCourseId}/learn`, BASE_URL).toString();
        console.log(`[e2e] learn: ${learnUrl}`);
        const learnResp = await page.goto(learnUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
        if (!learnResp || learnResp.status() >= 400) {
            recordFail('learn-page', `HTTP ${learnResp ? learnResp.status() : 'NO_RESPONSE'}`);
            return;
        }

        // Heuristic: the learning page has an "xAPI Statements" section.
        await page.getByText('xAPI Statements', { exact: false }).first().waitFor({ timeout: PAGE_TIMEOUT_MS });
        console.log('[PASS] learn-page');
    } finally {
        await browser.close();
        if (devServerProcess) {
            await killProcessTree(devServerProcess.pid);
        }
    }

    if (failures.length > 0) {
        console.log('\n[e2e] failures:');
        for (const row of failures) {
            console.log(`- ${row.step}: ${row.reason}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log('\n[e2e] login -> enroll -> learn passed');
}

run().catch((err) => {
    console.error('[e2e] error:', err?.message || err);
    process.exit(1);
});

