/**
 * --------------------------------------------------------------------------
 * Enterprise Tier - Frontend Console Test Suite (Lifecycle Expansion)
 * --------------------------------------------------------------------------
 *
 * HOW TO USE:
 * 1. Log in to your enterprise tier dashboard locally (http://localhost:3000/dashboard)
 * 2. Open the browser Developer Tools (F12) -> Console tab
 * 3. Copy and paste this entire script into the console and hit Enter
 * 
 * WHAT IT DOES:
 * - Tests the authenticated Razorpay Subscription Endpoints.
 * - Tests the Authenticated Manual Nudge Endpoint.
 * - Tests the Authenticated Analytics Data Funnel.
 */

(async function runEnterpriseFrontendTests() {
  const state = { passed: 0, failed: 0 };
  let testSubscriptionId = null;

  console.log("%c🚀 Starting Advanced Enterprise Frontend Tests...", "color: #0ea5e9; font-weight: bold; font-size: 14px;");

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  async function test(name, fn) {
    try {
      await fn();
      console.log(`%c✅ PASS: ${name}`, "color: #22c55e; font-weight: bold;");
      state.passed++;
    } catch (err) {
      console.error(`%c❌ FAIL: ${name}\n   ↳ ${err.message}`, "color: #ef4444; font-weight: bold;");
      state.failed++;
    }
  }

  // 1. Test Create Subscription
  await test("Create subscription via /api/razorpay/create-subscription", async () => {
    const res = await fetch("/api/razorpay/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "ent_advanced" }),
    });
    
    assert(res.ok, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert(data.subscriptionId, "Response missing subscriptionId");
    testSubscriptionId = data.subscriptionId;
  });

  // 2. Test Verify Subscription
  await test("Verify subscription correctly rejects bad signature", async () => {
    const res = await fetch("/api/razorpay/verify-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_payment_id: "pay_test123",
        razorpay_subscription_id: testSubscriptionId || "sub_test123",
        razorpay_signature: "invalid_signature_hash",
        planId: "ent_advanced"
      }),
    });
    assert(res.status === 400, `Expected 400 Bad Request for invalid signature, got ${res.status}`);
  });

  // 3. Test Manual Nudge Step 1
  await test("Send Manual Nudge to Step 1 users safely processes response", async () => {
    const res = await fetch("/api/v1/nudge-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex: 1 }), 
    });
    
    const data = await res.json();
    // 429 means rate limited, which is fine in a test, otherwise 200 OK is expected
    assert(res.ok || res.status === 429, `Expected 200 OK or 429 Rate Limit, got ${res.status}: ${data.error}`);
    if (res.ok) {
        assert(data.success === true, "Nudge endpoint did not return success");
        console.log(`%c   ↳ Nudge sent to ${data.sent} users, skipped ${data.skipped} users.`, "color: #94a3b8;");
    }
  });

  // 4. Test Analytics Funnel
  await test("Analytics endpoint correctly returns formatted Funnel Data", async () => {
    const res = await fetch("/api/v1/analytics-data", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    assert(res.ok, `Expected 200 OK from analytics data, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.funnelData), "Response missing funnelData array");
    assert(typeof data.activeUsers === "number", "Response missing activeUsers calculation");
    console.log(`%c   ↳ Total Users: ${data.totalUsers} | Active Users: ${data.activeUsers}`, "color: #94a3b8;");
  });

  // Summary
  console.log(`\n%c📊 Test Results: ${state.passed} Passed / ${state.failed} Failed`, 
    `color: ${state.failed > 0 ? '#ef4444' : '#22c55e'}; font-weight: bold; font-size: 14px;`);
})();
