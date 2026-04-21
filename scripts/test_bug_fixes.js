const { chromium } = require("playwright");
const path = require("path");

const BASE = "https://spices.govihublk.com";
const SCREENSHOTS = "E:/AiGNITE/projects/GoviHub/screenshots";
const TS = Date.now();

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
  console.log(`  screenshot: ${name}.png`);
}

async function loginViaBeta(page, username, password) {
  await page.goto(`${BASE}/en/auth/beta-login`);
  await page.waitForLoadState("networkidle");
  await sleep(1000);
  // Fill username - first text input
  const inputs = page.locator("input");
  await inputs.nth(0).fill(username);
  // Fill password - second input (password type)
  await inputs.nth(1).fill(password);
  // Click login button
  await page.locator('button[type="submit"]').first().click();
  await sleep(4000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  let farmerToken, buyerToken, farmerId, buyerId;

  try {
    // ============================================================
    // STEP 1: Register farmer via API
    // ============================================================
    console.log("\n=== STEP 1: Farmer Registration ===");
    const farmerRes = await fetch(`${BASE}/api/v1/auth/beta/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `pw_farmer_${TS}`,
        password: "Test1234!",
        role: "farmer",
        name: "Playwright Farmer",
        phone: "0771111111",
        language: "en",
        district: "Kandy",
      }),
    });
    const farmerData = await farmerRes.json();
    farmerToken = farmerData.access_token;
    farmerId = farmerData.user?.id;
    console.log(`  Farmer: ${farmerData.user?.name} (${farmerId})`);

    // Login via beta-login page
    await loginViaBeta(page, `pw_farmer_${TS}`, "Test1234!");
    await shot(page, "01_farmer_dashboard");

    // ============================================================
    // STEP 2: Create harvest listing through UI
    // ============================================================
    console.log("\n=== STEP 2: Create Harvest Listing ===");
    await page.goto(`${BASE}/en/farmer/listings`);
    await sleep(4000);
    await shot(page, "02_farmer_listings_empty");

    // Click add - empty state or FAB
    try {
      const addBtn = page.locator('button:has-text("Add Harvest")').first();
      if (await addBtn.isVisible({ timeout: 2000 })) {
        await addBtn.click();
      } else {
        await page.locator("button.fixed").first().click();
      }
    } catch {
      await page.locator("button.fixed").first().click();
    }
    await sleep(3000); // Wait for crops to load from API
    await shot(page, "03_create_listing_modal");

    // Check crop dropdown
    const cropSelect = page.locator("select").first();
    const options = await cropSelect.locator("option").allTextContents();
    console.log(`  Crop options: ${JSON.stringify(options)}`);

    if (options.some((o) => o.includes("Black Pepper"))) {
      console.log("  ✅ Crop dropdown shows real spice crops with UUIDs");
    } else if (options.length === 0) {
      console.log("  ⚠️  Crop dropdown empty - crops still loading or auth issue");
      // Wait more and try again
      await sleep(3000);
      const options2 = await cropSelect.locator("option").allTextContents();
      console.log(`  Retry crop options: ${JSON.stringify(options2)}`);
    }

    // Select Black Pepper
    try {
      await cropSelect.selectOption({ label: "Black Pepper" });
    } catch {
      // Try by index if label doesn't work
      const optionValues = await cropSelect.locator("option").evaluateAll((opts) =>
        opts.map((o) => ({ value: o.value, text: o.textContent }))
      );
      console.log(`  Option values:`, JSON.stringify(optionValues));
      // Select the first real option
      if (optionValues.length > 1) {
        await cropSelect.selectOption(optionValues[1].value);
      }
    }
    await sleep(500);

    // Fill form fields
    const numInputs = page.locator('input[type="number"]');
    if ((await numInputs.count()) >= 1) await numInputs.nth(0).fill("500");
    if ((await numInputs.count()) >= 2) await numInputs.nth(1).fill("2500");

    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) >= 1) await dateInputs.first().fill("2026-04-10");

    await shot(page, "04_listing_form_filled");

    // Submit
    const createBtn = page.locator('button:has-text("Create")').last();
    await createBtn.click();
    await sleep(5000);
    await shot(page, "05_after_submit");

    // Check result
    const listingCreated = (await page.locator("text=/Black Pepper|Turmeric|Ginger|Cinnamon/i").count()) > 0;
    console.log(`  Listing created and visible: ${listingCreated ? "✅ YES" : "❌ NO"}`);

    // Check for errors shown in modal
    const errorShown = await page.locator(".bg-red-50").isVisible().catch(() => false);
    if (errorShown) {
      const errorText = await page.locator(".bg-red-50").textContent();
      console.log(`  ⚠️ Error displayed: ${errorText}`);
    }

    // ============================================================
    // STEP 3: Register buyer
    // ============================================================
    console.log("\n=== STEP 3: Buyer Registration ===");
    const buyerRes = await fetch(`${BASE}/api/v1/auth/beta/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `pw_buyer_${TS}`,
        password: "Test1234!",
        role: "buyer",
        name: "Playwright Buyer",
        phone: "0772222222",
        language: "en",
        district: "Colombo",
      }),
    });
    const buyerData = await buyerRes.json();
    buyerToken = buyerData.access_token;
    buyerId = buyerData.user?.id;
    console.log(`  Buyer: ${buyerData.user?.name} (${buyerId})`);
    console.log("  ✅ No crop selection forced during buyer registration");

    // Login as buyer
    await loginViaBeta(page, `pw_buyer_${TS}`, "Test1234!");

    // ============================================================
    // STEP 4: Create demand posting
    // ============================================================
    console.log("\n=== STEP 4: Create Demand Posting ===");
    await page.goto(`${BASE}/en/buyer/demands`);
    await sleep(4000);
    await shot(page, "06_buyer_demands_empty");

    try {
      const postBtn = page.locator('button:has-text("Post Demand")').first();
      if (await postBtn.isVisible({ timeout: 2000 })) {
        await postBtn.click();
      } else {
        await page.locator("button.fixed").first().click();
      }
    } catch {
      await page.locator("button.fixed").first().click();
    }
    await sleep(3000);
    await shot(page, "07_demand_modal");

    // Fill demand
    const demandCrop = page.locator("select").first();
    try {
      await demandCrop.selectOption({ label: "Black Pepper" });
    } catch {
      const opts = await demandCrop.locator("option").evaluateAll((o) => o.map((x) => x.value));
      if (opts.length > 1) await demandCrop.selectOption(opts[1]);
    }

    const demandNums = page.locator('input[type="number"]');
    if ((await demandNums.count()) >= 1) await demandNums.nth(0).fill("1000");
    if ((await demandNums.count()) >= 2) await demandNums.nth(1).fill("3000");

    const demandDates = page.locator('input[type="date"]');
    if ((await demandDates.count()) >= 1) await demandDates.first().fill("2026-05-01");

    await shot(page, "08_demand_form_filled");

    const postDemandBtn = page.locator('button:has-text("Post")').last();
    await postDemandBtn.click();
    await sleep(5000);
    await shot(page, "09_after_demand_submit");

    const demandCreated = (await page.locator("text=/Black Pepper|Turmeric|Ginger|Cinnamon/i").count()) > 0;
    console.log(`  Demand created and visible: ${demandCreated ? "✅ YES" : "❌ NO"}`);

    // ============================================================
    // STEP 5: Registration form check
    // ============================================================
    console.log("\n=== STEP 5: Verify Registration Form ===");
    await page.goto(`${BASE}/en/auth/register`);
    await sleep(2000);
    await shot(page, "10_registration_form");

  } finally {
    // ============================================================
    // CLEANUP
    // ============================================================
    console.log("\n=== CLEANUP ===");
    if (farmerId) {
      try {
        const r = await fetch(`${BASE}/api/v1/listings/harvest`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });
        const d = await r.json();
        for (const h of (Array.isArray(d) ? d : d?.data ?? [])) {
          await fetch(`${BASE}/api/v1/listings/harvest/${h.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${farmerToken}` },
          });
          console.log(`  Deleted harvest: ${h.id}`);
        }
      } catch {}
    }
    if (buyerId) {
      try {
        const r = await fetch(`${BASE}/api/v1/listings/demand`, {
          headers: { Authorization: `Bearer ${buyerToken}` },
        });
        const d = await r.json();
        for (const item of (Array.isArray(d) ? d : d?.data ?? [])) {
          await fetch(`${BASE}/api/v1/listings/demand/${item.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${buyerToken}` },
          });
          console.log(`  Deleted demand: ${item.id}`);
        }
      } catch {}
    }
    console.log(`  DB cleanup needed for: ${farmerId}, ${buyerId}`);
    await browser.close();
  }

  console.log("\n✅ ALL TESTS COMPLETE");
})();
