/**
 * GoviHub E2E V3 — G4.5 Vision/Mission rendering + G1.4 duplicate-registration UI
 * Target: LIVE PRODUCTION (govihublk.com umbrella + spices.govihublk.com app)
 *
 * Convention follows test-intl-mkt.js / test-tos.js: plain node + playwright
 * chromium, screenshots into ./screenshots/cleanup-vision, results JSON into
 * ./results, pass/fail/blocked collectors, ONLY= env filter (g45,g14).
 *
 * FONT VERDICT METHOD (G4.5) — four independent probes per page:
 *   1. CDP CSS.getPlatformFontsForNode  -> the font families Chromium ACTUALLY
 *      used to rasterise the Sinhala <p>, with glyph counts. Decisive.
 *   2. document.fonts.check() per family in the computed stack.
 *   3. Canvas glyph-distinctness: rasterise 'අ', 'ක' and a guaranteed-tofu
 *      codepoint (U+E000) with the element's resolved font shorthand and hash
 *      the alpha channel. Identical hashes => tofu boxes. Distinct + non-empty
 *      => real glyphs.
 *   4. Shaping probe: width of the ZWJ conjunct "ප්‍ර" vs the same sequence
 *      without ZWJ. A real Sinhala font with GSUB shapes them differently.
 *
 * CAVEAT recorded in the JSON: this runs on a Windows 11 host, so headless
 * Chromium inherits the Windows font set (Nirmala UI ships with Sinhala
 * coverage). A verdict of "real glyphs" here does NOT prove a Sri Lankan
 * visitor on an arbitrary device sees the same. The probe therefore records
 * WHICH family rendered the text, which is the transferable finding.
 *
 * Run: node test-cleanup-vision.js         (from e2e-v3/)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const UMBRELLA = 'https://govihublk.com';
const SPICES = 'https://spices.govihublk.com';
const SS_DIR = path.join(__dirname, 'screenshots', 'cleanup-vision');
const OUT = path.join(__dirname, 'results');
for (const d of [SS_DIR, OUT]) fs.mkdirSync(d, { recursive: true });

const RUN = Math.floor(Math.random() * 900000 + 100000);
const PASSWORD = 'CvLoop2026!';

const results = [];
const createdUsers = [];
const fontVerdicts = [];
let ssCount = 0;

function digits(n) { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; }
const lkPhone = () => `+9477${digits(7)}`;

async function ss(page, name, opts = {}) {
  ssCount++;
  const fname = `${String(ssCount).padStart(3, '0')}_${name}.png`;
  await page.screenshot({ path: path.join(SS_DIR, fname), fullPage: opts.fullPage !== false });
  return path.join('screenshots', 'cleanup-vision', fname);
}
async function ssEl(locator, name) {
  ssCount++;
  const fname = `${String(ssCount).padStart(3, '0')}_${name}.png`;
  await locator.screenshot({ path: path.join(SS_DIR, fname) });
  return path.join('screenshots', 'cleanup-vision', fname);
}
function pass(id, desc, ev) { results.push({ id, desc, status: 'PASS', evidence: ev }); console.log(`  PASS    ${id}: ${ev}`); }
function fail(id, desc, ev) { results.push({ id, desc, status: 'FAIL', evidence: ev }); console.log(`  FAIL    ${id}: ${ev}`); }
function blocked(id, desc, ev) { results.push({ id, desc, status: 'BLOCKED', evidence: ev }); console.log(`  BLOCKED ${id}: ${ev}`); }

// ---------------------------------------------------------------------------
// In-page: tag the Vision/Mission section so CDP + probes have stable selectors
// ---------------------------------------------------------------------------
const TAG_VM = () => {
  const SIN = /[඀-෿]/;
  const heads = Array.from(document.querySelectorAll('h1,h2,h3'));
  // The heading is the bilingual label "දැක්ම — Vision".
  // Match on "Sinhala chars + the Latin word Vision" so this never depends on
  // how this source file happens to be encoded on disk.
  const h = heads.find((e) => SIN.test(e.textContent || '') && /Vision/i.test(e.textContent || ''));
  if (!h) return { found: false, reason: 'no heading containing both Sinhala characters and the word "Vision"' };
  const sec = h.closest('section') || h.parentElement.parentElement;
  sec.id = '__vm_section';
  h.id = '__vm_head';
  const ps = Array.from(sec.querySelectorAll('p'));
  const si = ps.find((p) => SIN.test(p.textContent || '') && (p.textContent || '').trim().length > 60);
  const en = ps.find((p) => !SIN.test(p.textContent || '') && (p.textContent || '').trim().length > 60);
  if (si) si.id = '__vm_si';
  if (en) en.id = '__vm_en';
  const headsAll = Array.from(sec.querySelectorAll('h1,h2,h3')).map((e) => (e.textContent || '').trim());
  return {
    found: true,
    headings: headsAll,
    si_len: si ? si.textContent.trim().length : 0,
    en_len: en ? en.textContent.trim().length : 0,
    si_preview: si ? si.textContent.trim().slice(0, 40) : null,
    en_preview: en ? en.textContent.trim().slice(0, 60) : null,
    has_si: !!si,
    has_en: !!en,
  };
};

// ---------------------------------------------------------------------------
// In-page: font probes 2, 3, 4
// ---------------------------------------------------------------------------
const FONT_PROBE = () => {
  const el = document.getElementById('__vm_si');
  if (!el) return { ok: false, reason: '#__vm_si not tagged' };
  const cs = getComputedStyle(el);
  const stack = cs.fontFamily;
  const shorthand = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${stack}`;
  const families = stack.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));

  // --- probe 2: document.fonts.check per family + known Sinhala faces
  const probeList = Array.from(new Set([
    ...families,
    'Noto Sans Sinhala', 'Noto Serif Sinhala', 'Nirmala UI', 'Iskoola Pota',
  ]));
  const available = {};
  for (const f of probeList) {
    try { available[f] = document.fonts.check(`${cs.fontSize} "${f}"`); }
    catch (e) { available[f] = `err:${e.message}`; }
  }
  const loadedFaces = [];
  try { document.fonts.forEach((ff) => loadedFaces.push(`${ff.family}|${ff.status}`)); } catch (e) { /* noop */ }

  // --- probe 3: canvas glyph distinctness with the ELEMENT'S resolved stack
  const S = 56;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true });
  function raster(ch) {
    x.clearRect(0, 0, S, S);
    x.font = shorthand;
    x.textBaseline = 'top';
    x.fillStyle = '#000';
    x.fillText(ch, 6, 6);
    const d = x.getImageData(0, 0, S, S).data;
    let ink = 0; let h = 2166136261;
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i] > 12 ? 1 : 0;
      if (a) ink++;
      h ^= a; h = Math.imul(h, 16777619) >>> 0;
    }
    return { ink, h };
  }
  const gA = raster('අ');   // අ  SINHALA LETTER AYANNA
  const gK = raster('ක');   // ක  SINHALA LETTER ALPAPRAANA KAYANNA
  const gJ = raster('ඥ');   // ඥ  SINHALA LETTER TAALUJA SANYOOGA NAAKSIKYAYA
  const gTofuPUA = raster('');  // private use — no font has a glyph
  const gTofuUnassigned = raster('෵'); // unassigned in the Sinhala block

  // --- probe 4: shaping / ZWJ conjunct width
  x.font = shorthand;
  const wZWJ = x.measureText('ප්‍ර').width;   // ප්‍ර (conjunct)
  const wNoZWJ = x.measureText('ප්ර').width;       // ප්ර (no ZWJ)
  const wLatin = x.measureText('Mmmm').width;
  const wSiSentence = x.measureText(el.textContent.trim().slice(0, 30)).width;
  const wTofuRun = x.measureText(''.repeat(30)).width;

  return {
    ok: true,
    stack,
    shorthand,
    fontSize: cs.fontSize,
    available,
    loadedFaces,
    glyphs: {
      a: gA, ka: gK, nya: gJ, tofu_pua: gTofuPUA, tofu_unassigned: gTofuUnassigned,
    },
    widths: {
      zwj_conjunct: +wZWJ.toFixed(2),
      no_zwj: +wNoZWJ.toFixed(2),
      latin_Mmmm: +wLatin.toFixed(2),
      si_30chars: +wSiSentence.toFixed(2),
      tofu_30chars: +wTofuRun.toFixed(2),
    },
  };
};

