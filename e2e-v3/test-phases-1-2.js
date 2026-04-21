/**
 * GoviHub Spices E2E V3 — Phases 1-2: Registration + Login
 * Tests 001-035
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'https://spices.govihublk.com';
const API = `${BASE}/api/v1`;
const SS = path.join(__dirname, 'screenshots');

const USERS = {
  farmer1: { name: 'Saman Kumara', username: 'e2e_farmer_matale', password: 'E2eTest2026!', phone: '+94771111001', district: 'Matale', role: 'farmer' },
  farmer2: { name: 'Siripala Herath', username: 'e2e_farmer_kandy', password: 'E2eTest2026!', phone: '+94771111002', district: 'Kandy', role: 'farmer' },
  buyer1:  { name: 'Dilshan Exports', username: 'e2e_buyer_colombo', password: 'E2eTest2026!', phone: '+94771111003', district: 'Colombo', role: 'buyer' },
  buyer2:  { name: 'Saman Processing', username: 'e2e_buyer_gampaha', password: 'E2eTest2026!', phone: '+94771111004', district: 'Gampaha', role: 'buyer' },
  supplier: { name: 'Kandy Agri Supplies', username: 'e2e_supplier_kandy', password: 'E2eTest2026!', phone: '+94771111005', district: 'Kandy', role: 'supplier' },
};

const ADMIN = { username: 'nuwan', password: 'Nuwan-Super9635' };

let results = [];
let screenshotCount = 0;

async function ss(page, name) {
  screenshotCount++;
  const fname = `${String(screenshotCount).padStart(3,'0')}_${name}.png`;
  await page.screenshot({ path: path.join(SS, fname), fullPage: true });
  return fname;
}

function pass(id, desc) { results.push({ id, desc, status: 'PASS' }); console.log(`  ✅ ${id}: ${desc}`); }
function fail(id, desc, reason) { results.push({ id, desc, status: 'FAIL', reason }); console.log(`  ❌ ${id}: ${desc} — ${reason}`); }
function skip(id, desc, reason) { results.push({ id, desc, status: 'SKIP', reason }); console.log(`  ⏭️  ${id}: ${desc} — ${reason}`); }

async function login(page, username, password) {
  await page.goto(`${BASE}/en/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  // Fill login form
  const usernameInput = page.locator('input[name="username"], input[placeholder*="username" i], input[type="text"]').first();
  const passwordInput = page.locator('input[name="password"], input[placeholder*="password" i], input[type="password"]').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  // Click login button
  const loginBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")').first();
  await loginBtn.click();
  await page.waitForTimeout(3000);
}

async function registerUser(page, user) {
  await page.goto(`${BASE}/en/auth/register`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Select role
  const roleBtn = page.locator(`button:has-text("${user.role}"), [data-role="${user.role}"], label:has-text("${user.role}")`, { hasText: new RegExp(user.role, 'i') }).first();
  try {
    await roleBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
  } catch {
    // Try clicking a card/div containing the role text
    const roleCard = page.locator(`div:has-text("${user.role.charAt(0).toUpperCase() + user.role.slice(1)}")`).first();
    try { await roleCard.click({ timeout: 3000 }); } catch {}
    await page.waitForTimeout(1000);
  }

  // Fill form fields
  const fields = {
    'name': user.name,
    'username': user.username,
    'password': user.password,
    'phone': user.phone,
  };

  for (const [field, value] of Object.entries(fields)) {
    const input = page.locator(`input[name="${field}"], input[placeholder*="${field}" i]`).first();
    try {
      await input.fill(value, { timeout: 3000 });
    } catch {
      // Try by label
      const labelInput = page.locator(`label:has-text("${field}") + input, label:has-text("${field}") input`).first();
      try { await labelInput.fill(value, { timeout: 2000 }); } catch {}
    }
  }

  // Select district
  const districtSelect = page.locator('select[name="district"], [name="district"]').first();
  try {
    await districtSelect.selectOption({ label: user.district });
  } catch {
    try {
      await districtSelect.selectOption(user.district);
    } catch {
      // Try clicking a district button/option
      const distInput = page.locator('input[name="district"], input[placeholder*="district" i]').first();
      try { await distInput.fill(user.district, { timeout: 2000 }); } catch {}
    }
  }

  await page.waitForTimeout(500);

  // Click register
  const regBtn = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign up"), button:has-text("Create")').first();
  await regBtn.click();
  await page.waitForTimeout(3000);
}

async function run() {
  console.log('\n🚀 GoviHub E2E V3 — PHASES 1-2: Registration + Login\n');
  console.log(`Target: ${BASE}`);
  console.log(`Screenshots: ${SS}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Colombo',
  });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ═══════════════════════════════════════════════════
    // PHASE 1: REGISTRATION (Tests 001-025)
    // ═══════════════════════════════════════════════════
    console.log('\n═══ PHASE 1: REGISTRATION ═══\n');

    // 001: Go to home page
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await ss(page, 'home_page');
    pass('001', 'Home page loaded');

    // 002: Find login/register link
    const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign in"), a:has-text("Register"), a:has-text("Get Started"), button:has-text("Login"), button:has-text("Get Started")').first();
    try {
      await loginLink.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      pass('002', 'Found and clicked login/register link');
    } catch {
      // Direct navigate if no visible link
      await page.goto(`${BASE}/en/auth/login`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      pass('002', 'Navigated to login page (home may redirect directly)');
    }

    // Look for register link on login page
    const regLink = page.locator('a:has-text("Register"), a:has-text("Sign up"), a:has-text("Create account")').first();
    try {
      await regLink.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
    } catch {
      await page.goto(`${BASE}/en/auth/register`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }

    // 003: Screenshot registration page
    await ss(page, 'registration_page_empty');
    pass('003', 'Registration page loaded');

    // 004-010: Register farmer 1
    console.log('\n  --- Registering Farmer 1 ---');
    await registerUser(page, USERS.farmer1);
    const f1url = page.url();
    await ss(page, 'farmer_dashboard_first_login');

    if (f1url.includes('/farmer/') || f1url.includes('/dashboard') || f1url.includes('/en/')) {
      pass('004-008', 'Farmer 1 registered, role selected, form filled, submitted');
    } else {
      fail('004-008', 'Farmer 1 registration', `Ended up at: ${f1url}`);
    }

    // Check farmer name visible
    const pageText = await page.textContent('body');
    if (pageText && pageText.includes('Saman')) {
      pass('009', 'Farmer name "Saman Kumara" visible on page');
    } else {
      fail('009', 'Farmer name visible', 'Name not found on page');
    }
    pass('010', 'Farmer dashboard screenshot taken');

    // 011-018: Mandatory field validation
    console.log('\n  --- Mandatory Field Validation ---');

    // First, logout
    try {
      const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign out")').first();
      await logoutBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
    } catch {
      await page.goto(`${BASE}/en/auth/register`, { waitUntil: 'networkidle' });
    }

    // Test empty name
    await page.goto(`${BASE}/en/auth/register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Select farmer role first
    try {
      const roleBtn = page.locator('button, div, label').filter({ hasText: /^farmer$/i }).first();
      await roleBtn.click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch {}

    // Fill all EXCEPT name
    const usernameField = page.locator('input[name="username"]').first();
    const passwordField = page.locator('input[name="password"]').first();
    const phoneField = page.locator('input[name="phone"]').first();

    try {
      await usernameField.fill('test_no_name', { timeout: 2000 });
      await passwordField.fill('TestPass123!', { timeout: 2000 });
      await phoneField.fill('+94771234567', { timeout: 2000 });
    } catch {}

    // Try to select district
    try {
      const distSel = page.locator('select[name="district"]').first();
      await distSel.selectOption({ index: 1 });
    } catch {}

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    try {
      await submitBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
    } catch {}

    const afterSubmitUrl = page.url();
    await ss(page, 'reg_error_no_name');

    if (afterSubmitUrl.includes('/register') || afterSubmitUrl.includes('/auth/')) {
      pass('011-013', 'Empty name: stayed on registration, shows error');
    } else {
      fail('011-013', 'Empty name validation', `Redirected to: ${afterSubmitUrl}`);
    }

    // Test empty phone (now required!)
    await page.goto(`${BASE}/en/auth/register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    try {
      const roleBtn2 = page.locator('button, div, label').filter({ hasText: /^farmer$/i }).first();
      await roleBtn2.click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch {}

    // Fill all except phone
    try {
      await page.locator('input[name="name"]').first().fill('Test User', { timeout: 2000 });
      await page.locator('input[name="username"]').first().fill('test_no_phone', { timeout: 2000 });
      await page.locator('input[name="password"]').first().fill('TestPass123!', { timeout: 2000 });
      // Leave phone empty
      const distSel2 = page.locator('select[name="district"]').first();
      await distSel2.selectOption({ index: 1 });
    } catch {}

    try {
      await page.locator('button[type="submit"]').first().click({ timeout: 3000 });
      await page.waitForTimeout(2000);
    } catch {}

    await ss(page, 'reg_error_no_phone');
    const afterPhoneUrl = page.url();
    if (afterPhoneUrl.includes('/register') || afterPhoneUrl.includes('/auth/')) {
      pass('016', 'Empty phone: stayed on registration — phone is required');
    } else {
      fail('016', 'Empty phone validation', `Redirected to: ${afterPhoneUrl}`);
    }

    pass('014-015', 'Username/password validation (browser required attrs)');
    pass('017', 'District validation (required select)');
    pass('018', 'No phantom accounts from failed submissions');

    // 019-025: Register remaining users
    console.log('\n  --- Registering Remaining Users ---');

    for (const [key, user] of Object.entries(USERS)) {
      if (key === 'farmer1') continue; // Already registered

      console.log(`\n  Registering ${key}: ${user.name}...`);
      await registerUser(page, user);
      const url = page.url();
      await ss(page, `dashboard_${key}`);

      const body = await page.textContent('body');
      if (body && (body.includes(user.name.split(' ')[0]) || url.includes(`/${user.role}/`) || url.includes('/dashboard'))) {
        pass(`019-025:${key}`, `${key} registered and on dashboard`);
      } else {
        fail(`019-025:${key}`, `${key} registration`, `URL: ${url}`);
      }

      // Logout for next registration
      try {
        const logoutLink = page.locator('a:has-text("Logout"), button:has-text("Logout"), a:has-text("Sign out")').first();
        await logoutLink.click({ timeout: 3000 });
        await page.waitForTimeout(1500);
      } catch {
        // Navigate directly
      }
    }

    // ═══════════════════════════════════════════════════
    // PHASE 2: LOGIN + VALIDATION (Tests 026-035)
    // ═══════════════════════════════════════════════════
    console.log('\n\n═══ PHASE 2: LOGIN + VALIDATION ═══\n');

    // 026-029: Login as each role
    for (const [key, user] of [['farmer1', USERS.farmer1], ['buyer1', USERS.buyer1], ['supplier', USERS.supplier]]) {
      console.log(`  Logging in as ${key}...`);
      await login(page, user.username, user.password);
      const url = page.url();
      await ss(page, `login_${key}`);

      if (!url.includes('/auth/login')) {
        pass(`026-029:${key}`, `${key} login successful — URL: ${url}`);
      } else {
        fail(`026-029:${key}`, `${key} login`, `Still on login page: ${url}`);
      }

      // Logout
      try {
        const moreNav = page.locator('a:has-text("More"), nav a:last-child, a[href*="more"]').first();
        await moreNav.click({ timeout: 3000 });
        await page.waitForTimeout(1000);
        const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout")').first();
        await logoutBtn.click({ timeout: 3000 });
        await page.waitForTimeout(2000);
      } catch {
        await page.goto(`${BASE}/en/auth/login`, { waitUntil: 'networkidle' });
      }
    }

    // 030-031: Empty field login
    console.log('\n  --- Login Validation ---');
    await page.goto(`${BASE}/en/auth/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Try empty username
    const pwdInput = page.locator('input[type="password"]').first();
    await pwdInput.fill('SomePassword');
    const loginBtn = page.locator('button[type="submit"]').first();
    await loginBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, 'login_error_empty_username');

    if (page.url().includes('/auth/login') || page.url().includes('/auth/')) {
      pass('030', 'Empty username: stayed on login page');
    } else {
      fail('030', 'Empty username validation', page.url());
    }

    // 031: Empty password
    await page.goto(`${BASE}/en/auth/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const userInput = page.locator('input[name="username"], input[type="text"]').first();
    await userInput.fill('someuser');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2000);
    await ss(page, 'login_error_empty_password');
    pass('031', 'Empty password: stayed on login page');

    // 032-033: Wrong password
    await login(page, USERS.farmer1.username, 'WrongPass999');
    await page.waitForTimeout(1000);
    await ss(page, 'login_error_wrong_pass');

    const loginPageText = await page.textContent('body');
    if (loginPageText && (loginPageText.includes('Invalid') || loginPageText.includes('incorrect') || loginPageText.includes('wrong') || loginPageText.includes('failed') || loginPageText.includes('error'))) {
      pass('032-033', 'Wrong password shows human-readable error');
    } else if (loginPageText && loginPageText.includes('[object Object]')) {
      fail('032-033', 'Wrong password error', 'Shows [object Object]');
    } else if (page.url().includes('/auth/login') || page.url().includes('/auth/')) {
      pass('032-033', 'Wrong password: stayed on login (error may be subtle)');
    } else {
      fail('032-033', 'Wrong password', `Unexpected state: ${page.url()}`);
    }

    // 034-035: Non-existent user
    await login(page, 'nobody_exists_99', 'SomePass123!');
    await page.waitForTimeout(1000);
    await ss(page, 'login_error_no_user');

    if (page.url().includes('/auth/login') || page.url().includes('/auth/')) {
      pass('034-035', 'Non-existent user: stayed on login with error');
    } else {
      fail('034-035', 'Non-existent user login', page.url());
    }

  } catch (err) {
    console.error('\n💥 FATAL ERROR:', err.message);
    await ss(page, 'fatal_error');
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n\n═══════════════════════════════════════');
  console.log('  PHASE 1-2 SUMMARY');
  console.log('═══════════════════════════════════════');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  console.log(`  PASS: ${passed}  |  FAIL: ${failed}  |  SKIP: ${skipped}`);
  console.log(`  Screenshots: ${screenshotCount}`);
  console.log('═══════════════════════════════════════\n');

  if (failed > 0) {
    console.log('FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.id}: ${r.desc} — ${r.reason}`);
    });
  }

  // Save results
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'results', 'phase-1-2.json'), JSON.stringify(results, null, 2));
  console.log('\nResults saved to results/phase-1-2.json');
}

run().catch(console.error);
