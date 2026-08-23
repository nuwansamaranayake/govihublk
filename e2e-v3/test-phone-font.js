/**
 * GoviHub E2E V3 — GA (admin phone normalisation THROUGH THE ADMIN UI)
 *                 + GB (Noto Sans Sinhala webfont on the umbrella)
 *
 * Target: LIVE PRODUCTION
 *   spices.govihublk.com  — admin console (Task A)
 *   govihublk.com         — umbrella marketing site (Task B)
 *
 * Convention follows test-cleanup-vision.js / test-intl-mkt.js: plain node +
 * playwright chromium, screenshots into ./screenshots/phone-font, results JSON
 * into ./results, pass/fail/blocked collectors, ONLY= env filter (a,b).
 *
 * CREDENTIALS: never stored in this file. The ADMIN const is parsed out of
 * test-all.js at runtime and is never logged or written to the results JSON.
 *
 * TASK A mutates REAL production data (users.phone for username 'nuwan').
 * Every assertion about the stored value is made against the PRODUCTION
 * DATABASE over ssh from node's own shell — never against what the UI claims.
 *
 * TASK B font method — three independent probes per page:
 *   1. document.fonts.check('16px "Noto Sans Sinhala"') after document.fonts.ready
 *   2. successful (2xx) network responses from fonts.gstatic.com (the woff2 files)
 *   3. CDP CSS.getPlatformFontsForNode on the Sinhala Vision <p> and on .vm-head
 *      (font-weight: 800) -> the family Chromium ACTUALLY rasterised with, plus
 *      glyph counts. This is the decisive probe: it distinguishes "the webfont
 *      loaded" from "the webfont was used for this text at this weight".
 *
 * HOST CAVEAT: runs in headless Chromium on Windows 11, which ships Nirmala UI
 * (Sinhala-capable). A page CAN render Sinhala here without any webfont. That is
 * exactly why probe 3 matters — it names the family that did the work.
 *
 * Run: node test-phone-font.js              (from e2e-v3/)
 *      ONLY=a node test-phone-font.js       (task A only)
 *      ONLY=b node test-phone-font.js       (task B only)
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const UMBRELLA = 'https://govihublk.com';
const SPICES = 'https://spices.govihublk.com';
const SS_DIR = path.join(__dirname, 'screenshots', 'phone-font');
const OUT = path.join(__dirname, 'results');
for (const d of [SS_DIR, OUT]) fs.mkdirSync(d, { recursive: true });

const RUN = Math.floor(Math.random() * 900000 + 100000);
const BAD_PHONE = '0771234567';   // local format — must be REJECTED by the form
const GOOD_PHONE = '+94771234567'; // E.164 — must be ACCEPTED

const results = [];
const dbTrail = [];
const fontFindings = [];
const shots = [];
let ssCount = 0;

const ONLY = (process.env.ONLY || '').toLowerCase();
const run = (k) => !ONLY || ONLY.split(',').map((s) => s.trim()).includes(k);

function pass(id, desc, evidence) { results.push({ id, desc, status: 'PASS', evidence }); console.log(`  PASS     ${id}: ${desc} — ${evidence}`); }
function fail(id, desc, evidence) { results.push({ id, desc, status: 'FAIL', evidence }); console.log(`  FAIL     ${id}: ${desc} — ${evidence}`); }
function blocked(id, desc, evidence) { results.push({ id, desc, status: 'BLOCKED', evidence }); console.log(`  BLOCKED  ${id}: ${desc} — ${evidence}`); }

async function ss(page, name, opts = {}) {
  ssCount++;
  const fname = `${String(ssCount).padStart(3, '0')}_${name}.png`;
  const p = path.join(SS_DIR, fname);
  await page.screenshot({ path: p, fullPage: opts.fullPage !== false });
  shots.push(p);
  return p;
}

async function ssEl(locator, name) {
  ssCount++;
  const fname = `${String(ssCount).padStart(3, '0')}_${name}.png`;
  const p = path.join(SS_DIR, fname);
  await locator.screenshot({ path: p });
  shots.push(p);
  return p;
}

/* ---------------- credentials (runtime, never persisted) ---------------- */
function adminCreds() {
  const src = fs.readFileSync(path.join(__dirname, 'test-all.js'), 'utf8');
  const m = src.match(/const\s+ADMIN\s*=\s*\{[^}]*username:\s*['"]([^'"]+)['"][^}]*password:\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('ADMIN const not parseable from test-all.js');
  return { username: m[1], password: m[2] };
}

