#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8080';
const USERNAME = process.env.E2E_USERNAME || process.env.PAGE_TEST_USERNAME || '';
const PASSWORD = process.env.E2E_PASSWORD || process.env.PAGE_TEST_PASSWORD || '';
const START_SERVER = String(process.env.E2E_START_SERVER || '').trim().toLowerCase() === 'true';
const DEV_PORT = Number(process.env.E2E_PORT || '8080');
const PAGE_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || '30000');

const PROTECTED_PAGES = [
    '/admin-dashboard',
    '/admin-dashboard/group',
    '/admin-dashboard/manage-user/users',
    '/admin-dashboard/learn/course',
    '/admin-dashboard/content/manage',
    '/admin-dashboard/report',
];

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
        'input[placeholder*="Username"]',
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

    const submitBtn = page.locator('button[type="submit"]').first();
    if ((await submitBtn.count()) > 0) {
        await submitBtn.click();
    } else {
        await page.keyboard.press('Enter');
    }
}

async function run() {
    if (!USERNAME || !PASSWORD) {
        throw new Error('Missing E2E_USERNAME or E2E_PASSWORD');
    }

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

    try {
        const loginUrl = new URL('/login', BASE_URL).toString();
        console.log(`[e2e] login: ${loginUrl}`);
        const loginResponse = await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
        if (!loginResponse || loginResponse.status() >= 400) {
            throw new Error(`Login page unavailable (HTTP ${loginResponse ? loginResponse.status() : 'NO_RESPONSE'})`);
        }

        await fillLogin(page);
        await page.waitForURL((url) => !url.pathname.includes('/login'), {
            timeout: PAGE_TIMEOUT_MS,
        });

        for (const route of PROTECTED_PAGES) {
            const url = new URL(route, BASE_URL).toString();
            const startedAt = Date.now();
            let status = 0;
            let reason = '';
            try {
                const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
                status = response ? response.status() : 0;
                if (!response) {
                    reason = 'No response';
                } else if (status >= 400) {
                    reason = `HTTP ${status}`;
                } else {
                    const bodyText = await page.locator('body').innerText().catch(() => '');
                    if (/internal server error/i.test(bodyText || '')) {
                        reason = 'Contains "Internal server error" text';
                    }
                }
            } catch (err) {
                reason = String(err?.message || err);
            }
            const elapsed = Date.now() - startedAt;
            if (reason) {
                failures.push({ route, reason, elapsed });
                console.log(`[FAIL] ${route} (${elapsed}ms): ${reason}`);
            } else {
                console.log(`[PASS] ${route} (${elapsed}ms)`);
            }
        }
    } finally {
        await browser.close();
        if (devServerProcess) {
            await killProcessTree(devServerProcess.pid);
        }
    }

    if (failures.length > 0) {
        console.log('\n[e2e] failed routes:');
        for (const row of failures) {
            console.log(`- ${row.route}: ${row.reason}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log('\n[e2e] all protected pages passed');
}

run().catch((err) => {
    console.error('[e2e] error:', err?.message || err);
    process.exit(1);
});

