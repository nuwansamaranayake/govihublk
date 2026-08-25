// Diagnostic: why does /ta registration not submit? Capture the API call and the
// on-screen error rather than guessing at the phone format.
const { chromium } = require('playwright');
const BASE = process.env.TAMIL_BASE || 'http://localhost:6001';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const calls = [];
  page.on('response', async r => {
    if (r.url().includes('/auth/beta/register')) {
      let body = '';
      try { body = (await r.text()).slice(0, 300); } catch (e) {}
      calls.push({ status: r.status(), body });
    }
  });

  const stamp = Date.now().toString().slice(-8);
  await page.goto(`${BASE}/ta/auth/beta-login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'பதிவுசெய்' }).first().click();
  await page.waitForTimeout(800);

  const inputs = page.locator('input');
  await inputs.nth(0).fill('தமிழ் சோதனை');
  await inputs.nth(1).fill(`ta_diag_${stamp}`);
  await inputs.nth(2).fill('TaGate#2026x');
  await page.getByRole('button', { name: /விவசாயி/ }).first().click();
  await page.locator('select').nth(0).selectOption({ index: 2 });

  const tel = page.locator('input[type="tel"]').first();
  await tel.fill(process.env.PHONE || '0771234567');
  await page.locator('input[type="checkbox"]').first().check();

  console.log('tel value before submit:', await tel.inputValue());

  await page.getByRole('button', { name: 'கணக்கை உருவாக்கவும்' }).first().click();
  await page.waitForTimeout(5000);

  console.log('url after submit :', page.url().replace(BASE, ''));
  console.log('register calls   :', JSON.stringify(calls));

  // any visible error text
  const err = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[role="alert"], .text-red-600, .text-red-500, .text-error, [class*="error"]')
      .forEach(el => { const t = (el.innerText || '').trim(); if (t) out.push(t.slice(0, 160)); });
    return out;
  });
  console.log('visible errors   :', JSON.stringify(err, null, 1));

  // is the button disabled / is anything required unfilled?
  const state = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.type === 'submit' && x.innerText.includes('கணக்'));
    const inv = Array.from(document.querySelectorAll('input,select')).filter(e => !e.checkValidity())
      .map(e => ({ type: e.type || e.tagName, msg: e.validationMessage }));
    return { submitDisabled: b ? b.disabled : null, invalid: inv };
  });
  console.log('form state       :', JSON.stringify(state));

  await browser.close();
})().catch(e => { console.error('DIAG FAILED:', e.message); process.exit(1); });
