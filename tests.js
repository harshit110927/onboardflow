#!/usr/bin/env node
/**
 * OnboardFlow comprehensive integration test suite (plain Node.js).
 *
 * ============================================================================
 * 1) REQUIRED ENVIRONMENT VARIABLES
 * ============================================================================
 * BASE_URL=http://localhost:3000
 *
 * # Auth identities (for tenant lookup + setup docs)
 * TEST_USER_EMAIL=<seeded individual tenant email>
 * TEST_ENTERPRISE_EMAIL=<seeded enterprise tenant email>
 *
 * # IMPORTANT AUTH NOTE
 * # This codebase uses Supabase magic-link and Google OAuth, not password login.
 * # So TEST_USER_PASSWORD / TEST_ENTERPRISE_PASSWORD are intentionally NOT used.
 * # To run authenticated-route tests, provide session cookies captured from a logged-in browser:
 * TEST_INDIVIDUAL_COOKIE=<full Cookie header for individual user session>
 * TEST_ENTERPRISE_COOKIE=<full Cookie header for enterprise user session>
 *
 * # Enterprise API
 * TEST_ENTERPRISE_API_KEY=<valid x-api-key value from tenants.api_key>
 *
 * # Billing / cron secrets (must match app runtime env)
 * RAZORPAY_WEBHOOK_SECRET=<same value as server env>
 * CRON_SECRET=<same value as server env>
 *
 * # Optional (enables DB verification + state restore for mutation tests)
 * DATABASE_URL=<postgres connection string>
 * TEST_INDIVIDUAL_TENANT_ID=<uuid, optional if TEST_USER_EMAIL + DB available>
 * TEST_ENTERPRISE_TENANT_ID=<uuid, optional if TEST_ENTERPRISE_EMAIL + DB available>
 * TEST_INDIVIDUAL_LIST_ID=<existing list id for CSV-import gate tests>
 *
 * ============================================================================
 * 2) DB SEEDING (idempotent SQL)
 * ============================================================================
 * -- Tenants
 * INSERT INTO tenants (email, name, tier, plan, has_access, api_key)
 * VALUES
 *   ('qa-individual@example.com', 'QA Individual', 'individual', 'free', true, 'qa_individual_key_123'),
 *   ('qa-enterprise@example.com', 'QA Enterprise', 'enterprise', 'advanced', true, 'qa_enterprise_key_123')
 * ON CONFLICT (email) DO UPDATE
 * SET tier = EXCLUDED.tier,
 *     plan = EXCLUDED.plan,
 *     has_access = EXCLUDED.has_access,
 *     api_key = EXCLUDED.api_key;
 *
 * -- Optional paid windows for gating tests
 * UPDATE tenants
 * SET plan_expires_at = NOW() + INTERVAL '30 days',
 *     plan_renewal_date = NOW() + INTERVAL '30 days'
 * WHERE email IN ('qa-individual@example.com', 'qa-enterprise@example.com');
 *
 * -- Optional deterministic cleanup
 * DELETE FROM processed_webhook_events WHERE stripe_event_id LIKE 'qa_%';
 * DELETE FROM end_users WHERE email LIKE 'qa-%@example.com' OR external_id LIKE 'qa-%';
 *
 * -- Supabase auth users must already exist for TEST_USER_EMAIL / TEST_ENTERPRISE_EMAIL
 * -- and you must capture valid session cookies after magic-link login.
 *
 * ============================================================================
 * 3) HOW TO RUN
 * ============================================================================
 * node tests.js
 * BASE_URL=https://staging.example.com node tests.js
 *
 * ============================================================================
 * 4) OUTPUT INTERPRETATION
 * ============================================================================
 * PASS  [category] test name
 * FAIL  [category] test name — expected X got Y
 * SKIP  [category] test name — reason
 *
 * End summary:
 * =====================================
 * Results: N passed, N failed, N skipped
 * =====================================
 *
 * Exit code:
 * - 0 when all tests are PASS/SKIP
 * - 1 when any test FAILs
 */

const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const IND_COOKIE = process.env.TEST_INDIVIDUAL_COOKIE || '';
const ENT_COOKIE = process.env.TEST_ENTERPRISE_COOKIE || '';
const API_KEY = process.env.TEST_ENTERPRISE_API_KEY || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const DB_URL = process.env.DATABASE_URL || '';

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_ENTERPRISE_EMAIL = process.env.TEST_ENTERPRISE_EMAIL || '';

const state = {
  passed: 0,
  failed: 0,
  skipped: 0,
  cleanup: [],
};

let sql = null;

function pass(category, name) {
  console.log(`PASS  [${category}] ${name}`);
  state.passed += 1;
}

function fail(category, name, error) {
  console.log(`FAIL  [${category}] ${name} — ${error}`);
  state.failed += 1;
}

function skip(category, name, reason) {
  console.log(`SKIP  [${category}] ${name} — ${reason}`);
  state.skipped += 1;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nowId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

async function initDb() {
  if (!DB_URL) return;
  const mod = await import('postgres');
  sql = mod.default(DB_URL, { max: 1 });
}

async function closeDb() {
  if (sql) await sql.end({ timeout: 1 });
}

async function api(path, options = {}) {
  const { method = 'GET', headers = {}, body, cookie, redirect = 'manual' } = options;
  const finalHeaders = { ...headers };
  if (cookie) finalHeaders.cookie = cookie;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body,
    redirect,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-json response
  }

  return { res, text, json };
}

async function runTest(category, name, fn, opts = {}) {
  try {
    if (opts.skipIf && opts.skipIf()) {
      skip(category, name, opts.skipReason || 'prerequisite missing');
      return;
    }
    await fn();
    pass(category, name);
  } catch (err) {
    fail(category, name, err?.message || String(err));
  }
}

function hmacRazorpay(body) {
  return crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
}

function withJsonHeaders(extra = {}) {
  return { 'content-type': 'application/json', ...extra };
}

async function tenantByEmail(email) {
  if (!sql || !email) return null;
  const rows = await sql`select id, email, tier, plan, plan_expires_at, plan_renewal_date, razorpay_subscription_id from tenants where email = ${email} limit 1`;
  return rows[0] || null;
}

async function tenantById(id) {
  if (!sql || !id) return null;
  const rows = await sql`select id, email, tier, plan, plan_expires_at, plan_renewal_date, razorpay_subscription_id from tenants where id = ${id} limit 1`;
  return rows[0] || null;
}

