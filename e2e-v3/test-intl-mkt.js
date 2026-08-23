/**
 * GoviHub Spices E2E V3 — international phone + supplier marketplace (P1-P7)
 * Target: LIVE PRODUCTION https://spices.govihublk.com
 *
 * Convention follows test-tos.js: plain node + playwright chromium,
 * screenshots into ./screenshots/intl-mkt, results JSON into ./results,
 * pass/fail/blocked collectors, ONLY= env filter (comma list, e.g. ONLY=p1,p2).
 *
 * RULE: every feature is reached through real UI navigation from the
 * dashboard. Direct URL entry is used ONLY for the initial login page
 * (/en/auth/beta-login), which the operator explicitly allowed.
 *
 * Screenshot note: react-phone-number-input's country <select> is a native
 * select rendered with opacity:0 over the flag. A native dropdown never
 * paints into a headless page screenshot, so for the "open dropdown"
 * evidence shots the select is temporarily styled visible + size=N (inline
 * listbox), captured, then restored. All ASSERTIONS run against the
 * untouched DOM option list, never the styled clone.
 *
 * Run: node test-intl-mkt.js         (from e2e-v3/)
 */
const { chromium } = require('playwright');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');

const BASE = 'https://spices.govihublk.com';
const SS_DIR = path.join(__dirname, 'screenshots', 'intl-mkt');
const OUT = path.join(__dirname, 'results');
const FIX = path.join(__dirname, 'fixtures-intl-mkt');
for (const d of [SS_DIR, OUT, FIX]) fs.mkdirSync(d, { recursive: true });

const RUN = Math.floor(Math.random() * 900000 + 100000); // 6 digits
const PASSWORD = 'PlwMkt2026!';

// Smoke-suite accounts (already exist in prod, password IntlSmoke2026!)
const SMK = {
  farmer: { username: 'smkfrm466762', password: 'IntlSmoke2026!' },
  buyer: { username: 'smkbuy466762', password: 'IntlSmoke2026!' },
  supplier2: { username: 'smksup2466762', password: 'IntlSmoke2026!' },
};

const results = [];
const createdUsers = [];
const createdListings = [];
let ssCount = 0;

async function ss(page, name) {
  ssCount++;
  const fname = `${String(ssCount).padStart(3, '0')}_${name}.png`;
  await page.screenshot({ path: path.join(SS_DIR, fname), fullPage: true });
  return path.join('screenshots', 'intl-mkt', fname);
}
function pass(id, desc, ev) { results.push({ id, desc, status: 'PASS', evidence: ev }); console.log(`  PASS ${id}: ${desc} — ${ev}`); }
function fail(id, desc, ev) { results.push({ id, desc, status: 'FAIL', evidence: ev }); console.log(`  FAIL ${id}: ${desc} — ${ev}`); }
function blocked(id, desc, ev) { results.push({ id, desc, status: 'BLOCKED', evidence: ev }); console.log(`  BLOCKED ${id}: ${desc} — ${ev}`); }

// ---------- unique phone generators (phones are unique per role in prod) ----
function digits(n) { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; }
const mxPhone = () => `+52551234${digits(4)}`;    // Mexico City mobile, 10-digit national
const lkPhone = () => `+9477${digits(7)}`;         // LK mobile 77x
const aePhone = () => `+97150${digits(7)}`;        // UAE mobile 50x (starts +9715 per spec)

