/**
 * GoviHub E2E V3 — admin panel API error rendering (apiErrorMessage fix)
 *
 * Target: LIVE PRODUCTION  https://spices.govihublk.com/admin/
 *
 * Re-verification of commit 897b616 "fix(admin): render API errors as text,
 * not [object Object]". apiFetch now routes every rejection through
 * apiErrorMessage(data, status).
 *
 * CREDENTIALS: never stored here. ADMIN is parsed out of test-all.js at runtime
 * and is never logged or written to the results JSON.
 *
 * MUTATION SCOPE: throwaway farmer `agate530055` ONLY. `nuwan` is never touched.
 * Both cases below are expected to be REJECTED, so nothing should change.
 *
 * Gates
 *   GE.1  bad phone (local format 0771234567) -> readable error, no [object Object]
 *   GE.2  empty phone                          -> readable error, no [object Object]
 *   GE.3  production DB phone unchanged (+94771230099)
 *
 * Run: node test-admin-error-message.js          (from e2e-v3/)
 *      ONLY=1,3 node test-admin-error-message.js
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

const TARGET = {
  username: 'agate530055',
  id: 'd39a52e7-bd4e-4243-a1ee-7c0b2c7a1845',
};
const EXPECTED_PHONE = '+94771230099';   // must be unchanged at the end
const BAD_PHONE = '0771234567';          // local format — API must reject

const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const run = (n) => ONLY.length === 0 || ONLY.includes(String(n));

const results = [];
const shots = [];
const dbTrail = [];
function pass(id, desc, ev) { results.push({ id, desc, status: 'PASS', evidence: ev }); console.log(`  PASS    ${id}: ${desc}\n          ${ev}`); }
function fail(id, desc, ev) { results.push({ id, desc, status: 'FAIL', evidence: ev }); console.log(`  FAIL    ${id}: ${desc}\n          ${ev}`); }
function blocked(id, desc, ev) { results.push({ id, desc, status: 'BLOCKED', evidence: ev }); console.log(`  BLOCKED ${id}: ${desc}\n          ${ev}`); }

async function ss(page, fname) {
  const full = path.join(SS_DIR, fname);
  await page.screenshot({ path: full, fullPage: true });
  shots.push(full);
  return full;
}

/* --------------------------- production DB (ssh) --------------------------- */
function psql(sql) {
  const remote = `docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -tAc "${sql}"`;
  return execFileSync('ssh', ['govihub-mumbai', remote], { encoding: 'utf8', timeout: 45000 }).trim();
}
function dbUser(label) {
  const raw = psql(`SELECT username, phone, role, name FROM users WHERE username='${TARGET.username}';`);
  const [username, phone, role, name] = raw.split('|');
  const row = { username, phone, role, name };
  dbTrail.push({ at: new Date().toISOString(), label, raw, row });
  console.log(`  [db] ${label}: ${raw}`);
  return row;
}

/* ------------------------------- credentials ------------------------------- */
function adminCreds() {
  const src = fs.readFileSync(path.join(__dirname, 'test-all.js'), 'utf8');
  const m = src.match(/const\s+ADMIN\s*=\s*\{\s*username:\s*'([^']+)'\s*,\s*password:\s*'([^']+)'/);
  if (!m) throw new Error('ADMIN const not found in test-all.js');
  return { username: m[1], password: m[2] };
}

/* ------------------------------- UI helpers ------------------------------- */
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
  await page.waitForTimeout(2500);
}

function targetRow(page) {
  return page.locator(`#users-tbody tr:has-text("${TARGET.username}")`).first();
}

/** The row-level Edit button: btn btn-sm btn-secondary with onclick openEditUser(...)
 *  — explicitly NOT the read-only detail modal trigger. */
function editButton(page) {
  return targetRow(page).locator('button.btn-secondary:has-text("Edit")').first();
}

async function openEditModal(page) {
  const btn = editButton(page);
  const onclick = await btn.getAttribute('onclick').catch(() => null);
  await btn.click();
  await page.locator('#modal-edit-user').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);
  return onclick;
}

async function toastTexts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.toast, #toast, [class*="toast"]')]
      .map(e => (e.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 5)
  );
}