/* ---------------- production DB probe (node shell, NOT the browser) ------ */
const SQL_SELECT = "SELECT phone FROM users WHERE username='nuwan';";
const SQL_RESTORE = "UPDATE users SET phone='0771234567' WHERE username='nuwan' AND role='admin';";

function psql(sql) {
  const remote = `docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -tAc "${sql}"`;
  return execFileSync('ssh', ['govihub-mumbai', remote], { encoding: 'utf8', timeout: 45000 }).trim();
}

function dbPhone(label) {
  const v = psql(SQL_SELECT);
  dbTrail.push({ at: new Date().toISOString(), label, phone: v });
  console.log(`  [db] ${label}: phone = ${JSON.stringify(v)}`);
  return v;
}

let restoreUsed = false;
function dbRestore(why) {
  console.log(`  [db] RESTORE PATH invoked: ${why}`);
  psql(SQL_RESTORE);
  restoreUsed = true;
  return dbPhone('after-restore');
}

/* ---------------- shared UI helpers ---------------- */
/* NOTE: the beta-login page renders the Login/Register tab pair TWICE (a
 * responsive duplicate), so `button:has-text("Login")` is ambiguous and .last()
 * lands on the hidden duplicate's TAB, which resets the controlled inputs.
 * Address the fields by placeholder and the submit by button[type=submit]. */