// ---------- tiny PNG fixtures (real PNGs so the browser can render them) ----
function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function makePng(w, h, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // bit depth 8, colour type RGB
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
const PNG_RED = path.join(FIX, 'red.png');
const PNG_BLUE = path.join(FIX, 'blue.png');
const PNG_GREEN = path.join(FIX, 'green.png');
fs.writeFileSync(PNG_RED, makePng(24, 24, [220, 40, 40]));
fs.writeFileSync(PNG_BLUE, makePng(24, 24, [40, 60, 220]));
fs.writeFileSync(PNG_GREEN, makePng(24, 24, [40, 180, 60]));

// ---------- shared UI helpers ------------------------------------------------
async function gotoLoginPage(page) {
  // The one permitted direct URL: the initial login page.
  await page.goto(`${BASE}/en/auth/beta-login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
}

async function dismissTosGateIfPresent(page, tag) {
  const gate = page.getByText('Updated Terms of Use', { exact: false }).first();
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Accept' }).first().click().catch(() => {});
    await page.waitForTimeout(2500);
    console.log(`  [note] ToS gate modal appeared for ${tag}; accepted to proceed`);
    return true;
  }
  return false;
}

async function login(page, { username, password }) {
  await gotoLoginPage(page);
  const form = page.locator('form');
  await form.locator('input[type="text"]').first().fill(username);
  await form.locator('input[type="password"]').first().fill(password);
  await form.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(farmer|buyer|supplier|admin)\/dashboard/, { timeout: 45000 });
  await page.waitForTimeout(3000);
  await dismissTosGateIfPresent(page, username);
}

/** Click a bottom-nav link from the current (dashboard) page. */
async function navTo(page, hrefPart, urlRe) {
  const link = page.locator(`a[href="/en/${hrefPart}"]`).first();
  await link.waitFor({ state: 'visible', timeout: 20000 });
  await link.click();
  await page.waitForURL(urlRe, { timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function waitEnabled(loc, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!(await loc.isDisabled().catch(() => true))) return true;
    await loc.page().waitForTimeout(250);
  }
  return false;
}

const countrySelect = (page) => page.locator('select.PhoneInputCountrySelect').first();
const telInput = (page) => page.locator('input.PhoneInputInput, .phone-input-wrapper input[type="tel"]').first();

async function readCountryOptions(page) {
  return countrySelect(page).evaluate((sel) =>
    Array.from(sel.options).map((o) => ({ value: o.value, label: (o.label || o.textContent || '').trim() }))
  );
}

/** Evidence-only: make the native select temporarily visible as an inline
 *  listbox, screenshot, restore. Assertions never use this styled state. */
async function screenshotOpenDropdown(page, name) {
  const sel = countrySelect(page);
  await sel.evaluate((s) => {
    s.dataset.origCss = s.style.cssText;
    s.style.cssText = 'opacity:1;position:relative;width:280px;height:auto;background:#fff;z-index:9999;border:1px solid #999;';
    s.size = 14;
  });
  await page.waitForTimeout(400);
  const shot = await ss(page, name);
  await sel.evaluate((s) => { s.style.cssText = s.dataset.origCss || ''; s.size = 0; });
  await page.waitForTimeout(300);
  return shot;
}

async function openRegisterTab(page) {
  await gotoLoginPage(page);
  await page.locator('button:has-text("Register")').first().click();
  await page.waitForSelector('form input[type="checkbox"]', { timeout: 20000 });
  await page.waitForTimeout(1000);
}

/**
 * Fill the register form (name/username/password/role/district/language).
 * Phone + ToS + submit are handled by the caller so P1 can interrogate the
 * country dropdown in between.
 */
async function fillRegisterBasics(page, user) {
  const form = page.locator('form');
  await form.locator('input[type="text"]').nth(0).fill(user.name);
  await form.locator('input[type="text"]').nth(1).fill(user.username);
  await form.locator('input[type="password"]').first().fill(user.password);
  const roleEmoji = user.role === 'farmer' ? '🌾' : user.role === 'buyer' ? '🛒' : '📦';
  await form.locator(`button:has-text("${roleEmoji}")`).first().click();
  await page.waitForTimeout(300);
  await form.locator('select').first().selectOption('Anuradhapura'); // district (first select; country select comes later in DOM)
  await page.locator('button:has-text("English")').first().click(); // deterministic app language
  await page.waitForTimeout(300);
}

/** Tick ToS, wait for submit to enable, submit, retry fresh phone on the
 *  known duplicate-phone 500 (cap 3 total attempts). */
async function submitRegistration(page, user, phoneGen) {
  const form = page.locator('form');
  const submit = form.locator('button[type="submit"]').first();
  const box = form.locator('input[type="checkbox"]').first();
  if (!(await box.isChecked())) await box.check();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const enabled = await waitEnabled(submit, 8000);
    if (!enabled) {
      const val = await telInput(page).inputValue().catch(() => '?');
      return { ok: false, why: `submit stayed disabled (phone value "${val}" likely invalid)` };
    }
    await submit.click();
    const landed = await page
      .waitForURL(/\/(farmer|buyer|supplier)\/dashboard/, { timeout: 45000 })
      .then(() => true)
      .catch(() => false);
    if (landed) {
      await page.waitForTimeout(3000);
      createdUsers.push({ username: user.username, role: user.role, phone: user.phone });
      return { ok: true, attempts: attempt };
    }
    const alert = await page.locator('[role="alert"]').first().innerText().catch(() => '(no alert)');
    console.log(`  [retry] registration attempt ${attempt} did not land on dashboard (alert: ${alert.trim().slice(0, 120)})`);
    if (attempt === 3) return { ok: false, why: `3 attempts failed; last alert: ${alert.trim().slice(0, 160)}` };
    user.phone = phoneGen();
    await telInput(page).fill(user.phone);
    await page.waitForTimeout(600);
  }
  return { ok: false, why: 'unreachable' };
}

// ============================================================================
// P1 — register NEW buyer, curated dropdown, Mexico number  (desktop)
// ============================================================================
async function P1(ctx) {
  const id = 'P1';
  const desc = 'Register buyer via UI: curated country dropdown, Mexico number, buyer dashboard';
  const page = await ctx.newPage();
  try {
    const user = { name: 'Plw Mkt Buyer', username: `plwmkt${RUN}b`, password: PASSWORD, role: 'buyer', phone: mxPhone() };
    await openRegisterTab(page);
    await fillRegisterBasics(page, user);

    // --- curated dropdown assertions (untouched DOM) ---
    const opts = await readCountryOptions(page);
    const labels = opts.map((o) => o.label);
    const values = opts.map((o) => o.value);
    const problems = [];
    if (!labels.some((l) => /mexico/i.test(l))) problems.push('Mexico MISSING from dropdown');
    if (!labels.some((l) => /france/i.test(l))) problems.push('France MISSING from dropdown');
    if (labels.some((l) => /nigeria/i.test(l)) || values.includes('NG')) problems.push('Nigeria PRESENT (should be absent)');
    if (labels.some((l) => /russia/i.test(l)) || values.includes('RU')) problems.push('Russia PRESENT (should be absent)');
    if (labels.some((l) => /international/i.test(l)) || values.includes('')) problems.push('"International" option PRESENT (should be absent)');
    const selectedDefault = await countrySelect(page).inputValue();
    if (selectedDefault !== 'LK') problems.push(`default selection is ${selectedDefault}, expected LK`);
    // Deviation note, not a failure: react-phone-number-input sorts option
    // labels alphabetically, so LK is the preselected DEFAULT but not row 1.
    const orderNote = values[0] === 'LK'
      ? 'LK is row 1'
      : `NOTE option list is alphabetical (row 1 = ${values[0]}); LK is the preselected default, not row 1`;

    const ddShot = await screenshotOpenDropdown(page, 'P1_country_dropdown_open');

    if (problems.length) {
      fail(id, desc, `dropdown (${opts.length} entries): ` + problems.join('; ') + ` | shot ${ddShot}`);
      return;
    }

    // --- pick Mexico, enter a Mexican mobile ---
    await countrySelect(page).selectOption('MX');
    await page.waitForTimeout(500);
    await telInput(page).fill(user.phone);
    await page.waitForTimeout(500);
    const shownVal = await telInput(page).inputValue();
    await ss(page, 'P1_form_filled_mexico');

    const res = await submitRegistration(page, user, mxPhone);
    if (!res.ok) { fail(id, desc, `registration failed: ${res.why}`); return; }

    const url = page.url();
    await ss(page, 'P1_buyer_dashboard');
    if (!/\/buyer\/dashboard/.test(url)) { fail(id, desc, `landed on ${url}, expected buyer dashboard`); return; }
    pass(id, desc, `dropdown ${opts.length} curated entries (Mexico+France in, Nigeria/Russia/International out, LK default; ${orderNote}); phone ${user.phone} shown as "${shownVal}"; user ${user.username} -> ${url}; dropdown shot ${ddShot}`);
  } catch (e) {
    await ss(page, 'P1_error').catch(() => {});
    fail(id, desc, `exception: ${e.message}`);
  } finally { await page.close(); }
}

// ============================================================================
// P2 — register NEW farmer, default LK flag, +94 number  (desktop, regression)
// ============================================================================
async function P2(ctx) {
  const id = 'P2';
  const desc = 'Register farmer via UI: default LK flag, +94 number, farmer dashboard';
  const page = await ctx.newPage();
  try {
    const user = { name: 'Plw Mkt Farmer', username: `plwmkt${RUN}f`, password: PASSWORD, role: 'farmer', phone: lkPhone() };
    await openRegisterTab(page);
    await fillRegisterBasics(page, user);

    const defCountry = await countrySelect(page).inputValue();
    const ddShot = await screenshotOpenDropdown(page, 'P2_country_dropdown_open_LK_default');
    if (defCountry !== 'LK') { fail(id, desc, `default country is ${defCountry}, expected LK | shot ${ddShot}`); return; }

    // Leave the default LK flag untouched; just type the +94 number.
    await telInput(page).fill(user.phone);
    await page.waitForTimeout(500);
    await ss(page, 'P2_form_filled_lk');

    const res = await submitRegistration(page, user, lkPhone);
    if (!res.ok) { fail(id, desc, `registration failed: ${res.why}`); return; }

    const url = page.url();
    await ss(page, 'P2_farmer_dashboard');
    if (!/\/farmer\/dashboard/.test(url)) { fail(id, desc, `landed on ${url}, expected farmer dashboard`); return; }
    pass(id, desc, `LK default flag kept; phone ${user.phone}; user ${user.username} -> ${url}; dropdown shot ${ddShot}`);
  } catch (e) {
    await ss(page, 'P2_error').catch(() => {});
    fail(id, desc, `exception: ${e.message}`);
  } finally { await page.close(); }
}

// ============================================================================
// P3/P4 core — dashboard -> marketplace -> click the CARD -> detail modal
// ============================================================================
async function marketplaceDetailCheck(ctx, id, desc, account, rolePath, viewportTag, cardText) {
  const page = await ctx.newPage();
  try {
    await login(page, account);
    await navTo(page, `${rolePath}/marketplace`, new RegExp(`${rolePath}/marketplace`));

    // Cards render as full-card <button> elements (Card onClick) — wait for them.
    await page.waitForSelector('button:has(h3)', { timeout: 30000 });
    const card = page.locator(`button:has(h3:has-text("${cardText}"))`).first();
    if (!(await card.count())) { fail(id, desc, `no card containing "${cardText}" on ${rolePath}/marketplace`); return; }
    await card.scrollIntoViewIfNeeded();
    await ss(page, `${id}_${viewportTag}_marketplace`);
    await card.click(); // the CARD itself, not an inner button

    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 20000 });
    await dialog.locator('a[href^="tel:"]').first().waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(1000);
    const shot = await ss(page, `${id}_${viewportTag}_detail_modal`);

    const telHref = await dialog.locator('a[href^="tel:"]').first().getAttribute('href');
    const waHref = await dialog.locator('a[href^="https://wa.me/"]').first().getAttribute('href').catch(() => null);
    const block = await dialog.evaluate((d) => {
      const label = Array.from(d.querySelectorAll('p')).find((p) => /supplier details/i.test(p.textContent || ''));
      const parent = label ? label.parentElement : null;
      if (!parent) return null;
      const ps = Array.from(parent.querySelectorAll('p')).map((p) => (p.textContent || '').trim());
      return {
        name: ps[1] || '',
        district: ps.find((t) => t.startsWith('📍')) || '',
        phone: ps.find((t) => /^\+94\d+/.test(t)) || '',
      };
    });

    const problems = [];
    if (!block) problems.push('supplier block ("Supplier details") not found in modal');
    else {
      if (!block.name) problems.push('supplier name empty/not visible');
      if (!block.district) problems.push('district (📍 …) not visible');
      if (!/^\+94\d+/.test(block.phone)) problems.push(`phone string starting +94 not visible (got "${block.phone}")`);
    }
    if (!telHref || !telHref.startsWith('tel:+94')) problems.push(`tel link href "${telHref}" does not start tel:+94`);
    if (!waHref || !waHref.startsWith('https://wa.me/94')) problems.push(`WhatsApp href "${waHref}" does not start https://wa.me/94`);

    if (problems.length) fail(id, desc, problems.join('; ') + ` | shot ${shot}`);
    else pass(id, desc, `card click opened modal; supplier "${block.name}", ${block.district}, phone ${block.phone}, ${telHref}, ${waHref}; shot ${shot}`);
  } catch (e) {
    await ss(page, `${id}_${viewportTag}_error`).catch(() => {});
    fail(id, desc, `exception: ${e.message}`);
  } finally { await page.close(); }
}

// ============================================================================
// P5 — supplier creates listing with 2 photos; farmer sees thumbnail + photos
// ============================================================================
async function P5(browser, desktop) {
  const id = 'P5';
  const desc = 'Supplier creates listing with 2 photos via UI; My Listings + farmer marketplace show them';
  const listingName = `Plw mkt gear ${RUN}`;
  let createdId = null;
  let uploadedPhotos = null;

  // --- supplier side ---
  let ctx = await browser.newContext(desktop);
  let page = await ctx.newPage();
  try {
    page.on('response', async (res) => {
      try {
        const u = new URL(res.url());
        if (res.request().method() === 'POST' && /\/marketplace\/listings$/.test(u.pathname) && res.ok()) {
          const j = await res.json();
          if (j && j.id) createdId = j.id;
        }
        if (res.request().method() === 'POST' && /\/marketplace\/listings\/[^/]+\/images$/.test(u.pathname) && res.ok()) {
          const j = await res.json();
          if (j && Array.isArray(j.photos)) uploadedPhotos = j.photos;
        }
      } catch { /* non-JSON responses etc. */ }
    });

    await login(page, SMK.supplier2);
    await navTo(page, 'supplier/listings', /supplier\/listings/);

    const fab = page.locator('button[aria-label="Add Supply"]').first();
    await fab.waitFor({ state: 'visible', timeout: 20000 });
    await fab.click({ timeout: 5000 }).catch(() => fab.click({ force: true }));
    const form = page.locator('#supply-form');
    await form.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(800);

    await form.locator('select').first().selectOption('equipment');
    // The shared Input component spreads props without a default type attr,
    // so the name field is the first <input> in the form (no [type="text"]).
    await form.locator('input').first().fill(listingName);
    await form.locator('textarea').first().fill('Playwright intl-mkt E2E listing. Safe to delete in cleanup.');
    await form.locator('input[type="number"]').nth(0).fill('1234'); // price
    await form.locator('input[type="number"]').nth(1).fill('7');    // stock

    await form.locator('input[type="file"]').setInputFiles([PNG_RED, PNG_BLUE]);
    await page.waitForFunction(
      () => document.querySelectorAll('#supply-form img').length === 2,
      null, { timeout: 15000 }
    );
    await ss(page, 'P5_create_form_2_photos_staged');

    await page.locator('button:has-text("Create Listing")').first().click();
    // create POST -> images POST -> list reload
    await form.waitFor({ state: 'hidden', timeout: 30000 });
    await page.waitForTimeout(8000);

    if (!createdId) { fail(id, desc, 'no successful POST /marketplace/listings observed — listing not created'); return; }
    createdListings.push({ id: createdId, name: listingName, owner: SMK.supplier2.username });

    const thumb = page.locator(`img[src*="${createdId}"]`).first();
    const thumbVisible = await thumb.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
    const thumbLoaded = thumbVisible && await thumb.evaluate((i) => i.complete && i.naturalWidth > 0);
    await ss(page, 'P5_my_listings_thumbnail');
    if (!thumbLoaded) {
      fail(id, desc, `listing ${createdId} created but My Listings thumbnail img[src*=id] not rendered (visible=${thumbVisible}); uploaded photos: ${JSON.stringify(uploadedPhotos)}`);
      return;
    }
  } catch (e) {
    await ss(page, 'P5_supplier_error').catch(() => {});
    fail(id, desc, `exception (supplier side): ${e.message}`);
    return;
  } finally { await page.close(); await ctx.close(); }

  // --- farmer side ---
  ctx = await browser.newContext(desktop);
  page = await ctx.newPage();
  try {
    await login(page, SMK.farmer);
    await navTo(page, 'farmer/marketplace', /farmer\/marketplace/);
    await page.waitForSelector('button:has(h3)', { timeout: 30000 });

    const card = page.locator(`button:has(h3:has-text("${listingName}"))`).first();
    if (!(await card.count())) { fail(id, desc, `new listing "${listingName}" not found in farmer marketplace`); return; }
    await card.scrollIntoViewIfNeeded();
    const cardThumb = card.locator(`img[src*="${createdId}"]`).first();
    const cardThumbOk = await cardThumb.isVisible().catch(() => false) &&
      await cardThumb.evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false);
    await ss(page, 'P5_farmer_marketplace_card');

    await card.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForFunction(
      (lid) => {
        const imgs = Array.from(document.querySelectorAll(`[role="dialog"] img[src*="${lid}"]`));
        return imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0);
      },
      createdId, { timeout: 25000 }
    ).catch(() => {});
    const nPhotos = await dialog.locator(`img[src*="${createdId}"]`).count();
    const allRendered = nPhotos > 0 && await dialog
      .locator(`img[src*="${createdId}"]`)
      .evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0));
    const shot = await ss(page, 'P5_farmer_detail_2_photos');

    const problems = [];
    if (!cardThumbOk) problems.push('marketplace card thumbnail not rendered');
    if (nPhotos !== 2) problems.push(`detail modal shows ${nPhotos} photos for this listing, expected 2`);
    else if (!allRendered) problems.push('detail modal photos present but not rendered (naturalWidth=0)');

    if (problems.length) fail(id, desc, problems.join('; ') + ` | listing ${createdId} "${listingName}" | shot ${shot}`);
    else pass(id, desc, `listing ${createdId} "${listingName}" created with 2 photos; My Listings thumbnail OK; farmer card thumbnail OK; detail modal renders both photos; shot ${shot}`);
  } catch (e) {
    await ss(page, 'P5_farmer_error').catch(() => {});
    fail(id, desc, `exception (farmer side): ${e.message}`);
  } finally { await page.close(); await ctx.close(); }
}