/** Submit the edit form and collect everything rendered afterwards. */
async function saveAndCapture(page, phoneValue) {
  await page.fill('#edit-user-phone', phoneValue);
  const actual = await page.inputValue('#edit-user-phone');

  let putStatus = null;
  let putBody = '';
  const [resp] = await Promise.all([
    page.waitForResponse(r => /\/admin\/users\//.test(r.url()) && r.request().method() === 'PUT', { timeout: 25000 }).catch(() => null),
    page.locator('#modal-edit-user button:has-text("Save changes")').click(),
  ]);
  if (resp) { putStatus = resp.status(); putBody = (await resp.text().catch(() => '')).slice(0, 400); }
  await page.waitForTimeout(1500);

  const errVisible = await page.locator('#edit-user-error').isVisible().catch(() => false);
  // innerText is what a human actually sees rendered
  const errText = await page.evaluate(() => {
    const el = document.getElementById('edit-user-error');
    return el ? (el.innerText || el.textContent || '').trim() : '(#edit-user-error not in DOM)';
  });
  const modalStillOpen = await page.locator('#modal-edit-user').isVisible().catch(() => false);
  const toasts = await toastTexts(page);

  return { fieldValue: actual, putStatus, putBody, errVisible, errText, modalStillOpen, toasts };
}

function assertNoObjectObject(id, desc, cap, shotPath) {
  const all = [cap.errText, ...cap.toasts].join(' | ');
  const hasObjObj = all.includes('[object Object]');
  const readable = cap.errText.length > 0 && !hasObjObj;
  const ev =
    `PUT ${cap.putStatus}; field value sent="${cap.fieldValue}"; ` +
    `#edit-user-error visible=${cap.errVisible} text="${cap.errText}"; ` +
    `toasts=${JSON.stringify(cap.toasts)}; modal still open=${cap.modalStillOpen}; ` +
    `API body=${cap.putBody}; shot=${shotPath}`;
  if (!hasObjObj && readable && cap.errVisible) pass(id, desc, ev);
  else fail(id, desc, ev);
  return { hasObjObj, readable };
}

/* ================================== main ================================== */
(async () => {
  const t0 = Date.now();
  console.log(`\nRUN ${RUN} — ${ADMIN_URL} (LIVE PRODUCTION)`);
  console.log(`mutations attempted on throwaway user '${TARGET.username}' (${TARGET.id}) only\n`);
  const before = dbUser('run-start');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

  const rendered = {};
  try {
    await adminLogin(page);
    await gotoUsers(page);
    await searchFor(page, TARGET.username);
    if (await targetRow(page).count() === 0) throw new Error('target row not found after search');
    const onclick = await openEditModal(page);
    console.log(`  [ui] edit modal open via onclick="${onclick}"\n`);

    if (run(1)) {
      console.log('GE.1 — bad phone (local format)');
      const cap = await saveAndCapture(page, BAD_PHONE);
      const shot = await ss(page, 'fix_error_message.png');
      rendered.bad_phone = { text: cap.errText, toasts: cap.toasts, put: cap.putStatus, shot };
      assertNoObjectObject('GE.1', 'local-format phone rejected with human-readable message', cap, shot);
    }

    if (run(2)) {
      console.log('\nGE.2 — empty phone');
      if (!(await page.locator('#modal-edit-user').isVisible().catch(() => false))) {
        await searchFor(page, TARGET.username);
        await openEditModal(page);
      }
      const cap = await saveAndCapture(page, '');
      const shot = await ss(page, 'fix_error_message_empty.png');
      rendered.empty_phone = { text: cap.errText, toasts: cap.toasts, put: cap.putStatus, shot };
      assertNoObjectObject('GE.2', 'empty phone rejected with human-readable message', cap, shot);
    }

    await page.locator('#modal-edit-user button:has-text("Cancel")').click().catch(() => {});
  } catch (e) {
    blocked('RUN', 'harness', `${e.message}`);
    try { await ss(page, 'fix_error_harness_failure.png'); } catch {}
  } finally {
    await browser.close();
  }

  const after = dbUser('run-end');
  if (run(3)) {
    console.log('\nGE.3 — DB unchanged');
    const ev = `before phone=${before.phone}; after phone=${after.phone}; expected=${EXPECTED_PHONE}`;
    if (after.phone === EXPECTED_PHONE && before.phone === after.phone) pass('GE.3', 'production phone unchanged by rejected saves', ev);
    else fail('GE.3', 'production phone unchanged by rejected saves', ev);
  }

  const summary = {
    run: RUN,
    target: ADMIN_URL,
    commit_under_test: '897b616 fix(admin): render API errors as text, not [object Object]',
    throwaway_user: { username: TARGET.username, id: TARGET.id },
    started: new Date(t0).toISOString(),
    duration_s: Math.round((Date.now() - t0) / 1000),
    rendered_error_strings: rendered,
    db_trail: dbTrail,
    console_errors: consoleErrors.slice(0, 20),
    screenshots: shots,
    results,
  };
  const outFile = path.join(OUT, `admin-error-message-${RUN}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  console.log('\n================ GATES ================');
  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(6)} ${r.desc}`);
  console.log('\n--------- EXACT RENDERED STRINGS ---------');
  for (const [k, v] of Object.entries(rendered)) console.log(`${k}: ${JSON.stringify(v.text)}  toasts=${JSON.stringify(v.toasts)}`);
  console.log(`\nresults: ${outFile}`);
})();