function verdictFromProbes(probe, platformFonts) {
  const reasons = [];
  if (!probe.ok) return { verdict: 'UNKNOWN', confidence: 'none', reasons: [probe.reason] };
  const g = probe.glyphs;
  const blank = g.a.ink === 0 && g.ka.ink === 0;
  const tofuMatch = g.a.h === g.tofu_pua.h || g.a.h === g.tofu_unassigned.h;
  const identical = g.a.h === g.ka.h;
  const shaped = Math.abs(probe.widths.zwj_conjunct - probe.widths.no_zwj) > 0.5;
  const uniformRun = probe.widths.tofu_30chars > 0 &&
    Math.abs(probe.widths.si_30chars - probe.widths.tofu_30chars) / probe.widths.tofu_30chars < 0.05;

  let verdict;
  if (blank) { verdict = 'BLANK/NOT RENDERED'; reasons.push('canvas raster of අ and ක produced zero ink'); }
  else if (tofuMatch || identical) {
    verdict = 'TOFU/FALLBACK';
    if (tofuMatch) reasons.push('අ rasterises identically to a guaranteed-tofu codepoint');
    if (identical) reasons.push('අ and ක rasterise identically (uniform boxes)');
  } else {
    verdict = 'REAL SINHALA GLYPHS';
    reasons.push(`අ / ක / ඥ rasterise to 3 distinct non-empty bitmaps (ink ${g.a.ink}/${g.ka.ink}/${g.nya.ink})`);
    reasons.push(shaped ? 'ZWJ conjunct ප්‍ර shapes to a different width than ප්ර (GSUB active)'
      : 'NOTE: ZWJ conjunct width matched the non-ZWJ sequence — shaping not confirmed');
    if (uniformRun) reasons.push('WARNING: 30-char Sinhala run measured the same width as 30 tofu boxes');
  }
  if (platformFonts && platformFonts.length) {
    reasons.push(`CDP platform fonts actually used: ${platformFonts.map((f) => `${f.familyName}(${f.glyphCount} glyphs)`).join(', ')}`);
  } else {
    reasons.push('CDP platform-font list unavailable');
  }
  return { verdict, confidence: platformFonts && platformFonts.length ? 'high' : 'medium', reasons, signals: { blank, tofuMatch, identical, shaped, uniformRun } };
}

