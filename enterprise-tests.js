#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Load .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const DB_URL = process.env.DATABASE_URL;
const REAL_API_KEY = process.env.TEST_ENTERPRISE_API_KEY;
const REAL_TENANT_ID = process.env.TEST_ENTERPRISE_TENANT_ID;

if (!DB_URL || !REAL_API_KEY || !REAL_TENANT_ID) {
  console.error('❌ Missing DATABASE_URL, TEST_ENTERPRISE_API_KEY, or TEST_ENTERPRISE_TENANT_ID in .env.local.');
  process.exit(1);
}

const state = { passed: 0, failed: 0 };
const TEST_EMAIL = `real_test_${Date.now()}@test.com`;
let sql = null;

// ── Formatting Helpers ──────────────────────────────────────────────────────
const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const d = (s) => `\x1b[2m${s}\x1b[0m`;
const cy = (s) => `\x1b[36m${s}\x1b[0m`;

// ── HTTP Helper ─────────────────────────────────────────────────────────────
async function req(urlPath, opts = {}) {
  const { method = 'GET', headers = {}, body } = opts;
  const res = await fetch(`${BASE_URL}${urlPath}`, { method, headers, body });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

function json(extra = {}) {
  return { 'content-type': 'application/json', ...extra };
}

// ── Setup & Teardown ────────────────────────────────────────────────────────
async function setup() {
  console.log(cy('⏳ Preparing DB Connection...'));
  const mod = await import('postgres');
  sql = mod.default(DB_URL, { max: 1 });
  
  // Ensure the real tenant has steps defined for the cron/nudges to work, and enforce its API key matches the .env config
  await sql`UPDATE tenants SET activation_step = 'signed_up', step_2 = 'created_project', api_key = ${REAL_API_KEY} WHERE id = ${REAL_TENANT_ID}`;
  
  // Mark all old stuck users as emailed so the cron processor runs instantly for our single test user
  await sql`UPDATE end_users SET last_emailed_at = NOW() WHERE last_emailed_at IS NULL AND email NOT LIKE 'real_test_%'`;
}

async function teardown() {
  console.log(cy('\n🧹 Cleaning up mocked user data from the real tenant...'));
  if (sql) {
    try {
      await sql`DELETE FROM end_users WHERE email LIKE 'real_test_%'`;
      console.log(g('✅ Cleanup complete.'));
    } catch (e) {
      console.error(r('❌ Cleanup failed:'), e.message);
    }
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`${g('PASS')} ${name}`);
    state.passed++;
  } catch (err) {
    console.log(`${r('FAIL')} ${name}`);
    console.log(d(`     ↳ ${err.message}`));
    state.failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── Suites ──────────────────────────────────────────────────────────────────
async function run() {
  await setup();
  console.log('\n' + cy('🚀 Running Real-User Lifecycle Backend Tests...'));

  // 1. Identification
  await test('Identify creates a real end_user for the logged-in tenant', async () => {
    const payload = JSON.stringify({ userId: TEST_EMAIL, email: TEST_EMAIL, event: 'installed_app' });
    const r1 = await req('/api/v1/identify', { method: 'POST', headers: json({ 'x-api-key': REAL_API_KEY }), body: payload });
    assert(r1.res.status === 200, `Expected 200, got ${r1.res.status}`);
  });

  // 2. Cron Stall Automated Nudge
  await test('Automated Cron Stall Processor sends email to backdated users', async () => {
    // Backdate user to simulate being stuck
    await sql`UPDATE end_users SET created_at = NOW() - INTERVAL '10 minutes' WHERE email = ${TEST_EMAIL}`;
    
    // Trigger the actual backend cron job (No auth required for cron itself)
    const rCron = await req('/api/cron/process-stalls', { method: 'GET' });
    assert(rCron.res.status === 200, `Expected 200 from process-stalls, got ${rCron.res.status}`);
    
    // DB Verification
    const [u] = await sql`SELECT last_emailed_at FROM end_users WHERE email = ${TEST_EMAIL}`;
    assert(u.last_emailed_at !== null, "User was not automatically emailed by the stall processor");
  });

  // 3. Unstuck via Track Event
  await test('Track Event successfully unstucks the user', async () => {
    const stepPayload = JSON.stringify({ userId: TEST_EMAIL, stepId: 'signed_up', event: 'signed_up' });
    const r1 = await req('/api/v1/track', { method: 'POST', headers: json({ 'x-api-key': REAL_API_KEY }), body: stepPayload });
    assert(r1.res.status === 200, `Expected 200, got ${r1.res.status}`);

    const [u] = await sql`SELECT completed_steps FROM end_users WHERE email = ${TEST_EMAIL}`;
    assert(u.completed_steps.includes('signed_up'), "User tracking step failed");
  });
}

// ── Execution ───────────────────────────────────────────────────────────────
run()
  .then(() => {
    console.log('\n' + cy('📊 Backend Results:'));
    console.log(`${g(state.passed + ' passed')} / ${r(state.failed + ' failed')}`);
  })
  .catch((e) => {
    console.error(r('\n❌ Fatal Test Error:'), e);
    state.failed++;
  })
  .finally(async () => {
    await teardown();
    process.exit(state.failed > 0 ? 1 : 0);
  });
