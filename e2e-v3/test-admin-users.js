/**
 * GoviHub E2E V3 — Admin panel users: search, pagination, edit (G2.6), regressions
 *
 * Target: LIVE PRODUCTION  https://spices.govihublk.com/admin/
 *
 * Convention follows test-phone-font.js / test-cleanup-vision.js: plain node +
 * playwright chromium, screenshots into ./screenshots/admin-users, results JSON
 * into ./results, pass/fail/blocked collectors, ONLY= env filter.
 *
 * CREDENTIALS: never stored in this file. The ADMIN const is parsed out of
 * test-all.js at runtime and is never logged or written to the results JSON.
 *
 * MUTATION SCOPE: every mutating gate runs on the throwaway farmer
 * `agate530055` ONLY. The admin's own record (`nuwan`) is never touched.
 *
 * Every claim about what was stored is checked against the PRODUCTION DATABASE
 * over ssh from node's own shell — never against what the UI claims.
 *
 * Gates
 *   GP.1  server-side search  — /admin/users?search=<term> is a query param
 *   GP.2  pagination          — row counts across pages sum to the shown total
 *   GP.3  G2.6 NEGATIVE       — local-format phone rejected, nothing saved
 *   GP.4  G2.6 POSITIVE       — name+phone+district saved, persist across reload
 *   GP.5  regressions         — suspend blocks login, activate restores, reset PW
 *   GP.6  screenshot evidence — the five required shots exist on disk
 *
 * Run: node test-admin-users.js                 (from e2e-v3/)
 *      ONLY=1,3,4 node test-admin-users.js      (subset by gate number)
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = 'https://spices.govihublk.com';
const ADMIN_URL = `${BASE}/admin/`;
const SS_DIR = path.join(__dirname, 'screenshots', 'admin-users');
const OUT = path.join(__dirname, 'results');
for (const d of [SS_DIR, OUT]) fs.mkdirSync(d, { recursive: true });

const RUN = String(Math.floor(Math.random() * 900000) + 100000);

/* --------------------------- target user (throwaway) --------------------------- */
const TARGET = {
  username: 'agate530055',
  id: 'd39a52e7-bd4e-4243-a1ee-7c0b2c7a1845',
  password: 'AdmGate2026!',
};
const BAD_PHONE = '0771234567';       // local format — API must reject
const GOOD_PHONE = '+94771230099';    // E.164 — API must accept
const GOOD_DISTRICT = 'Matale';
const GOOD_NAME = 'Agate Renamed';

const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const run = (n) => ONLY.length === 0 || ONLY.includes(String(n));

/* ------------------------------- collectors ------------------------------- */
const results = [];
const shots = [];
const dbTrail = [];
const netTrail = [];
let ssCount = 0;

function pass(id, desc, ev) { results.push({ id, desc, status: 'PASS', evidence: ev }); console.log(`  PASS    ${id}: ${desc}\n          ${ev}`); }
function fail(id, desc, ev) { results.push({ id, desc, status: 'FAIL', evidence: ev }); console.log(`  FAIL    ${id}: ${desc}\n          ${ev}`); }
function blocked(id, desc, ev) { results.push({ id, desc, status: 'BLOCKED', evidence: ev }); console.log(`  BLOCKED ${id}: ${desc}\n          ${ev}`); }

async function ss(page, name) {
  ssCount++;
  const fname = `${String(ssCount).padStart(2, '0')}_${name}.png`;
  const full = path.join(SS_DIR, fname);
  await page.screenshot({ path: full, fullPage: true });
  shots.push({ name, file: fname });
  return fname;
}

/* --------------------------- production DB (ssh) --------------------------- */
function psql(sql) {
  const remote = `docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -tAc "${sql}"`;
  return execFileSync('ssh', ['govihub-mumbai', remote], { encoding: 'utf8', timeout: 45000 }).trim();
}

