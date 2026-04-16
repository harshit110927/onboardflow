# OnboardFlow Project Context (Single-File Handoff)

## 1) What this repo is
OnboardFlow is a Next.js 15 App Router SaaS app with two product tiers:
- **Enterprise**: SDK/API-key based onboarding + event tracking + drip/webhook automation.
- **Individual**: no-code email list/campaign product for small businesses.

The app uses:
- Next.js 15 + React 19 + TypeScript
- Drizzle ORM with Postgres (Supabase-hosted DB)
- Supabase Auth for application users
- Resend / SMTP for email sending
- Razorpay subscriptions (current billing flow)
- Stripe endpoints still exist for compatibility/legacy flows

---

## 2) Top-level layout and what lives where
- `app/` — App Router pages, layouts, and API routes.
- `lib/` — domain logic (plans, limits, auth wrappers, rate limits, tracking helpers, AI, webhooks, email).
- `db/` — Drizzle schema (`db/schema.ts`).
- `supabase/migrations/` — SQL and Drizzle metadata snapshots.
- `components/` — shared UI components.
- `sdk/index.ts` — minimal public SDK entrypoint used by integrators.
- `middleware.ts` — route protection + tier redirection.

---

## 3) Core domain model (DB)
Primary tables in `db/schema.ts`:

### Tenancy and auth
- `tenants`: root account object (`id`, `email`, `tier`, `plan`, `planExpiresAt`, `planRenewalDate`, `razorpaySubscriptionId`, api/smtp fields, etc.).

### Enterprise onboarding tracking
- `end_users`: customer/end-user records tracked by enterprise tenants (`externalId`, `completedSteps`, etc.).
- `drip_steps`: configured automation steps.
- `webhooks` + `webhook_deliveries`: outgoing webhook config and delivery history.

### Individual email marketing
- `individual_lists`
- `individual_contacts`
- `individual_campaigns`
- `unsubscribed_contacts`
- `campaign_events` (open/click/send-like analytics events)

### Billing/usage/meta
- `processed_webhook_events` (idempotency store for webhook events)
- `ai_usage`
- `credit_transactions` and `stripe_subscriptions` (legacy artifacts still present)

---

## 4) Tier and plan system
Plan constants live in `lib/plans/limits.ts`.

### Account tiers
- `individual`
- `enterprise`

### Individual plan tiers
- `free`, `starter`, `growth`, `pro`
- Gated features include: CSV import, tracking, AI, list/contact/email limits.

### Enterprise plan tiers
- `free`, `basic`, `advanced`
- Gated features include: tracked users, monthly emails, drip step limits, webhook/analytics availability.

### Plan resolution
- `lib/plans/get-tenant-plan.ts` computes effective plan from tenant row + expiration.
- It is wrapped with `cache(...)` from React to reduce repeated resolution overhead inside request/render lifecycles.
- If tenant missing/expired, fallback behavior resolves to `free`.

---

## 5) Authentication and request identity
- Supabase auth client helpers are used in `utils/supabase/*` and `lib/auth/*`.
- `middleware.ts` enforces:
  - logged-in users required for dashboard/tier-selection routes
  - users without selected tier are redirected to `/tier-selection`
  - users with existing tier are redirected from `/tier-selection` to `/dashboard/{tier}`

Enterprise API routes also validate `x-api-key` against `tenants.apiKey`.

---

## 6) Billing and subscriptions
### Current path: Razorpay
Relevant routes:
- `POST /api/razorpay/create-subscription`
- `POST /api/razorpay/cancel-subscription`
- `POST /api/webhook/razorpay`

How it works:
1. UI calls `create-subscription` with a plan id.
2. Server maps internal plan id -> Razorpay plan id env vars.
3. Server creates subscription at Razorpay and returns `subscriptionId`.
4. Frontend opens Razorpay Checkout (`BillingActions.tsx`).
5. Webhook validates signature, deduplicates by event id, and updates tenant plan + expiry + subscription id.

### Stripe status
- Stripe endpoints are still in repo (`/api/stripe/*`, `/api/webhook/stripe`) plus some price env vars.
- `create-order` (Razorpay old order path) intentionally returns deprecated behavior.

---

## 7) Email generation, sending, and tracking
### HTML templating
- `lib/email/templates.ts` builds email HTML shell + unsubscribe links + optional tracking pixel insertion.

### Link/open tracking
- `lib/tracking/inject.ts` wraps detected URLs with click-tracking endpoint URLs.
- `createOpenTrackingUrl(...)` creates pixel endpoint URL.
- API endpoints:
  - `GET/POST /api/track/click`
  - `GET/POST /api/track/open`
