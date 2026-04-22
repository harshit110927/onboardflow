#!/usr/bin/env node
/**
 * OnboardFlow integration test suite
 *
 * SETUP — copy this block into .env.local (values already there will be reused):
 *
 *   BASE_URL=http://localhost:3000
 *   TEST_ENTERPRISE_API_KEY=<x-api-key from tenants.api_key for your enterprise test tenant>
 *   RAZORPAY_WEBHOOK_SECRET=<same value as server>
 *   CRON_SECRET=<same value as server>
 *   TEST_ENTERPRISE_TENANT_ID=<uuid of enterprise tenant>
 *   TEST_INDIVIDUAL_TENANT_ID=<uuid of individual tenant>
 *   DATABASE_URL=<postgres connection string>   # optional — enables DB assertions
 *
 * HOW TO RUN:
 *   node tests.js
 *   DEBUG=1 node tests.js        # prints every HTTP request
 *   STOP_ON_FAIL=1 node tests.js # halt at first failure
 *
 * No browser, no cookies, no Playwright needed.
 *
 * ON FAILURE each test prints:
 *   Route      — the HTTP endpoint under test
 *   File       — the source file most likely responsible
 *   Root cause — the most likely reason this is broken
 *   Fix        — concrete code change needed
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Load .env.local manually (no dotenv dependency needed) ──────────────────
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

const BASE_URL      = process.env.BASE_URL || 'http://localhost:3000';
const API_KEY       = process.env.TEST_ENTERPRISE_API_KEY || '';
const RZ_SECRET     = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const CRON_SECRET   = process.env.CRON_SECRET || '';
const ENT_TENANT_ID = process.env.TEST_ENTERPRISE_TENANT_ID || '';
const IND_TENANT_ID = process.env.TEST_INDIVIDUAL_TENANT_ID || '';
const DB_URL        = process.env.DATABASE_URL || '';
const DEBUG         = Boolean(process.env.DEBUG);
const STOP_ON_FAIL  = Boolean(process.env.STOP_ON_FAIL);

const state    = { passed: 0, failed: 0, skipped: 0 };
const failures = []; // accumulates { category, name, error, meta }

const g  = (s) => `\x1b[32m${s}\x1b[0m`;
const r  = (s) => `\x1b[31m${s}\x1b[0m`;
const y  = (s) => `\x1b[33m${s}\x1b[0m`;
const d  = (s) => `\x1b[2m${s}\x1b[0m`;
const b  = (s) => `\x1b[1m${s}\x1b[0m`;
const cy = (s) => `\x1b[36m${s}\x1b[0m`;

let sql = null;
const cleanupFns = [];

// ── DB (optional) ───────────────────────────────────────────────────────────
async function initDb() {
  if (!DB_URL) return;
  try {
    const mod = await import('postgres');
    sql = mod.default(DB_URL, { max: 1 });
  } catch {
    console.log(y('WARN  DATABASE_URL set but postgres package unavailable — DB assertions skipped'));
  }
}

async function closeDb() {
  if (sql) await sql.end({ timeout: 2 }).catch(() => {});
}

async function withTenantRestore(tenantId, fn) {
  if (!sql || !tenantId) return fn();
  const [before] = await sql`
    select plan, plan_expires_at, plan_renewal_date, razorpay_subscription_id
    from tenants where id = ${tenantId} limit 1
  `;
  try {
    await fn();
  } finally {
    if (before) {
      await sql`
        update tenants
        set plan = ${before.plan},
            plan_expires_at = ${before.plan_expires_at},
            plan_renewal_date = ${before.plan_renewal_date},
            razorpay_subscription_id = ${before.razorpay_subscription_id}
        where id = ${tenantId}
      `.catch(() => {});
    }
  }
}

// ── HTTP helper ─────────────────────────────────────────────────────────────
async function req(urlPath, opts = {}) {
  const { method = 'GET', headers = {}, body } = opts;
  const url = `${BASE_URL}${urlPath}`;
  const res = await fetch(url, { method, headers, body, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (DEBUG) console.log(d(`  [${method}] ${urlPath} → ${res.status}`));
  return { res, text, json };
}

function json(extra = {}) {
  return { 'content-type': 'application/json', ...extra };
}

function apiKey(key = API_KEY) {
  return { 'x-api-key': key };
}

function hmac(body) {
  return crypto.createHmac('sha256', RZ_SECRET).update(body).digest('hex');
}

function uid(prefix = 'qa') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
}

// ── Test runner ─────────────────────────────────────────────────────────────
/**
 * @param {string} category  - test group label
 * @param {string} name      - test name
 * @param {Function} fn      - async test body; throw to fail
 * @param {string|null} skip - if truthy, reason to skip
 * @param {Object} meta      - diagnostic info printed on failure
 *   @param {string} meta.route      - HTTP route under test  e.g. POST /api/webhook/razorpay
 *   @param {string} meta.file       - most likely source file e.g. app/api/webhook/razorpay/route.ts
 *   @param {string} meta.rootCause  - why this likely fails
 *   @param {string} meta.fix        - concrete code change needed
 */