function dbUser(label) {
  const raw = psql(
    `SELECT username, name, phone, district, is_active FROM users WHERE username='${TARGET.username}';`
  );
  const [username, name, phone, district, is_active] = raw.split('|');
  const row = { username, name, phone, district, is_active };
  dbTrail.push({ at: new Date().toISOString(), label, raw, row });
  console.log(`  [db] ${label}: ${raw}`);
  return row;
}

function dbTotalUsers() {
  const n = parseInt(psql('SELECT count(*) FROM users;'), 10);
  console.log(`  [db] total users = ${n}`);
  return n;
}

/* ------------------------------- credentials ------------------------------- */
function adminCreds() {
  const src = fs.readFileSync(path.join(__dirname, 'test-all.js'), 'utf8');
  const m = src.match(/const\s+ADMIN\s*=\s*\{\s*username:\s*'([^']+)'\s*,\s*password:\s*'([^']+)'/);
  if (!m) throw new Error('ADMIN const not found in test-all.js');
  return { username: m[1], password: m[2] };
}

/* ------------------------------- UI helpers ------------------------------- */

/** Log into the STATIC admin console at /admin/ using its own login screen.
 *  (The Next.js /en/auth/beta-login page does not populate this panel's
 *  sessionStorage token, so the panel's own form is the real entry point.) */
async function adminLogin(page) {
  const { username, password } = adminCreds();
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const alreadyIn = await page.locator('#app').isVisible().catch(() => false);
  if (!alreadyIn) {
    await page.fill('#login-username', username);
    await page.fill('#login-password', password);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/auth/beta/login') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
      page.locator('#login-screen button.btn-primary').click(),
    ]);
  }
  await page.locator('#app').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
}

async function gotoUsers(page) {
  await page.locator('#nav-users').click();
  await page.locator('#view-users').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2000);
}

async function searchFor(page, term) {
  await page.fill('#users-search', '');
  await page.waitForTimeout(600);
  await page.fill('#users-search', term);
  // debounce is 300ms + the network round trip
  await page.waitForTimeout(2500);
}

function targetRow(page) {
  return page.locator(`#users-tbody tr:has-text("${TARGET.username}")`).first();
}

async function toastTexts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.toast, #toast, [class*="toast"]')]
      .map(e => (e.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 5)
  );
}

async function openEditModal(page) {
  await targetRow(page).locator('button:has-text("Edit")').click();
  await page.locator('#modal-edit-user').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);
}

async function readEditForm(page) {
  return page.evaluate(() => ({
    name: document.getElementById('edit-user-name').value,
    phone: document.getElementById('edit-user-phone').value,
    role: document.getElementById('edit-user-role').value,
    district: document.getElementById('edit-user-district').value,
    districtIsSelect: document.getElementById('edit-user-district').tagName.toLowerCase() === 'select',
    districtOptionCount: document.getElementById('edit-user-district').tagName.toLowerCase() === 'select'
      ? document.getElementById('edit-user-district').options.length : 0,
  }));
}

/* =============================== GP.1 search =============================== */
async function gateSearch(page) {
  const seen = [];
  const listener = (req) => {
    const u = req.url();
    if (req.method() === 'GET' && /\/admin\/users(\?|$)/.test(u)) seen.push(u);
  };
  page.on('request', listener);

  await searchFor(page, TARGET.username);
  const shot = await ss(page, 'search_result');
  page.off('request', listener);

  const rowCount = await page.locator(`#users-tbody tr:has-text("${TARGET.username}")`).count();
  const withSearch = seen.filter(u => {
    try { return new URL(u).searchParams.get('search') === TARGET.username; } catch { return false; }
  });
  netTrail.push({ gate: 'GP.1', requests: seen.slice(-6), matched: withSearch.slice(-3) });

  const countText = await page.locator('#users-count').textContent().catch(() => '');
  const evidence =
    `row visible=${rowCount > 0}; count label="${(countText || '').trim()}"; ` +
    `GET ${withSearch.length ? new URL(withSearch[withSearch.length - 1]).pathname + new URL(withSearch[withSearch.length - 1]).search : '(none with search=)'}; shot=${shot}`;

  if (rowCount > 0 && withSearch.length > 0) pass('GP.1', 'server-side search by query param', evidence);
  else fail('GP.1', 'server-side search by query param', evidence);
}

