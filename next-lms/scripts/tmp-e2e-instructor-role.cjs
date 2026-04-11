const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const BASE_URL = 'http://127.0.0.1:3101';
const USERNAME = 'instructor_e2e';
const PASSWORD = 'Instructor@123';

const ALLOWED_PAGES = [
  '/admin-dashboard',
  '/admin-dashboard/learn/category',
  '/admin-dashboard/learn/course',
  '/admin-dashboard/learn/learner-status',
  '/admin-dashboard/content',
  '/admin-dashboard/report/learner-status',
  '/admin-dashboard/report/attempt-report',
  '/admin-dashboard/report/examination-score',
  '/admin-dashboard/report/certificate-report',
];

const BLOCKED_PAGES = [
  '/admin-dashboard/group',
  '/admin-dashboard/manage-user/users',
  '/admin-dashboard/e-publication',
  '/admin-dashboard/connection',
  '/admin-dashboard/report/audit-log',
  '/admin-dashboard/learn/enrollment',
  '/admin-dashboard/learn/batch-enrollment',
];

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function waitForServer(url, timeoutMs=180000){
  const start=Date.now();
  while(Date.now()-start < timeoutMs){
    try {
      const res = await fetch(url);
      if (res.status > 0) return;
    } catch {}
    await wait(1000);
  }
  throw new Error(`Server not ready: ${url}`);
}

function spawnDevServer(){
  const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  return spawn(process.execPath, [nextBin, 'dev', '--webpack', '--port', '3101', '-H', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: ['ignore','pipe','pipe'],
    env: process.env,
  });
}

function killProcessTree(pid){
  if(!pid) return Promise.resolve();
  if(process.platform==='win32'){
    return new Promise((resolve)=>{
      const killer = spawn('taskkill',['/PID', String(pid), '/T', '/F'], { stdio:'ignore' });
      killer.on('close', ()=>resolve());
      killer.on('error', ()=>resolve());
    });
  }
  return Promise.resolve();
}

(async()=>{
  const failures=[];
  const results = { pass: [], fail: [] };
  let devServer;
  let browser;

  try {
    console.log('[step] start dev server');
    devServer = spawnDevServer();
    devServer.stdout.on('data', (d)=> {
      const t = String(d);
      if (/ready|compiled|Local:/i.test(t)) process.stdout.write(`[dev] ${t}`);
    });
    devServer.stderr.on('data', (d)=> {
      const t = String(d);
      if (/error|failed/i.test(t)) process.stderr.write(`[dev-err] ${t}`);
    });

    await waitForServer(`${BASE_URL}/login`);
    console.log('[step] server ready');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('[step] login');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const usernameInput = page.locator('input[placeholder="Enter username"]').first();
    const passwordInput = page.locator('input[placeholder="Enter Password"]').first();
    await usernameInput.waitFor({ state: 'visible', timeout: 45000 });
    await usernameInput.fill(USERNAME);
    await passwordInput.fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((url)=>!url.pathname.includes('/login'), { timeout: 45000 });

    const loggedUrl = page.url();
    if (!loggedUrl.includes('/admin-dashboard')) failures.push(`Login redirect expected /admin-dashboard but got ${loggedUrl}`);
    else results.pass.push(`Login redirect -> ${loggedUrl}`);

    console.log('[step] sidebar check');
    await page.goto(`${BASE_URL}/admin-dashboard`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const sidebarText = await page.locator('aside').first().innerText().catch(()=> '');
    for (const label of ['Dashboard','Learn','Content','Report']) {
      if (!sidebarText.includes(label)) failures.push(`Sidebar missing allowed item: ${label}`);
      else results.pass.push(`Sidebar contains: ${label}`);
    }
    for (const label of ['Group','Manage User','e-Publication','Connection']) {
      if (sidebarText.includes(label)) failures.push(`Sidebar should hide item for instructor: ${label}`);
      else results.pass.push(`Sidebar hides: ${label}`);
    }

    console.log('[step] allowed pages');
    for (const route of ALLOWED_PAGES) {
      const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const status = response ? response.status() : 0;
      const current = new URL(page.url());
      const ok = status < 400 && current.pathname.startsWith(route);
      if (!ok) failures.push(`Allowed page failed: ${route} (status=${status}, current=${current.pathname})`);
      else results.pass.push(`Allowed page OK: ${route}`);
    }

    console.log('[step] blocked pages');
    for (const route of BLOCKED_PAGES) {
      const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const status = response ? response.status() : 0;
      const current = new URL(page.url());
      if (current.pathname !== '/dashboard') failures.push(`Blocked page should redirect to /dashboard: ${route} (status=${status}, current=${current.pathname})`);
      else results.pass.push(`Blocked page redirected: ${route}`);
    }

    console.log('[step] api checks');
    const api = context.request;
    const coursesRes = await api.get(`${BASE_URL}/api/courses`);
    let firstCourseId = 1;
    if (coursesRes.status() < 400) {
      const json = await coursesRes.json().catch(()=>[]);
      if (Array.isArray(json) && json[0]) firstCourseId = Number(json[0].id || json[0].courseId || 1);
    }

    for (const item of [
      { name: 'admin stats', url: '/api/admin/stats' },
      { name: 'categories', url: '/api/categories' },
      { name: 'courses', url: '/api/courses' },
      { name: 'content upload list', url: '/api/content/upload' },
      { name: 'sections', url: `/api/courses/sections?courseId=${firstCourseId}` },
      { name: 'report learner status', url: '/api/reports/learner-status' },
      { name: 'report attempt', url: '/api/reports/attempt-report' },
      { name: 'report exam score', url: '/api/reports/examination-score' },
      { name: 'report cert', url: '/api/reports/certificate-report' },
    ]) {
      const res = await api.get(`${BASE_URL}${item.url}`);
      const status = res.status();
      if (status === 401 || status === 403) failures.push(`Allowed API denied (${item.name}): ${status}`);
      else results.pass.push(`Allowed API OK (${item.name}): ${status}`);
    }

    const qrRes = await api.post(`${BASE_URL}/api/enrollments/qr-token`, {
      data: { courseId: firstCourseId },
      headers: { 'content-type': 'application/json' },
    });
    if ([401,403].includes(qrRes.status())) failures.push(`Allowed API denied (qr-token): ${qrRes.status()}`);
    else results.pass.push(`Allowed API OK (qr-token): ${qrRes.status()}`);

    for (const item of [
      { name: 'admin audit access', url: '/api/admin/audit/access' },
      { name: 'groups', url: '/api/groups' },
      { name: 'users', url: '/api/users' },
    ]) {
      const res = await api.get(`${BASE_URL}${item.url}`);
      const status = res.status();
      if (status !== 403) failures.push(`Blocked API should be 403 (${item.name}) but got ${status}`);
      else results.pass.push(`Blocked API denied as expected (${item.name})`);
    }

    console.log('\n=== RESULT ===');
    if (failures.length) {
      console.log('FAIL');
      failures.forEach((f)=>console.log(`- ${f}`));
      process.exitCode = 1;
    } else {
      console.log('PASS');
    }
    console.log(`PASS count: ${results.pass.length}`);
    results.pass.forEach((p)=>console.log(`+ ${p}`));
  } catch (err) {
    console.error('E2E script error:', err?.stack || err?.message || err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(()=>{});
    if (devServer) await killProcessTree(devServer.pid);
  }
})();