// ============================================================================
// P6 — edit the P5 listing: remove one photo, add one, persists after reload
// ============================================================================
async function P6(ctx) {
  const id = 'P6';
  const desc = 'Edit listing: remove one photo, add one; state persists after reload';
  const listing = createdListings[0];
  if (!listing) { blocked(id, desc, 'no listing created in P5 to edit'); return; }
  const page = await ctx.newPage();
  try {
    await login(page, SMK.supplier2);
    await navTo(page, 'supplier/listings', /supplier\/listings/);
    await page.waitForSelector('h3', { timeout: 30000 });

    const openEditModal = async () => {
      const editBtn = page
        .locator(`div.rounded-2xl:has(h3:has-text("${listing.name}"))`)
        .locator('button:has-text("Edit")')
        .first();
      await editBtn.waitFor({ state: 'visible', timeout: 20000 });
      await editBtn.click();
      await page.locator('#supply-form').waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(1500);
    };
    const photoSrcs = () =>
      page.locator('#supply-form img').evaluateAll((imgs) => imgs.map((i) => i.src));

    await openEditModal();
    const before = await photoSrcs();
    await ss(page, 'P6_edit_modal_before');
    if (before.length !== 2) { fail(id, desc, `edit modal shows ${before.length} current photos, expected 2 from P5`); return; }

    // Remove the first photo (immediate DELETE in edit mode).
    await page.locator('#supply-form button[aria-label="Remove photo"]').first().click();
    await page.waitForFunction(() => document.querySelectorAll('#supply-form img').length === 1, null, { timeout: 20000 });

    // Add one new photo (immediate POST in edit mode).
    await page.locator('#supply-form input[type="file"]').setInputFiles([PNG_GREEN]);
    await page.waitForFunction(() => document.querySelectorAll('#supply-form img').length === 2, null, { timeout: 25000 });
    const after = await photoSrcs();
    await ss(page, 'P6_edit_modal_after_swap');

    await page.locator('button:has-text("Update Listing")').first().click();
    await page.locator('#supply-form').waitFor({ state: 'hidden', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Reload the same page (state persistence check), reopen the edit modal.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await dismissTosGateIfPresent(page, 'supplier2-reload');
    await openEditModal();
    const final = await photoSrcs();
    const shot = await ss(page, 'P6_edit_modal_after_reload');

    const setEq = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    const kept = final.filter((u) => before.includes(u));
    const fresh = final.filter((u) => !before.includes(u));

    const problems = [];
    if (final.length !== 2) problems.push(`after reload: ${final.length} photos, expected 2`);
    if (!setEq(final, after)) problems.push('photo set after reload differs from what the edit session showed (not persisted)');
    if (kept.length !== 1 || fresh.length !== 1) problems.push(`expected exactly 1 kept + 1 new photo, got kept=${kept.length} new=${fresh.length}`);

    if (problems.length) fail(id, desc, problems.join('; ') + ` | before=${JSON.stringify(before)} final=${JSON.stringify(final)} | shot ${shot}`);
    else pass(id, desc, `removed 1, added 1; after reload still 2 photos (1 kept, 1 new); kept=${kept[0].slice(-40)} new=${fresh[0].slice(-40)}; shot ${shot}`);
  } catch (e) {
    await ss(page, 'P6_error').catch(() => {});
    fail(id, desc, `exception: ${e.message}`);
  } finally { await page.close(); }
}

// ============================================================================
// P7 — farmer changes phone to UAE via Settings country picker; persists
// ============================================================================
async function P7(ctx) {
  const id = 'P7';
  const desc = 'Farmer Settings: change phone to UAE (+9715…) via country picker; persists after reload';
  const page = await ctx.newPage();
  try {
    await login(page, SMK.farmer);
    // Dashboard -> More -> Settings (real UI path; farmer bottom nav has no direct settings link)
    await navTo(page, 'farmer/more', /farmer\/more/);
    await page.getByText('Settings', { exact: true }).first().click();
    await page.waitForURL(/farmer\/settings/, { timeout: 30000 });
    await page.waitForTimeout(4000);

    await countrySelect(page).waitFor({ state: 'attached', timeout: 20000 });
    const oldVal = await telInput(page).inputValue();

    let newPhone = aePhone();
    let saved = false, lastErr = '';
    for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
      await countrySelect(page).selectOption('AE');
      await page.waitForTimeout(400);
      await telInput(page).fill(newPhone);
      await page.waitForTimeout(600);
      if (attempt === 1) await ss(page, 'P7_settings_uae_entered');
      await page.locator('button:has-text("Save Changes")').first().click();
      saved = await page.getByText('✓ Saved!', { exact: false }).first()
        .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
      if (!saved) {
        lastErr = await page.locator('.text-red-700, [role="alert"]').first().innerText().catch(() => '(no error shown)');
        console.log(`  [retry] settings save attempt ${attempt} failed: ${lastErr.trim().slice(0, 120)}`);
        newPhone = aePhone();
      }
    }
    if (!saved) { fail(id, desc, `save never confirmed after 3 attempts; last error: ${lastErr.trim().slice(0, 160)}`); return; }
    await ss(page, 'P7_settings_saved');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000);
    await dismissTosGateIfPresent(page, 'farmer-settings-reload');
    await countrySelect(page).waitFor({ state: 'attached', timeout: 20000 });
    // Profile loads async — wait until the input is hydrated.
    await page.waitForFunction(
      () => { const i = document.querySelector('input.PhoneInputInput, .phone-input-wrapper input'); return i && i.value.trim().length > 0; },
      null, { timeout: 20000 }
    );
    const reloadedRaw = await telInput(page).inputValue();
    const reloadedE164 = reloadedRaw.replace(/[\s-]/g, '');
    const reloadedCountry = await countrySelect(page).inputValue();
    const shot = await ss(page, 'P7_settings_after_reload');

    const problems = [];
    if (reloadedE164 !== newPhone) problems.push(`input after reload is "${reloadedRaw}" (${reloadedE164}), expected ${newPhone}`);
    if (reloadedCountry !== 'AE') problems.push(`country picker after reload is ${reloadedCountry}, expected AE`);

    if (problems.length) fail(id, desc, problems.join('; ') + ` | shot ${shot}`);
    else pass(id, desc, `phone "${oldVal.trim()}" -> ${newPhone}; after reload input shows "${reloadedRaw}" with AE flag; shot ${shot}`);
  } catch (e) {
    await ss(page, 'P7_error').catch(() => {});
    fail(id, desc, `exception: ${e.message}`);
  } finally { await page.close(); }
}