/* ============================= GP.2 pagination ============================= */
async function gatePagination(page) {
  await page.fill('#users-search', '');
  await page.waitForTimeout(2500);

  const countText = ((await page.locator('#users-count').textContent()) || '').trim();
  const total = parseInt(countText.replace(/[^0-9]/g, ''), 10);
  const dbTotal = dbTotalUsers();

  const firstShot = await ss(page, 'list_pagination_page1');

  const prevFirstDisabled = await page
    .locator('#users-pagination button:has-text("Previous")')
    .isDisabled().catch(() => null);

  const perPage = [];
  let guard = 0;
  let nextDisabled = null;
  let pageLabel = '';
  while (guard++ < 25) {
    const rows = await page.locator('#users-tbody tr').count();
    const empty = await page.locator('#users-tbody tr td[colspan]').count();
    perPage.push(empty > 0 ? 0 : rows);
    pageLabel = ((await page.locator('#users-pagination span').textContent().catch(() => '')) || '').trim();

    const nextBtn = page.locator('#users-pagination button:has-text("Next")');
    if (await nextBtn.count() === 0) { nextDisabled = true; break; }
    nextDisabled = await nextBtn.isDisabled();
    if (nextDisabled) break;
    await nextBtn.click();
    await page.waitForTimeout(2200);
  }

  const lastShot = await ss(page, 'list_pagination_lastpage');
  const sum = perPage.reduce((a, b) => a + b, 0);

  const evidence =
    `label="${countText}" total=${total} (db=${dbTotal}); pages walked=${perPage.length} [${perPage.join(',')}] sum=${sum}; ` +
    `last page label="${pageLabel}"; Next disabled on last=${nextDisabled}; Prev disabled on first=${prevFirstDisabled}; ` +
    `shots=${firstShot},${lastShot}`;

  const ok = Number.isFinite(total) && sum === total && total === dbTotal &&
    nextDisabled === true && prevFirstDisabled === true;
  if (ok) pass('GP.2', 'pagination row counts sum to displayed total', evidence);
  else fail('GP.2', 'pagination row counts sum to displayed total', evidence);

  // leave the list back on page 1 for the gates that follow (the search input
  // listener resets usersPage to 1, so a no-op fill is enough)
  await page.fill('#users-search', '');
  await page.waitForTimeout(2200);
}

