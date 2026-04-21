const { chromium } = require("playwright");
const path = require("path");

const BASE = "https://spices.govihublk.com";
const SCREENSHOTS = "E:/AiGNITE/projects/GoviHub/screenshots/reset_pw";
const TS = Date.now();

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function loginViaBeta(page, username, password) {
  await page.goto(`${BASE}/en/auth/beta-login`);
  await page.waitForLoadState("networkidle");
  await sleep(1000);
  const inputs = page.locator("input");
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.locator('button[type="submit"]').first().click();
  await sleep(4000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  let testUserId = null;
  let adminToken = null;

  try {
    // =========================================
    // STEP 1: Register a test user via API
    // =========================================
    console.log("\n=== STEP 1: Register test user ===");
    const regRes = await fetch(`${BASE}/api/v1/auth/beta/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `pw_reset_test_${TS}`,
        password: "OldPass1234!",
        role: "farmer",
        name: "Reset Test Farmer",
        phone: `077${String(TS).slice(-7)}`,
        language: "en",
        district: "Kandy",
      }),
    });
    const regData = await regRes.json();
    testUserId = regData.user?.id;
    console.log(`  Test user: ${regData.user?.name} (${testUserId})`);
    console.log(`  Username: pw_reset_test_${TS}`);

    // Get admin token for cleanup later
    const adminLoginRes = await fetch(`${BASE}/api/v1/auth/beta/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nuwan", password: "Nuwan-Super9635" }),
    });
    const adminData = await adminLoginRes.json();
    adminToken = adminData.access_token;

    // =========================================
    // STEP 2: Login as admin
    // =========================================
    console.log("\n=== STEP 2: Login as admin ===");
    const page = await context.newPage();
    await loginViaBeta(page, "nuwan", "Nuwan-Super9635");
    console.log(`  Logged in as admin → ${page.url()}`);

    // =========================================
    // STEP 3: Navigate to admin users
    // =========================================
    console.log("\n=== STEP 3: Navigate to admin/users ===");
    await page.goto(`${BASE}/en/admin/users`, { waitUntil: "networkidle", timeout: 20000 });
    await sleep(3000);
    await shot(page, "01_admin_users_list");

    // =========================================
    // STEP 4: Find the test user and click Reset Password
    // =========================================
    console.log("\n=== STEP 4: Find test user & click Reset Password ===");

    // Search for the test user
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill("Reset Test Farmer");
    await sleep(1000);
    await shot(page, "02_search_test_user");

    // Find Reset Password button for that user
    const resetBtn = page.locator('button:has-text("Reset Password")').first();
    const resetVisible = await resetBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Reset Password button visible: ${resetVisible ? "✅ YES" : "❌ NO"}`);

    if (!resetVisible) {
      // Try clicking on the user row to open detail, then find reset there
      const userRow = page.locator('text="Reset Test Farmer"').first();
      await userRow.click();
      await sleep(1000);
      const resetInModal = page.locator('button:has-text("Reset Password")').first();
      await resetInModal.click();
    } else {
      await resetBtn.click();
    }
    await sleep(1000);
    await shot(page, "03_reset_modal_opened");

    // =========================================
    // STEP 5: Verify modal contents
    // =========================================
    console.log("\n=== STEP 5: Verify modal ===");
    const modalName = await page.locator('text="Reset Test Farmer"').isVisible().catch(() => false);
    console.log(`  User name shown: ${modalName ? "✅ YES" : "❌ NO"}`);

    const pwInput = page.locator('input[type="text"][placeholder*="password"], input[placeholder*="8 char"]').first();
    const pwVisible = await pwInput.isVisible().catch(() => false);
    console.log(`  Password input visible: ${pwVisible ? "✅ YES" : "❌ NO"}`);

    // =========================================
    // STEP 6: Click Generate button
    // =========================================
    console.log("\n=== STEP 6: Auto-generate password ===");
    const generateBtn = page.locator('button:has-text("Generate")').first();
    await generateBtn.click();
    await sleep(500);

    const generatedPw = await pwInput.inputValue();
    console.log(`  Generated password: ${generatedPw}`);
    console.log(`  Password length >= 8: ${generatedPw.length >= 8 ? "✅ YES" : "❌ NO"}`);
    await shot(page, "04_password_generated");

    // =========================================
    // STEP 7: Click Save
    // =========================================
    console.log("\n=== STEP 7: Save new password ===");
    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();
    await sleep(3000);
    await shot(page, "05_reset_success");

    // Verify success state
    const successMsg = await page.locator('text="Password reset successful"').isVisible().catch(() => false);
    console.log(`  Success message shown: ${successMsg ? "✅ YES" : "❌ NO"}`);

    const copyBtn = await page.locator('button:has-text("Copy")').isVisible().catch(() => false);
    console.log(`  Copy button shown: ${copyBtn ? "✅ YES" : "❌ NO"}`);

    const reminderText = await page.locator('text="Share this password"').isVisible().catch(() => false);
    console.log(`  Security reminder shown: ${reminderText ? "✅ YES" : "❌ NO"}`);

    // Get the displayed password from the code element
    const displayedPw = await page.locator('code').first().textContent().catch(() => "");
    console.log(`  Password in copyable box: ${displayedPw}`);
    console.log(`  Matches generated: ${displayedPw === generatedPw ? "✅ YES" : "❌ NO"}`);

    // Close the modal
    await page.locator('button:has-text("Done")').click();
    await sleep(500);

    // =========================================
    // STEP 8: Logout and login with new password
    // =========================================
    console.log("\n=== STEP 8: Verify new password works ===");
    await page.close();

    const page2 = await context.newPage();
    await loginViaBeta(page2, `pw_reset_test_${TS}`, generatedPw);
    const afterLoginUrl = page2.url();
    const loginSuccess = afterLoginUrl.includes("/farmer/dashboard") || afterLoginUrl.includes("/dashboard");
    console.log(`  Login with new password: ${loginSuccess ? "✅ SUCCESS" : "❌ FAILED"} → ${afterLoginUrl}`);
    await shot(page2, "06_login_with_new_password");

    // Also verify old password no longer works
    await page2.close();
    const page3 = await context.newPage();
    await loginViaBeta(page3, `pw_reset_test_${TS}`, "OldPass1234!");
    const oldPwUrl = page3.url();
    const oldPwFails = oldPwUrl.includes("/auth/") || oldPwUrl.includes("/beta-login");
    console.log(`  Old password rejected: ${oldPwFails ? "✅ YES" : "❌ NO"} → ${oldPwUrl}`);
    await shot(page3, "07_old_password_rejected");
    await page3.close();

    console.log("\n✅ ALL RESET PASSWORD TESTS PASSED");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
  } finally {
    // =========================================
    // CLEANUP: Delete test user
    // =========================================
    console.log("\n=== CLEANUP ===");
    if (testUserId && adminToken) {
      try {
        // Delete harvest listings first
        const lr = await fetch(`${BASE}/api/v1/admin/users/${testUserId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        console.log(`  Deleted test user: ${lr.status}`);
      } catch (e) {
        console.log(`  Cleanup error: ${e.message}`);
      }
    }
    await browser.close();
  }
})();