async function test(category, name, fn, skip = null, meta = {}) {
  if (skip) {
    console.log(`${y('SKIP')}  [${category}] ${name} — ${skip}`);
    state.skipped++;
    return;
  }
  try {
    await fn();
    console.log(`${g('PASS')}  [${category}] ${name}`);
    state.passed++;
  } catch (err) {
    console.log(`${r('FAIL')}  [${category}] ${name}`);
    console.log(d(`        Assertion : ${err.message}`));
    if (meta.route)     console.log(d(`        Route     : ${meta.route}`));
    if (meta.file)      console.log(d(`        File      : ${meta.file}`));
    if (meta.rootCause) console.log(d(`        Root cause: ${meta.rootCause}`));
    if (meta.fix)       console.log(d(`        Fix       : ${meta.fix}`));
    failures.push({ category, name, error: err.message, meta });
    state.failed++;
    if (STOP_ON_FAIL) throw err;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

// ── TEST SUITES ─────────────────────────────────────────────────────────────
async function run() {
  await initDb();

  console.log(`\nOnboardFlow Integration Tests`);
  console.log(`Base URL    : ${BASE_URL}`);
  console.log(`API key     : ${API_KEY ? '✓ set' : '✗ missing'}`);
  console.log(`RZ secret   : ${RZ_SECRET ? '✓ set' : '✗ missing'}`);
  console.log(`Cron secret : ${CRON_SECRET ? '✓ set' : '✗ missing'}`);
  console.log(`DB          : ${sql ? '✓ connected' : '✗ skipped'}`);
  console.log('');

  // ── 1. Public auth redirects ──────────────────────────────────────────────
  await test('auth', 'Unauthenticated /dashboard redirects to /login', async () => {
    const { res } = await req('/dashboard');
    assert(isRedirect(res.status), `expected redirect got ${res.status}`);
    assert((res.headers.get('location') || '').includes('/login'), 'expected /login');
  }, null, {
    route: 'GET /dashboard',
    file: 'middleware.ts  OR  app/dashboard/page.tsx',
    rootCause: 'Auth middleware is not protecting /dashboard',
    fix: 'In middleware.ts, add /dashboard to the matcher and redirect to /login when no session cookie is present.',
  });

  await test('auth', 'Unauthenticated /dashboard/individual redirects to /login', async () => {
    const { res } = await req('/dashboard/individual');
    assert(isRedirect(res.status), `expected redirect got ${res.status}`);
    assert((res.headers.get('location') || '').includes('/login'), 'expected /login');
  }, null, {
    route: 'GET /dashboard/individual',
    file: 'middleware.ts  OR  app/dashboard/individual/page.tsx',
    rootCause: 'Auth middleware matcher does not cover /dashboard/individual',
    fix: 'Extend the middleware matcher to cover /dashboard/:path* so all sub-routes are protected.',
  });

  await test('auth', 'Unauthenticated /dashboard/enterprise redirects to /login', async () => {
    const { res } = await req('/dashboard/enterprise');
    assert(isRedirect(res.status), `expected redirect got ${res.status}`);
    assert((res.headers.get('location') || '').includes('/login'), 'expected /login');
  }, null, {
    route: 'GET /dashboard/enterprise',
    file: 'middleware.ts  OR  app/dashboard/enterprise/page.tsx',
    rootCause: 'Auth middleware matcher does not cover /dashboard/enterprise',
    fix: 'Extend the middleware matcher to cover /dashboard/:path* so all sub-routes are protected.',
  });

  await test('auth', 'Login page is publicly accessible', async () => {
    const { res } = await req('/login');
    assert(res.status === 200, `expected 200 got ${res.status}`);
  }, null, {
    route: 'GET /login',
    file: 'app/login/page.tsx  OR  middleware.ts',
    rootCause: 'Either the login page is missing or middleware is blocking it',
    fix: 'Ensure /login is excluded from auth middleware matcher.',
  });

  // ── 2. Enterprise v1 API (x-api-key, no session needed) ──────────────────
  await test('v1/identify', 'Missing API key returns 401', async () => {
    const { res } = await req('/api/v1/identify', {
      method: 'POST', headers: json(), body: JSON.stringify({ email: 'test@x.com' }),
    });
    assert(res.status === 401, `expected 401 got ${res.status}`);
  }, null, {
    route: 'POST /api/v1/identify',
    file: 'app/api/v1/identify/route.ts',
    rootCause: 'Route does not check for x-api-key header when it is absent',
    fix: 'Read request.headers.get("x-api-key") early and return NextResponse.json({error:"Unauthorized"},{status:401}) when missing.',
  });

  await test('v1/identify', 'Invalid API key returns 403', async () => {
    const { res } = await req('/api/v1/identify', {
      method: 'POST',
      headers: json(apiKey('bad_key_xyz')),
      body: JSON.stringify({ email: 'test@x.com' }),
    });
    assert([401, 403].includes(res.status), `expected 401/403 got ${res.status}`);
  }, null, {
    route: 'POST /api/v1/identify',
    file: 'app/api/v1/identify/route.ts',
    rootCause: 'Route does not validate the API key against the tenants table',
    fix: 'Query `SELECT id FROM tenants WHERE api_key = $1` and return 403 when no row is found.',
  });

  await test('v1/identify', 'Missing email field returns 400', async () => {
    const { res } = await req('/api/v1/identify', {
      method: 'POST',
      headers: json(apiKey()),
      body: JSON.stringify({ userId: 'user_123' }),
    });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  }, !API_KEY ? 'TEST_ENTERPRISE_API_KEY missing' : null, {
    route: 'POST /api/v1/identify',
    file: 'app/api/v1/identify/route.ts',
    rootCause: 'Route does not validate that email is present in the request body',
    fix: 'After JSON.parse, check `if (!body.email) return NextResponse.json({error:"email required"},{status:400})`.',
  });

  await test('v1/identify', 'Valid key creates/upserts user', async () => {
    const email = `${uid('identify')}@example.com`;
    const { res, json: j } = await req('/api/v1/identify', {
      method: 'POST',
      headers: json(apiKey()),
      body: JSON.stringify({ email, event: 'signed_up' }),
    });
    assert(res.status === 200, `expected 200 got ${res.status}`);
    assert(j?.success === true, `expected success=true got ${JSON.stringify(j)}`);
  }, !API_KEY ? 'TEST_ENTERPRISE_API_KEY missing' : null, {
    route: 'POST /api/v1/identify',
    file: 'app/api/v1/identify/route.ts',
    rootCause: 'Upsert into end_users table is failing or response shape is wrong',
    fix: 'Use INSERT ... ON CONFLICT (email, tenant_id) DO UPDATE and return NextResponse.json({success:true}).',
  });

  await test('v1/identify', 'Identifying same user twice is idempotent', async () => {
    const email = `${uid('idem')}@example.com`;
    const body = JSON.stringify({ email });
    const r1 = await req('/api/v1/identify', { method: 'POST', headers: json(apiKey()), body });
    const r2 = await req('/api/v1/identify', { method: 'POST', headers: json(apiKey()), body });
    assert(r1.res.status === 200 && r2.res.status === 200, `expected 200/200`);
  }, !API_KEY ? 'TEST_ENTERPRISE_API_KEY missing' : null, {
    route: 'POST /api/v1/identify',
    file: 'app/api/v1/identify/route.ts',
    rootCause: 'Second insert throws a unique constraint error instead of upserting',
    fix: 'Use INSERT ... ON CONFLICT (email, tenant_id) DO UPDATE SET updated_at = now() to make it idempotent.',
  });

  // ── 3. v1/track ───────────────────────────────────────────────────────────
  await test('v1/track', 'Missing stepId returns 400', async () => {
    const { res } = await req('/api/v1/track', {
      method: 'POST',
      headers: json(apiKey()),
      body: JSON.stringify({ userId: 'u1' }),
    });
    assert([400, 401, 403].includes(res.status), `expected 400/401/403 got ${res.status}`);
  }, !API_KEY ? 'TEST_ENTERPRISE_API_KEY missing' : null, {
    route: 'POST /api/v1/track',
    file: 'app/api/v1/track/route.ts',
    rootCause: 'Route does not validate stepId presence before processing',
    fix: 'Add `if (!body.stepId) return NextResponse.json({error:"stepId required"},{status:400})` after parsing body.',
  });

  await test('v1/track', 'Tracking step for known user succeeds', async () => {
    const email = `${uid('track')}@example.com`;
    await req('/api/v1/identify', { method: 'POST', headers: json(apiKey()), body: JSON.stringify({ email }) });
    const { res } = await req('/api/v1/track', {
      method: 'POST',
      headers: json(apiKey()),
      body: JSON.stringify({ userId: email, stepId: 'connect_repo', event: 'connect_repo' }),
    });
    assert(res.status === 200, `expected 200 got ${res.status}`);
  }, !API_KEY ? 'TEST_ENTERPRISE_API_KEY missing' : null, {
    route: 'POST /api/v1/track',
    file: 'app/api/v1/track/route.ts',
    rootCause: 'Step tracking for an existing user fails or returns wrong status',
    fix: 'Upsert into completed_steps array: UPDATE end_users SET completed_steps = array_append(...) WHERE email = $1.',
  });

  await test('v1/track', 'Tracking step for unknown user returns 404', async () => {
    const { res } = await req('/api/v1/track', {
      method: 'POST',
      headers: json(apiKey()),
      body: JSON.stringify({ userId: uid('ghost'), stepId: 'connect_repo', event: 'connect_repo' }),
    });
    assert([404, 403].includes(res.status), `expected 404/403 got ${res.status}`);
  }, !API_KEY ? 'TEST_ENTERPRISE_API_KEY missing' : null, {
    route: 'POST /api/v1/track',
    file: 'app/api/v1/track/route.ts',
    rootCause: 'Route does not check whether the user exists before tracking',
    fix: 'SELECT the user first; if no row, return NextResponse.json({error:"user not found"},{status:404}).',
  });

  await test('v1/track', 'Tracking same step twice is idempotent', async () => {
    const email = `${uid('idem-track')}@example.com`;
    await req('/api/v1/identify', { method: 'POST', headers: json(apiKey()), body: JSON.stringify({ email }) });
    const body = JSON.stringify({ userId: email, stepId: 'connect_repo', event: 'connect_repo' });
    const r1 = await req('/api/v1/track', { method: 'POST', headers: json(apiKey()), body });
    const r2 = await req('/api/v1/track', { method: 'POST', headers: json(apiKey()), body });
    assert(r1.res.status === 200 && r2.res.status === 200, `expected 200/200`);
    if (sql) {
      const email2 = email;
      const rows = await sql`
        select completed_steps from end_users
        where email = ${email2} limit 1
      `;
      const steps = rows[0]?.completed_steps || [];
      const count = steps.filter((s) => s === 'connect_repo').length;
      assert(count === 1, `expected step stored once, got ${count}`);
    }
  }, !API_KEY ? 'TEST_ENTERPRISE_API_KEY missing' : null, {
    route: 'POST /api/v1/track',
    file: 'app/api/v1/track/route.ts',
    rootCause: 'array_append is called unconditionally, causing duplicate entries in completed_steps',
    fix: 'Use `WHERE NOT (completed_steps @> ARRAY[$1])` guard, or check with `if (!steps.includes(stepId))` before appending.',
  });

  // ── 4. Razorpay webhook ───────────────────────────────────────────────────
  await test('webhook', 'Missing signature returns 400', async () => {
    const body = JSON.stringify({ event: 'subscription.activated', payload: {} });
    const { res } = await req('/api/webhook/razorpay', { method: 'POST', headers: json(), body });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  }, null, {
    route: 'POST /api/webhook/razorpay',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'Route does not return 400 when x-razorpay-signature header is absent',
    fix: 'Check `if (!request.headers.get("x-razorpay-signature")) return NextResponse.json({error:"missing sig"},{status:400})`.',
  });

  await test('webhook', 'Wrong signature returns 400', async () => {
    const body = JSON.stringify({ event: 'subscription.activated', payload: {} });
    const { res } = await req('/api/webhook/razorpay', {
      method: 'POST', headers: json({ 'x-razorpay-signature': 'bad' }), body,
    });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  }, null, {
    route: 'POST /api/webhook/razorpay',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'HMAC comparison is not rejecting bad signatures',
    fix: 'Use crypto.timingSafeEqual to compare HMAC-SHA256(secret, rawBody) against the header value; return 400 on mismatch.',
  });

  await test('webhook', 'Missing tenant_id in notes returns 400', async () => {
    const body = JSON.stringify({
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: uid('sub'), notes: { plan_id: 'ent_basic' } } } },
    });
    const { res } = await req('/api/webhook/razorpay', {
      method: 'POST',
      headers: json({ 'x-razorpay-signature': hmac(body) }),
      body,
    });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  }, !RZ_SECRET ? 'RAZORPAY_WEBHOOK_SECRET missing' : null, {
    route: 'POST /api/webhook/razorpay',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'Route does not validate that notes.tenant_id is present',
    fix: 'After parsing payload, check `if (!notes?.tenant_id) return NextResponse.json({error:"missing tenant_id"},{status:400})`.',
  });

  await test('webhook', 'Unknown plan_id returns 400', async () => {
    const body = JSON.stringify({
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: uid('sub'),
            notes: { tenant_id: ENT_TENANT_ID || 'fake-uuid', plan_id: 'does_not_exist' },
          },
        },
      },
    });
    const { res } = await req('/api/webhook/razorpay', {
      method: 'POST',
      headers: json({ 'x-razorpay-signature': hmac(body) }),
      body,
    });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  }, !RZ_SECRET ? 'RAZORPAY_WEBHOOK_SECRET missing' : null, {
    route: 'POST /api/webhook/razorpay',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'Route does not validate plan_id against the known plan list',
    fix: 'Maintain a VALID_PLANS set; return 400 if notes.plan_id is not in it.',
  });

  await test('webhook', 'subscription.activated sets plan + expiry on tenant', async () => {
    if (!ENT_TENANT_ID) throw new Error('TEST_ENTERPRISE_TENANT_ID missing');
    await withTenantRestore(ENT_TENANT_ID, async () => {
      const subId = uid('sub');
      const body = JSON.stringify({
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: subId,
              notes: { tenant_id: ENT_TENANT_ID, plan_id: 'ent_advanced' },
            },
          },
        },
      });
      const { res } = await req('/api/webhook/razorpay', {
        method: 'POST',
        headers: json({ 'x-razorpay-signature': hmac(body) }),
        body,
      });
      assert(res.status === 200, `expected 200 got ${res.status}`);
      if (sql) {
        const [row] = await sql`select plan, plan_expires_at, razorpay_subscription_id from tenants where id = ${ENT_TENANT_ID}`;
        assert(row.plan === 'advanced', `expected advanced got ${row.plan}`);
        assert(row.plan_expires_at, 'plan_expires_at should be set');
        assert(row.razorpay_subscription_id === subId, `expected ${subId} got ${row.razorpay_subscription_id}`);
      }
    });
  }, !RZ_SECRET ? 'RAZORPAY_WEBHOOK_SECRET missing' : null, {
    route: 'POST /api/webhook/razorpay  (event: subscription.activated)',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'UPDATE tenants is not setting plan, plan_expires_at, or razorpay_subscription_id correctly',
    fix: 'UPDATE tenants SET plan=$plan, plan_expires_at=NOW()+INTERVAL\'30 days\', razorpay_subscription_id=$subId WHERE id=$tenantId.',
  });

  await test('webhook', 'subscription.charged renews expiry', async () => {
    if (!ENT_TENANT_ID) throw new Error('TEST_ENTERPRISE_TENANT_ID missing');
    await withTenantRestore(ENT_TENANT_ID, async () => {
      const subId = uid('sub');
      const body = JSON.stringify({
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: subId,
              notes: { tenant_id: ENT_TENANT_ID, plan_id: 'ent_basic' },
            },
          },
        },
      });
      const { res } = await req('/api/webhook/razorpay', {
        method: 'POST',
        headers: json({ 'x-razorpay-signature': hmac(body) }),
        body,
      });
      assert(res.status === 200, `expected 200 got ${res.status}`);
      if (sql) {
        const [row] = await sql`select plan from tenants where id = ${ENT_TENANT_ID}`;
        assert(row.plan === 'basic', `expected basic got ${row.plan}`);
      }
    });
  }, !RZ_SECRET ? 'RAZORPAY_WEBHOOK_SECRET missing' : null, {
    route: 'POST /api/webhook/razorpay  (event: subscription.charged)',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'subscription.charged event handler does not update the plan or renew plan_expires_at',
    fix: 'Handle the "subscription.charged" case the same as "subscription.activated": update plan + expiry.',
  });

  await test('webhook', 'subscription.cancelled nulls subscription id', async () => {
    if (!ENT_TENANT_ID) throw new Error('TEST_ENTERPRISE_TENANT_ID missing');
    await withTenantRestore(ENT_TENANT_ID, async () => {
      if (sql) await sql`update tenants set razorpay_subscription_id = ${uid('preset')} where id = ${ENT_TENANT_ID}`;
      const body = JSON.stringify({
        event: 'subscription.cancelled',
        payload: { subscription: { entity: { notes: { tenant_id: ENT_TENANT_ID } } } },
      });
      const { res } = await req('/api/webhook/razorpay', {
        method: 'POST',
        headers: json({ 'x-razorpay-signature': hmac(body) }),
        body,
      });
      assert(res.status === 200, `expected 200 got ${res.status}`);
      if (sql) {
        const [row] = await sql`select razorpay_subscription_id from tenants where id = ${ENT_TENANT_ID}`;
        assert(row.razorpay_subscription_id == null, `expected null got ${row.razorpay_subscription_id}`);
      }
    });
  }, !RZ_SECRET ? 'RAZORPAY_WEBHOOK_SECRET missing' : null, {
    route: 'POST /api/webhook/razorpay  (event: subscription.cancelled)',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'subscription.cancelled handler does not null out razorpay_subscription_id',
    fix: 'UPDATE tenants SET razorpay_subscription_id = NULL WHERE id = $tenantId on this event.',
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ❌ KNOWN FAILURE
  // Test    : Duplicate event id is idempotent (DB row inserted once)
  // Route   : POST /api/webhook/razorpay  (header: x-razorpay-event-id)
  // File    : app/api/webhook/razorpay/route.ts
  //           lib/db/webhook-events.ts  (or equivalent helper)
  //           SQL migration: processed_webhook_events table
  //
  // Root cause (most likely):
  //   Either (a) the processed_webhook_events table does not have a UNIQUE
  //   constraint on stripe_event_id, so two concurrent inserts both succeed and
  //   the second insert is counted as a new row, OR (b) the deduplication INSERT
  //   throws a unique-constraint error on the second request and the catch block
  //   re-throws it, causing a non-200 response.
  //
  // Fix:
  //   1. Ensure migration: CREATE UNIQUE INDEX ON processed_webhook_events(stripe_event_id)
  //   2. Use INSERT ... ON CONFLICT (stripe_event_id) DO NOTHING
  //   3. If rowCount === 0, it was a duplicate — return 200 early without re-processing
  //
  // Example:
  //   const { rowCount } = await db.query(
  //     `INSERT INTO processed_webhook_events (stripe_event_id) VALUES ($1)
  //      ON CONFLICT (stripe_event_id) DO NOTHING`,
  //     [eventId]
  //   );
  //   if (rowCount === 0) return NextResponse.json({ ok: true, duplicate: true });
  // ─────────────────────────────────────────────────────────────────────────
  await test('webhook', 'Duplicate event id is idempotent (DB row inserted once)', async () => {
    if (!ENT_TENANT_ID) throw new Error('TEST_ENTERPRISE_TENANT_ID required');
    const eventId = uid('qa_dedupe');
    const body = JSON.stringify({
      event: 'subscription.cancelled',
      payload: { subscription: { entity: { notes: { tenant_id: ENT_TENANT_ID } } } },
    });
    const hdrs = json({ 'x-razorpay-signature': hmac(body), 'x-razorpay-event-id': eventId });
    const [r1, r2] = await Promise.all([
      req('/api/webhook/razorpay', { method: 'POST', headers: hdrs, body }),
      req('/api/webhook/razorpay', { method: 'POST', headers: hdrs, body }),
    ]);
    assert(r1.res.status === 200 && r2.res.status === 200, `expected 200/200 got ${r1.res.status}/${r2.res.status}`);
    if (sql) {
      const [{ c }] = await sql`select count(*)::int as c from processed_webhook_events where stripe_event_id = ${eventId}`;
      assert(c === 1, `expected 1 row got ${c}`);
    }
  }, !RZ_SECRET ? 'RAZORPAY_WEBHOOK_SECRET missing' : null, {
    route: 'POST /api/webhook/razorpay  (header: x-razorpay-event-id)',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'Concurrent duplicate event inserts hit a unique constraint and the error is not caught — second request returns non-200',
    fix: 'Use INSERT INTO processed_webhook_events ... ON CONFLICT (stripe_event_id) DO NOTHING; if rowCount===0 return 200 immediately.',
  });

  await test('webhook', 'Unknown event type returns 200 without crash', async () => {
    const body = JSON.stringify({ event: 'some.future.event', payload: {} });
    const { res } = await req('/api/webhook/razorpay', {
      method: 'POST',
      headers: json({ 'x-razorpay-signature': hmac(body) }),
      body,
    });
    assert(res.status === 200, `expected 200 got ${res.status}`);
  }, !RZ_SECRET ? 'RAZORPAY_WEBHOOK_SECRET missing' : null, {
    route: 'POST /api/webhook/razorpay',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'Switch/if-else for event type has no default case and throws on unknown events',
    fix: 'Add a default: return NextResponse.json({ok:true}) at the bottom of the event-type switch.',
  });

  // ── 5. Email tracking endpoints ───────────────────────────────────────────
  await test('tracking', 'Open pixel with missing params returns 1x1 GIF', async () => {
    const { res } = await req('/api/track/open');
    assert(res.status === 200, `expected 200 got ${res.status}`);
    assert(res.headers.get('content-type')?.includes('image/gif'), 'expected image/gif');
  }, null, {
    route: 'GET /api/track/open',
    file: 'app/api/track/open/route.ts',
    rootCause: 'Route returns an error instead of the 1x1 GIF when query params are missing',
    fix: 'Always return the 1×1 GIF buffer with Content-Type: image/gif regardless of params; log/skip DB writes if params are absent.',
  });

  await test('tracking', 'Open pixel with invalid token still returns GIF (never break email)', async () => {
    const { res } = await req('/api/track/open?cid=999&email=x@x.com&token=bad');
    assert(res.status === 200, `expected 200 got ${res.status}`);
    assert(res.headers.get('content-type')?.includes('image/gif'), 'expected image/gif');
  }, null, {
    route: 'GET /api/track/open',
    file: 'app/api/track/open/route.ts',
    rootCause: 'Invalid token causes the route to throw or return non-200 instead of serving the GIF',
    fix: 'Wrap the token-validation/DB-write in try/catch; always respond with the GIF even on error.',
  });

  await test('tracking', 'Click redirect with valid url still redirects', async () => {
    const { res } = await req('/api/track/click?cid=1&email=x@x.com&token=bad&url=https%3A%2F%2Fexample.com');
    assert(isRedirect(res.status), `expected redirect got ${res.status}`);
    const loc = res.headers.get('location') || '';
    assert(loc.includes('example.com'), `expected redirect to destination, got ${loc}`);
  }, null, {
    route: 'GET /api/track/click',
    file: 'app/api/track/click/route.ts',
    rootCause: 'Click handler fails to redirect when the tracking token is invalid',
    fix: 'Extract and validate `url` param first; always redirect to it (NextResponse.redirect) even if token validation fails.',
  });

  await test('tracking', 'Click redirect with missing url param still redirects somewhere', async () => {
    const { res } = await req('/api/track/click?cid=1&email=x@x.com&token=bad');
    assert(isRedirect(res.status), `expected redirect got ${res.status}`);
  }, null, {
    route: 'GET /api/track/click',
    file: 'app/api/track/click/route.ts',
    rootCause: 'Route returns a non-redirect response when the url query param is absent',
    fix: 'Fall back to redirecting to "/" or BASE_URL when url param is missing: NextResponse.redirect(new URL("/", request.url)).',
  });

  // ── 6. Cron ───────────────────────────────────────────────────────────────
  await test('cron', 'Missing secret returns 401', async () => {
    const { res } = await req('/api/cron');
    assert(res.status === 401, `expected 401 got ${res.status}`);
  }, null, {
    route: 'GET /api/cron',
    file: 'app/api/cron/route.ts',
    rootCause: 'Cron route is publicly accessible without an Authorization header',
    fix: 'Check `request.headers.get("authorization")` === `Bearer ${CRON_SECRET}` and return 401 when absent or wrong.',
  });

  await test('cron', 'Wrong secret returns 401', async () => {
    const { res } = await req('/api/cron', { headers: { authorization: 'Bearer wrong_secret' } });
    assert(res.status === 401, `expected 401 got ${res.status}`);
  }, null, {
    route: 'GET /api/cron',
    file: 'app/api/cron/route.ts',
    rootCause: 'Cron route accepts any Bearer token value',
    fix: 'Compare the token with `process.env.CRON_SECRET` using a constant-time comparison.',
  });

  await test('cron', 'Valid secret returns 200', async () => {
    const { res } = await req('/api/cron', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    assert(res.status === 200, `expected 200 got ${res.status}`);
  }, !CRON_SECRET ? 'CRON_SECRET missing' : null, {
    route: 'GET /api/cron',
    file: 'app/api/cron/route.ts',
    rootCause: 'Cron route handler is throwing or not returning 200 on a valid request',
    fix: 'Ensure the handler completes normally and returns NextResponse.json({ok:true},{status:200}).',
  });

  // ── 7. Plan gates (DB-backed) ─────────────────────────────────────────────
  await test('gates', 'Free plan blocks CSV import on individual list', async () => {
    if (!sql || !IND_TENANT_ID) throw new Error('DATABASE_URL + TEST_INDIVIDUAL_TENANT_ID required');
    await withTenantRestore(IND_TENANT_ID, async () => {
      await sql`update tenants set plan='free', plan_expires_at=NULL where id=${IND_TENANT_ID}`;
      const listId = process.env.TEST_INDIVIDUAL_LIST_ID;
      if (!listId) throw new Error('TEST_INDIVIDUAL_LIST_ID required — set an existing list id');
      const boundary = '----testboundary';
      const csvBody = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="c.csv"\r\nContent-Type: text/csv\r\n\r\nname,email\nTest,t@t.com\r\n--${boundary}--\r\n`;
      const { res } = await req(`/api/individual/lists/${listId}/import-csv`, {
        method: 'POST',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body: csvBody,
      });
      assert(res.status === 401 || res.status === 403, `expected 401/403 for free tier got ${res.status}`);
    });
  }, (!sql || !IND_TENANT_ID) ? 'DATABASE_URL + TEST_INDIVIDUAL_TENANT_ID required' : null, {
    route: 'POST /api/individual/lists/:listId/import-csv',
    file: 'app/api/individual/lists/[listId]/import-csv/route.ts',
    rootCause: 'Plan gate is not checking tenant plan before allowing CSV import',
    fix: 'Fetch tenant plan; if plan === "free" or plan_expires_at < NOW(), return 403 before processing the file.',
  });

  await test('gates', 'Expired plan reverts to free behavior', async () => {
    if (!sql || !IND_TENANT_ID) throw new Error('DATABASE_URL + TEST_INDIVIDUAL_TENANT_ID required');
    await withTenantRestore(IND_TENANT_ID, async () => {
      await sql`update tenants set plan='growth', plan_expires_at=NOW() - interval '1 day' where id=${IND_TENANT_ID}`;
      const listId = process.env.TEST_INDIVIDUAL_LIST_ID;
      if (!listId) throw new Error('TEST_INDIVIDUAL_LIST_ID required');
      const boundary = '----testboundary2';
      const csvBody = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="c.csv"\r\nContent-Type: text/csv\r\n\r\nname,email\nTest2,t2@t.com\r\n--${boundary}--\r\n`;
      const { res } = await req(`/api/individual/lists/${listId}/import-csv`, {
        method: 'POST',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body: csvBody,
      });
      assert(res.status === 401 || res.status === 403, `expected auth/plan block got ${res.status}`);
    });
  }, (!sql || !IND_TENANT_ID) ? 'DATABASE_URL + TEST_INDIVIDUAL_TENANT_ID required' : null, {
    route: 'POST /api/individual/lists/:listId/import-csv',
    file: 'app/api/individual/lists/[listId]/import-csv/route.ts',
    rootCause: 'Gate only checks plan name, not whether plan_expires_at is in the past',
    fix: 'Change condition to: `plan === "free" || !plan_expires_at || new Date(plan_expires_at) < new Date()`.',
  });

  await test('gates', 'subscription.activated plan stays active before expiry', async () => {
    if (!sql || !ENT_TENANT_ID) throw new Error('DATABASE_URL + TEST_ENTERPRISE_TENANT_ID required');
    await withTenantRestore(ENT_TENANT_ID, async () => {
      await sql`
        update tenants
        set plan='advanced', plan_expires_at=NOW() + interval '30 days'
        where id=${ENT_TENANT_ID}
      `;
      const [row] = await sql`select plan, plan_expires_at from tenants where id=${ENT_TENANT_ID}`;
      assert(row.plan === 'advanced', `expected advanced got ${row.plan}`);
      assert(new Date(row.plan_expires_at) > new Date(), 'plan_expires_at should be in the future');
    });
  }, (!sql || !ENT_TENANT_ID) ? 'DATABASE_URL + TEST_ENTERPRISE_TENANT_ID required' : null, {
    route: 'DB assertion only (no HTTP request)',
    file: 'db/migrations/…_tenants.sql  OR  app/api/webhook/razorpay/route.ts',
    rootCause: 'plan or plan_expires_at column is not being set/read correctly',
    fix: 'Verify the tenants table has plan VARCHAR and plan_expires_at TIMESTAMPTZ columns and that webhook updates them correctly.',
  });

  // ── 8. Edge / adversarial ─────────────────────────────────────────────────
  await test('edge', 'Malformed JSON does not return 500 on v1/identify', async () => {
    const { res } = await req('/api/v1/identify', {
      method: 'POST',
      headers: json(apiKey(API_KEY || 'bad')),
      body: '{invalid-json',
    });
    assert(res.status !== 500, `expected non-500 got ${res.status}`);
  }, null, {
    route: 'POST /api/v1/identify',
    file: 'app/api/v1/identify/route.ts',
    rootCause: 'JSON.parse(await request.text()) throws on bad input and is not caught',
    fix: 'Wrap the parse in try/catch: try { body = JSON.parse(raw) } catch { return NextResponse.json({error:"invalid JSON"},{status:400}) }',
  });

  await test('edge', 'Malformed JSON does not return 500 on v1/track', async () => {
    const { res } = await req('/api/v1/track', {
      method: 'POST',
      headers: json(apiKey(API_KEY || 'bad')),
      body: '{invalid-json',
    });
    assert(res.status !== 500, `expected non-500 got ${res.status}`);
  }, null, {
    route: 'POST /api/v1/track',
    file: 'app/api/v1/track/route.ts',
    rootCause: 'JSON.parse throws on bad input and is not caught',
    fix: 'Wrap the parse in try/catch and return 400 on failure.',
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ❌ KNOWN FAILURE
  // Test    : Malformed JSON does not return 500 on razorpay webhook
  // Route   : POST /api/webhook/razorpay
  // File    : app/api/webhook/razorpay/route.ts
  //
  // Root cause:
  //   The route reads the raw body for HMAC verification (correct) but then
  //   calls JSON.parse(rawBody) without a try/catch. When the body is not
  //   valid JSON, JSON.parse throws a SyntaxError which is unhandled,
  //   causing Next.js to return 500.
  //
  // Fix (add this immediately after HMAC verification):
  //   let payload;
  //   try {
  //     payload = JSON.parse(rawBody);
  //   } catch {
  //     return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  //   }
  // ─────────────────────────────────────────────────────────────────────────
  await test('edge', 'Malformed JSON does not return 500 on razorpay webhook', async () => {
    const body = '{bad';
    const { res } = await req('/api/webhook/razorpay', {
      method: 'POST',
      headers: json({ 'x-razorpay-signature': hmac(body) }),
      body,
    });
    assert(res.status !== 500, `expected non-500 got ${res.status}`);
  }, !RZ_SECRET ? 'RAZORPAY_WEBHOOK_SECRET missing' : null, {
    route: 'POST /api/webhook/razorpay',
    file: 'app/api/webhook/razorpay/route.ts',
    rootCause: 'JSON.parse(rawBody) is called without try/catch after HMAC verification, throwing SyntaxError → 500',
    fix: 'Wrap JSON.parse in try/catch immediately after HMAC check and return NextResponse.json({error:"invalid JSON"},{status:400}) on failure.',
  });

  await test('edge', 'SQL injection attempt in email field does not crash', async () => {
    const { res } = await req('/api/v1/identify', {
      method: 'POST',
      headers: json(apiKey(API_KEY || 'bad')),
      body: JSON.stringify({ email: "test@x.com' OR 1=1 --" }),
    });
    assert(res.status !== 500, `expected non-500 got ${res.status}`);
  }, null, {
    route: 'POST /api/v1/identify',
    file: 'app/api/v1/identify/route.ts',
    rootCause: 'SQL is being constructed with string concatenation instead of parameterized queries',
    fix: 'Always use parameterized queries: db.query("SELECT … WHERE email = $1", [email]). Never interpolate user input into SQL strings.',
  });

  await test('edge', 'Extremely long email string is rejected gracefully', async () => {
    const { res } = await req('/api/v1/identify', {
      method: 'POST',
      headers: json(apiKey(API_KEY || 'bad')),
      body: JSON.stringify({ email: 'a'.repeat(5000) + '@x.com' }),
    });
    assert(res.status !== 500, `expected non-500 got ${res.status}`);
  }, null, {
    route: 'POST /api/v1/identify',
    file: 'app/api/v1/identify/route.ts',
    rootCause: 'No length validation on the email field before attempting to insert into DB',
    fix: 'Add `if (email.length > 254) return NextResponse.json({error:"email too long"},{status:400})` before DB operations.',
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ❌ KNOWN FAILURE
  // Test    : Rate limiter triggers 429 under burst on v1/track
  // Route   : POST /api/v1/track
  // File    : app/api/v1/track/route.ts
  //           middleware.ts  (or a dedicated rate-limit helper)
  //
  // Root cause:
  //   No rate limiting exists on this route. 80 concurrent requests from
  //   different IPs all complete with 200.
  //
  // Fix — choose one approach:
  //
  //   Option A — in-process (no Redis, good for single instance):
  //     import { LRUCache } from 'lru-cache';
  //     const rateLimit = new LRUCache<string, number>({ max: 500, ttl: 60_000 });
  //     // At the top of the route handler:
  //     const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  //     const hits = (rateLimit.get(ip) ?? 0) + 1;
  //     rateLimit.set(ip, hits);
  //     if (hits > 20) return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  //
  //   Option B — Upstash Redis + @upstash/ratelimit (production-grade):
  //     import { Ratelimit } from '@upstash/ratelimit';
  //     import { Redis } from '@upstash/redis';
  //     const ratelimit = new Ratelimit({ redis: Redis.fromEnv(),
  //       limiter: Ratelimit.slidingWindow(20, '60s') });
  //     const { success } = await ratelimit.limit(ip);
  //     if (!success) return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  //
  //   Option C — Next.js middleware (apply before the route):
  //     Add rate-limit logic in middleware.ts for the /api/v1 matcher.
  // ─────────────────────────────────────────────────────────────────────────
  await test('edge', 'Rate limiter triggers 429 under burst on v1/track', async () => {
    let got429 = false;
    const promises = Array.from({ length: 80 }, (_, i) =>
      req('/api/v1/track', {
        method: 'POST',
        headers: json({ ...apiKey(API_KEY || 'bad'), 'x-forwarded-for': `10.0.0.${i % 255}` }),
        body: JSON.stringify({ userId: `rl-${i}`, stepId: 'step', event: 'step' }),
      })
    );
    const results = await Promise.all(promises);
    got429 = results.some((r) => r.res.status === 429);
    assert(got429, 'expected at least one 429 under burst load — no rate limiting is implemented');
  }, null, {
    route: 'POST /api/v1/track',
    file: 'app/api/v1/track/route.ts  OR  middleware.ts',
    rootCause: 'No rate limiting is implemented on this route; all 80 burst requests return 200',
    fix: 'Add per-IP sliding-window rate limiting (e.g. lru-cache in-process or @upstash/ratelimit). Return 429 after ~20 req/min per IP. See comment block above this test for full code examples.',
  });

  await test('edge', 'v1/analytics-data requires session cookie, not API key', async () => {
    const { res } = await req('/api/v1/analytics-data', { headers: apiKey() });
    assert(res.status === 401, `expected 401 without session got ${res.status}`);
  }, !API_KEY ? 'TEST_ENTERPRISE_API_KEY missing' : null, {
    route: 'GET /api/v1/analytics-data',
    file: 'app/api/v1/analytics-data/route.ts',
    rootCause: 'Route accepts an API key as auth instead of requiring a session cookie',
    fix: 'Remove API-key auth from this route; use getServerSession() (NextAuth) or equivalent and return 401 when no session.',
  });

  await test('edge', 'POST to GET-only endpoint returns 405', async () => {
    const { res } = await req('/api/track/open', { method: 'POST' });
    assert(res.status === 405, `expected 405 got ${res.status}`);
  }, null, {
    route: 'POST /api/track/open  (should be GET only)',
    file: 'app/api/track/open/route.ts',
    rootCause: 'Route exports a POST handler (or a catch-all) when it should only export GET',
    fix: 'Remove any `export async function POST` from this file. Next.js returns 405 automatically when only GET is exported.',
  });

  // ── 9. Subscription create requires auth ──────────────────────────────────
  await test('billing', 'Create subscription without session returns redirect/401', async () => {
    const { res } = await req('/api/razorpay/create-subscription', {
      method: 'POST',
      headers: json(),
      body: JSON.stringify({ planId: 'ind_starter' }),
    });
    assert(isRedirect(res.status) || res.status === 401, `expected redirect or 401 got ${res.status}`);
  }, null, {
    route: 'POST /api/razorpay/create-subscription',
    file: 'app/api/razorpay/create-subscription/route.ts',
    rootCause: 'Route does not validate session before creating a Razorpay subscription',
    fix: 'Call getServerSession() at the top; if no session, return 401 or redirect to /login.',
  });

  await test('billing', 'Cancel subscription without session returns redirect/401', async () => {
    const { res } = await req('/api/razorpay/cancel-subscription', {
      method: 'POST',
      headers: json(),
      body: JSON.stringify({ subscriptionId: 'sub_test' }),
    });
    assert(isRedirect(res.status) || res.status === 401, `expected redirect or 401 got ${res.status}`);
  }, null, {
    route: 'POST /api/razorpay/cancel-subscription',
    file: 'app/api/razorpay/cancel-subscription/route.ts',
    rootCause: 'Route does not validate session before cancelling a subscription',
    fix: 'Call getServerSession() at the top; if no session, return 401 or redirect to /login.',
  });

  // ── 10. Individual contacts: import/notes/tags endpoints ─────────────────
  await test('individual', 'POST /api/individual/contacts/import without session returns 401', async () => {
    const fd = new FormData();
    fd.append('file', new Blob(['name,email\nA,a@example.com'], { type: 'text/csv' }), 'contacts.csv');
    fd.append('listId', String(process.env.TEST_INDIVIDUAL_LIST_ID || 1));
    const { res } = await req('/api/individual/contacts/import', { method: 'POST', body: fd });
    assert(res.status === 401, `expected 401 got ${res.status}`);
  }, null, {
    route: 'POST /api/individual/contacts/import',
    file: 'app/api/individual/contacts/import/route.ts',
    rootCause: 'Route does not enforce Supabase user auth before processing multipart body',
    fix: 'Apply createClient().auth.getUser() gate at top and return 401 when no user.',
  });

  await test('individual', 'Notes GET/POST/PATCH/DELETE without session return 401', async () => {
    const id = Number(process.env.TEST_INDIVIDUAL_CONTACT_ID || 1);
    const getRes = await req(`/api/individual/contacts/${id}/notes`);
    const postRes = await req(`/api/individual/contacts/${id}/notes`, {
      method: 'POST', headers: json(), body: JSON.stringify({ body: 'test note' }),
    });
    const patchRes = await req(`/api/individual/contacts/${id}/notes`, {
      method: 'PATCH', headers: json(), body: JSON.stringify({ noteId: 1, body: 'updated' }),
    });
    const deleteRes = await req(`/api/individual/contacts/${id}/notes`, {
      method: 'DELETE', headers: json(), body: JSON.stringify({ noteId: 1 }),
    });
    assert(getRes.res.status === 401, `GET expected 401 got ${getRes.res.status}`);
    assert(postRes.res.status === 401, `POST expected 401 got ${postRes.res.status}`);
    assert(patchRes.res.status === 401, `PATCH expected 401 got ${patchRes.res.status}`);
    assert(deleteRes.res.status === 401, `DELETE expected 401 got ${deleteRes.res.status}`);
  }, null, {
    route: 'GET/POST/PATCH/DELETE /api/individual/contacts/[id]/notes',
    file: 'app/api/individual/contacts/[id]/notes/route.ts',
    rootCause: 'One or more handlers skip user auth gate',
    fix: 'Apply the exact Supabase getUser + tenant lookup pattern at top of each handler.',
  });

  await test('individual', 'Tags endpoints without session return 401', async () => {
    const id = Number(process.env.TEST_INDIVIDUAL_CONTACT_ID || 1);
    const tagsGet = await req('/api/individual/tags');
    const tagsPost = await req('/api/individual/tags', {
      method: 'POST', headers: json(), body: JSON.stringify({ name: 'VIP', color: '#6366f1' }),
    });
    const assignPost = await req(`/api/individual/contacts/${id}/tags`, {
      method: 'POST', headers: json(), body: JSON.stringify({ tagId: 1 }),
    });
    const assignDelete = await req(`/api/individual/contacts/${id}/tags`, {
      method: 'DELETE', headers: json(), body: JSON.stringify({ tagId: 1 }),
    });

    assert(tagsGet.res.status === 401, `GET tags expected 401 got ${tagsGet.res.status}`);
    assert(tagsPost.res.status === 401, `POST tags expected 401 got ${tagsPost.res.status}`);
    assert(assignPost.res.status === 401, `POST assign expected 401 got ${assignPost.res.status}`);
    assert(assignDelete.res.status === 401, `DELETE assign expected 401 got ${assignDelete.res.status}`);
  }, null, {
    route: 'GET/POST /api/individual/tags and POST/DELETE /api/individual/contacts/[id]/tags',
    file: 'app/api/individual/tags/route.ts and app/api/individual/contacts/[id]/tags/route.ts',
    rootCause: 'One or more tag handlers skip user auth gate',
    fix: 'Apply the exact Supabase getUser + tenant lookup pattern at top of each handler.',
  });

  await test('individual', 'DB has contact_notes/contact_tags/contact_tag_assignments tables + required columns', async () => {
    if (!sql) throw new Error('DATABASE_URL missing for DB assertions');

    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema='public'
        and table_name in ('contact_notes','contact_tags','contact_tag_assignments')
    `;
    const names = tables.map((t) => t.table_name);
    assert(names.includes('contact_notes'), 'missing table contact_notes');
    assert(names.includes('contact_tags'), 'missing table contact_tags');
    assert(names.includes('contact_tag_assignments'), 'missing table contact_tag_assignments');

    const columns = await sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema='public'
        and (
          (table_name='individual_contacts' and column_name in ('custom_fields','phone','follow_up_at','follow_up_note','follow_up_sent','pipeline_stage')) or
          (table_name='tenants' and column_name='whatsapp_template')
        )
    `;
    const has = (table, col) => columns.some((r) => r.table_name === table && r.column_name === col);
    assert(has('individual_contacts', 'custom_fields'), 'missing individual_contacts.custom_fields');
    assert(has('individual_contacts', 'phone'), 'missing individual_contacts.phone');
    assert(has('individual_contacts', 'follow_up_at'), 'missing individual_contacts.follow_up_at');
    assert(has('individual_contacts', 'follow_up_note'), 'missing individual_contacts.follow_up_note');
    assert(has('individual_contacts', 'follow_up_sent'), 'missing individual_contacts.follow_up_sent');
    assert(has('individual_contacts', 'pipeline_stage'), 'missing individual_contacts.pipeline_stage');
    assert(has('tenants', 'whatsapp_template'), 'missing tenants.whatsapp_template');
  }, !DB_URL ? 'DATABASE_URL missing' : null, {
    route: 'DB schema assertion',
    file: 'db/schema.ts and Supabase migrations',
    rootCause: 'Migrations were not applied or schema.ts is out of sync with live DB',
    fix: 'Run the Prompt 1 SQL statements in order, then verify db/schema.ts definitions match exactly.',
  });

  await test('individual', 'Timeline endpoint without session returns 401', async () => {
    const id = Number(process.env.TEST_INDIVIDUAL_CONTACT_ID || 1);
    const { res } = await req(`/api/individual/contacts/${id}/timeline`);
    assert(res.status === 401, `expected 401 got ${res.status}`);
  }, null, {
    route: 'GET /api/individual/contacts/[id]/timeline',
    file: 'app/api/individual/contacts/[id]/timeline/route.ts',
    rootCause: 'Timeline route is missing mandatory auth gate',
    fix: 'Apply the exact Supabase getUser + tenant lookup pattern before reading params or DB.',
  });

  await test('individual', 'Engagement endpoint without session returns 401', async () => {
    const id = Number(process.env.TEST_INDIVIDUAL_CONTACT_ID || 1);
    const { res } = await req(`/api/individual/contacts/${id}/engagement`);
    assert(res.status === 401, `expected 401 got ${res.status}`);
  }, null, {
    route: 'GET /api/individual/contacts/[id]/engagement',
    file: 'app/api/individual/contacts/[id]/engagement/route.ts',
    rootCause: 'Engagement route is missing mandatory auth gate',
    fix: 'Apply the exact Supabase getUser + tenant lookup pattern before reading params or DB.',
  });

  await test('individual', 'Reminder endpoint without session returns 401 for POST/DELETE', async () => {
    const id = Number(process.env.TEST_INDIVIDUAL_CONTACT_ID || 1);
    const postRes = await req(`/api/individual/contacts/${id}/reminder`, {
      method: 'POST',
      headers: json(),
      body: JSON.stringify({ followUpAt: '2099-01-01T09:00:00.000Z', followUpNote: 'test' }),
    });
    const deleteRes = await req(`/api/individual/contacts/${id}/reminder`, {
      method: 'DELETE',
      headers: json(),
    });
    assert(postRes.res.status === 401, `POST expected 401 got ${postRes.res.status}`);
    assert(deleteRes.res.status === 401, `DELETE expected 401 got ${deleteRes.res.status}`);
  }, null, {
    route: 'POST/DELETE /api/individual/contacts/[id]/reminder',
    file: 'app/api/individual/contacts/[id]/reminder/route.ts',
    rootCause: 'Reminder handlers skip mandatory auth pattern',
    fix: 'Apply the exact Supabase getUser + tenant lookup pattern at top of both handlers.',
  });

  await test('tracking', 'Pixel route always returns GIF', async () => {
    const { res, text } = await req('/api/track/pixel');
    assert(res.status === 200, `expected 200 got ${res.status}`);
    assert((res.headers.get('content-type') || '').includes('image/gif'), `expected image/gif got ${res.headers.get('content-type')}`);
    assert(text.length > 0, 'expected non-empty gif body');
  }, null, {
    route: 'GET /api/track/pixel',
    file: 'app/api/track/pixel/route.ts',
    rootCause: 'Route may be returning JSON or requiring auth instead of binary gif response',
    fix: 'Always return the 1x1 gif Response regardless of missing/invalid query params.',
  });

  await test('tracking', 'Click route rejects non-http URLs with 400', async () => {
    const { res } = await req('/api/track/click?url=javascript%3Aalert(1)');
    assert(res.status === 400, `expected 400 got ${res.status}`);
  }, null, {
    route: 'GET /api/track/click?url=<value>',
    file: 'app/api/track/click/route.ts',
    rootCause: 'Open redirect protection is missing or incomplete',
    fix: 'Validate decoded URL starts with http:// or https:// before redirecting.',
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  for (const fn of cleanupFns) {
    try { await fn(); } catch {}
  }
  await closeDb();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Results: ${g(state.passed + ' passed')}  ${r(state.failed + ' failed')}  ${y(state.skipped + ' skipped')}`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('');
    console.log(b(r('── FAILURES DIGEST (paste this to an AI for instant diagnosis) ─────────────')));
    failures.forEach((f, i) => {
      console.log('');
      console.log(r(`  ${i + 1}. [${f.category}] ${f.name}`));
      console.log(`     ${cy('Assertion')} : ${f.error}`);
      if (f.meta.route)      console.log(`     ${cy('Route')}     : ${f.meta.route}`);
      if (f.meta.file)       console.log(`     ${cy('File')}      : ${f.meta.file}`);
      if (f.meta.rootCause)  console.log(`     ${cy('Root cause')}: ${f.meta.rootCause}`);
      if (f.meta.fix)        console.log(`     ${cy('Fix')}       : ${f.meta.fix}`);
    });
    console.log('');
    console.log('─────────────────────────────────────────────────────────────────────────────');
  }

  process.exit(state.failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error('Fatal:', err?.message || err);
  await closeDb();
  process.exit(1);
});