/* ========================= GP.3 G2.6 negative case ========================= */
async function gateEditNegative(page) {
  const before = dbUser('GP.3-before');

  await searchFor(page, TARGET.username);
  if (await targetRow(page).count() === 0) {
    blocked('GP.3', 'G2.6 negative — local-format phone rejected', 'target row not found after search');
    return null;
  }
  await openEditModal(page);
  const form = await readEditForm(page);

  await page.fill('#edit-user-phone', BAD_PHONE);
  let putStatus = null;
  const [resp] = await Promise.all([
    page.waitForResponse(r => /\/admin\/users\//.test(r.url()) && r.request().method() === 'PUT', { timeout: 25000 }).catch(() => null),
    page.locator('#modal-edit-user button:has-text("Save changes")').click(),
  ]);
  if (resp) putStatus = resp.status();
  await page.waitForTimeout(1500);

  const errVisible = await page.locator('#edit-user-error').isVisible().catch(() => false);
  const errText = ((await page.locator('#edit-user-error').textContent().catch(() => '')) || '').trim();
  const modalStillOpen = await page.locator('#modal-edit-user').isVisible().catch(() => false);
  const toasts = await toastTexts(page);
  const shot = await ss(page, 'edit_error_state');

  const after = dbUser('GP.3-after');
  const unchanged = after.phone === before.phone && after.name === before.name && after.district === before.district;

  const evidence =
    `PUT ${putStatus}; #edit-user-error visible=${errVisible} text="${errText.slice(0, 120)}"; ` +
    `modal still open=${modalStillOpen}; toasts=${JSON.stringify(toasts).slice(0, 160)}; ` +
    `DB before phone=${before.phone} after phone=${after.phone} (unchanged=${unchanged}); ` +
    `district control is <select> with ${form.districtOptionCount} options=${form.districtIsSelect}; shot=${shot}`;

  if (errVisible && modalStillOpen && unchanged && putStatus && putStatus >= 400) {
    pass('GP.3', 'G2.6 negative — local-format phone rejected, nothing saved', evidence);
  } else {
    fail('GP.3', 'G2.6 negative — local-format phone rejected, nothing saved', evidence);
  }
  return before;
}

/* ========================= GP.4 G2.6 positive case ========================= */
async function gateEditPositive(page) {
  // modal is still open from GP.3 — if not, reopen it
  if (!(await page.locator('#modal-edit-user').isVisible().catch(() => false))) {
    await searchFor(page, TARGET.username);
    await openEditModal(page);
  }

  await page.fill('#edit-user-phone', GOOD_PHONE);
  await page.selectOption('#edit-user-district', GOOD_DISTRICT);
  await page.fill('#edit-user-name', GOOD_NAME);

  let putStatus = null;
  const [resp] = await Promise.all([
    page.waitForResponse(r => /\/admin\/users\//.test(r.url()) && r.request().method() === 'PUT', { timeout: 25000 }).catch(() => null),
    page.locator('#modal-edit-user button:has-text("Save changes")').click(),
  ]);
  if (resp) putStatus = resp.status();
  await page.waitForTimeout(2500);

  const modalClosed = !(await page.locator('#modal-edit-user').isVisible().catch(() => false));
  const toasts = await toastTexts(page);
  const successShot = await ss(page, 'edit_success_state');

  const afterSave = dbUser('GP.4-after-save');

  // --- reload the whole page, walk back in, reopen the form
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  if (!(await page.locator('#app').isVisible().catch(() => false))) await adminLogin(page);
  await gotoUsers(page);
  await searchFor(page, TARGET.username);
  let reopened = false;
  let form = null;
  for (let i = 0; i < 3 && !reopened; i++) {
    try { await openEditModal(page); reopened = true; } catch { await page.waitForTimeout(2000); }
  }
  if (reopened) form = await readEditForm(page);
  const reloadShot = await ss(page, 'edit_reloaded_persisted');

  const uiOk = !!form && form.name === GOOD_NAME && form.phone === GOOD_PHONE && form.district === GOOD_DISTRICT;
  const dbOk = afterSave.name === GOOD_NAME && afterSave.phone === GOOD_PHONE && afterSave.district === GOOD_DISTRICT;

  const evidence =
    `PUT ${putStatus}; modal closed=${modalClosed}; toasts=${JSON.stringify(toasts).slice(0, 120)}; ` +
    `DB after save name="${afterSave.name}" phone=${afterSave.phone} district=${afterSave.district} (dbOk=${dbOk}); ` +
    `after full reload form=${JSON.stringify(form)} (uiOk=${uiOk}); shots=${successShot},${reloadShot}`;

  if (putStatus === 200 && modalClosed && dbOk && uiOk) {
    pass('GP.4', 'G2.6 positive — name/phone/district saved and persist across reload', evidence);
  } else {
    fail('GP.4', 'G2.6 positive — name/phone/district saved and persist across reload', evidence);
  }
  if (reopened) await page.locator('#modal-edit-user button:has-text("Cancel")').click().catch(() => {});
  await page.waitForTimeout(500);
}

/* ====================== login probe in a fresh context ====================== */
/** Drives the REAL beta-login form in a brand-new browser context.
 *  NOTE: that page renders the Login/Register tab pair twice (a responsive
 *  duplicate), so fields are addressed by placeholder and the submit by
 *  button[type=submit] — a naive text=Login selector hits the hidden copy. */
async function probeLogin(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  let status = null;
  let body = '';
  try {
    await page.goto(`${BASE}/en/auth/beta-login`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.fill('input[placeholder="Enter username"]', TARGET.username);
    await page.fill('input[placeholder="Enter password"]', TARGET.password);
    const [resp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/auth/beta/login') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
      page.locator('button[type="submit"]').last().click(),
    ]);
    if (resp) { status = resp.status(); body = (await resp.text().catch(() => '')).slice(0, 200); }
    await page.waitForTimeout(3000);
  } catch (e) {
    body = `probe error: ${e.message}`;
  }
  const url = page.url();
  const shot = await ss(page, label);
  await ctx.close();
  return { status, url, body, shot, loggedIn: status === 200 && !/beta-login/.test(url) };
}

/* =========================== GP.5 regressions =========================== */
async function gateRegressions(page, browser) {
  await gotoUsers(page);
  await searchFor(page, TARGET.username);
  if (await targetRow(page).count() === 0) {
    blocked('GP.5', 'suspend/activate/reset-password regressions', 'target row not found after search');
    return;
  }

  // ---- suspend
  await targetRow(page).locator('button:has-text("Suspend")').click();
  await page.locator('#modal-confirm-action').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#confirm-action-btn').click();
  await page.waitForTimeout(2500);
  const suspendShot = await ss(page, 'suspend_confirmed');
  const dbSuspended = dbUser('GP.5-after-suspend');
  const loginWhileSuspended = await probeLogin(browser, 'login_blocked_while_suspended');

  const suspendOk = dbSuspended.is_active === 'f' && loginWhileSuspended.loggedIn === false;
  const suspendEv =
    `DB is_active=${dbSuspended.is_active}; login POST status=${loginWhileSuspended.status} url=${loginWhileSuspended.url} ` +
    `body="${loginWhileSuspended.body.slice(0, 100)}"; shots=${suspendShot},${loginWhileSuspended.shot}`;

  // ---- activate (restore)
  await searchFor(page, TARGET.username);
  await targetRow(page).locator('button:has-text("Activate")').click();
  await page.locator('#modal-confirm-action').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#confirm-action-btn').click();
  await page.waitForTimeout(2500);
  const activateShot = await ss(page, 'activate_restored');
  const dbActive = dbUser('GP.5-after-activate');
  const loginAfterRestore = await probeLogin(browser, 'login_works_after_restore');

  const activateOk = dbActive.is_active === 't' && loginAfterRestore.loggedIn === true;
  const activateEv =
    `DB is_active=${dbActive.is_active}; login POST status=${loginAfterRestore.status} url=${loginAfterRestore.url}; ` +
    `shots=${activateShot},${loginAfterRestore.shot}`;

  if (suspendOk) pass('GP.5a', 'suspend blocks login', suspendEv);
  else fail('GP.5a', 'suspend blocks login', suspendEv);
  if (activateOk) pass('GP.5b', 'activate restores login', activateEv);
  else fail('GP.5b', 'activate restores login', activateEv);

  // ---- reset password to completion
  await searchFor(page, TARGET.username);
  await targetRow(page).locator('button:has-text("Reset PW")').click();
  await page.locator('#modal-reset-pw').waitFor({ state: 'visible', timeout: 10000 });
  let rstStatus = null;
  const [rstResp] = await Promise.all([
    page.waitForResponse(r => /reset-password-temp/.test(r.url()), { timeout: 25000 }).catch(() => null),
    page.locator('#modal-reset-pw button:has-text("Generate password")').click(),
  ]);
  if (rstResp) rstStatus = rstResp.status();
  await page.waitForTimeout(1800);
  const step2Visible = await page.locator('#reset-pw-step2').isVisible().catch(() => false);
  const tempPw = ((await page.locator('#reset-pw-value').textContent().catch(() => '')) || '').trim();
  const resetShot = await ss(page, 'reset_password_temp_shown');
  const resetOk = rstStatus === 200 && step2Visible && tempPw.length >= 8 && tempPw !== '—';
  // never print the temp password itself — only its shape
  const resetEv = `PUT reset-password-temp ${rstStatus}; step2 visible=${step2Visible}; ` +
    `temp password surfaced: length=${tempPw.length} (value withheld); shot=${resetShot}`;
  if (resetOk) pass('GP.5c', 'reset password surfaces a temp password in the UI', resetEv);
  else fail('GP.5c', 'reset password surfaces a temp password in the UI', resetEv);

  await page.locator('#modal-reset-pw button:has-text("Done")').click().catch(() => {});
}

/* ========================== GP.6 screenshot evidence ========================== */
function gateShots() {
  const required = [
    'search_result',
    'list_pagination_page1',
    'edit_error_state',
    'edit_success_state',
    'edit_reloaded_persisted',
  ];
  const onDisk = fs.readdirSync(SS_DIR);
  const found = required.map(r => ({ r, f: onDisk.find(f => f.includes(r)) || null }));
  const missing = found.filter(x => !x.f).map(x => x.r);
  const ev = found.map(x => `${x.r}=${x.f || 'MISSING'}`).join('; ');
  if (missing.length === 0) pass('GP.6', 'required screenshots exist on disk', `${SS_DIR} — ${ev}`);
  else fail('GP.6', 'required screenshots exist on disk', `missing: ${missing.join(', ')} — ${ev}`);
}

/* ================================== main ================================== */
(async () => {
  const t0 = Date.now();
  console.log(`\nRUN ${RUN} — target ${ADMIN_URL} (LIVE PRODUCTION)`);
  console.log(`mutations confined to throwaway user '${TARGET.username}' (${TARGET.id})\n`);
  dbUser('run-start');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

  try {
    await adminLogin(page);
    await gotoUsers(page);
    console.log(`  [ui] admin console reached, users view open\n`);

    if (run(1)) { console.log('GP.1 — server-side search'); await gateSearch(page); }
    if (run(3)) { console.log('\nGP.3 — G2.6 NEGATIVE'); await gateEditNegative(page); }
    if (run(4)) { console.log('\nGP.4 — G2.6 POSITIVE'); await gateEditPositive(page); }
    if (run(2)) { console.log('\nGP.2 — pagination'); await gatePagination(page); }
    if (run(5)) { console.log('\nGP.5 — regressions'); await gateRegressions(page, browser); }
    if (run(6)) { console.log('\nGP.6 — screenshot evidence'); gateShots(); }
  } catch (e) {
    blocked('RUN', 'harness', `${e.message}`);
    try { await ss(page, 'harness_failure'); } catch {}
  } finally {
    await browser.close();
  }

  const final = dbUser('run-end');
  const summary = {
    run: RUN,
    target: ADMIN_URL,
    throwaway_user: { username: TARGET.username, id: TARGET.id },
    started: new Date(t0).toISOString(),
    duration_s: Math.round((Date.now() - t0) / 1000),
    db_trail: dbTrail,
    network_trail: netTrail,
    console_errors: consoleErrors.slice(0, 20),
    screenshots_dir: SS_DIR,
    screenshots: shots,
    final_db_state: final,
    results,
  };
  const outFile = path.join(OUT, `admin-users-${RUN}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  console.log('\n================ GATES ================');
  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(8)} ${r.desc}`);
  console.log(`\nresults: ${outFile}`);
  console.log(`screenshots: ${SS_DIR}`);
})();