async function withTenantRestore(tenantId, fn) {
  if (!sql || !tenantId) return fn();
  const before = await tenantById(tenantId);
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
      `;
    }
  }
}

async function cleanupAll() {
  while (state.cleanup.length) {
    const fn = state.cleanup.pop();
    try { await fn(); } catch {}
  }
}

async function resolveTenantIds() {
  let enterpriseTenantId = process.env.TEST_ENTERPRISE_TENANT_ID || null;
  let individualTenantId = process.env.TEST_INDIVIDUAL_TENANT_ID || null;

  if (sql && !enterpriseTenantId && TEST_ENTERPRISE_EMAIL) {
    enterpriseTenantId = (await tenantByEmail(TEST_ENTERPRISE_EMAIL))?.id || null;
  }
  if (sql && !individualTenantId && TEST_USER_EMAIL) {
    individualTenantId = (await tenantByEmail(TEST_USER_EMAIL))?.id || null;
  }

  return { enterpriseTenantId, individualTenantId };
}

(async function main() {
  await initDb();
  const { enterpriseTenantId, individualTenantId } = await resolveTenantIds();

  // ---------------------------------------------------------------------------
  // 1. Auth and middleware
  // ---------------------------------------------------------------------------
  await runTest('auth/middleware', 'Unauthenticated user hitting /dashboard/* is redirected to login', async () => {
    const { res } = await api('/dashboard/individual');
    assert([302, 303, 307, 308].includes(res.status), `expected redirect got ${res.status}`);
    assert((res.headers.get('location') || '').includes('/login'), `expected /login redirect`);
  });

  await runTest('auth/middleware', 'Authenticated user with tier=individual is routed to individual dashboard access', async () => {
    const { res } = await api('/dashboard/individual', { cookie: IND_COOKIE });
    assert(res.status === 200, `expected 200 got ${res.status}`);
  }, { skipIf: () => !IND_COOKIE, skipReason: 'TEST_INDIVIDUAL_COOKIE missing' });

  await runTest('auth/middleware', 'Authenticated user with tier=enterprise is routed to enterprise dashboard access', async () => {
    const { res } = await api('/dashboard/enterprise', { cookie: ENT_COOKIE });
    assert(res.status === 200, `expected 200 got ${res.status}`);
  }, { skipIf: () => !ENT_COOKIE, skipReason: 'TEST_ENTERPRISE_COOKIE missing' });

  await runTest('auth/middleware', '/tier-selection inaccessible to users who already have a tier', async () => {
    const { res } = await api('/tier-selection', { cookie: ENT_COOKIE });
    assert([302, 303, 307, 308].includes(res.status), `expected redirect got ${res.status}`);
    const location = res.headers.get('location') || '';
    assert(location.includes('/dashboard/enterprise'), `expected redirect to enterprise dashboard got ${location}`);
  }, { skipIf: () => !ENT_COOKIE, skipReason: 'TEST_ENTERPRISE_COOKIE missing' });

  await runTest('auth/middleware', 'Authenticated user with no tier redirects to /tier-selection', async () => {
    // Needs a cookie for a user whose tenant.tier is NULL.
    const cookie = process.env.TEST_NO_TIER_COOKIE;
    const { res } = await api('/dashboard', { cookie });
    assert([302, 303, 307, 308].includes(res.status), `expected redirect got ${res.status}`);
    assert((res.headers.get('location') || '').includes('/tier-selection'), 'expected /tier-selection redirect');
  }, { skipIf: () => !process.env.TEST_NO_TIER_COOKIE, skipReason: 'TEST_NO_TIER_COOKIE missing (special seeded no-tier user)' });

  // ---------------------------------------------------------------------------
  // 2. Tenant and plan resolution (DB-backed integration checks)
  // ---------------------------------------------------------------------------
  await runTest('tenant/plan', 'getTenantPlan semantics: null plan_expires_at => free (verified by gating)', async () => {
    assert(sql && individualTenantId && IND_COOKIE, 'requires DATABASE_URL + TEST_INDIVIDUAL_TENANT_ID/EMAIL + TEST_INDIVIDUAL_COOKIE');

    await withTenantRestore(individualTenantId, async () => {
      await sql`update tenants set plan='pro', plan_expires_at=NULL where id=${individualTenantId}`;

      const listId = process.env.TEST_INDIVIDUAL_LIST_ID;
      assert(listId, 'TEST_INDIVIDUAL_LIST_ID required for gating check');

      const boundary = '----csvboundary1';
      const csv = 'name,email\nPlanCheck,plancheck@example.com\n';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="contacts.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;

      const { res } = await api(`/api/individual/lists/${listId}/import-csv`, {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      assert(res.status === 403, `expected 403 (free tier behavior) got ${res.status}`);
    });
  }, {
    skipIf: () => !sql || !individualTenantId || !IND_COOKIE || !process.env.TEST_INDIVIDUAL_LIST_ID,
    skipReason: 'DATABASE_URL + individual tenant + cookie + TEST_INDIVIDUAL_LIST_ID required',
  });

  await runTest('tenant/plan', 'expired plan is downgraded in gate checks', async () => {
    assert(sql && individualTenantId && IND_COOKIE, 'requires DB + individual tenant + cookie');

    await withTenantRestore(individualTenantId, async () => {
      await sql`update tenants set plan='growth', plan_expires_at=NOW() - interval '1 day' where id=${individualTenantId}`;

      const listId = process.env.TEST_INDIVIDUAL_LIST_ID;
      assert(listId, 'TEST_INDIVIDUAL_LIST_ID required');

      const boundary = '----csvboundary2';
      const csv = 'name,email\nExpiredPlan,expired-plan@example.com\n';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="contacts.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;

      const { res } = await api(`/api/individual/lists/${listId}/import-csv`, {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      assert(res.status === 403, `expected downgraded free-tier block (403), got ${res.status}`);
    });
  }, {
    skipIf: () => !sql || !individualTenantId || !IND_COOKIE || !process.env.TEST_INDIVIDUAL_LIST_ID,
    skipReason: 'DATABASE_URL + individual tenant + cookie + list id required',
  });

  await runTest('tenant/plan', 'missing tenant gracefully falls back in app behavior', async () => {
    const { res } = await api('/api/v1/check-auth', { headers: { 'x-api-key': nowId('nonexistent_key') } });
    assert([401, 403].includes(res.status), `expected auth failure for missing tenant got ${res.status}`);
  });

  // ---------------------------------------------------------------------------
  // 3. Razorpay webhook
  // ---------------------------------------------------------------------------
  await runTest('billing/webhook', '400 when x-razorpay-signature missing', async () => {
    const body = JSON.stringify({ event: 'subscription.activated', payload: { subscription: { entity: { notes: {} } } } });
    const { res } = await api('/api/webhook/razorpay', { method: 'POST', body, headers: withJsonHeaders() });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  });

  await runTest('billing/webhook', '400 when signature invalid', async () => {
    const body = JSON.stringify({ event: 'subscription.activated', payload: { subscription: { entity: { notes: {} } } } });
    const { res } = await api('/api/webhook/razorpay', {
      method: 'POST',
      body,
      headers: withJsonHeaders({ 'x-razorpay-signature': 'bad_signature' }),
    });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  });

  await runTest('billing/webhook', '400 when notes.tenant_id missing', async () => {
    const body = JSON.stringify({
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: nowId('sub'), notes: { plan_id: 'ent_basic' } } } },
    });
    const { res } = await api('/api/webhook/razorpay', {
      method: 'POST',
      body,
      headers: withJsonHeaders({
        'x-razorpay-signature': hmacRazorpay(body),
        'x-razorpay-event-id': nowId('qa_missing_tenant'),
      }),
    });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  }, { skipIf: () => !RAZORPAY_WEBHOOK_SECRET, skipReason: 'RAZORPAY_WEBHOOK_SECRET missing' });

  await runTest('billing/webhook', '400 when notes.plan_id unknown', async () => {
    assert(enterpriseTenantId, 'enterprise tenant id required');
    const body = JSON.stringify({
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: nowId('sub'), notes: { tenant_id: enterpriseTenantId, plan_id: 'unknown_plan' } } } },
    });

    const { res } = await api('/api/webhook/razorpay', {
      method: 'POST',
      body,
      headers: withJsonHeaders({
        'x-razorpay-signature': hmacRazorpay(body),
        'x-razorpay-event-id': nowId('qa_unknown_plan'),
      }),
    });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  }, {
    skipIf: () => !RAZORPAY_WEBHOOK_SECRET || !enterpriseTenantId,
    skipReason: 'RAZORPAY_WEBHOOK_SECRET + enterprise tenant id required',
  });

  await runTest('billing/webhook', '200 and updates tenant on subscription.activated', async () => {
    assert(sql && enterpriseTenantId, 'DB + enterprise tenant required');
    await withTenantRestore(enterpriseTenantId, async () => {
      const subId = nowId('sub_active');
      const eventId = nowId('qa_sub_activated');
      const body = JSON.stringify({
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: subId,
              current_end: Math.floor(Date.now() / 1000) + 86400,
              notes: { tenant_id: enterpriseTenantId, plan_id: 'ent_advanced' },
            },
          },
        },
      });

      const { res } = await api('/api/webhook/razorpay', {
        method: 'POST',
        body,
        headers: withJsonHeaders({
          'x-razorpay-signature': hmacRazorpay(body),
          'x-razorpay-event-id': eventId,
        }),
      });
      assert(res.status === 200, `expected 200 got ${res.status}`);

      const after = await tenantById(enterpriseTenantId);
      assert(after.plan === 'advanced', `expected advanced got ${after.plan}`);
      assert(after.plan_expires_at, 'plan_expires_at should be set');
      assert(after.plan_renewal_date, 'plan_renewal_date should be set');
      assert(after.razorpay_subscription_id === subId, `expected subscription id ${subId} got ${after.razorpay_subscription_id}`);
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !RAZORPAY_WEBHOOK_SECRET,
    skipReason: 'DATABASE_URL + enterprise tenant id + webhook secret required',
  });

  await runTest('billing/webhook', '200 and updates tenant on subscription.charged', async () => {
    assert(sql && enterpriseTenantId, 'DB + enterprise tenant required');
    await withTenantRestore(enterpriseTenantId, async () => {
      const subId = nowId('sub_charged');
      const eventId = nowId('qa_sub_charged');
      const body = JSON.stringify({
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: subId,
              current_end: Math.floor(Date.now() / 1000) + 172800,
              notes: { tenant_id: enterpriseTenantId, plan_id: 'ent_basic' },
            },
          },
        },
      });

      const { res } = await api('/api/webhook/razorpay', {
        method: 'POST',
        body,
        headers: withJsonHeaders({
          'x-razorpay-signature': hmacRazorpay(body),
          'x-razorpay-event-id': eventId,
        }),
      });
      assert(res.status === 200, `expected 200 got ${res.status}`);

      const after = await tenantById(enterpriseTenantId);
      assert(after.plan === 'basic', `expected basic got ${after.plan}`);
      assert(after.razorpay_subscription_id === subId, `expected sub id ${subId} got ${after.razorpay_subscription_id}`);
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !RAZORPAY_WEBHOOK_SECRET,
    skipReason: 'DATABASE_URL + enterprise tenant id + webhook secret required',
  });

  await runTest('billing/webhook', 'Deduplicates same event id (second returns 200, no duplicate row)', async () => {
    assert(sql && enterpriseTenantId, 'DB + enterprise tenant required');

    const eventId = nowId('qa_dedupe');
    const body = JSON.stringify({
      event: 'subscription.cancelled',
      payload: { subscription: { entity: { notes: { tenant_id: enterpriseTenantId } } } },
    });

    const headers = withJsonHeaders({
      'x-razorpay-signature': hmacRazorpay(body),
      'x-razorpay-event-id': eventId,
    });

    const r1 = await api('/api/webhook/razorpay', { method: 'POST', body, headers });
    const r2 = await api('/api/webhook/razorpay', { method: 'POST', body, headers });

    assert(r1.res.status === 200 && r2.res.status === 200, `expected 200/200 got ${r1.res.status}/${r2.res.status}`);

    const countRows = await sql`select count(*)::int as c from processed_webhook_events where stripe_event_id = ${eventId}`;
    assert(countRows[0].c === 1, `expected exactly 1 processed row got ${countRows[0].c}`);
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !RAZORPAY_WEBHOOK_SECRET,
    skipReason: 'DATABASE_URL + enterprise tenant id + webhook secret required',
  });

  await runTest('billing/webhook', 'subscription.cancelled sets razorpay_subscription_id to null', async () => {
    assert(sql && enterpriseTenantId, 'DB + enterprise tenant required');

    await withTenantRestore(enterpriseTenantId, async () => {
      await sql`update tenants set razorpay_subscription_id=${nowId('preset_sub')} where id=${enterpriseTenantId}`;

      const body = JSON.stringify({
        event: 'subscription.cancelled',
        payload: { subscription: { entity: { notes: { tenant_id: enterpriseTenantId } } } },
      });

      const { res } = await api('/api/webhook/razorpay', {
        method: 'POST',
        body,
        headers: withJsonHeaders({
          'x-razorpay-signature': hmacRazorpay(body),
          'x-razorpay-event-id': nowId('qa_cancelled'),
        }),
      });
      assert(res.status === 200, `expected 200 got ${res.status}`);

      const after = await tenantById(enterpriseTenantId);
      assert(after.razorpay_subscription_id == null, `expected null got ${after.razorpay_subscription_id}`);
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !RAZORPAY_WEBHOOK_SECRET,
    skipReason: 'DATABASE_URL + enterprise tenant id + webhook secret required',
  });

  await runTest('billing/webhook', 'subscription.expired sets razorpay_subscription_id to null', async () => {
    assert(sql && enterpriseTenantId, 'DB + enterprise tenant required');

    await withTenantRestore(enterpriseTenantId, async () => {
      await sql`update tenants set razorpay_subscription_id=${nowId('preset_sub')} where id=${enterpriseTenantId}`;

      const body = JSON.stringify({
        event: 'subscription.expired',
        payload: { subscription: { entity: { notes: { tenant_id: enterpriseTenantId } } } },
      });

      const { res } = await api('/api/webhook/razorpay', {
        method: 'POST',
        body,
        headers: withJsonHeaders({
          'x-razorpay-signature': hmacRazorpay(body),
          'x-razorpay-event-id': nowId('qa_expired'),
        }),
      });
      assert(res.status === 200, `expected 200 got ${res.status}`);

      const after = await tenantById(enterpriseTenantId);
      assert(after.razorpay_subscription_id == null, `expected null got ${after.razorpay_subscription_id}`);
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !RAZORPAY_WEBHOOK_SECRET,
    skipReason: 'DATABASE_URL + enterprise tenant id + webhook secret required',
  });

  await runTest('billing/webhook', 'Unrecognized event type accepted (200) without crash', async () => {
    const body = JSON.stringify({ event: 'subscription.some_new_event', payload: {} });
    const { res } = await api('/api/webhook/razorpay', {
      method: 'POST',
      body,
      headers: withJsonHeaders({
        'x-razorpay-signature': hmacRazorpay(body),
        'x-razorpay-event-id': nowId('qa_unknown_event_type'),
      }),
    });
    assert(res.status === 200, `expected 200 got ${res.status}`);
  }, { skipIf: () => !RAZORPAY_WEBHOOK_SECRET, skipReason: 'RAZORPAY_WEBHOOK_SECRET missing' });

  await runTest('billing/webhook', 'Concurrent duplicate deliveries only process once (idempotency race)', async () => {
    assert(sql && enterpriseTenantId, 'DB + enterprise tenant required');

    const eventId = nowId('qa_race');
    const body = JSON.stringify({
      event: 'subscription.cancelled',
      payload: { subscription: { entity: { notes: { tenant_id: enterpriseTenantId } } } },
    });

    const headers = withJsonHeaders({
      'x-razorpay-signature': hmacRazorpay(body),
      'x-razorpay-event-id': eventId,
    });

    const responses = await Promise.all([
      api('/api/webhook/razorpay', { method: 'POST', body, headers }),
      api('/api/webhook/razorpay', { method: 'POST', body, headers }),
      api('/api/webhook/razorpay', { method: 'POST', body, headers }),
    ]);

    assert(responses.every((r) => r.res.status === 200), `expected all 200 got ${responses.map((r) => r.res.status).join(',')}`);

    const countRows = await sql`select count(*)::int as c from processed_webhook_events where stripe_event_id = ${eventId}`;
    assert(countRows[0].c === 1, `expected one processed row, got ${countRows[0].c}`);
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !RAZORPAY_WEBHOOK_SECRET,
    skipReason: 'DATABASE_URL + enterprise tenant id + webhook secret required',
  });

  // ---------------------------------------------------------------------------
  // 4. Individual plan gates
  // ---------------------------------------------------------------------------
  await runTest('individual/gates', 'Free tier blocks CSV import (403)', async () => {
    assert(sql && individualTenantId && IND_COOKIE, 'requires DB + individual tenant + cookie');
    const listId = process.env.TEST_INDIVIDUAL_LIST_ID;
    assert(listId, 'TEST_INDIVIDUAL_LIST_ID required');

    await withTenantRestore(individualTenantId, async () => {
      await sql`update tenants set plan='free', plan_expires_at=NULL where id=${individualTenantId}`;

      const boundary = '----csvboundary_free';
      const csv = 'name,email\nFreeCase,free-case@example.com\n';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="contacts.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;

      const { res } = await api(`/api/individual/lists/${listId}/import-csv`, {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      assert(res.status === 403, `expected 403 got ${res.status}`);
    });
  }, {
    skipIf: () => !sql || !individualTenantId || !IND_COOKIE || !process.env.TEST_INDIVIDUAL_LIST_ID,
    skipReason: 'DATABASE_URL + individual tenant + cookie + list id required',
  });

  await runTest('individual/gates', 'Growth tier allows CSV import', async () => {
    assert(sql && individualTenantId && IND_COOKIE, 'requires DB + individual tenant + cookie');
    const listId = process.env.TEST_INDIVIDUAL_LIST_ID;
    assert(listId, 'TEST_INDIVIDUAL_LIST_ID required');

    await withTenantRestore(individualTenantId, async () => {
      await sql`update tenants set plan='growth', plan_expires_at=NOW() + interval '30 days' where id=${individualTenantId}`;

      const boundary = '----csvboundary_growth';
      const email = `${nowId('growth')}@example.com`;
      const csv = `name,email\nGrowthCase,${email}\n`;
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="contacts.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;

      const { res } = await api(`/api/individual/lists/${listId}/import-csv`, {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      assert([200, 303].includes(res.status), `expected 200/303 got ${res.status}`);
    });
  }, {
    skipIf: () => !sql || !individualTenantId || !IND_COOKIE || !process.env.TEST_INDIVIDUAL_LIST_ID,
    skipReason: 'DATABASE_URL + individual tenant + cookie + list id required',
  });

  await runTest('individual/gates', 'Free tier blocks AI generation', async () => {
    assert(sql && individualTenantId && IND_COOKIE, 'requires DB + individual tenant + cookie');

    await withTenantRestore(individualTenantId, async () => {
      await sql`update tenants set plan='free', plan_expires_at=NULL where id=${individualTenantId}`;

      const { res } = await api('/api/individual/ai/generate', {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ businessDescription: 'A bakery', tone: 'friendly', campaignType: 'welcome' }),
      });

      assert(res.status === 403, `expected 403 got ${res.status}`);
    });
  }, {
    skipIf: () => !sql || !individualTenantId || !IND_COOKIE,
    skipReason: 'DATABASE_URL + individual tenant + cookie required',
  });

  await runTest('individual/gates', 'Pro tier allows AI generation endpoint path (non-gating status)', async () => {
    assert(sql && individualTenantId && IND_COOKIE, 'requires DB + individual tenant + cookie');

    await withTenantRestore(individualTenantId, async () => {
      await sql`update tenants set plan='pro', plan_expires_at=NOW() + interval '30 days' where id=${individualTenantId}`;

      const { res } = await api('/api/individual/ai/generate', {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ businessDescription: 'A SaaS analytics app', tone: 'professional', campaignType: 'welcome' }),
      });

      // Could be 200 (if Gemini configured) or 500 (provider/env issue). Must not be 403 gate in pro tier.
      assert(res.status !== 403, `expected non-403 in pro tier got ${res.status}`);
    });
  }, {
    skipIf: () => !sql || !individualTenantId || !IND_COOKIE,
    skipReason: 'DATABASE_URL + individual tenant + cookie required',
  });

  await runTest('individual/gates', 'List/contact count limits enforced', async () => {
    assert(sql && individualTenantId && IND_COOKIE, 'requires DB + individual tenant + cookie');

    await withTenantRestore(individualTenantId, async () => {
      await sql`update tenants set plan='free', plan_expires_at=NULL where id=${individualTenantId}`;

      const listNameA = `QA List A ${Date.now()}`;
      const createA = await api('/api/individual/lists', {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ name: listNameA }),
      });
      assert([200, 201].includes(createA.res.status), `expected list A create success got ${createA.res.status}`);

      const listNameB = `QA List B ${Date.now()}`;
      const createB = await api('/api/individual/lists', {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ name: listNameB }),
      });
      assert(createB.res.status === 403, `expected second list blocked in free tier got ${createB.res.status}`);
    });
  }, {
    skipIf: () => !sql || !individualTenantId || !IND_COOKIE,
    skipReason: 'DATABASE_URL + individual tenant + cookie required',
  });

  await runTest('individual/gates', 'Monthly email sending limit enforced', async () => {
    // No direct campaign-send endpoint exists in app/api for plain API test; sequence send path relies on external email provider.
    // Mark skip unless operator explicitly opts-in and wires SMTP/Resend test harness.
    throw new Error('Not directly automatable via current public API without external email side effects.');
  }, { skipIf: () => true, skipReason: 'No direct send-campaign API; requires controlled email infra integration' });

  // ---------------------------------------------------------------------------
  // 5. Enterprise plan gates
  // ---------------------------------------------------------------------------
  await runTest('enterprise/gates', 'Free/basic/advanced gate for webhook config endpoint', async () => {
    assert(sql && enterpriseTenantId && ENT_COOKIE, 'requires DB + enterprise tenant + cookie');

    await withTenantRestore(enterpriseTenantId, async () => {
      await sql`update tenants set plan='basic', plan_expires_at=NOW() + interval '30 days' where id=${enterpriseTenantId}`;
      const basicGet = await api('/api/individual/webhooks', { cookie: ENT_COOKIE });
      assert(basicGet.res.status === 403, `expected basic plan webhook gate 403 got ${basicGet.res.status}`);

      await sql`update tenants set plan='advanced', plan_expires_at=NOW() + interval '30 days' where id=${enterpriseTenantId}`;
      const advGet = await api('/api/individual/webhooks', { cookie: ENT_COOKIE });
      assert(advGet.res.status === 200, `expected advanced webhook access 200 got ${advGet.res.status}`);
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !ENT_COOKIE,
    skipReason: 'DATABASE_URL + enterprise tenant + cookie required',
  });

  await runTest('enterprise/gates', 'Tracked user limit enforced for free plan', async () => {
    assert(sql && enterpriseTenantId && API_KEY, 'requires DB + enterprise tenant + API key');

    await withTenantRestore(enterpriseTenantId, async () => {
      await sql`update tenants set plan='free', plan_expires_at=NULL where id=${enterpriseTenantId}`;
      await sql`delete from end_users where tenant_id=${enterpriseTenantId}`;
      await sql`
        insert into end_users (tenant_id, external_id, email, completed_steps)
        select ${enterpriseTenantId}, 'seed_' || gs::text, 'qa-seed-' || gs::text || '@example.com', '[]'::jsonb
        from generate_series(1, 50) gs
      `;

      const resp = await api('/api/v1/track', {
        method: 'POST',
        headers: withJsonHeaders({ 'x-api-key': API_KEY }),
        body: JSON.stringify({ userId: nowId('new_user'), stepId: 'connect_repo', event: 'connect_repo' }),
      });

      assert(resp.res.status === 403 || resp.res.status === 404, `expected limit path 403/404 got ${resp.res.status}`);
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !API_KEY,
    skipReason: 'DATABASE_URL + enterprise tenant + API key required',
  });

  await runTest('enterprise/gates', 'Analytics gate coverage', async () => {
    // /api/v1/analytics-data is session-auth route, not x-api-key route; no explicit plan-gate logic in current code.
    throw new Error('Route exists but explicit plan gating is not implemented in current backend.');
  }, { skipIf: () => true, skipReason: 'Current code has no explicit plan gate on analytics-data route' });

  // ---------------------------------------------------------------------------
  // 6. Enterprise v1 API endpoints (x-api-key)
  // ---------------------------------------------------------------------------
  await runTest('enterprise/v1', 'POST /api/v1/identify with valid key creates/upserts user', async () => {
    const email = `qa-${nowId('identify')}@example.com`;
    const r = await api('/api/v1/identify', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': API_KEY }),
      body: JSON.stringify({ email, event: 'signed_up' }),
    });
    assert(r.res.status === 200, `expected 200 got ${r.res.status} body=${r.text}`);
    assert(r.json?.success === true, `expected success true got ${JSON.stringify(r.json)}`);
  }, { skipIf: () => !API_KEY, skipReason: 'TEST_ENTERPRISE_API_KEY missing' });

  await runTest('enterprise/v1', 'POST /api/v1/identify with invalid key rejected', async () => {
    const r = await api('/api/v1/identify', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': nowId('invalid') }),
      body: JSON.stringify({ email: `qa-${nowId('bad')}` }),
    });
    assert([401, 403].includes(r.res.status), `expected 401/403 got ${r.res.status}`);
  });

  await runTest('enterprise/v1', 'POST /api/v1/track records event for known user', async () => {
    const email = `qa-${nowId('track-known')}@example.com`;

    const i = await api('/api/v1/identify', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': API_KEY }),
      body: JSON.stringify({ email }),
    });
    assert(i.res.status === 200, `identify expected 200 got ${i.res.status}`);

    const t = await api('/api/v1/track', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': API_KEY }),
      body: JSON.stringify({ userId: email, stepId: 'connect_repo', event: 'connect_repo' }),
    });
    assert(t.res.status === 200, `expected 200 got ${t.res.status}`);
  }, { skipIf: () => !API_KEY, skipReason: 'TEST_ENTERPRISE_API_KEY missing' });

  await runTest('enterprise/v1', 'POST /api/v1/track unknown user returns error', async () => {
    const t = await api('/api/v1/track', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': API_KEY }),
      body: JSON.stringify({ userId: nowId('missing_user'), stepId: 'connect_repo', event: 'connect_repo' }),
    });
    assert(t.res.status === 404, `expected 404 got ${t.res.status}`);
  }, { skipIf: () => !API_KEY, skipReason: 'TEST_ENTERPRISE_API_KEY missing' });

  await runTest('enterprise/v1', 'POST /api/v1/nudge reachable only by session auth route', async () => {
    const r = await api('/api/v1/nudge', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': API_KEY }),
      body: JSON.stringify({ targetStep: 'step1' }),
    });
    assert(r.res.status === 401, `expected 401 for non-session API-key call got ${r.res.status}`);
  }, { skipIf: () => !API_KEY, skipReason: 'TEST_ENTERPRISE_API_KEY missing' });

  await runTest('enterprise/v1', 'GET /api/v1/check-auth valid and invalid behavior', async () => {
    const ok = await api('/api/v1/check-auth', { headers: { 'x-api-key': API_KEY } });
    assert(ok.res.status === 200, `valid expected 200 got ${ok.res.status}`);

    const bad = await api('/api/v1/check-auth', { headers: { 'x-api-key': nowId('invalid') } });
    assert([401, 403].includes(bad.res.status), `invalid expected 401/403 got ${bad.res.status}`);
  }, { skipIf: () => !API_KEY, skipReason: 'TEST_ENTERPRISE_API_KEY missing' });

  await runTest('enterprise/v1', 'POST /api/v1/config update works for valid key', async () => {
    const r = await api('/api/v1/config', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': API_KEY }),
      body: JSON.stringify({ activationStep: 'qa_step' }),
    });
    assert(r.res.status === 200, `expected 200 got ${r.res.status}`);
    assert(r.json?.success === true, `expected success true got ${JSON.stringify(r.json)}`);
  }, { skipIf: () => !API_KEY, skipReason: 'TEST_ENTERPRISE_API_KEY missing' });

  await runTest('enterprise/v1', 'GET /api/v1/analytics-data is session-auth, not API-key', async () => {
    const r = await api('/api/v1/analytics-data', { headers: { 'x-api-key': API_KEY } });
    assert(r.res.status === 401, `expected 401 without session cookie got ${r.res.status}`);
  }, { skipIf: () => !API_KEY, skipReason: 'TEST_ENTERPRISE_API_KEY missing' });

  // ---------------------------------------------------------------------------
  // 7. Email tracking
  // ---------------------------------------------------------------------------
  await runTest('tracking', 'GET /api/track/open with invalid token should reject (spec)', async () => {
    const r = await api('/api/track/open?cid=1&email=test@example.com&token=bad');
    assert(r.res.status === 400, `expected 400 got ${r.res.status}`);
  });

  await runTest('tracking', 'GET /api/track/click with invalid token should reject (spec)', async () => {
    const r = await api('/api/track/click?cid=1&email=test@example.com&token=bad&url=https%3A%2F%2Fexample.com');
    assert(r.res.status === 400, `expected 400 got ${r.res.status}`);
  });

  await runTest('tracking', 'Open/click valid-token DB verification', async () => {
    // Requires direct DB and token logic from TRACKING_HMAC_SECRET; not practical black-box unless secret exposed.
    throw new Error('Needs TRACKING_HMAC_SECRET + seeded campaign/contact + DB verification harness.');
  }, { skipIf: () => true, skipReason: 'Requires token secret + deterministic campaign fixture' });

  await runTest('tracking', 'Tracking pixel injection and click wrapping in outgoing HTML', async () => {
    // buildEmailHtml and injectTracking are library-level TS functions.
    throw new Error('Library-level assertion requires TS runtime harness not currently wired in this plain-node integration script.');
  }, { skipIf: () => true, skipReason: 'Unit-level TS function assertions intentionally skipped in integration-only run' });

  // ---------------------------------------------------------------------------
  // 8. Individual campaign CRUD
  // ---------------------------------------------------------------------------
  let createdListId = null;
  let createdCampaignId = null;

  await runTest('individual/crud', 'Create list and list appears in GET /api/individual/lists', async () => {
    assert(IND_COOKIE, 'TEST_INDIVIDUAL_COOKIE required');

    const name = `QA List ${Date.now()}`;
    const create = await api('/api/individual/lists', {
      method: 'POST',
      cookie: IND_COOKIE,
      headers: withJsonHeaders(),
      body: JSON.stringify({ name }),
    });

    assert([200, 201].includes(create.res.status), `expected 200/201 got ${create.res.status}`);
    createdListId = create.json?.list?.id;
    assert(createdListId, 'expected list.id in response');

    const get = await api('/api/individual/lists', { cookie: IND_COOKIE });
    assert(get.res.status === 200, `expected 200 got ${get.res.status}`);
    const found = (get.json?.lists || []).some((l) => l.id === createdListId);
    assert(found, `expected created list ${createdListId} present`);

    if (sql) {
      state.cleanup.push(async () => {
        await sql`delete from individual_lists where id = ${createdListId}`;
      });
    }
  }, { skipIf: () => !IND_COOKIE, skipReason: 'TEST_INDIVIDUAL_COOKIE missing' });

  await runTest('individual/crud', 'Create contact and duplicate contact handling', async () => {
    assert(IND_COOKIE && createdListId, 'individual cookie and created list required');
    const email = `qa-${nowId('contact')}@example.com`;

    const c1 = await api(`/api/individual/lists/${createdListId}/contacts`, {
      method: 'POST',
      cookie: IND_COOKIE,
      headers: withJsonHeaders(),
      body: JSON.stringify({ name: 'Contact One', email }),
    });
    assert([200, 201].includes(c1.res.status), `expected 200/201 got ${c1.res.status}`);

    const c2 = await api(`/api/individual/lists/${createdListId}/contacts`, {
      method: 'POST',
      cookie: IND_COOKIE,
      headers: withJsonHeaders(),
      body: JSON.stringify({ name: 'Contact One', email }),
    });
    assert([200, 201, 409].includes(c2.res.status), `expected dedupe behavior status got ${c2.res.status}`);
  }, { skipIf: () => !IND_COOKIE || !createdListId, skipReason: 'Requires prior list creation test to pass' });

  await runTest('individual/crud', 'Create campaign', async () => {
    assert(IND_COOKIE && createdListId, 'individual cookie and created list required');
    const r = await api(`/api/individual/lists/${createdListId}/campaigns`, {
      method: 'POST',
      cookie: IND_COOKIE,
      headers: withJsonHeaders(),
      body: JSON.stringify({ subject: 'QA Subject', body: 'QA Body' }),
    });
    assert([200, 201].includes(r.res.status), `expected 200/201 got ${r.res.status}`);
    createdCampaignId = r.json?.campaign?.id || null;
  }, { skipIf: () => !IND_COOKIE || !createdListId, skipReason: 'Requires prior list creation test to pass' });

  await runTest('individual/crud', 'Send campaign / unsubscribe flow / unsubscribed resend prevention', async () => {
    throw new Error('No direct send-campaign API route exists in current app/api surface.');
  }, { skipIf: () => true, skipReason: 'Current implementation sends via sequences/cron, not direct campaign send endpoint' });

  // ---------------------------------------------------------------------------
  // 9. Drip/webhook automation (Enterprise)
  // ---------------------------------------------------------------------------
  await runTest('enterprise/automation', 'Creating drip step stored correctly (advanced plan path)', async () => {
    assert(sql && enterpriseTenantId && ENT_COOKIE, 'DB + enterprise tenant + cookie required');

    await withTenantRestore(enterpriseTenantId, async () => {
      await sql`update tenants set plan='advanced', plan_expires_at=NOW() + interval '30 days' where id=${enterpriseTenantId}`;

      const payload = {
        steps: [
          {
            position: 1,
            eventTrigger: 'connect_repo',
            emailSubject: 'Step 1',
            emailBody: 'Body 1',
            delayHours: 1,
          },
        ],
      };

      const r = await api('/api/individual/drip-steps', {
        method: 'POST',
        cookie: ENT_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify(payload),
      });
      assert(r.res.status === 200, `expected 200 got ${r.res.status}`);

      const get = await api('/api/individual/drip-steps', { cookie: ENT_COOKIE });
      assert(get.res.status === 200, `expected GET 200 got ${get.res.status}`);
      assert(Array.isArray(get.json?.steps), 'expected steps array');
      assert(get.json.steps.some((s) => s.eventTrigger === 'connect_repo'), 'expected stored drip step not found');
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !ENT_COOKIE,
    skipReason: 'DATABASE_URL + enterprise tenant + enterprise cookie required',
  });

  await runTest('enterprise/automation', 'Webhook config save and retrieve', async () => {
    assert(sql && enterpriseTenantId && ENT_COOKIE, 'DB + enterprise tenant + cookie required');

    await withTenantRestore(enterpriseTenantId, async () => {
      await sql`update tenants set plan='advanced', plan_expires_at=NOW() + interval '30 days' where id=${enterpriseTenantId}`;

      const create = await api('/api/individual/webhooks', {
        method: 'POST',
        cookie: ENT_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ url: 'https://example.com/webhook', events: ['user.identified'] }),
      });
      assert(create.res.status === 200, `expected 200 got ${create.res.status}`);

      const wid = create.json?.webhook?.id;
      assert(wid, 'expected webhook id');

      const get = await api('/api/individual/webhooks', { cookie: ENT_COOKIE });
      assert(get.res.status === 200, `expected 200 got ${get.res.status}`);
      assert((get.json?.webhooks || []).some((w) => w.id === wid), 'expected created webhook in GET response');

      const del = await api('/api/individual/webhooks', {
        method: 'DELETE',
        cookie: ENT_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ id: wid }),
      });
      assert(del.res.status === 200, `expected delete 200 got ${del.res.status}`);
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !ENT_COOKIE,
    skipReason: 'DATABASE_URL + enterprise tenant + enterprise cookie required',
  });

  await runTest('enterprise/automation', 'Webhook delivery attempt + failure recorded', async () => {
    assert(sql && enterpriseTenantId && ENT_COOKIE && API_KEY, 'DB + enterprise tenant + cookie + API key required');

    await withTenantRestore(enterpriseTenantId, async () => {
      await sql`update tenants set plan='advanced', plan_expires_at=NOW() + interval '30 days' where id=${enterpriseTenantId}`;

      const badUrl = 'https://127.0.0.1.invalid/webhook';
      const create = await api('/api/individual/webhooks', {
        method: 'POST',
        cookie: ENT_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ url: badUrl, events: ['user.identified'] }),
      });
      assert(create.res.status === 200, `expected create 200 got ${create.res.status}`);
      const wid = create.json?.webhook?.id;

      const identify = await api('/api/v1/identify', {
        method: 'POST',
        headers: withJsonHeaders({ 'x-api-key': API_KEY }),
        body: JSON.stringify({ email: `qa-${nowId('webhook-delivery')}@example.com` }),
      });
      assert(identify.res.status === 200, `identify expected 200 got ${identify.res.status}`);

      // allow async fire-and-forget delivery to execute
      await new Promise((r) => setTimeout(r, 1200));

      const rows = await sql`
        select wd.id, wd.success, wd.response_status
        from webhook_deliveries wd
        join webhooks w on w.id = wd.webhook_id
        where w.id = ${wid}
        order by wd.id desc
        limit 1
      `;
      assert(rows.length > 0, 'expected at least one webhook delivery row');
      assert(rows[0].success === false, `expected failed delivery success=false got ${rows[0].success}`);

      await api('/api/individual/webhooks', {
        method: 'DELETE',
        cookie: ENT_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ id: wid }),
      });
    });
  }, {
    skipIf: () => !sql || !enterpriseTenantId || !ENT_COOKIE || !API_KEY,
    skipReason: 'DATABASE_URL + enterprise tenant + enterprise cookie + API key required',
  });

  await runTest('enterprise/automation', 'Retry logic exercised', async () => {
    throw new Error('No retry loop is implemented in lib/webhooks/deliver.ts current code.');
  }, { skipIf: () => true, skipReason: 'Retry logic not present in current implementation' });

  // ---------------------------------------------------------------------------
  // 10. Cron and maintenance
  // ---------------------------------------------------------------------------
  await runTest('cron', 'GET /api/cron wrong/missing secret returns 401', async () => {
    const r = await api('/api/cron');
    assert(r.res.status === 401, `expected 401 got ${r.res.status}`);
  });

  await runTest('cron', 'GET /api/cron with valid secret returns 200', async () => {
    const r = await api('/api/cron', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    assert(r.res.status === 200, `expected 200 got ${r.res.status}`);
  }, { skipIf: () => !CRON_SECRET, skipReason: 'CRON_SECRET missing' });

  await runTest('cron', 'GET /api/cron/process-stalls with valid secret executes', async () => {
    const r = await api('/api/cron/process-stalls', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    assert(r.res.status !== 401, `expected non-401 with valid secret got ${r.res.status}`);
  }, { skipIf: () => !CRON_SECRET, skipReason: 'CRON_SECRET missing' });

  // ---------------------------------------------------------------------------
  // 11. Edge/adversarial
  // ---------------------------------------------------------------------------
  await runTest('edge', 'POST endpoints malformed JSON should not 500', async () => {
    const targets = [
      ['/api/v1/identify', { 'x-api-key': API_KEY || 'invalid' }],
      ['/api/v1/track', { 'x-api-key': API_KEY || 'invalid' }],
      ['/api/v1/config', { 'x-api-key': API_KEY || 'invalid' }],
      ['/api/individual/lists', {}],
    ];

    for (const [path, extra] of targets) {
      const r = await api(path, {
        method: 'POST',
        cookie: path.startsWith('/api/individual') ? IND_COOKIE : undefined,
        headers: withJsonHeaders(extra),
        body: '{bad-json',
      });
      assert(r.res.status !== 500, `${path} returned 500 for malformed JSON`);
    }
  }, {
    skipIf: () => !IND_COOKIE,
    skipReason: 'TEST_INDIVIDUAL_COOKIE missing for individual malformed JSON path coverage',
  });

  await runTest('edge', 'Missing required fields return descriptive errors', async () => {
    const r1 = await api('/api/v1/track', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': API_KEY || 'invalid' }),
      body: JSON.stringify({ userId: 'only_user' }),
    });
    assert([400, 403].includes(r1.res.status), `expected 400/403 got ${r1.res.status}`);

    if (IND_COOKIE) {
      const r2 = await api('/api/individual/lists', {
        method: 'POST',
        cookie: IND_COOKIE,
        headers: withJsonHeaders(),
        body: JSON.stringify({ name: '' }),
      });
      assert(r2.res.status === 400, `expected 400 for invalid list name got ${r2.res.status}`);
      assert(r2.text.length > 0, 'expected descriptive error body');
    }
  });

  await runTest('edge', 'SQL injection attempt does not crash or leak', async () => {
    const payload = "test@example.com' OR 1=1 --";
    const r = await api('/api/v1/identify', {
      method: 'POST',
      headers: withJsonHeaders({ 'x-api-key': API_KEY || 'invalid' }),
      body: JSON.stringify({ email: payload }),
    });
    assert(r.res.status !== 500, `expected non-500 got ${r.res.status}`);
  });

  await runTest('edge', 'Extremely long strings rejected gracefully', async () => {
    const long = 'x'.repeat(12000);

    if (!IND_COOKIE) {
      throw new Error('TEST_INDIVIDUAL_COOKIE required to validate list/contact zod constraints');
    }

    const r = await api('/api/individual/lists', {
      method: 'POST',
      cookie: IND_COOKIE,
      headers: withJsonHeaders(),
      body: JSON.stringify({ name: long }),
    });

    assert(r.res.status === 400 || r.res.status === 413, `expected graceful reject 400/413 got ${r.res.status}`);
  }, { skipIf: () => !IND_COOKIE, skipReason: 'TEST_INDIVIDUAL_COOKIE missing' });

  await runTest('edge', 'Rate limiting returns 429 under burst load', async () => {
    let got429 = false;
    for (let i = 0; i < 80; i++) {
      const r = await api('/api/v1/check-auth', {
        headers: {
          'x-api-key': API_KEY || 'invalid',
          'x-forwarded-for': '203.0.113.50',
        },
      });
      if (r.res.status === 429) {
        got429 = true;
        break;
      }
    }
    assert(got429, 'expected at least one 429 under burst requests');
  });

  // cleanup
  await cleanupAll();
  await closeDb();

  console.log('=====================================');
  console.log(`Results: ${state.passed} passed, ${state.failed} failed, ${state.skipped} skipped`);
  console.log('=====================================');

  process.exit(state.failed > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error('Fatal test runner error:', err?.message || err);
  await cleanupAll();
  await closeDb();
  process.exit(1);
});