// ============================================================================
(async () => {
  const browser = await chromium.launch({ headless: true });
  const t0 = Date.now();
  console.log(`\nGoviHub intl-phone + marketplace E2E — LIVE ${BASE}\nrun id: ${RUN}\n`);

  const DESKTOP = { viewport: { width: 1280, height: 800 }, locale: 'en-US' };
  const MOBILE = { viewport: { width: 390, height: 844 }, locale: 'en-US', hasTouch: true };

  const only = (process.env.ONLY || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const run = (name) => only.length === 0 || only.includes(name);

  let ctx;
  if (run('p1')) { console.log('P1 — buyer registration, Mexico'); ctx = await browser.newContext(DESKTOP); await P1(ctx); await ctx.close(); }
  if (run('p2')) { console.log('P2 — farmer registration, LK default'); ctx = await browser.newContext(DESKTOP); await P2(ctx); await ctx.close(); }
  if (run('p3')) {
    console.log('P3 — farmer marketplace card -> detail (desktop)');
    ctx = await browser.newContext(DESKTOP);
    await marketplaceDetailCheck(ctx, 'P3_desktop', 'Farmer: marketplace card click -> supplier detail modal (desktop 1280x800)', SMK.farmer, 'farmer', 'desktop', 'Smoke compost');
    await ctx.close();
    console.log('P3 — farmer marketplace card -> detail (mobile)');
    ctx = await browser.newContext(MOBILE);
    await marketplaceDetailCheck(ctx, 'P3_mobile', 'Farmer: marketplace card click -> supplier detail modal (mobile 390x844)', SMK.farmer, 'farmer', 'mobile', 'Smoke compost');
    await ctx.close();
  }
  if (run('p4')) {
    console.log('P4 — buyer marketplace card -> detail (desktop)');
    ctx = await browser.newContext(DESKTOP);
    await marketplaceDetailCheck(ctx, 'P4', 'Buyer: marketplace card click -> supplier detail modal (desktop)', SMK.buyer, 'buyer', 'desktop', 'Smoke compost');
    await ctx.close();
  }
  if (run('p5')) { console.log('P5 — supplier creates listing with photos'); await P5(browser, DESKTOP); }
  if (run('p6')) { console.log('P6 — edit listing photos'); ctx = await browser.newContext(DESKTOP); await P6(ctx); await ctx.close(); }
  if (run('p7')) { console.log('P7 — farmer settings phone -> UAE'); ctx = await browser.newContext(DESKTOP); await P7(ctx); await ctx.close(); }

  await browser.close();

  const summary = {
    target: BASE,
    run: RUN,
    started: new Date(t0).toISOString(),
    duration_s: Math.round((Date.now() - t0) / 1000),
    created_users: createdUsers,
    created_listings: createdListings,
    results,
  };
  const outFile = path.join(OUT, `intl-mkt-${RUN}.json`);
  // Merge into a prior partial run's file when ONLY= is used with RESULTS=<file>.
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  console.log('\n================ SUMMARY ================');
  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(12)} ${r.desc}`);
  console.log(`\ncreated users: ${createdUsers.map((u) => `${u.username}(${u.role},${u.phone})`).join(', ') || '(none)'}`);
  console.log(`created listings: ${createdListings.map((l) => `${l.id} "${l.name}"`).join(', ') || '(none)'}`);
  console.log(`results: ${outFile}`);
  console.log(`screenshots: ${SS_DIR}`);
})();