async function platformFontsFor(context, page, selector) {
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) { await cdp.detach().catch(() => {}); return null; }
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    await cdp.detach().catch(() => {});
    return fonts.map((f) => ({ familyName: f.familyName, glyphCount: f.glyphCount, isCustomFont: f.isCustomFont }));
  } catch (e) {
    return null;
  }
}

// ============================================================================
// G4.5 — one page, one viewport
// ============================================================================
async function vmPage(browser, { key, url, width, height, elementShot }) {
  const id = `G4.5_${key}`;
  const desc = `Vision/Mission section on ${url} @ ${width}x${height}`;
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'en-US' });
  const page = await ctx.newPage();
  const fontReqs = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/fonts\.(googleapis|gstatic)\.com|\.woff2?(\?|$)|\.ttf(\?|$)/i.test(u)) {
      fontReqs.push({ url: u.slice(0, 160), status: r.status() });
    }
  });
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
    const status = resp ? resp.status() : 'no-response';
    await page.waitForTimeout(2500);
    try { await page.evaluate(() => document.fonts.ready); } catch (e) { /* noop */ }
    await page.waitForTimeout(800);

    const tag = await page.evaluate(TAG_VM);
    if (!tag.found) {
      const shot = await ss(page, `${key}_NO_VM_SECTION`);
      fail(id, desc, `HTTP ${status}, final URL ${page.url()} — Vision/Mission section NOT FOUND (${tag.reason}); shot ${shot}`);
      return;
    }

    await page.locator('#__vm_section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    const probe = await page.evaluate(FONT_PROBE);
    const platformFonts = await platformFontsFor(ctx, page, '#__vm_si');
    const v = verdictFromProbes(probe, platformFonts);

    // full page shot (scroll back to top first so the fullPage stitch is clean)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const fullShot = await ss(page, `${key}_full`);
    await page.locator('#__vm_section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    let elShot = null;
    if (elementShot) elShot = await ssEl(page.locator('#__vm_section'), `${key}_vm_element`);

    fontVerdicts.push({
      page: key,
      url,
      final_url: page.url(),
      viewport: `${width}x${height}`,
      http_status: status,
      verdict: v.verdict,
      confidence: v.confidence,
      reasons: v.reasons,
      signals: v.signals,
      declared_font_stack: probe.stack,
      platform_fonts_used: platformFonts,
      fonts_check: probe.available,
      loaded_fontfaces: probe.loadedFaces,
      webfont_requests: fontReqs,
      widths: probe.widths,
      headings: tag.headings,
      si_len: tag.si_len,
      en_len: tag.en_len,
      screenshots: { full: fullShot, element: elShot },
    });

    const contentOk = tag.has_si && tag.has_en && tag.si_len > 100;
    const glyphOk = v.verdict === 'REAL SINHALA GLYPHS';
    const ev = `HTTP ${status}; headings [${tag.headings.join(' | ')}]; si ${tag.si_len} chars, en ${tag.en_len} chars; FONT VERDICT = ${v.verdict}; rendered by ${platformFonts ? platformFonts.map((f) => f.familyName).join('+') : 'unknown'}; shots ${fullShot}${elShot ? ' + ' + elShot : ''}`;
    if (contentOk && glyphOk) pass(id, desc, ev);
    else if (!contentOk) fail(id, desc, `section present but content incomplete — ${ev}`);
    else fail(id, desc, ev);
  } catch (e) {
    blocked(id, desc, `exception: ${String(e.message).slice(0, 200)}`);
  } finally {
    await ctx.close();
  }
}

