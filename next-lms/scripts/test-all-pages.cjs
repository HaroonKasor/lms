#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const APP_DIR = path.join(process.cwd(), 'src', 'app');
const DEV_PORT = Number(process.env.PAGE_TEST_PORT || 3100);
const BASE_URL = process.env.PAGE_TEST_BASE_URL || `http://127.0.0.1:${DEV_PORT}`;
const START_SERVER = process.env.PAGE_TEST_START_SERVER !== 'false';
const PAGE_TIMEOUT_MS = Number(process.env.PAGE_TEST_TIMEOUT_MS || 30000);
const DEFAULT_DYNAMIC_ID = process.env.PAGE_TEST_DYNAMIC_ID || '1';
const CATCH_ALL_VALUE = process.env.PAGE_TEST_CATCH_ALL || 'sample';

function parseJsonEnv(name) {
    const raw = process.env[name];
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        console.warn(`[WARN] ${name} is not valid JSON. Ignoring.`);
        return {};
    }
}

const ROUTE_OVERRIDES = parseJsonEnv('PAGE_TEST_ROUTE_OVERRIDES');
const DYNAMIC_PARAM_OVERRIDES = parseJsonEnv('PAGE_TEST_DYNAMIC_PARAMS');

function walk(dirPath, found = []) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walk(full, found);
            continue;
        }
        if (/^page\.(js|jsx|ts|tsx)$/.test(entry.name)) {
            found.push(full);
        }
    }
    return found;
}

function toTemplateRoute(pageFile) {
    const rel = path.relative(APP_DIR, path.dirname(pageFile)).replace(/\\/g, '/');
    if (!rel || rel === '.') return '/';

    const segments = rel
        .split('/')
        .filter(Boolean)
        .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')));

    if (segments.length === 0) return '/';
    return `/${segments.join('/')}`.replace(/\/+/g, '/');
}

function toConcreteRoute(templateRoute) {
    if (ROUTE_OVERRIDES[templateRoute]) {
        return String(ROUTE_OVERRIDES[templateRoute]);
    }

    let out = templateRoute;
    out = out.replace(/\[\[\.\.\.([^\]]+)\]\]/g, '');
    out = out.replace(/\[\.\.\.([^\]]+)\]/g, CATCH_ALL_VALUE);
    out = out.replace(/\[([^\]]+)\]/g, (_, name) => {
        const key = String(name || '').trim();
        const override = DYNAMIC_PARAM_OVERRIDES[key];
        if (override === undefined || override === null || override === '') {
            return DEFAULT_DYNAMIC_ID;
        }
        return String(override);
    });

    out = out.replace(/\/+/g, '/');
    if (!out.startsWith('/')) out = `/${out}`;
    if (!out) out = '/';
    return out;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 90000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.status > 0) return;
        } catch {
            // ignore and retry
        }
        await wait(1000);
    }
    throw new Error(`Server did not become ready in ${timeoutMs}ms: ${url}`);
}

function spawnDevServer() {
    const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
    const child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '--port', String(DEV_PORT), '-H', '127.0.0.1'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
    });
    return child;
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
        process.kill(-pid, 'SIGTERM');
        resolve();
    });
}

async function run() {
    if (!fs.existsSync(APP_DIR)) {
        throw new Error(`Cannot find app directory: ${APP_DIR}`);
    }

    const pageFiles = walk(APP_DIR).sort();
    const templateRoutes = [...new Set(pageFiles.map(toTemplateRoute))].sort();
    const concreteRoutes = templateRoutes.map((template) => ({
        template,
        route: toConcreteRoute(template),
    }));

    let devServerProcess = null;
    if (START_SERVER) {
        console.log(`[INFO] Starting dev server on ${BASE_URL} ...`);
        devServerProcess = spawnDevServer();
        await waitForServer(BASE_URL);
        console.log('[INFO] Dev server is ready.');
    } else {
        console.log(`[INFO] Using existing server at ${BASE_URL}`);
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const results = [];
    let serverBecameUnavailable = false;
    let serverUnavailableReason = '';
    try {
        for (const item of concreteRoutes) {
            if (serverBecameUnavailable) break;
            const url = new URL(item.route, BASE_URL).toString();
            const pageErrors = [];
            const onPageError = (error) => pageErrors.push(String(error?.message || error));
            page.on('pageerror', onPageError);

            const startedAt = Date.now();
            let status = 0;
            let category = 'PASS';
            let reason = '';

            try {
                const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
                status = response ? response.status() : 0;

                if (status >= 500) {
                    category = 'FAIL';
                    reason = `HTTP ${status}`;
                } else if (status >= 400) {
                    category = 'WARN';
                    reason = `HTTP ${status}`;
                } else if (pageErrors.length > 0) {
                    category = 'WARN';
                    reason = `Client error: ${pageErrors[0]}`;
                }
            } catch (error) {
                category = 'FAIL';
                reason = String(error?.message || error);
                if (reason.includes('ERR_CONNECTION_REFUSED')) {
                    serverBecameUnavailable = true;
                    serverUnavailableReason = reason;
                }
            } finally {
                page.off('pageerror', onPageError);
            }

            const elapsed = Date.now() - startedAt;
            results.push({
                template: item.template,
                route: item.route,
                status,
                category,
                reason,
                elapsed,
            });
            console.log(`[${category}] ${item.route} (${elapsed} ms)${reason ? ` - ${reason}` : ''}`);
        }
    } finally {
        await browser.close();
        if (devServerProcess) {
            await killProcessTree(devServerProcess.pid);
        }
    }

    const passCount = results.filter((r) => r.category === 'PASS').length;
    const warnCount = results.filter((r) => r.category === 'WARN').length;
    const failCount = results.filter((r) => r.category === 'FAIL').length;

    console.log('\n=== Page Smoke Test Summary ===');
    console.log(`Total routes: ${results.length}`);
    console.log(`PASS: ${passCount}`);
    console.log(`WARN: ${warnCount}`);
    console.log(`FAIL: ${failCount}`);

    if (warnCount > 0) {
        console.log('\nWarnings:');
        for (const item of results.filter((r) => r.category === 'WARN')) {
            console.log(`- ${item.route} (${item.reason || 'warning'})`);
        }
    }
    if (serverBecameUnavailable) {
        console.log('\n[ERROR] Server became unavailable during smoke tests.');
        console.log(serverUnavailableReason || 'Connection refused');
    }
    if (failCount > 0) {
        console.log('\nFailures:');
        for (const item of results.filter((r) => r.category === 'FAIL')) {
            console.log(`- ${item.route} (${item.reason || 'failure'})`);
        }
        process.exitCode = 1;
    }
}

run().catch((error) => {
    console.error('[ERROR]', error?.message || error);
    process.exitCode = 1;
});