async function betaLogin(page, username, password) {
  await page.goto(`${SPICES}/en/auth/beta-login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.fill('input[placeholder="Enter username"]', username);
  await page.fill('input[placeholder="Enter password"]', password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/beta/login') && r.request().method() === 'POST', { timeout: 25000 }).catch(() => null),
    page.locator('button[type="submit"]').last().click(),
  ]);
  await page.waitForTimeout(4000);
}

/** Inventory every editable control + button inside the topmost dialog (or the
 *  whole document if no dialog). Used to decide whether a phone FIELD exists. */
async function inventoryForm(page) {
  return page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"],dialog,[aria-modal="true"]')]
      .filter((d) => d.getClientRects().length);
    const scope = dialogs.length ? dialogs[dialogs.length - 1] : document.body;
    const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
    const fields = [...scope.querySelectorAll('input,textarea,select,[contenteditable="true"]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      id: el.id || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      autocomplete: el.getAttribute('autocomplete') || '',
      visible: vis(el),
    }));
    const buttons = [...scope.querySelectorAll('button,[role="button"]')]
      .filter(vis).map((b) => (b.textContent || '').trim() || b.getAttribute('aria-label') || '(icon)');
    const text = (scope.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      scope: dialogs.length ? 'dialog' : 'document',
      fields,
      buttons,
      mentionsPhone: /phone/i.test(text),
      textSample: text.slice(0, 600),
    };
  });
}

/** Is any of the inventoried fields plausibly the phone input? */
function findPhoneField(inv) {
  return inv.fields.find((f) => {
    if (!f.visible) return false;
    const hay = `${f.type} ${f.name} ${f.id} ${f.placeholder} ${f.ariaLabel} ${f.autocomplete}`.toLowerCase();
    return f.type === 'tel' || /phone|mobile|tel\b/.test(hay);
  });
}

/* ================================ TASK A ================================ */
async function taskA(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

  const before = dbPhone('before-any-ui-action');
  if (before !== BAD_PHONE) {
    console.log(`  [db] WARNING: expected before-state ${BAD_PHONE}, found ${JSON.stringify(before)}`);
  }

  const { username, password } = adminCreds();
  await betaLogin(page, username, password);
  const afterLoginUrl = page.url();
  await ss(page, 'A01_after_admin_login');
  if (!/\/admin\//.test(afterLoginUrl)) {
    // some builds land on a role picker / home; walk to the admin area via UI
    console.log(`  [ui] post-login url: ${afterLoginUrl} (not /admin/) — looking for an admin entry point`);
  }

  // --- navigate to user management by clicking the sidebar nav (no typed URL)
  let onUsers = false;
  for (let attempt = 0; attempt < 3 && !onUsers; attempt++) {
    try {
      const usersLink = page.locator('nav a:has-text("Users"), a:has-text("Users")').first();
      await usersLink.waitFor({ state: 'visible', timeout: 8000 });
      await usersLink.click();
      await page.waitForTimeout(3000);
      onUsers = /\/admin\/users/.test(page.url());
    } catch (e) {
      // maybe a mobile/hamburger layout — try opening a menu first
      try { await page.locator('button[aria-label*="menu" i], button:has-text("Menu")').first().click({ timeout: 3000 }); await page.waitForTimeout(800); } catch {}
    }
  }
  const usersShot = await ss(page, 'A02_admin_users_list');
  if (!onUsers) {
    blocked('GA.1', 'phone field rejects local format', `could not reach admin user management via UI navigation; url=${page.url()} shot=${path.basename(usersShot)}`);
    blocked('GA.2', 'phone field accepts E.164', 'user management unreachable via UI');
    blocked('GA.3', 'DB shows +94771234567', 'no UI save was attempted');
    await ctx.close();
    return;
  }
  console.log(`  [ui] on user management: ${page.url()}`);

  // --- can the 'nuwan' record even be REACHED through this UI?
  // wait for the list to actually finish loading, otherwise a "0 results" search
  // is indistinguishable from "still fetching"
  try {
    await page.waitForFunction(() => {
      const m = (document.body.textContent || '').replace(/\s+/g, ' ').match(/(\d+)\s+registered users/);
      return m && Number(m[1]) > 0;
    }, { timeout: 25000 });
  } catch { console.log('  [ui] WARNING: user list never reported a non-zero loaded count'); }
  const listState = await page.evaluate(() => {
    const t = (document.body.textContent || '').replace(/\s+/g, ' ');
    const loaded = t.match(/(\d+)\s+registered users/);
    const res = t.match(/(\d+)\s+results/);
    return { headerCount: loaded ? Number(loaded[1]) : null, unfilteredResults: res ? Number(res[1]) : null };
  });
  let searchResults = null;
  try {
    const search = page.locator('input[placeholder*="earch" i]').first();
    await search.fill('nuwan');
    await page.waitForTimeout(1800);
    searchResults = await page.evaluate(() => {
      const m = (document.body.textContent || '').replace(/\s+/g, ' ').match(/(\d+)\s+results/);
      return m ? Number(m[1]) : null;
    });
  } catch {}
  const searchShot = await ss(page, 'A03_search_nuwan_in_user_list');
  console.log(`  [ui] list loaded=${listState.headerCount} users (unfiltered rows=${listState.unfilteredResults}), search "nuwan" -> ${searchResults} results`);

  const reachable = searchResults !== null && searchResults > 0;
  if (reachable) {
    const row = page.locator('button, [role="row"], li, tr').filter({ hasText: /nuwan/i }).first();
    try { await row.click({ timeout: 8000 }); await page.waitForTimeout(2000); } catch {}
  } else {
    // Not reachable. Prove the SHAPE of the edit form anyway, on a record that IS
    // reachable — opening a detail modal is read-only, nothing is saved.
    try { await page.locator('input[placeholder*="earch" i]').first().fill(''); await page.waitForTimeout(1500); } catch {}
    try { await page.locator('button').filter({ hasText: /@/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(2000); } catch {}
  }
  const detailShot = await ss(page, reachable ? 'A04_nuwan_detail_open' : 'A04_representative_user_detail_form');
  const inv = await inventoryForm(page);
  fs.writeFileSync(path.join(OUT, `phone-font-${RUN}-admin-form-inventory.json`), JSON.stringify({ listState, searchResults, reachable, inventory: inv }, null, 2));

  // --- also check the admin's own Settings page for a phone field
  try { await page.keyboard.press('Escape'); await page.waitForTimeout(800); } catch {}
  let settingsInv = null;
  try {
    await page.locator('nav a:has-text("Settings"), a:has-text("Settings")').first().click({ timeout: 8000 });
    await page.waitForTimeout(3000);
    settingsInv = await inventoryForm(page);
    await ss(page, 'A05_admin_settings_no_profile_phone');
    console.log(`  [ui] admin Settings: mentionsPhone=${settingsInv.mentionsPhone}, phoneField=${!!findPhoneField(settingsInv)}`);
  } catch (e) { console.log(`  [ui] settings probe failed: ${e.message.slice(0, 100)}`); }

  if (!reachable) {
    const ctrls = inv.fields.filter((f) => f.visible).map((f) => `${f.tag}[${f.type || 'text'}]`);
    const ev = `user 'nuwan' is UNREACHABLE in the admin UI: the list fetches /admin/users?size=100 (no pagination, no server-side search) while prod has 203 users, and 'nuwan' ranks 201 by created_at DESC — searching "nuwan" returns ${searchResults} results. shot=${path.basename(searchShot)}. Separately, the user detail modal that DOES open exposes no phone input at all (visible controls: [${ctrls.join(', ') || 'none'}]; buttons: [${inv.buttons.join(' | ')}]) — phone is read-only text. Admin Settings has no profile phone field either (mentionsPhone=${settingsInv ? settingsInv.mentionsPhone : 'n/a'}). shot=${path.basename(detailShot)}`;
    blocked('GA.1', 'phone field rejects local format', ev);
    blocked('GA.2', 'phone field accepts E.164', 'no phone input exists anywhere in the admin UI — refused to fall back to the API');
    const still = dbPhone('after-blocked-unreachable-record');
    if (still === BAD_PHONE) pass('GA.3-neg', 'prod phone left untouched by this run', `DB still ${still}`);
    else fail('GA.3-neg', 'prod phone left untouched by this run', `DB is ${still}, expected ${BAD_PHONE}`);
    blocked('GA.3', 'DB shows +94771234567', 'no UI save path exists; DB deliberately left at its original value');
    await taskA4(page, ctx, username, password);
    return;
  }

  // --- is there an EDIT affordance that reveals a form?
  let phoneField = findPhoneField(inv);
  let inv2 = inv;
  if (!phoneField) {
    const editBtn = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]').first();
    if (await editBtn.count()) {
      try {
        await editBtn.click({ timeout: 4000 });
        await page.waitForTimeout(1500);
        await ss(page, 'A06_after_edit_click');
        inv2 = await inventoryForm(page);
        phoneField = findPhoneField(inv2);
      } catch {}
    }
  }

  if (!phoneField) {
    const ctrls = inv2.fields.filter((f) => f.visible).map((f) => `${f.tag}[${f.type || 'text'}]${f.name || f.id || f.placeholder ? ':' + (f.name || f.id || f.placeholder) : ''}`);
    const ev = `admin user-edit view has NO phone input. Visible controls: [${ctrls.join(', ') || 'none'}]. Buttons: [${inv2.buttons.join(' | ')}]. Phone is rendered as read-only text (mentionsPhone=${inv2.mentionsPhone}). shot=${path.basename(detailShot)}`;
    blocked('GA.1', 'phone field rejects local format', ev);
    blocked('GA.2', 'phone field accepts E.164', 'no phone input exists on the admin user edit form — refused to fall back to the API');
    const still = dbPhone('after-blocked-no-phone-field');
    if (still === BAD_PHONE) pass('GA.3-neg', 'prod phone unchanged by this run', `DB still ${still}`);
    else fail('GA.3-neg', 'prod phone unchanged by this run', `DB is ${still}, expected ${BAD_PHONE}`);
    blocked('GA.3', 'DB shows +94771234567', 'no UI save path exists; DB left at its original value');
    await taskA4(page, ctx, username, password);
    return;
  }

  console.log(`  [ui] phone field found: ${JSON.stringify(phoneField)}`);
  const phoneLoc = page.locator('input[type="tel"], input[name*="phone" i], input[id*="phone" i], input[placeholder*="phone" i]').first();

  /* ---- GA.1 negative case: local format must be rejected, must not save ---- */
  await phoneLoc.fill('');
  await phoneLoc.fill(BAD_PHONE);
  await page.waitForTimeout(500);
  const saveBtn = page.locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]').first();
  let saveDisabled = false;
  try { saveDisabled = await saveBtn.isDisabled({ timeout: 3000 }); } catch {}
  if (!saveDisabled) { try { await saveBtn.click({ timeout: 5000 }); } catch {} }
  await page.waitForTimeout(2500);
  const ga1Shot = await ss(page, 'A05_GA1_local_format_rejected');
  const errText = await page.evaluate(() => {
    const scope = document.querySelector('[role="dialog"]') || document.body;
    const nodes = [...scope.querySelectorAll('[role="alert"],.text-red-500,.text-red-600,.text-error,[class*="error" i],[aria-invalid="true"]')];
    return nodes.map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 5).join(' | ');
  });
  const afterBad = dbPhone('after-GA1-attempted-save-of-local-format');
  if (afterBad !== BAD_PHONE) {
    fail('GA.1', 'local format rejected and not saved', `DB changed to ${afterBad} — the form accepted an invalid value`);
    dbRestore('GA.1 mutated the row unexpectedly');
  } else if (saveDisabled || errText) {
    pass('GA.1', 'local format rejected and not saved', `${saveDisabled ? 'save disabled' : `visible error: "${errText}"`}; DB unchanged at ${afterBad}; shot=${path.basename(ga1Shot)}`);
  } else {
    fail('GA.1', 'local format rejected and not saved', `no visible validation error and save was clickable, though DB is still ${afterBad}; shot=${path.basename(ga1Shot)}`);
  }

  /* ---- GA.2 positive case: E.164 must save with a visible success state ---- */
  await phoneLoc.fill('');
  await phoneLoc.fill(GOOD_PHONE);
  await page.waitForTimeout(500);
  try { await saveBtn.click({ timeout: 6000 }); } catch (e) { console.log(`  [ui] save click failed: ${e.message.slice(0, 120)}`); }
  await page.waitForTimeout(3500);
  const ga2Shot = await ss(page, 'A06_GA2_e164_saved');
  const successText = await page.evaluate(() => {
    const t = (document.body.textContent || '').replace(/\s+/g, ' ');
    const m = t.match(/(saved|updated|success[^.]{0,40})/i);
    const dialogGone = !document.querySelector('[role="dialog"]');
    return { hint: m ? m[0].slice(0, 80) : '', dialogGone };
  });

  /* ---- GA.3 DB truth ---- */
  const afterGood = dbPhone('after-GA2-save-of-E164');
  if (afterGood === GOOD_PHONE) {
    pass('GA.3', `DB phone is exactly ${GOOD_PHONE}`, `psql returned ${JSON.stringify(afterGood)}`);
    if (successText.hint || successText.dialogGone) {
      pass('GA.2', 'E.164 accepted with a visible success state', `${successText.hint ? `"${successText.hint}"` : 'edit dialog closed on save'}; shot=${path.basename(ga2Shot)}`);
    } else {
      fail('GA.2', 'E.164 accepted with a visible success state', `DB did update but no success state was visible; shot=${path.basename(ga2Shot)}`);
    }
  } else {
    fail('GA.2', 'E.164 accepted', `DB is ${JSON.stringify(afterGood)} after save; shot=${path.basename(ga2Shot)}`);
    fail('GA.3', `DB phone is exactly ${GOOD_PHONE}`, `psql returned ${JSON.stringify(afterGood)}`);
    if (!afterGood || afterGood === '') dbRestore('phone ended up empty after GA.2');
  }

  await taskA4(page, ctx, username, password);
}

/* ---- GA.4 logout through the UI, log back in ---- */
async function taskA4(page, ctx, username, password) {
  try {
    const logout = page.locator('button[aria-label="Logout"], button[aria-label*="logout" i], button:has-text("Logout")').first();
    await logout.waitFor({ state: 'visible', timeout: 8000 });
    await logout.click();
    await page.waitForTimeout(3500);
    const loggedOutUrl = page.url();
    await ss(page, 'A07_after_logout');
    const isOut = /login|auth/.test(loggedOutUrl) || !/\/admin\//.test(loggedOutUrl);
    if (!isOut) { fail('GA.4', 'logout + re-login', `still on ${loggedOutUrl} after clicking Logout`); return; }

    await betaLogin(page, username, password);
    await page.waitForTimeout(2000);
    const backUrl = page.url();
    const dash = await ss(page, 'A08_GA4_admin_dashboard_after_relogin');
    const isAdmin = /\/admin\//.test(backUrl) || (await page.locator('text=Admin Console').count()) > 0;
    if (isAdmin) pass('GA.4', 'logout via UI then re-login succeeds', `back at ${backUrl}; shot=${path.basename(dash)}`);
    else fail('GA.4', 'logout via UI then re-login succeeds', `landed on ${backUrl}; shot=${path.basename(dash)}`);
  } catch (e) {
    fail('GA.4', 'logout via UI then re-login succeeds', `${e.message.slice(0, 160)}`);
  } finally {
    await ctx.close();
  }
}

/* ================================ TASK B ================================ */
const PAGES = [
  { key: 'root', url: `${UMBRELLA}/` },
  { key: 'si', url: `${UMBRELLA}/si` },
];
const VIEWPORTS = [
  { key: 'desktop', width: 1280, height: 800 },
  { key: 'mobile', width: 360, height: 640 },
];

async function platformFonts(cdp, selector) {
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) return { selector, error: 'node not found' };
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    return { selector, fonts: fonts.map((f) => ({ familyName: f.familyName, glyphCount: f.glyphCount, isCustomFont: f.isCustomFont })) };
  } catch (e) {
    return { selector, error: e.message.slice(0, 160) };
  }
}

async function taskB(browser) {
  for (const p of PAGES) {
    for (const v of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } });
      const page = await ctx.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const gstatic = [];
      const failed = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
      page.on('requestfailed', (r) => failed.push({ url: r.url().slice(0, 160), reason: r.failure() && r.failure().errorText }));
      page.on('response', (r) => {
        const u = r.url();
        if (u.includes('fonts.gstatic.com')) gstatic.push({ url: u.slice(0, 160), status: r.status() });
        if (r.status() >= 400) failed.push({ url: u.slice(0, 160), reason: `HTTP ${r.status()}` });
      });

      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);

      const fontCheck = await page.evaluate(() => ({
        check16: document.fonts.check('16px "Noto Sans Sinhala"'),
        check800: document.fonts.check('800 26px "Noto Sans Sinhala"'),
        loadedFaces: [...document.fonts].map((f) => `${f.family}/${f.weight}/${f.status}`),
        linkHrefs: [...document.querySelectorAll('link[rel="stylesheet"],link[rel="preload"]')].map((l) => l.href).filter((h) => /fonts\.googleapis|gstatic/.test(h)),
        vmSiStack: (() => { const el = document.querySelector('.vm-si'); return el ? getComputedStyle(el).fontFamily : null; })(),
        vmHeadStack: (() => { const el = document.querySelector('.vm-head'); return el ? `${getComputedStyle(el).fontFamily} @ ${getComputedStyle(el).fontWeight}` : null; })(),
      }));

      const cdp = await ctx.newCDPSession(page);
      await cdp.send('DOM.enable');
      await cdp.send('CSS.enable');
      const pf = {
        vm_si: await platformFonts(cdp, '.vm-si'),
        vm_head: await platformFonts(cdp, '.vm-head'),
      };

      const gsOk = gstatic.filter((g) => g.status >= 200 && g.status < 300);

      // --- GB.3 screenshots: section scrolled into view, full page + tight element
      const section = page.locator('section.vision-mission').first();
      let fullShot = null, elShot = null;
      try {
        await section.scrollIntoViewIfNeeded({ timeout: 8000 });
        await page.waitForTimeout(800);
        fullShot = await ss(page, `B_${p.key}_${v.key}_fullpage`);
        elShot = await ssEl(section, `B_${p.key}_${v.key}_vision_mission_element`);
      } catch (e) {
        console.log(`  [ui] ${p.key}/${v.key} section screenshot failed: ${e.message.slice(0, 120)}`);
      }

      fontFindings.push({
        page: p.url, viewport: v.key,
        fonts_check_16px: fontCheck.check16,
        fonts_check_800: fontCheck.check800,
        gstatic_success_count: gsOk.length,
        gstatic_all: gstatic,
        google_font_links: fontCheck.linkHrefs,
        loaded_faces: fontCheck.loadedFaces,
        computed_vm_si: fontCheck.vmSiStack,
        computed_vm_head: fontCheck.vmHeadStack,
        platform_fonts: pf,
        console_errors: consoleErrors,
        page_errors: pageErrors,
        failed_requests: failed,
        screenshots: { fullpage: fullShot, element: elShot },
      });

      console.log(`  [B] ${p.key}/${v.key}: check16=${fontCheck.check16} check800=${fontCheck.check800} gstatic2xx=${gsOk.length} ` +
        `vm-si->${(pf.vm_si.fonts || []).map((f) => `${f.familyName}(${f.glyphCount})`).join(',') || pf.vm_si.error} ` +
        `vm-head->${(pf.vm_head.fonts || []).map((f) => `${f.familyName}(${f.glyphCount})`).join(',') || pf.vm_head.error}`);

      await ctx.close();
    }
  }

  // ---- GB.2 verdict (desktop rows are the reference; both viewports must agree)
  for (const p of PAGES) {
    const rows = fontFindings.filter((f) => f.page === p.url);
    const allCheck = rows.every((r) => r.fonts_check_16px === true);
    const gs = rows.map((r) => r.gstatic_success_count);
    const usedSi = rows.map((r) => (r.platform_fonts.vm_si.fonts || []).map((f) => f.familyName).join('+') || 'unknown');
    const usedHead = rows.map((r) => (r.platform_fonts.vm_head.fonts || []).map((f) => f.familyName).join('+') || 'unknown');
    const id = `GB.2-${p.key}`;
    const ev = `fonts.check('16px "Noto Sans Sinhala"')=${rows.map((r) => r.fonts_check_16px).join('/')}; gstatic 2xx=${gs.join('/')}; vm-si rendered by ${usedSi.join(' / ')}; vm-head(800) rendered by ${usedHead.join(' / ')}`;
    if (allCheck) pass(id, `${p.url} loads Noto Sans Sinhala`, ev);
    else fail(id, `${p.url} loads Noto Sans Sinhala`, ev);

    const clean = rows.every((r) => r.console_errors.length === 0 && r.page_errors.length === 0 && r.failed_requests.length === 0);
    const detail = rows.flatMap((r) => [...r.console_errors, ...r.page_errors, ...r.failed_requests.map((f) => `${f.url} ${f.reason}`)]).slice(0, 6);
    if (clean) pass(`GB.2-clean-${p.key}`, `${p.url} no console errors / failed requests`, 'zero console errors, zero page errors, zero failed or 4xx/5xx requests');
    else fail(`GB.2-clean-${p.key}`, `${p.url} no console errors / failed requests`, detail.join(' | '));
  }

  const wanted = PAGES.length * VIEWPORTS.length * 2;
  const got = fontFindings.reduce((n, f) => n + (f.screenshots.fullpage ? 1 : 0) + (f.screenshots.element ? 1 : 0), 0);
  if (got === wanted) pass('GB.3', 'Vision & Mission screenshots, 2 pages x 2 viewports, fullpage + element', `${got}/${wanted} captured in ${SS_DIR}`);
  else fail('GB.3', 'Vision & Mission screenshots, 2 pages x 2 viewports, fullpage + element', `${got}/${wanted} captured`);
}

/* ================================ main ================================ */
(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ headless: true });
  console.log(`\nRUN ${RUN} — targets: ${SPICES} (task A), ${UMBRELLA} (task B)\n`);

  try {
    if (run('a')) { console.log('TASK A — admin phone normalisation through the admin panel UI'); await taskA(browser); }
    if (run('b')) { console.log('\nTASK B — Noto Sans Sinhala on the umbrella'); await taskB(browser); }
  } finally {
    await browser.close();
  }

  const summary = {
    run: RUN,
    targets: { umbrella: UMBRELLA, spices: SPICES },
    started: new Date(t0).toISOString(),
    duration_s: Math.round((Date.now() - t0) / 1000),
    host_caveat:
      'Probes ran in headless Chromium on a Windows 11 host, which ships Nirmala UI (Sinhala-capable). A page can render Sinhala here with no webfont at all, so the transferable finding is platform_fonts: the family Chromium actually rasterised with.',
    restore_path_used: restoreUsed,
    db_trail: dbTrail,
    font_findings: fontFindings,
    screenshots: shots,
    results,
  };
  const outFile = path.join(OUT, `phone-font-${RUN}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  console.log('\n================ GATES ================');
  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(18)} ${r.desc}`);
  console.log(`\nrestore path used: ${restoreUsed}`);
  console.log(`results: ${outFile}`);
  console.log(`screenshots: ${SS_DIR}`);
})();