// ============================================================================
// G4.5-CTRL — what does a visitor WITHOUT "Noto Sans Sinhala" installed see?
//
// This host has NotoSansSinhala-Regular.ttf in the per-user font directory
// (C:\Users\<u>\AppData\Local\Microsoft\Windows\Fonts), which is NOT a Windows
// default. So the umbrella's "real glyphs" result is partly an artifact of THIS
// machine. Fonts cannot be uninstalled from inside Playwright, so instead we
// strip "Noto Sans Sinhala" out of the element's font stack at runtime and ask
// CDP which family Chromium then actually uses. That isolates the question:
// does the page survive on the rest of its declared stack + the browser's
// last-resort per-script fallback, or does it tofu?
// ============================================================================
async function fallbackControl(browser) {
  const id = 'G4.5_CTRL';
  const desc = 'Umbrella Sinhala rendering with "Noto Sans Sinhala" removed from the stack';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await ctx.newPage();
  try {
    await page.goto(`${UMBRELLA}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    const tag = await page.evaluate(TAG_VM);
    if (!tag.found) { blocked(id, desc, 'VM section not found'); return; }

    // Strip the Sinhala family from the stack, keep the rest verbatim.
    const stripped = await page.evaluate(() => {
      const el = document.getElementById('__vm_si');
      const orig = getComputedStyle(el).fontFamily;
      const rest = orig.split(',').map((s) => s.trim())
        .filter((s) => !/noto sans sinhala/i.test(s)).join(', ');
      el.style.fontFamily = rest;
      return { orig, rest };
    });
    await page.waitForTimeout(800);
    const probe = await page.evaluate(FONT_PROBE);
    const platformFonts = await platformFontsFor(ctx, page, '#__vm_si');
    const v = verdictFromProbes(probe, platformFonts);
    await page.locator('#__vm_section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const shot = await ssEl(page.locator('#__vm_section'), 'ctrl_umbrella_no_noto_sinhala');

    fontVerdicts.push({
      page: 'umbrella_CONTROL_no_noto_sinhala',
      url: `${UMBRELLA}/`,
      viewport: '1280x800',
      verdict: v.verdict,
      confidence: v.confidence,
      reasons: v.reasons,
      signals: v.signals,
      declared_font_stack: stripped.orig,
      forced_font_stack: stripped.rest,
      platform_fonts_used: platformFonts,
      screenshots: { element: shot },
      note: 'Control probe: Noto Sans Sinhala removed from the stack at runtime to emulate a visitor without it.',
    });

    const used = platformFonts ? platformFonts.map((f) => f.familyName).join(', ') : 'unknown';
    const ev = `stack forced to "${stripped.rest}"; Chromium fell back to [${used}]; verdict ${v.verdict}; shot ${shot}`;
    if (v.verdict === 'REAL SINHALA GLYPHS') pass(id, desc, `NO TOFU — ${ev}`);
    else fail(id, desc, `TOFU RISK CONFIRMED — ${ev}`);
  } catch (e) {
    blocked(id, desc, `exception: ${String(e.message).slice(0, 200)}`);
  } finally {
    await ctx.close();
  }
}

// ============================================================================
// G1.4 — duplicate registration UI on spices
// ============================================================================
async function openRegisterTab(page) {
  await page.goto(`${SPICES}/en/auth/beta-login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Register")').first().click();
  await page.waitForSelector('form input[type="checkbox"]', { timeout: 20000 });
  await page.waitForTimeout(1000);
}

const telInput = (page) => page.locator('input.PhoneInputInput, .phone-input-wrapper input[type="tel"]').first();

async function fillRegister(page, user) {
  const form = page.locator('form');
  await form.locator('input[type="text"]').nth(0).fill(user.name);
  await form.locator('input[type="text"]').nth(1).fill(user.username);
  await form.locator('input[type="password"]').first().fill(user.password);
  await form.locator('button:has-text("🌾")').first().click(); // farmer
  await page.waitForTimeout(300);
  await form.locator('select').first().selectOption('Anuradhapura');
  await page.locator('button:has-text("English")').first().click();
  await page.waitForTimeout(300);
  await telInput(page).fill(user.phone);
  await page.waitForTimeout(600);
  const box = form.locator('input[type="checkbox"]').first();
  if (!(await box.isChecked())) await box.check();
  await page.waitForTimeout(400);
}

async function waitEnabled(loc, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!(await loc.isDisabled().catch(() => true))) return true;
    await loc.page().waitForTimeout(250);
  }
  return false;
}

