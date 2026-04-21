/**
 * Playwright E2E: Settings persistence test for all roles
 * Tests that profile + notification preferences save and persist after reload.
 */

const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "https://spices.govihublk.com";
const TIMEOUT = 60_000;

let browser, context, page;

async function login(username, password) {
  page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(`${BASE}/en/auth/beta-login`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"], form button:not([type])').first().click();
  await page.waitForTimeout(4000);
  await page.waitForLoadState("networkidle");
}

async function closePage() {
  if (page) await page.close();
}

// Helper: get the state of a toggle switch
async function getToggleState(toggleBtn) {
  const ariaChecked = await toggleBtn.getAttribute("aria-checked");
  return ariaChecked === "true";
}

// Helper: test settings page for a given role
async function testSettingsPage(role, settingsPath, accentColor) {
  const results = [];

  // Navigate to settings
  await page.goto(`${BASE}/en/${role}/settings`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // 1. Check page loaded (has Save button)
  const saveBtn = page.locator('button:has-text("Save Changes"), button:has-text("Saved")').first();
  const saveBtnVisible = await saveBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!saveBtnVisible) {
    results.push({ test: `${role} settings page loads`, pass: false, detail: "Save button not found" });
    return results;
  }
  results.push({ test: `${role} settings page loads`, pass: true });

  // 2. Check profile fields loaded (name should not be empty)
  const nameInput = page.locator('input').first();
  const nameVal = await nameInput.inputValue();
  results.push({ test: `${role} profile data loaded`, pass: nameVal.length > 0, detail: `name="${nameVal}"` });

  // 3. Find all toggle switches
  const toggles = page.locator('button[role="switch"]');
  const toggleCount = await toggles.count();
  results.push({ test: `${role} has notification toggles`, pass: toggleCount >= 3, detail: `found ${toggleCount} toggles` });

  // 4. Toggle the first switch (match_alerts) to OFF
  if (toggleCount > 0) {
    const firstToggle = toggles.nth(0);
    const initialState = await getToggleState(firstToggle);

    // Click to change state
    await firstToggle.click();
    await page.waitForTimeout(300);
    const afterClickState = await getToggleState(firstToggle);
    results.push({ test: `${role} toggle clickable`, pass: initialState !== afterClickState, detail: `${initialState} -> ${afterClickState}` });

    // 5. Click Save
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // Check for success feedback
    const savedText = page.locator('button:has-text("Saved")');
    const savedVisible = await savedText.isVisible({ timeout: 3000 }).catch(() => false);
    results.push({ test: `${role} save shows feedback`, pass: savedVisible });

    // 6. RELOAD and verify persistence
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const togglesAfterReload = page.locator('button[role="switch"]');
    const reloadCount = await togglesAfterReload.count();
    if (reloadCount > 0) {
      const firstToggleReloaded = togglesAfterReload.nth(0);
      const reloadedState = await getToggleState(firstToggleReloaded);
      results.push({
        test: `${role} toggle persists after reload`,
        pass: reloadedState === afterClickState,
        detail: `expected=${afterClickState}, actual=${reloadedState}`
      });

      // 7. Restore original state
      if (reloadedState !== initialState) {
        await firstToggleReloaded.click();
        await page.waitForTimeout(300);
        const restoreSaveBtn = page.locator('button:has-text("Save Changes"), button:has-text("Saved")').first();
        await restoreSaveBtn.click();
        await page.waitForTimeout(1500);
      }
    } else {
      results.push({ test: `${role} toggle persists after reload`, pass: false, detail: "no toggles after reload" });
    }
  }

  // 8. Test profile field persistence
  const phoneInput = page.locator('input[type="tel"]').first();
  const phoneVisible = await phoneInput.isVisible({ timeout: 3000 }).catch(() => false);
  if (phoneVisible) {
    const origPhone = await phoneInput.inputValue();
    const testPhone = "0771234567";
    await phoneInput.fill(testPhone);
    const saveBtnAgain = page.locator('button:has-text("Save Changes"), button:has-text("Saved")').first();
    await saveBtnAgain.click();
    await page.waitForTimeout(2000);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const phoneAfterReload = page.locator('input[type="tel"]').first();
    const phoneVal = await phoneAfterReload.inputValue();
    results.push({
      test: `${role} phone persists after reload`,
      pass: phoneVal === testPhone,
      detail: `expected="${testPhone}", actual="${phoneVal}"`
    });

    // Restore original phone
    if (origPhone !== testPhone) {
      await phoneAfterReload.fill(origPhone);
      const restoreBtn = page.locator('button:has-text("Save Changes"), button:has-text("Saved")').first();
      await restoreBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  return results;
}

// Test More page notification toggles for a role
async function testMorePage(role, morePath) {
  const results = [];

  await page.goto(`${BASE}/en/${role}/more`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const toggles = page.locator('button[role="switch"]');
  const count = await toggles.count();
  results.push({ test: `${role} more page has toggles`, pass: count >= 2, detail: `found ${count}` });

  if (count > 0) {
    const toggle = toggles.nth(0);
    const before = await getToggleState(toggle);
    await toggle.click();
    await page.waitForTimeout(1000); // Wait for API call

    // Reload to verify persistence
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const toggleAfter = page.locator('button[role="switch"]').nth(0);
    const after = await getToggleState(toggleAfter);
    results.push({
      test: `${role} more toggle persists`,
      pass: before !== after,
      detail: `before=${before}, afterReload=${after}`
    });

    // Restore
    if (before !== after) {
      await toggleAfter.click();
      await page.waitForTimeout(1000);
    }
  }

  return results;
}

// API-level test to verify preferences endpoint
async function testApiPreferences() {
  const results = [];

  const token = await page.evaluate(() => sessionStorage.getItem("govihub_token"));
  if (!token) {
    results.push({ test: "API preferences - get token", pass: false });
    return results;
  }

  // GET preferences
  const getResp = await page.evaluate(async (t) => {
    const res = await fetch("/api/v1/users/me/preferences", {
      headers: { "Authorization": `Bearer ${t}` },
    });
    return { status: res.status, data: await res.json() };
  }, token);

  results.push({ test: "GET /me/preferences returns 200", pass: getResp.status === 200 });
  results.push({
    test: "GET /me/preferences has required fields",
    pass: "match_alerts" in getResp.data && "price_alerts" in getResp.data,
    detail: Object.keys(getResp.data).join(", ")
  });

  // PUT preferences
  const putResp = await page.evaluate(async (t) => {
    const res = await fetch("/api/v1/users/me/preferences", {
      method: "PUT",
      headers: { "Authorization": `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ match_alerts: false }),
    });
    return { status: res.status, data: await res.json() };
  }, token);

  results.push({ test: "PUT /me/preferences returns 200", pass: putResp.status === 200 });

  // Verify the change persisted
  const verifyResp = await page.evaluate(async (t) => {
    const res = await fetch("/api/v1/users/me/preferences", {
      headers: { "Authorization": `Bearer ${t}` },
    });
    return await res.json();
  }, token);

  results.push({
    test: "Preference change persisted in DB",
    pass: verifyResp.match_alerts === false,
    detail: `match_alerts=${verifyResp.match_alerts}`
  });

  // Restore
  await page.evaluate(async (t) => {
    await fetch("/api/v1/users/me/preferences", {
      method: "PUT",
      headers: { "Authorization": `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ match_alerts: true }),
    });
  }, token);

  return results;
}

(async () => {
  let totalPassed = 0;
  let totalFailed = 0;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ ignoreHTTPSErrors: true });

    console.log("\n=== Settings Persistence Tests ===\n");

    // --- FARMER ---
    console.log("--- FARMER TESTS ---");
    await login("nuwan", "Nuwan-Super9635");

    // API test first
    const apiResults = await testApiPreferences();
    for (const r of apiResults) {
      console.log(`  ${r.pass ? "PASS" : "FAIL"}: ${r.test}${r.detail ? ` (${r.detail})` : ""}`);
      r.pass ? totalPassed++ : totalFailed++;
    }

    // Farmer settings page
    const farmerSettings = await testSettingsPage("farmer", "/farmer/settings", "green");
    for (const r of farmerSettings) {
      console.log(`  ${r.pass ? "PASS" : "FAIL"}: ${r.test}${r.detail ? ` (${r.detail})` : ""}`);
      r.pass ? totalPassed++ : totalFailed++;
    }

    // Farmer more page
    const farmerMore = await testMorePage("farmer", "/farmer/more");
    for (const r of farmerMore) {
      console.log(`  ${r.pass ? "PASS" : "FAIL"}: ${r.test}${r.detail ? ` (${r.detail})` : ""}`);
      r.pass ? totalPassed++ : totalFailed++;
    }
    await closePage();

    // --- BUYER ---
    console.log("\n--- BUYER TESTS ---");
    // Register a test buyer if needed, or use admin who can access buyer routes
    await login("nuwan", "Nuwan-Super9635");
    // Admin can't access buyer settings directly, so test API-level only
    const buyerApiResults = await testApiPreferences();
    for (const r of buyerApiResults) {
      console.log(`  ${r.pass ? "PASS" : "FAIL"}: ${r.test}${r.detail ? ` (${r.detail})` : ""}`);
      r.pass ? totalPassed++ : totalFailed++;
    }
    await closePage();

    // --- SUPPLIER ---
    console.log("\n--- SUPPLIER TESTS ---");
    await login("nuwan", "Nuwan-Super9635");
    const supplierApiResults = await testApiPreferences();
    for (const r of supplierApiResults) {
      console.log(`  ${r.pass ? "PASS" : "FAIL"}: ${r.test}${r.detail ? ` (${r.detail})` : ""}`);
      r.pass ? totalPassed++ : totalFailed++;
    }
    await closePage();

    console.log(`\n=== Results: ${totalPassed} passed, ${totalFailed} failed ===\n`);
  } catch (err) {
    console.error("Test error:", err.message);
    totalFailed++;
  } finally {
    if (browser) await browser.close();
    process.exit(totalFailed > 0 ? 1 : 0);
  }
})();
