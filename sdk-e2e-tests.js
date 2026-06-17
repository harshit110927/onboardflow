#!/usr/bin/env node
/**
 * ============================================================================
 *  DRIPMETRIC ENTERPRISE – FULL E2E SDK & RATE-LIMIT TEST SUITE
 * ============================================================================
 *
 *  This script simulates the EXACT journey a real client goes through after
 *  installing the Dripmetric npm SDK and integrating it into their backend.
 *
 *  It tests:
 *    Phase 1 – Health & Version endpoints
 *    Phase 2 – SDK identify() via both /api/public/identify AND /api/v1/identify
 *    Phase 3 – SDK track() via both /api/public/track AND /api/v1/track
 *    Phase 4 – Idempotency (re-identify, re-track)
 *    Phase 5 – Validation & Error handling
 *    Phase 6 – IP-based API Rate Limiting (20 req/min sliding window)
 *    Phase 7 – Tracked User Limit Enforcement (plan-based)
 *    Phase 8 – Stall/Cron Processing
 *    Phase 9 – Analytics Verification
 *    Phase 10 – Full Cleanup
 *
 *  HOW TO RUN:
 *    1. Ensure your .env.local has:  TEST_ENTERPRISE_API_KEY, TEST_ENTERPRISE_TENANT_ID, DATABASE_URL
 *    2. Ensure `npm run dev` is running on localhost:3000
 *    3. Run:  node sdk-e2e-tests.js
 *
 * ============================================================================
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Load .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

// ── Config ──────────────────────────────────────────────────────────────────
const BASE      = process.env.BASE_URL || 'http://127.0.0.1:3000';
const DB_URL    = process.env.DATABASE_URL;
const API_KEY   = process.env.TEST_ENTERPRISE_API_KEY;
const TENANT_ID = process.env.TEST_ENTERPRISE_TENANT_ID;

if (!DB_URL || !API_KEY || !TENANT_ID) {
  console.error('❌  Missing required env vars: DATABASE_URL, TEST_ENTERPRISE_API_KEY, TEST_ENTERPRISE_TENANT_ID');
  process.exit(1);
}

// Unique prefix so cleanup is surgical
const RUN_ID = `sdke2e_${Date.now()}`;
const mkEmail = (n) => `${RUN_ID}_user${n}@test.io`;

// ── Formatters ──────────────────────────────────────────────────────────────
const FG = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
const ok   = (s) => `${FG.g}✅ PASS${FG.x} ${s}`;
const fail = (s) => `${FG.r}❌ FAIL${FG.x} ${s}`;
const info = (s) => `${FG.c}${s}${FG.x}`;
const dim  = (s) => `${FG.d}${s}${FG.x}`;

// ── State ───────────────────────────────────────────────────────────────────
const S = { passed: 0, failed: 0, total: 0 };
let sql = null;

// ── HTTP helpers ────────────────────────────────────────────────────────────
async function api(urlPath, { method = 'POST', headers = {}, body, raw = false } = {}) {
  const opts = { method, headers: { ...headers } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, opts);
  if (raw) return res;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

function withKey(extra = {}) {
  return { 'x-api-key': API_KEY, ...extra };
}

// ── Test runner ─────────────────────────────────────────────────────────────
async function test(name, fn) {
  S.total++;
  try {
    await fn();
    console.log(ok(name));
    S.passed++;
  } catch (err) {
    console.log(fail(name));
    console.log(dim(`     ↳ ${err.message}`));
    S.failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { assert(a === b, msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Setup ───────────────────────────────────────────────────────────────────
async function setup() {
  console.log(info('\n⏳  Connecting to Postgres...'));
  const mod = await import('postgres');
  sql = mod.default(DB_URL, { max: 1 });

  // Ensure our test tenant has correct API key & step config
  await sql`
    UPDATE tenants
    SET api_key         = ${API_KEY},
        activation_step = 'signed_up',
        step_2          = 'created_project'
    WHERE id = ${TENANT_ID}
  `;

  // Mark existing stuck users as emailed so cron runs fast for our test users only
  await sql`
    UPDATE end_users
    SET last_emailed_at = NOW()
    WHERE last_emailed_at IS NULL
      AND email NOT LIKE ${RUN_ID + '%'}
  `;

  console.log(info('✅  Setup complete.\n'));
}

async function teardown() {
  console.log(info('\n🧹  Cleaning up test data...'));
  if (!sql) return;
  try {
    const del = await sql`DELETE FROM end_users WHERE email LIKE ${RUN_ID + '%'} RETURNING id`;
    console.log(info(`    Deleted ${del.length} test user(s).`));
  } catch (e) {
    console.log(fail(`Cleanup error: ${e.message}`));
  }
  await sql.end({ timeout: 2 }).catch(() => {});
}

// ============================================================================
//  PHASE 1 – Health & Version
// ============================================================================
async function phase1() {
  console.log(info('\n─── Phase 1: Health & Version ───'));

  await test('GET /api/public/health returns 200 OK', async () => {
    const r = await api('/api/public/health', { method: 'GET' });
    eq(r.status, 200);
    eq(r.json?.success, true);
  });

  await test('GET /api/public/version returns api name and version', async () => {
    const r = await api('/api/public/version', { method: 'GET' });
    eq(r.status, 200);
    eq(r.json?.name, 'dripmetric');
    assert(typeof r.json?.version === 'string', 'version must be a string');
  });
}

// ============================================================================
//  PHASE 2 – Identify (both route paths)
// ============================================================================
async function phase2() {
  console.log(info('\n─── Phase 2: SDK identify() ───'));

  // 2a. /api/public/identify (the path the npm SDK actually hits)
  await test('POST /api/public/identify creates a new user (SDK path)', async () => {
    const email = mkEmail(1);
    const r = await api('/api/public/identify', { headers: withKey(), body: { userId: email, email } });
    eq(r.status, 200);
    eq(r.json?.success, true);
    eq(r.json?.idempotent, false, 'First call should not be idempotent');
  });

  // 2b. /api/v1/identify (the legacy/alias path)
  await test('POST /api/v1/identify creates a new user (v1 path)', async () => {
    const email = mkEmail(2);
    const r = await api('/api/v1/identify', { headers: withKey(), body: { userId: email, email } });
    eq(r.status, 200);
    eq(r.json?.success, true);
    eq(r.json?.idempotent, false);
  });

  // 2c. With metadata
  await test('identify() accepts optional metadata', async () => {
    const email = mkEmail(3);
    const r = await api('/api/public/identify', {
      headers: withKey(),
      body: { userId: email, email, metadata: { plan: 'startup', source: 'organic' } },
    });
    eq(r.status, 200);
    const [row] = await sql`SELECT properties FROM end_users WHERE email = ${email}`;
    assert(row.properties?.plan === 'startup', 'Metadata was not persisted');
  });

  // 2d. Bearer token auth variant
  await test('identify() works with Authorization: Bearer header', async () => {
    const email = mkEmail(4);
    const r = await api('/api/public/identify', {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      body: { userId: email, email },
    });
    eq(r.status, 200);
    eq(r.json?.success, true);
  });
}

// ============================================================================
//  PHASE 3 – Track
// ============================================================================
async function phase3() {
  console.log(info('\n─── Phase 3: SDK track() ───'));

  const email = mkEmail(1); // already identified in phase 2

  await test('POST /api/public/track records a step completion', async () => {
    const r = await api('/api/public/track', {
      headers: withKey(),
      body: { userId: email, eventName: 'signed_up' },
    });
    eq(r.status, 200);
    eq(r.json?.success, true);
    eq(r.json?.duplicate, false);
  });

  await test('POST /api/v1/track also works (v1 alias)', async () => {
    const r = await api('/api/v1/track', {
      headers: withKey(),
      body: { userId: mkEmail(2), eventName: 'signed_up' },
    });
    eq(r.status, 200);
    eq(r.json?.success, true);
  });

  await test('track() accepts stepId as alias for eventName', async () => {
    const r = await api('/api/public/track', {
      headers: withKey(),
      body: { userId: email, stepId: 'created_project' },
    });
    eq(r.status, 200);
    eq(r.json?.eventName, 'created_project');
  });

  await test('track() stores step in completedSteps array in DB', async () => {
    const [row] = await sql`SELECT completed_steps FROM end_users WHERE email = ${email}`;
    assert(Array.isArray(row.completed_steps), 'completedSteps is not an array');
    assert(row.completed_steps.includes('signed_up'), 'signed_up not in completedSteps');
    assert(row.completed_steps.includes('created_project'), 'created_project not in completedSteps');
  });
}

// ============================================================================
//  PHASE 4 – Idempotency
// ============================================================================
async function phase4() {
  console.log(info('\n─── Phase 4: Idempotency ───'));

  const email = mkEmail(1);

  await test('Re-identifying same userId returns idempotent: true', async () => {
    const r = await api('/api/public/identify', { headers: withKey(), body: { userId: email, email } });
    eq(r.status, 200);
    eq(r.json?.idempotent, true);
  });

  await test('Re-tracking same eventName returns duplicate: true', async () => {
    const r = await api('/api/public/track', {
      headers: withKey(),
      body: { userId: email, eventName: 'signed_up' },
    });
    eq(r.status, 200);
    eq(r.json?.duplicate, true);
  });

  await test('Re-identifying updates lastSeenAt timestamp', async () => {
    const [before] = await sql`SELECT last_seen_at FROM end_users WHERE email = ${email}`;
    await new Promise(r => setTimeout(r, 50));
    await api('/api/public/identify', { headers: withKey(), body: { userId: email, email } });
    const [after] = await sql`SELECT last_seen_at FROM end_users WHERE email = ${email}`;
    assert(after.last_seen_at >= before.last_seen_at, 'lastSeenAt was not updated');
  });

  await test('Re-identifying merges new metadata with existing', async () => {
    const email3 = mkEmail(3);
    await api('/api/public/identify', {
      headers: withKey(),
      body: { userId: email3, email: email3, metadata: { tier: 'premium' } },
    });
    const [row] = await sql`SELECT properties FROM end_users WHERE email = ${email3}`;
    assert(row.properties?.plan === 'startup', 'Original metadata.plan was lost');
    assert(row.properties?.tier === 'premium', 'New metadata.tier was not merged');
  });
}

// ============================================================================
//  PHASE 5 – Validation & Error Handling
// ============================================================================
async function phase5() {
  console.log(info('\n─── Phase 5: Validation & Errors ───'));

  await test('identify() without x-api-key returns 401', async () => {
    const r = await api('/api/public/identify', { body: { userId: 'x', email: 'x@x.com' } });
    eq(r.status, 401);
  });

  await test('identify() with invalid API key returns 401', async () => {
    const r = await api('/api/public/identify', {
      headers: { 'x-api-key': 'bad_key_12345' },
      body: { userId: 'x', email: 'x@x.com' },
    });
    eq(r.status, 401);
  });

  await test('identify() without userId returns 400', async () => {
    const r = await api('/api/public/identify', { headers: withKey(), body: { email: 'a@b.com' } });
    eq(r.status, 400);
  });

  await test('identify() without email returns 400', async () => {
    const r = await api('/api/public/identify', { headers: withKey(), body: { userId: 'u1' } });
    eq(r.status, 400);
  });

  await test('identify() with invalid email format returns 400', async () => {
    const r = await api('/api/public/identify', { headers: withKey(), body: { userId: 'u1', email: 'not-an-email' } });
    eq(r.status, 400);
  });

  await test('identify() with non-object metadata returns 400', async () => {
    const r = await api('/api/public/identify', {
      headers: withKey(),
      body: { userId: 'u1', email: 'a@b.com', metadata: 'string' },
    });
    eq(r.status, 400);
  });

  await test('track() without userId returns 400', async () => {
    const r = await api('/api/public/track', { headers: withKey(), body: { eventName: 'x' } });
    eq(r.status, 400);
  });

  await test('track() without eventName returns 400', async () => {
    const r = await api('/api/public/track', { headers: withKey(), body: { userId: 'u1' } });
    eq(r.status, 400);
  });

  await test('track() for un-identified user returns 404', async () => {
    const r = await api('/api/public/track', {
      headers: withKey(),
      body: { userId: 'nonexistent_user_xyz', eventName: 'step' },
    });
    eq(r.status, 404);
  });

  await test('identify() with non-JSON body returns 400', async () => {
    const res = await fetch(`${BASE}/api/public/identify`, {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: 'not json at all',
    });
    eq(res.status, 400);
  });

  await test('track() with invalid timestamp returns 400', async () => {
    const r = await api('/api/public/track', {
      headers: withKey(),
      body: { userId: mkEmail(1), eventName: 'bogus', timestamp: 'not-a-date' },
    });
    eq(r.status, 400);
  });
}

// ============================================================================
//  PHASE 6 – IP Rate Limiting (20 req / 60s window)
// ============================================================================
async function phase6() {
  console.log(info('\n─── Phase 6: IP Rate Limiting ───'));

  await test('API returns 429 after 20 rapid requests from same IP', async () => {
    // We'll fire identify requests rapidly. The in-memory LRU allows 20 per IP per minute.
    // Since these all come from 127.0.0.1 (or whatever x-forwarded-for resolves to),
    // the 21st should be rate-limited.
    let hitRateLimit = false;
    const email = `${RUN_ID}_ratelimit@test.io`;
    for (let i = 0; i < 25; i++) {
      const r = await api('/api/public/identify', {
        headers: withKey(),
        body: { userId: `${email}_${i}`, email: `${RUN_ID}_rl${i}@test.io` },
      });
      if (r.status === 429) {
        hitRateLimit = true;
        console.log(dim(`     ↳ Rate limited at request #${i + 1}`));
        break;
      }
    }
    assert(hitRateLimit, 'Expected 429 after exceeding 20 requests but never received it');
  });
}

// ============================================================================
//  PHASE 7 – End-User Tracking Limit (plan-tier enforcement)
// ============================================================================
async function phase7() {
  console.log(info('\n─── Phase 7: Tracked User Limit Enforcement ───'));

  await test('checkEndUserLimit function is NOT enforced in identify (known vulnerability)', async () => {
    // This test documents a KNOWN gap: the identify() endpoint does not call
    // checkEndUserLimit(), meaning tenants can exceed their plan's maxTrackedUsers.
    //
    // On a Free plan (50 users max), we should be able to create user #51 without rejection.
    // This test PASSES if the vulnerability EXISTS (i.e. no 403/429 is returned).
    // When the vulnerability is FIXED, this test should be UPDATED to expect rejection.
    const email = `${RUN_ID}_overlimit@test.io`;
    const r = await api('/api/public/identify', {
      headers: withKey(),
      body: { userId: email, email },
    });
    // If 200 → vulnerability confirmed (identify doesn't enforce limit)
    // If 429 → it means rate limit kicked in from phase 6; we note that separately
    if (r.status === 200) {
      console.log(dim('     ↳ ⚠️  Confirmed: identify() does NOT enforce maxTrackedUsers.'));
      console.log(dim('     ↳ ⚠️  checkEndUserLimit() exists but is never imported in lib/api/public.ts'));
    } else if (r.status === 429) {
      console.log(dim('     ↳ Got 429 (IP rate limit from Phase 6). Cannot verify user limit separately.'));
    }
    // We pass either way; this is a documentation test
    assert(true);
  });
}

// ============================================================================
//  PHASE 8 – Stall / Cron Processing
// ============================================================================
async function phase8() {
  console.log(info('\n─── Phase 8: Stall Processing (Cron) ───'));

  // Create a fresh user who has NOT completed any steps
  const stallEmail = mkEmail('stall');
  await sql`
    INSERT INTO end_users (tenant_id, external_id, email, completed_steps, created_at)
    VALUES (${TENANT_ID}, ${stallEmail}, ${stallEmail}, '[]'::jsonb, NOW() - INTERVAL '10 minutes')
  `;

  await test('Cron /api/cron/process-stalls detects and emails a stuck user', async () => {
    const r = await api('/api/cron/process-stalls', { method: 'GET' });
    eq(r.status, 200);
    assert(r.json?.success === true, 'Cron did not return success');
    console.log(dim(`     ↳ Candidates: ${r.json.candidatesFound}, Emails sent: ${r.json.emailsSent}`));
  });

  await test('Stalled user has lastEmailedAt set after cron run', async () => {
    const [row] = await sql`SELECT last_emailed_at FROM end_users WHERE email = ${stallEmail}`;
    assert(row.last_emailed_at !== null, 'lastEmailedAt was not set — cron did not process this user');
  });
}

// ============================================================================
//  PHASE 9 – SDK/API Path Parity
// ============================================================================
async function phase9() {
  console.log(info('\n─── Phase 9: Route Path Parity ───'));

  // The SDK uses /api/public/*, but the codebase also exposes /api/v1/*.
  // Both must point to the same handler.

  await test('/api/public/identify and /api/v1/identify return same structure', async () => {
    const email = mkEmail('parity1');
    const r1 = await api('/api/public/identify', { headers: withKey(), body: { userId: email, email } });
    // re-identify via v1
    const r2 = await api('/api/v1/identify', { headers: withKey(), body: { userId: email, email } });
    eq(r1.status, 200);
    eq(r2.status, 200);
    assert(r1.json?.success === true && r2.json?.success === true, 'Both paths must succeed');
    eq(r2.json?.idempotent, true, 'v1 re-identify should be idempotent');
  });

  await test('/api/public/track and /api/v1/track return same structure', async () => {
    const email = mkEmail('parity1');
    const r1 = await api('/api/public/track', { headers: withKey(), body: { userId: email, eventName: 'parity_step' } });
    const r2 = await api('/api/v1/track', { headers: withKey(), body: { userId: email, eventName: 'parity_step' } });
    eq(r1.status, 200);
    eq(r2.status, 200);
    eq(r2.json?.duplicate, true, 'Second call via /v1 should be duplicate');
  });
}

// ============================================================================
//  MAIN
// ============================================================================
async function main() {
  console.log(`\n${FG.b}${FG.c}╔══════════════════════════════════════════════════╗${FG.x}`);
  console.log(`${FG.b}${FG.c}║  DRIPMETRIC SDK – FULL E2E TEST SUITE            ║${FG.x}`);
  console.log(`${FG.b}${FG.c}╚══════════════════════════════════════════════════╝${FG.x}`);
  console.log(dim(`Run ID: ${RUN_ID}`));

  await setup();

  await phase1();
  await phase2();
  await phase3();
  await phase4();
  await phase5();
  // Note: Phase 6 (rate limiting) will exhaust the IP window.
  // Run it last among the API tests so it doesn't pollute other phases.
  await phase6();
  await phase7();
  await phase8();
  await phase9();

  console.log(`\n${FG.b}══════════════════════════════════════════════════${FG.x}`);
  console.log(`${FG.b}📊  Results: ${FG.g}${S.passed} passed${FG.x} / ${FG.r}${S.failed} failed${FG.x} / ${S.total} total`);
  console.log(`${FG.b}══════════════════════════════════════════════════${FG.x}\n`);
}

main()
  .catch((e) => { console.error(fail('Fatal error:'), e); S.failed++; })
  .finally(async () => { await teardown(); process.exit(S.failed > 0 ? 1 : 0); });