async function G14(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });

  // ---- step 1: register a fresh farmer ------------------------------------
  const seedUser = {
    name: 'CV Loop Farmer',
    username: `cvloop${digits(6)}`,
    password: PASSWORD,
    role: 'farmer',
    phone: lkPhone(),
  };
  let seeded = false;
  {
    const page = await ctx.newPage();
    try {
      for (let attempt = 1; attempt <= 3 && !seeded; attempt++) {
        await openRegisterTab(page);
        await fillRegister(page, seedUser);
        const submit = page.locator('form button[type="submit"]').first();
        if (!(await waitEnabled(submit))) {
          blocked('G1.4a', 'Register a fresh farmer through the UI',
            `submit stayed disabled on attempt ${attempt} (phone "${seedUser.phone}")`);
          break;
        }
        await submit.click();
        const landed = await page.waitForURL(/\/farmer\/dashboard/, { timeout: 45000 }).then(() => true).catch(() => false);
        if (landed) {
          seeded = true;
          createdUsers.push({ username: seedUser.username, role: 'farmer', phone: seedUser.phone, purpose: 'G1.4 seed' });
          await page.waitForTimeout(2000);
          const shot = await ss(page, 'g14_seed_dashboard');
          pass('G1.4a', 'Register a fresh farmer through the UI',
            `created ${seedUser.username} / ${seedUser.phone} (farmer), landed on ${page.url()}; shot ${shot}`);
        } else {
          const alert = await page.locator('[role="alert"]').first().innerText().catch(() => '(none)');
          console.log(`  [retry] seed attempt ${attempt} failed: ${alert.trim().slice(0, 140)}`);
          if (attempt === 3) {
            const shot = await ss(page, 'g14_seed_FAILED');
            fail('G1.4a', 'Register a fresh farmer through the UI',
              `3 attempts failed; last alert "${alert.trim().slice(0, 160)}"; shot ${shot}`);
          } else {
            seedUser.username = `cvloop${digits(6)}`;
            seedUser.phone = lkPhone();
          }
        }
      }
    } catch (e) {
      blocked('G1.4a', 'Register a fresh farmer through the UI', `exception: ${String(e.message).slice(0, 200)}`);
    } finally {
      await page.close();
    }
  }
  await ctx.close();

  if (!seeded) {
    blocked('G1.4b', 'Duplicate-phone registration shows a friendly inline error',
      'seed farmer was never created, so no phone exists to duplicate');
    return;
  }

  // ---- step 2: second farmer, DIFFERENT username, SAME phone --------------
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  const page = await ctx2.newPage();
  const apiCalls = [];
  const pageErrors = [];
  page.on('response', (r) => {
    if (/\/api\/.*(register|auth)/i.test(r.url())) apiCalls.push({ url: r.url().slice(0, 120), status: r.status() });
  });
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 160)));

  const dupUser = {
    name: 'CV Loop Dup',
    username: `cvloop${digits(6)}`,
    password: PASSWORD,
    role: 'farmer',
    phone: seedUser.phone,          // SAME phone
  };
  try {
    await openRegisterTab(page);
    await fillRegister(page, dupUser);
    const submit = page.locator('form button[type="submit"]').first();
    if (!(await waitEnabled(submit))) {
      blocked('G1.4b', 'Duplicate-phone registration shows a friendly inline error', 'submit stayed disabled');
      return;
    }
    await submit.click();
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => {
      const tel = document.querySelector('input.PhoneInputInput, input[type="tel"]');
      const alerts = Array.from(document.querySelectorAll('[role="alert"]')).map((a) => {
        const r = a.getBoundingClientRect();
        return {
          text: (a.innerText || '').trim(),
          cls: a.className,
          tag: a.tagName,
          top: Math.round(r.top + window.scrollY),
          isBanner: /bg-red-50|border-red-200/.test(a.className || ''),
        };
      });
      const telBox = tel ? tel.getBoundingClientRect() : null;
      // is any alert a DOM sibling/descendant of the phone field's wrapper?
      let inPhoneWrapper = null;
      if (tel) {
        const wrap = tel.closest('div.flex.flex-col') || tel.parentElement.parentElement;
        const inner = Array.from(wrap.querySelectorAll('[role="alert"]')).map((a) => (a.innerText || '').trim());
        inPhoneWrapper = inner;
      }
      const inputs = Array.from(document.querySelectorAll('form input[type="text"]')).map((i) => i.value);
      const sel = document.querySelector('form select');
      return {
        url: location.href,
        alerts,
        inPhoneWrapper,
        telTop: telBox ? Math.round(telBox.top + window.scrollY) : null,
        telValue: tel ? tel.value : null,
        textInputs: inputs,
        district: sel ? sel.value : null,
        formStillPresent: !!document.querySelector('form'),
        bodyLen: document.body.innerText.length,
      };
    });

    const shot = await ss(page, 'g14_duplicate_phone_error');

    const EXPECTED = 'This phone number is already registered for this role. Log in instead, or use a different number.';
    const inlineTexts = state.inPhoneWrapper || [];
    const hasInline = inlineTexts.some((t) => t.includes('already registered for this role'));
    const exactMatch = inlineTexts.some((t) => t.trim() === EXPECTED);
    const inlineAlert = state.alerts.find((a) => a.text.includes('already registered for this role') && !a.isBanner);
    const proximity = inlineAlert && state.telTop !== null ? inlineAlert.top - state.telTop : null;
    const noCrash = state.formStillPresent && !/\/farmer\/dashboard/.test(state.url) && state.bodyLen > 200;
    const held = {
      name: state.textInputs[0] === dupUser.name,
      username: state.textInputs[1] === dupUser.username,
      district: state.district === 'Anuradhapura',
      phone: (state.telValue || '').replace(/\s/g, '').includes(dupUser.phone.replace('+94', '')),
    };
    const allHeld = held.name && held.username && held.district;
    const status = apiCalls.length ? apiCalls[apiCalls.length - 1].status : 'n/a';

    const problems = [];
    if (!hasInline) problems.push('no inline message inside the phone field wrapper');
    if (!exactMatch && hasInline) problems.push(`inline text is not the exact expected string (got "${inlineTexts.join(' / ').slice(0, 140)}")`);
    if (!noCrash) problems.push(`page crashed or navigated away (url ${state.url}, form present ${state.formStillPresent})`);
    if (!allHeld) problems.push(`form lost typed values: name=${held.name} username=${held.username} district=${held.district}`);
    if (status === 500) problems.push('API returned 500');
    if (pageErrors.length) problems.push(`page JS errors: ${pageErrors.join(' ; ').slice(0, 160)}`);

    const ev = [
      `dup username ${dupUser.username} + SAME phone ${dupUser.phone}`,
      `API ${apiCalls.map((c) => c.status).join(',') || 'n/a'}`,
      `inline alert in phone wrapper: ${hasInline ? `YES ("${inlineTexts.join(' / ').slice(0, 120)}")` : 'NO'}`,
      `exact expected string: ${exactMatch}`,
      proximity !== null ? `inline msg sits ${proximity}px below the phone input` : 'proximity not measurable',
      `top banner present: ${state.alerts.some((a) => a.isBanner)}`,
      `form retained name/username/district: ${held.name}/${held.username}/${held.district}`,
      `phone still ${state.telValue}`,
      `shot ${shot}`,
    ].join('; ');

    if (problems.length === 0) pass('G1.4b', 'Duplicate-phone registration shows a friendly inline error', ev);
    else fail('G1.4b', 'Duplicate-phone registration shows a friendly inline error', `${problems.join(' | ')} — ${ev}`);
  } catch (e) {
    blocked('G1.4b', 'Duplicate-phone registration shows a friendly inline error', `exception: ${String(e.message).slice(0, 200)}`);
  } finally {
    await ctx2.close();
  }
}