- HMAC token helpers are in `lib/tracking/hmac.ts`.

### Usage limits
- Monthly email usage helpers in `lib/rate-limit/email-usage.ts`.
- Individual and enterprise limit checks in `lib/rate-limit/individual.ts` and `lib/rate-limit/enterprise.ts`.

---

## 8) Important API surfaces
### Enterprise-facing v1 endpoints (`app/api/v1/*`)
- `identify` — create/register end users
- `track` — track step events
- `nudge` — trigger nudges
- `config` — fetch integration config
- `settings` — fetch/update settings
- `check-auth` — API key/auth checks
- `analytics-data` — usage analytics

### Individual product endpoints
- Lists/contacts/campaigns CRUD-like routes under `app/api/individual/*`.
- CSV import route:
  - `POST /api/individual/lists/[listId]/import-csv`
  - gated by plan (`growth`/`pro` via `csvImportEnabled`)

### Automation/maintenance
- `app/api/cron/route.ts`
- `app/api/cron/process-stalls/route.ts`

---

## 9) Frontend pages of note
- Tier selection: `app/tier-selection/*`
- Dashboard switcher/root: `app/dashboard/page.tsx`
- Individual dashboard/billing/campaigns/lists/settings: `app/dashboard/individual/*`
- Enterprise dashboard/billing/drip-steps/webhooks: `app/dashboard/enterprise/*`
- Embedded page: `app/embed/[orgId]/page.tsx`

A reusable plan quota UI component exists at `app/_components/PlanMeter.tsx`.

---

## 10) AI features
- Campaign generation logic: `lib/ai/generate-campaign.ts`
- API route: `app/api/individual/ai/generate/route.ts`
- AI usage tracked in `ai_usage` table and subject to plan gates.

---

## 11) Configuration and environment variables
Common env keys referenced in code (non-exhaustive operationally, but exhaustive from static `process.env.*` usage at time of writing):

- Core/App:  
  `DATABASE_URL`, `NODE_ENV`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_APP_URL`
- Supabase:  
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Resend/SMTP/tracking:  
  `RESEND_API_KEY`, `SMTP_ENCRYPTION_KEY`, `TRACKING_HMAC_SECRET`, `BASE_URL`
- Razorpay:  
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`,  
  `RAZORPAY_PLAN_IND_STARTER`, `RAZORPAY_PLAN_IND_GROWTH`, `RAZORPAY_PLAN_IND_PRO`, `RAZORPAY_PLAN_ENT_BASIC`, `RAZORPAY_PLAN_ENT_ADVANCED`
- Stripe (legacy/compat):  
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENABLED`,  
  `STRIPE_CREDITS_10_PRICE_ID`, `STRIPE_CREDITS_25_PRICE_ID`, `STRIPE_CREDITS_50_PRICE_ID`, `STRIPE_CREDITS_100_PRICE_ID`, `STRIPE_ENTERPRISE_PREMIUM_PRICE_ID`
- AI/other:  
  `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- Misc feature flags/state keys seen in code:  
  `CRON_SECRET`, `INDIVIDUAL_STATE`, `ENTERPRISE_STATE`

---

## 12) Build, run, and migration commands
- Dev server: `npm run dev`
- Production build: `npm run build`
- Start production build: `npm run start`
- Lint: `npm run lint`
- Type-check (direct): `npx tsc --noEmit`
- Drizzle config: `drizzle.config.ts` points schema to `db/schema.ts` and migrations to `supabase/migrations`.

---

## 13) Recent reliability/CI notes
- A CI failure around `Cannot find name 'cache'` in `lib/plans/get-tenant-plan.ts` was addressed by explicitly importing `cache` from React and exporting `getTenantPlan` via `cache(async ...)`.
- Current branch also includes strict TypeScript callback typings in `app/dashboard/individual/page.tsx` to avoid implicit-`any` build failures.

---

## 14) Practical onboarding checklist for a new contributor/AI
1. Start from `db/schema.ts` and `lib/plans/limits.ts` to understand domain limits.  
2. Read `middleware.ts` + `lib/auth/*` to understand access/tier routing.  
3. For billing, trace `BillingActions.tsx` -> Razorpay API routes -> webhook route.  
4. For individual campaigns, inspect dashboard list/campaign pages + tracking helpers.  
5. For enterprise SDK/API behavior, inspect `/api/v1/*` routes and `lib/webhooks/deliver.ts`.  
6. Before shipping: run `npx tsc --noEmit` and `npm run build`.

This file is intended as a high-signal map, not a replacement for reading source.
