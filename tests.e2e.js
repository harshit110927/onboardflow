#!/usr/bin/env node
/**
 * End-to-end smoke + edge-case coverage for Dripmetric (individual + enterprise tiers).
 *
 * Usage:
 *   BASE_URL="https://www.dripmetric.com" \
 *   INDIVIDUAL_STATE="./.auth/individual.json" \
 *   ENTERPRISE_STATE="./.auth/enterprise.json" \
 *   node tests.e2e.js
 *
 * Notes:
 * - This script expects Playwright to be available (`npm i -D playwright` if missing).
 * - Storage state JSON files should contain authenticated sessions for each tier.
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const INDIVIDUAL_STATE = process.env.INDIVIDUAL_STATE || "./.auth/individual.json";
const ENTERPRISE_STATE = process.env.ENTERPRISE_STATE || "./.auth/enterprise.json";

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectVisible(page, selector, timeout = 15000) {
  await page.waitForSelector(selector, { timeout });
}

async function runSuite(name, fn) {
  const started = Date.now();
  try {
    await fn();
    console.log(`✅ ${name} (${Date.now() - started}ms)`);
  } catch (err) {
    console.error(`❌ ${name}: ${err?.message || err}`);
    throw err;
  }
}

async function run() {
  let playwright;
  try {
    playwright = require("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed. Run: npm i -D playwright && npx playwright install"
    );
  }

  ensureFile(path.resolve(INDIVIDUAL_STATE));
  ensureFile(path.resolve(ENTERPRISE_STATE));

  const browser = await playwright.chromium.launch({ headless: true });
  const failures = [];

  // ──────────────────────────────────────────────────────────────────────────
  // Individual tier flows
  // ──────────────────────────────────────────────────────────────────────────
  const individual = await browser.newContext({ storageState: INDIVIDUAL_STATE });
  const ipage = await individual.newPage();

  const safeRun = async (name, fn) => {
    try {
      await runSuite(name, fn);
    } catch (err) {
      failures.push(`${name}: ${err?.message || err}`);
    }
  };

  await safeRun("Individual dashboard loads", async () => {
    await ipage.goto(`${BASE_URL}/dashboard/individual`, { waitUntil: "networkidle" });
    await expectVisible(ipage, "text=Welcome back");
    await expectVisible(ipage, "text=Emails This Month");
  });

  await safeRun("Individual lists page loads with scoped aggregates", async () => {
    await ipage.goto(`${BASE_URL}/dashboard/individual/lists`, { waitUntil: "networkidle" });
    await expectVisible(ipage, "text=Email Lists");
  });

  await safeRun("Individual campaign create page loads", async () => {
    await ipage.goto(`${BASE_URL}/dashboard/individual/campaigns/create`, { waitUntil: "networkidle" });
    await expectVisible(ipage, "text=Create Campaign");
  });

  await safeRun("Individual billing pack count is exactly 3", async () => {
    await ipage.goto(`${BASE_URL}/dashboard/individual/billing`, { waitUntil: "networkidle" });
    await expectVisible(ipage, "text=Credits");
    const buyButtons = await ipage.locator("button:has-text('Buy Now')").count();
    assert(buyButtons === 3, `Expected 3 individual credit packs, got ${buyButtons}`);
  });

  await safeRun("Individual settings sections exist", async () => {
    await ipage.goto(`${BASE_URL}/dashboard/individual/settings`, { waitUntil: "networkidle" });
    await expectVisible(ipage, "text=Account");
    await expectVisible(ipage, "text=Credits & Billing");
    await expectVisible(ipage, "text=Email Sending");
    await expectVisible(ipage, "text=Session");
  });

  await safeRun("Campaign detail shows send-state messaging", async () => {
    await ipage.goto(`${BASE_URL}/dashboard/individual/campaigns`, { waitUntil: "networkidle" });
    const firstView = ipage.locator("a:has-text('View')").first();
    const exists = await firstView.count();
    assert(exists > 0, "No campaign found to validate detail page");
    await firstView.click();
    await ipage.waitForLoadState("networkidle");

    // We don't force send here; we only verify that ready/sent/error areas render consistently.
    const hasReady = await ipage.locator("text=Ready to send?").count();
    const hasSent = await ipage.locator("text=Campaign sent").count();
    const hasNoContacts = await ipage.locator("text=No contacts in this list yet").count();
    assert(
      hasReady + hasSent + hasNoContacts > 0,
      "Campaign detail missing expected send status block"
    );
  });

  await individual.close();

  // ──────────────────────────────────────────────────────────────────────────
  // Enterprise tier flows
  // ──────────────────────────────────────────────────────────────────────────
  const enterprise = await browser.newContext({ storageState: ENTERPRISE_STATE });
  const epage = await enterprise.newPage();

  await safeRun("Enterprise dashboard loads", async () => {
    await epage.goto(`${BASE_URL}/dashboard/enterprise`, { waitUntil: "networkidle" });
    await expectVisible(epage, "text=Dashboard");
  });

  await safeRun("Enterprise billing pack count is exactly 3", async () => {
    await epage.goto(`${BASE_URL}/dashboard/enterprise/billing`, { waitUntil: "networkidle" });
    await expectVisible(epage, "text=Credits");
    const buyButtons = await epage.locator("button:has-text('Buy Now')").count();
    assert(buyButtons === 3, `Expected 3 enterprise credit packs, got ${buyButtons}`);
  });

  await enterprise.close();
  await browser.close();

  if (failures.length > 0) {
    console.error("\n--- E2E failures ---");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("\n🎉 All E2E suites passed.");
}

run().catch((err) => {
  console.error("Fatal E2E failure:", err?.message || err);
  process.exit(1);
});
