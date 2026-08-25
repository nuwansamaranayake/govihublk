/**
 * P5 gates GP.1-GP.8 plus GT.6 for the Tamil app UI.
 *
 * UI navigation only - no API shortcuts, because the point is to prove a Tamil
 * speaker can actually get through the app, not that the endpoints work.
 *
 *   TAMIL_BASE=http://localhost:6001 node tamil-gates.js
 *   TAMIL_BASE=https://spices.govihublk.com node tamil-gates.js
 *
 * Creates one throwaway farmer per run. The username and phone are printed at the
 * end so P6 cleanup can remove exactly what this made and nothing else.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.TAMIL_BASE || 'http://localhost:6001';
const LABEL = process.env.TAMIL_LABEL || (BASE.includes('localhost') ? 'local' : 'prod');
const SHOTS = path.join(__dirname, '..', 'screenshots', 'tamil', LABEL);
const RESULTS = path.join(__dirname, '..', `tamil_gate_results_${LABEL}.json`);

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

// Words that must NOT appear in rendered Tamil screens. Brand names, language
// switcher labels and district names are excluded on purpose: districts are
// hardcoded English by design (documented P1 finding), not a translation miss.
const LEAK_WORDS = ['Submit', 'Login', 'Log in', 'Password', 'Weather', 'Price',
  'Settings', 'Dashboard', 'Search', 'Cancel', 'Save', 'Logout', 'Register',
  'Continue', 'Loading'];
const LEAK_EXCLUDE = /GoviHub|AiGNITE|WhatsApp|SMS|LKR|Rs\.?|kg|English|සිංහල|Ampara|Anuradhapura|Badulla|Batticaloa|Colombo|Galle|Gampaha|Hambantota|Jaffna|Kalutara|Kandy|Kegalle|Kilinochchi|Kurunegala|Mannar|Matale|Matara|Monaragala|Mullaitivu|Nuwara|Polonnaruwa|Puttalam|Ratnapura|Trincomalee|Vavuniya/gi;

const TAMIL_RE = /[஀-௿]/;

const results = [];
const shots = [];
let created = null;

function rec(gate, viewport, pass, detail) {
  results.push({ gate, viewport, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${gate.padEnd(6)} ${String(viewport).padEnd(8)} ${detail}`);
}

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  shots.push(p);
  return p;
}

async function noOverflow(page) {
  return page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1);
}

async function visibleText(page) {
  return page.evaluate(() => document.body.innerText || '');
}

function leaks(text) {
  const cleaned = text.replace(LEAK_EXCLUDE, ' ');
  return LEAK_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(cleaned));
}

async function run(vp) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const apiCalls = [];
  page.on('response', async r => {
    if (r.url().includes('/auth/beta/register')) {
      let b = ''; try { b = (await r.text()).slice(0, 200); } catch (e) {}
      apiCalls.push(`${r.status()} ${b}`);
    }
  });

  const stamp = Date.now().toString().slice(-8);
  // username ceiling is 20 chars (API returns 422 TOO_LONG). tgate_ + m/d + 8 digits = 15,
  // and the tgate_ prefix is what P6 cleanup targets so it removes exactly these rows.
  const user = { name: 'தமிழ் சோதனை', username: `tgate_${vp.name[0]}${stamp}`,
                 password: 'TaGate#2026x',
                 // 9 digits starting 7. NO leading zero: the country picker already
                 // supplies +94, so "07..." would submit as "+94 077 ..." and be malformed.
                 phone: `7${String(Date.now()).slice(-8)}` };

  try {
    // ---------- GT.6 font ----------
    await page.goto(`${BASE}/ta`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const fontOK = await page.evaluate(async () => {
      try { await document.fonts.ready; } catch (e) {}
      return document.fonts.check('16px "Noto Sans Tamil"');
    });
    rec('GT.6', vp.name, fontOK, `document.fonts.check('16px "Noto Sans Tamil"') = ${fontOK}`);
    await shot(page, `${vp.name}-01-landing`);
    rec('GP.6', vp.name, await noOverflow(page), 'landing: no horizontal overflow');

    // ---------- GP.1 registration end to end ----------
    await page.goto(`${BASE}/ta/auth/beta-login`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'பதிவுசெய்' }).first().click();
    await page.waitForTimeout(800);
    await shot(page, `${vp.name}-02-register-form`);

    const inputs = page.locator('input');
    await inputs.nth(0).fill(user.name);
    await inputs.nth(1).fill(user.username);
    await inputs.nth(2).fill(user.password);

    // role: farmer
    await page.getByRole('button', { name: /விவசாயி/ }).first().click();

    // country picker present and pinned to LK
    const selects = page.locator('select');
    const countryFirst = await selects.nth(1).evaluate(el => el.options[0] && el.options[0].value);
    rec('GP.1a', vp.name, countryFirst === 'LK', `country picker present, first option = ${countryFirst}`);

    // district
    await selects.nth(0).selectOption({ index: 2 });

    // phone
    await page.locator('input[type="tel"]').first().fill(user.phone);

    // ToU click-wrap
    const cb = page.locator('input[type="checkbox"]').first();
    await cb.check();
    const touChecked = await cb.isChecked();
    rec('GP.1b', vp.name, touChecked, 'ToU click-wrap checked');

    const formText = await visibleText(page);
    rec('GP.1c', vp.name, TAMIL_RE.test(formText), 'registration form renders Tamil');
    rec('GP.6', vp.name, await noOverflow(page), 'register form: no horizontal overflow');

    await page.getByRole('button', { name: 'கணக்கை உருவாக்கவும்' }).first().click();
    await page.waitForTimeout(4000);

    const afterUrl = page.url();
    const landed = !/beta-login/.test(afterUrl);
    rec('GP.1', vp.name, landed,
        `phone=${user.phone} submit -> ${afterUrl.replace(BASE, '')}` +
        (landed ? '' : `  api=[${apiCalls.join(' | ')}]`));
    if (landed && !created) created = user;
    await shot(page, `${vp.name}-03-after-register`);

    const dashText = await visibleText(page);
    rec('GP.3a', vp.name, TAMIL_RE.test(dashText), 'dashboard renders Tamil');
    rec('GP.6', vp.name, await noOverflow(page), 'dashboard: no horizontal overflow');
    const dashLeaks = leaks(dashText);
    rec('GP.7a', vp.name, dashLeaks.length === 0, `dashboard English leak: ${dashLeaks.join(',') || 'none'}`);

    // ---------- GP.2 duplicate phone ----------
    const ctx2 = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p2 = await ctx2.newPage();
    p2.setDefaultTimeout(30000);
    await p2.goto(`${BASE}/ta/auth/beta-login`, { waitUntil: 'networkidle' });
    await p2.getByRole('button', { name: 'பதிவுசெய்' }).first().click();
    await p2.waitForTimeout(800);
    const i2 = p2.locator('input');
    await i2.nth(0).fill(user.name);
    await i2.nth(1).fill(user.username + '_dup');
    await i2.nth(2).fill(user.password);
    await p2.getByRole('button', { name: /விவசாயி/ }).first().click();
    await p2.locator('select').nth(0).selectOption({ index: 2 });
    await p2.locator('input[type="tel"]').first().fill(user.phone);   // same phone
    await p2.locator('input[type="checkbox"]').first().check();
    await p2.getByRole('button', { name: 'கணக்கை உருவாக்கவும்' }).first().click();
    await p2.waitForTimeout(3500);
    const dupText = await visibleText(p2);
    const stillOnForm = /beta-login/.test(p2.url());
    // Require the actual duplicate message, not just the phone field label:
    // ஏற்கனவே = "already", which only appears in auth.phone_already_registered.
    const dupTamil = /தொலைபேசி/.test(dupText) && /ஏற்கனவே/.test(dupText);
    rec('GP.2', vp.name, stillOnForm && dupTamil,
        `blocked=${stillOnForm}, Tamil duplicate-phone message shown=${dupTamil}`);
    await shot(p2, `${vp.name}-04-duplicate-phone`);
    await ctx2.close();

    // ---------- GP.3 weather + diagnosis ----------
    for (const [slug, gate] of [['weather', 'GP.3b'], ['diagnosis', 'GP.3c']]) {
      const candidates = [`${BASE}/ta/farmer/${slug}`, `${BASE}/ta/${slug}`];
      let ok = false, used = '', txt = '';
      for (const u of candidates) {
        const r = await page.goto(u, { waitUntil: 'networkidle' }).catch(() => null);
        if (r && r.status() === 200) {
          await page.waitForTimeout(1200);
          txt = await visibleText(page);
          if (TAMIL_RE.test(txt)) { ok = true; used = u.replace(BASE, ''); break; }
        }
      }
      rec(gate, vp.name, ok, `${slug}: ${ok ? `Tamil at ${used}` : 'no Tamil page found'}`);
      if (ok) {
        await shot(page, `${vp.name}-05-${slug}`);
        rec('GP.6', vp.name, await noOverflow(page), `${slug}: no horizontal overflow`);
        const l = leaks(txt);
        rec('GP.7b', vp.name, l.length === 0, `${slug} English leak: ${l.join(',') || 'none'}`);
      }
    }

    // ---------- GP.4 marketplace ----------
    let mkOK = false, mkUsed = '', mkTxt = '';
    for (const u of [`${BASE}/ta/farmer/marketplace`, `${BASE}/ta/buyer/marketplace`,
                     `${BASE}/ta/marketplace`, `${BASE}/ta/supplier/marketplace`]) {
      const r = await page.goto(u, { waitUntil: 'networkidle' }).catch(() => null);
      if (r && r.status() === 200) {
        await page.waitForTimeout(1500);
        mkTxt = await visibleText(page);
        if (TAMIL_RE.test(mkTxt)) { mkOK = true; mkUsed = u.replace(BASE, ''); break; }
      }
    }
    rec('GP.4', vp.name, mkOK, `marketplace: ${mkOK ? `Tamil at ${mkUsed}` : 'no Tamil page found'}`);
    if (mkOK) {
      await shot(page, `${vp.name}-06-marketplace`);
      rec('GP.6', vp.name, await noOverflow(page), 'marketplace: no horizontal overflow');
      const l = leaks(mkTxt);
      rec('GP.7c', vp.name, l.length === 0, `marketplace English leak: ${l.join(',') || 'none'}`);
      // open a detail if any card links out
      const link = page.locator('a[href*="/ta/"]').filter({ hasNotText: 'GoviHub' }).nth(2);
      if (await link.count()) {
        await link.click().catch(() => {});
        await page.waitForTimeout(2000);
        const dTxt = await visibleText(page);
        rec('GP.4b', vp.name, TAMIL_RE.test(dTxt), `detail view Tamil at ${page.url().replace(BASE, '')}`);
        await shot(page, `${vp.name}-07-marketplace-detail`);
      }
    }

    // ---------- GP.5 language round-trip on SETTINGS ----------
    // Settings persists language server-side via <input type="radio" name="language">,
    // so this is the real round-trip: choose, save, reload, still chosen.
    let rtOK = true; const rtDetail = [];
    const setUrl = `${BASE}/ta/farmer/settings`;
    const setResp = await page.goto(setUrl, { waitUntil: 'networkidle' }).catch(() => null);
    if (!setResp || setResp.status() !== 200) {
      rtOK = false; rtDetail.push('settings-unreachable');
    } else {
      await page.waitForTimeout(1500);
      rec('GP.5a', vp.name, TAMIL_RE.test(await visibleText(page)), 'settings page renders Tamil');
      rec('GP.6', vp.name, await noOverflow(page), 'settings: no horizontal overflow');

      for (const code of ['si', 'en', 'ta']) {
        const radio = page.locator(`input[name="language"][value="${code}"]`).first();
        if (!(await radio.count())) { rtOK = false; rtDetail.push(`${code}:no-radio`); continue; }
        await radio.check({ force: true });
        // save, whatever the button is called in this locale
        const save = page.locator('button[type="submit"]').first();
        if (await save.count()) { await save.click().catch(() => {}); await page.waitForTimeout(2500); }
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        const still = await page.locator(`input[name="language"][value="${code}"]`).first()
                                .isChecked().catch(() => false);
        if (!still) rtOK = false;
        rtDetail.push(`${code}:persisted=${still}`);
      }
    }
    rec('GP.5', vp.name, rtOK, `settings language ta->si->en->ta survives reload  [${rtDetail.join(' ')}]`);
    await shot(page, `${vp.name}-08-settings-language`);

  } catch (e) {
    rec('ERROR', vp.name, false, e.message.slice(0, 160));
  } finally {
    await browser.close();
  }
}

(async () => {
  console.log(`Tamil P5 gates against ${BASE}  (label: ${LABEL})\n`);
  for (const vp of VIEWPORTS) {
    console.log(`-- ${vp.name} ${vp.width}x${vp.height} --`);
    await run(vp);
    console.log('');
  }

  rec('GP.8', 'both', shots.length > 0, `${shots.length} screenshots saved under screenshots/tamil/${LABEL}/`);

  const byGate = {};
  for (const r of results) {
    const g = r.gate.replace(/[a-c]$/, '');
    byGate[g] = byGate[g] === false ? false : (byGate[g] === undefined ? r.pass : byGate[g] && r.pass);
  }
  const failed = Object.entries(byGate).filter(([, v]) => !v).map(([k]) => k);

  fs.writeFileSync(RESULTS, JSON.stringify(
    { base: BASE, label: LABEL, when: new Date().toISOString(), created,
      byGate, results, screenshots: shots }, null, 1));

  console.log('='.repeat(56));
  console.log('gate rollup:', JSON.stringify(byGate));
  console.log(`checks: ${results.filter(r => r.pass).length}/${results.length} passed`);
  if (created) console.log(`created test user: ${created.username} / phone ${created.phone}`);
  console.log(`results: ${RESULTS}`);
  console.log(failed.length ? `FAILED GATES: ${failed.join(', ')}` : 'ALL P5 GATES PASS');
  process.exit(failed.length ? 1 : 0);
})();