// ============================================================================
(async () => {
  const browser = await chromium.launch({ headless: true });
  const t0 = Date.now();
  console.log(`\nGoviHub cleanup-vision E2E — LIVE ${UMBRELLA} + ${SPICES}\nrun id: ${RUN}\n`);

  const only = (process.env.ONLY || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const run = (name) => only.length === 0 || only.includes(name);

  if (run('g45')) {
    console.log('G4.5 — Vision & Mission screenshots + font verdicts');
    const pages = [
      { key: 'umbrella_root_desktop', url: `${UMBRELLA}/`, width: 1280, height: 800, elementShot: true },
      { key: 'umbrella_root_mobile', url: `${UMBRELLA}/`, width: 360, height: 640, elementShot: false },
      { key: 'umbrella_si_desktop', url: `${UMBRELLA}/si`, width: 1280, height: 800, elementShot: true },
      { key: 'umbrella_si_mobile', url: `${UMBRELLA}/si`, width: 360, height: 640, elementShot: false },
      { key: 'spices_en_390', url: `${SPICES}/en`, width: 390, height: 844, elementShot: true },
      { key: 'spices_si_390', url: `${SPICES}/si`, width: 390, height: 844, elementShot: true },
    ];
    for (const p of pages) { console.log(`  -> ${p.key}`); await vmPage(browser, p); }
  }

  if (run('ctrl')) {
    console.log('\nG4.5-CTRL — umbrella with Noto Sans Sinhala stripped from the stack');
    await fallbackControl(browser);
  }

  if (run('g14')) {
    console.log('\nG1.4 — duplicate registration UI');
    await G14(browser);
  }

  await browser.close();

  const summary = {
    targets: { umbrella: UMBRELLA, spices: SPICES },
    run: RUN,
    started: new Date(t0).toISOString(),
    duration_s: Math.round((Date.now() - t0) / 1000),
    host_caveat:
      'Probes ran in headless Chromium on a Windows 11 host. Windows ships Nirmala UI, which covers Sinhala, so a "real glyphs" verdict here reflects THIS machine\'s font set. The transferable finding is the platform_fonts_used field: which family actually rasterised the text.',
    font_verdicts: fontVerdicts,
    created_users: createdUsers,
    results,
  };
  const outFile = path.join(OUT, `cleanup-vision-${RUN}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  console.log('\n================ SUMMARY ================');
  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(22)} ${r.desc}`);
  console.log('\n---------------- FONT VERDICTS ----------------');
  for (const f of fontVerdicts) {
    console.log(`${f.page.padEnd(24)} ${f.verdict.padEnd(22)} rendered by: ${f.platform_fonts_used ? f.platform_fonts_used.map((x) => `${x.familyName}(${x.glyphCount})`).join(', ') : 'unknown'}`);
  }
  console.log(`\ncreated users: ${createdUsers.map((u) => `${u.username}(${u.role},${u.phone})`).join(', ') || '(none)'}`);
  console.log(`results: ${outFile}`);
  console.log(`screenshots: ${SS_DIR}`);
})();
