# Dripmetric Project Context (Single-File Handoff)

## 1) What this repo is
Dripmetric is a Next.js 15 App Router SaaS app with two product tiers:
- **Enterprise**: SDK/API-key based onboarding + event tracking + drip/webhook automation.
- **Individual**: no-code email list/campaign product for small businesses.

---

## 1. Product in one paragraph

OnboardFlow is a Next.js 15 App Router SaaS product with two account tiers:

- **Enterprise**: developer-facing onboarding automation. A tenant gets an API key, integrates the SDK/HTTP API, identifies end users, tracks onboarding step completion, configures drip/nudge emails, views analytics, and can register outgoing webhooks.
- **Individual**: no-code email marketing for small businesses. A tenant creates lists, adds/imports contacts, creates campaigns/sequences, optionally uses AI writing, configures Gmail SMTP, and sends emails from the dashboard.

The app uses Supabase Auth for app-user login, Postgres via Drizzle for application data, Resend/Gmail SMTP for email, Razorpay for current billing flows, Stripe legacy compatibility routes, Tailwind/shadcn-style UI primitives, and a small TypeScript SDK package in `sdk/`.

---

## 2. Technology stack and runtime assumptions

### Core app

- Framework: **Next.js 15.5.7**, App Router, React 19, TypeScript.
- Styling: Tailwind CSS + CSS variables in `app/globals.css`; many landing/auth styles are inline.
- DB: PostgreSQL through `postgres` and Drizzle ORM.
- Auth: Supabase SSR helpers from `@supabase/ssr`.
- Email providers: Resend shared sender, tenant Resend key, Gmail SMTP through Nodemailer.
- Billing: Razorpay subscription endpoints are active; Stripe endpoints/webhook remain in code.
- Charts: Recharts, loaded dynamically by `components/analytics/ChartWrapper.tsx`.
- AI: Gemini via `@google/generative-ai` for Individual campaign generation.

### Important npm scripts

- `npm run dev` → `next dev`
- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run lint` → `next lint` (note: `next lint` is deprecated/removed in newer Next versions and may fail depending on installed Next behavior)

---

## 3. Top-level repository map

```text
app/                         Next.js App Router pages, layouts, server actions, API routes
  page.tsx                   Initial unauthenticated landing/login page
  actions.ts                 Landing page magic-link + Google OAuth server actions
  (auth)/login/              Secondary/simple login route
  auth/callback/route.ts     Supabase OAuth/OTP callback handler
  dashboard/                 Tier router plus legacy enterprise dashboard pages
  dashboard/enterprise/      Enterprise authenticated app shell and pages
  dashboard/individual/      Individual authenticated app shell and pages
  api/                       HTTP API, cron, billing, tracking, webhooks
  tier-selection/            First-run account tier choice
  docs/, terms/, privacy/    Public support pages
  embed/[orgId]/             Minimal embeddable widget placeholder
components/                  Shared UI primitives and analytics chart components
db/                          Drizzle schema and DB client
lib/                         Domain services: auth, plans, rate limits, email, tracking, AI, webhooks
utils/supabase/              Browser/server/middleware Supabase clients
sdk/                         Public TypeScript SDK package source and package metadata
supabase/migrations/         Supabase/Drizzle migration snapshots
middleware.ts                Supabase session refresh and route/tier redirects
cli.js                       Setup wizard that generates starter auth code for integrators
tests.js                     Integration-style HTTP test runner
tests.e2e.js                 Browser/e2e-style smoke test helper
context.md                   This project context file
```

---

## 4. Visual theme and brand context

### Landing/auth-before-dashboard theme

The initial landing page is the most important pre-auth brand reference. It is a split SaaS card:

- Outer background: pale lavender `#f0effe`.
- Left marketing panel: deep indigo `#1e1b4b` with dot-grid and radial glow.
- Primary CTA: indigo `#6366f1`, hover `#4338ca`.
- Accent: periwinkle `#818cf8` and light indigos `#a5b4fc`, `#c7d2fe`, `#e0e7ff`.
- Secondary success/code accent: emerald `#34d399`.
- Font: `DM Sans`; code sample uses `DM Mono`.

Primary source files:

- `app/page.tsx` contains the full pre-auth landing/login layout and most inline colors.
- `app/_components/TierChips.tsx` renders the Enterprise/Individual selector chips on the landing page.
- `app/globals.css` defines global theme tokens and imports `DM Sans`.

### Authenticated dashboard theme

Authenticated `/dashboard/individual/*` and `/dashboard/enterprise/*` layouts wrap content in `.theme-deep`, an opt-in “Dusk & Sage Deep” theme:

- Background: soft sage/off-white.
- Foreground/nav: deep blue-gray.
- Primary: muted green.
- Dashboard nav is styled through `.app-shell-nav` tokens.

Primary source files:

- `app/globals.css`
- `app/dashboard/individual/layout.tsx`
- `app/dashboard/enterprise/layout.tsx`

---

## 5. Database and data model

Database schema lives in `db/schema.ts`. The Drizzle DB client is created in `db/index.ts` from `DATABASE_URL`; development reuses a global `postgresClient`, while production creates a fresh client.

### Tables

#### `tenants`

Root account row for a logged-in app user. Key fields:

- Identity: `id`, `email`, `name`.
- Access/API: `licenseKey`, `hasAccess`, `apiKey`.
- Billing: `stripeCustomerId`, `razorpaySubscriptionId`, `plan`, `planExpiresAt`, `planRenewalDate`, `credits`.
- Tier: `tier` is `enterprise`, `individual`, or `null` until onboarding.
- Enterprise automation settings: `automationEnabled`, `activationStep`, step 2/3 fields, email subjects/bodies.
- Tenant email sending: encrypted `resendApiKey`, `resendFromEmail`, `smtpEmail`, encrypted `smtpPassword`, `smtpVerified`, `smtpProvider`.

#### `endUsers`

Enterprise tracked customer/end-user records:

- Belongs to `tenantId`.
- Identified by `externalId` and optional `email`.
- Tracks `completedSteps`, `lastEmailedAt`, `automationsReceived`, `lastSeenAt`, `createdAt`.

#### Individual marketing tables

- `individualLists`: list per Individual tenant.
- `individualContacts`: contact per list; unique `(listId, email)`.
- `individualCampaigns`: draft/sent/scheduled campaign rows and sequence metadata (`sequenceId`, `sequencePosition`, `sendDelayDays`).
- `campaignEvents`: open/click tracking records for Individual campaigns.
- `unsubscribedContacts`: global unsubscribe table keyed by email.

#### Billing/usage/support tables

- `creditTransactions`: legacy/credits accounting.
- `stripeSubscriptions`: legacy Stripe subscription records.
- `processedWebhookEvents`: idempotency table for Stripe/Razorpay-style event ids; column remains named `stripeEventId` even when used for Razorpay.
- `aiUsage`: Individual AI-generation usage/token audit.

#### Enterprise automation/webhook tables

- `dripSteps`: configurable Enterprise drip/nudge steps with `position`, `eventTrigger`, `emailSubject`, `emailBody`, `delayHours`.
- `webhooks`: tenant webhook endpoints and subscribed event names.
- `webhookDeliveries`: delivery audit rows with payload, response status, success, timestamp.

---

## 6. Plans, limits, and tier logic

Source files:

- `lib/plans/limits.ts`: canonical plan IDs, prices, highlights, and limits.
- `lib/plans/get-tenant-plan.ts`: cached plan resolution by tenant id.
- `lib/types/tier.ts`: basic tier type and older Individual-only limits.
- `lib/actions/set-tier.ts`: first-run tier assignment.

### Account tiers

- `enterprise`
- `individual`

### Individual plans

`PlanTier = "free" | "starter" | "growth" | "pro"`

Limits:

- Free: 1 list, 25 contacts/list, 50 emails/month, no CSV, no tracking, no AI.
- Starter: 3 lists, 100 contacts/list, 500 emails/month, no CSV/tracking/AI.
- Growth: 10 lists, 200 contacts/list, 2,000 emails/month, CSV/tracking/AI enabled.
- Pro: 15 lists, 500 contacts/list, 6,000 emails/month, CSV/tracking/AI enabled.

Plan card IDs:

- `ind_starter` → `starter`
- `ind_growth` → `growth`
- `ind_pro` → `pro`

### Enterprise plans

`EnterprisePlanTier = "free" | "basic" | "advanced"`

Limits:

- Free: 50 tracked users, 300 emails/month, 3 drip steps, no webhooks/advanced analytics.
- Basic: 500 tracked users, 3,000 emails/month, 3 drip steps, no webhooks/advanced analytics.
- Advanced: 2,000 tracked users, 10,000 emails/month, unlimited drip steps, webhooks and advanced analytics enabled.

Plan card IDs:

- `ent_basic` → `basic`
- `ent_advanced` → `advanced`

### Effective plan resolution

`getTenantPlan(tenantId)`:

1. Loads `tenants.plan`, `planExpiresAt`, `planRenewalDate`.
2. If tenant is missing, returns `free`.
3. If `planExpiresAt` is in the past, returns `free` with `isExpired: true`.
4. Otherwise returns stored plan and renewal metadata.

---

## 7. Authentication and routing lifecycle

### Supabase client helpers

- `utils/supabase/client.ts`: `createClient()` for browser components.
- `utils/supabase/server.ts`: async `createClient()` for server components/actions/routes using `cookies()`.
- `utils/supabase/middleware.ts`: `updateSession(request)` creates a server client, refreshes auth via `supabase.auth.getUser()`, and returns a cookie-preserving `NextResponse`.

### Middleware

`middleware.ts` runs on all routes except static assets/images/favicon. It:

1. Calls `updateSession(request)` first to refresh Supabase cookies.
2. Reads the user through a Supabase server client.
3. Allows unauthenticated access to public routes.
4. Redirects unauthenticated dashboard/tier-selection requests to `/login`.
5. For logged-in users, reads `tenants.tier` by email.
6. Redirects logged-in users without a tier to `/tier-selection`.
7. Redirects logged-in users with a tier away from `/tier-selection` to `/dashboard/{tier}`.

### Login flows

#### `/` landing page

File: `app/page.tsx`

- Server component checks Supabase user.
- If user exists, redirects to `/dashboard`.
- Otherwise renders pre-auth marketing/login screen.
- Email form calls `login` from `app/actions.ts`.
- Google button calls `signInWithGoogle` from `app/actions.ts`.

`app/actions.ts`:

- `login(formData)`: reads email, determines `origin` header, calls `supabase.auth.signInWithOtp({ shouldCreateUser: true, emailRedirectTo: origin + /auth/callback })`, then redirects to `/check-email`.
- `signInWithGoogle()`: determines the request origin and calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origin + /auth/callback } })`, then redirects to provider URL.

#### `/login` secondary route

Files: `app/(auth)/login/page.tsx`, `app/(auth)/login/actions.ts`

- Simple centered card UI.
- Uses a separate `login(formData)` action that determines the request origin and sends magic links to `origin + /auth/callback`.

#### `/auth/callback`

File: `app/auth/callback/route.ts`

- Reads `code` query param.
- Exchanges it with `supabase.auth.exchangeCodeForSession(code)`.
- Redirects to `/dashboard` after successful exchange.
- Redirects to `/` if no code is present.

#### First-run tier selection

Files:

- `app/tier-selection/page.tsx`: server page; requires authenticated user; if tenant already has tier, redirects to `/dashboard/{tier}`; otherwise renders client selector.
- `app/tier-selection/layout.tsx`: centers tier selection.
- `app/tier-selection/_components/TierSelectionClient.tsx`: two cards: Enterprise and Individual. Calls `setTier(tier)`.
- `lib/actions/set-tier.ts`: validates tier, loads Supabase user, inserts or updates tenant, generates enterprise API key when needed, sends welcome email non-blocking, returns redirect path.

#### Dashboard tier router

File: `app/dashboard/page.tsx`

- Requires user.
- Reads `tenants.tier` by email.
- If no tier, redirects to `/tier-selection`.
- Otherwise redirects to `/dashboard/{tier}`.

---

## 8. Complete route map: public pages

| URL | File | What loads |
|---|---|---|
| `/` | `app/page.tsx` | Primary unauthenticated landing/login page; redirects authenticated users to `/dashboard`. |
| `/login` | `app/(auth)/login/page.tsx` | Secondary simple magic-link login form. |
| `/check-email` | `app/check-email/page.tsx` | Static “check your email” screen after magic-link request. |
| `/auth/callback` | `app/auth/callback/route.ts` | Supabase auth callback; exchanges code then redirects to `/dashboard`. |
| `/tier-selection` | `app/tier-selection/page.tsx` | Authenticated first-run tier selection. |
| `/docs` | `app/docs/page.tsx` | Public-style documentation page with SDK/API snippets. |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy page. |
| `/terms` | `app/terms/page.tsx` | Terms page. |
| `/payment/success` | `app/payment/success/page.tsx` | Post-payment success card. |
| `/unsubscribe?email=&token=` | `app/unsubscribe/page.tsx` | Validates unsubscribe token and inserts into `unsubscribedContacts`. |
| `/embed/[orgId]` | `app/embed/[orgId]/page.tsx` | Minimal embedded widget placeholder using `orgId`. |

---

## 9. Complete route map: dashboard pages

### Shared/legacy dashboard routes

| URL | File | What loads |
|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | Server redirector to tier dashboard. |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | Legacy Enterprise automation workflow settings UI; client fetches `/api/v1/settings` and can trigger `/api/cron`. |
| `/dashboard/settings/actions.ts` | Server action file | `logout()` signs out Supabase user and redirects to `/login`. |
| `/dashboard/analytics` | `app/dashboard/analytics/page.tsx` | Legacy analytics page fetching `/api/v1/analytics-data`. |
| `/dashboard/ApiKeyCard.tsx` | Component | Displays/copies masked API key. |
| `/dashboard/actions.ts` | Server action file | Legacy dashboard server action(s), including `saveSettings`. |

### Enterprise dashboard routes

The layout `app/dashboard/enterprise/layout.tsx`:

- Calls `getSession()`.
- Redirects unauthenticated users to `/login`.
- Calls `getTenant(user.email)`.
- Requires `tenant.tier === "enterprise"`, otherwise redirects to `/dashboard`.
- Calls `getTenantPlan(tenant.id)` for current plan badge.
- Renders `EnterpriseNavLinks` and wraps page content in `theme-deep`.

| URL | File | What loads |
|---|---|---|
| `/dashboard/enterprise` | `app/dashboard/enterprise/page.tsx` | Enterprise home/dashboard: API key and onboarding stats/config entry points. |
| `/dashboard/enterprise/billing` | `app/dashboard/enterprise/billing/page.tsx` | Enterprise pricing/current plan, Razorpay subscription actions. |
| `/dashboard/enterprise/drip-steps` | `app/dashboard/enterprise/drip-steps/page.tsx` | Server page that gates drip-step editor by plan and loads existing `dripSteps`. |
| component | `app/dashboard/enterprise/drip-steps/_components/DripStepsEditor.tsx` | Client editor that saves Enterprise drip steps through `/api/individual/drip-steps`. |
| `/dashboard/enterprise/webhooks` | `app/dashboard/enterprise/webhooks/page.tsx` | Server page gating webhooks by Advanced plan and rendering manager. |
| component | `app/dashboard/enterprise/webhooks/_components/WebHooksManager.tsx` | Client CRUD UI for Enterprise webhooks through `/api/individual/webhooks`. |
| component | `app/dashboard/enterprise/_components/NavLinks.tsx` | Enterprise navigation links and active-route styling. |
| component | `app/dashboard/enterprise/_components/NudgeButton.tsx` | Button that triggers manual nudge send via `/api/v1/nudge-step`. |

### Individual dashboard routes

The layout `app/dashboard/individual/layout.tsx`:

- Calls `getSession()`.
- Redirects unauthenticated users to `/login`.
- Calls `getTenant(user.email)`.
- Requires `tenant.tier === "individual"`, otherwise redirects to `/dashboard`.
- Computes effective plan inline for nav badge.
- Renders `NavLinks` and wraps page content in `theme-deep`.

| URL | File | What loads |
|---|---|---|
| `/dashboard/individual` | `app/dashboard/individual/page.tsx` | Individual overview: lists/campaign stats, plan usage, quick links. |
| `/dashboard/individual/billing` | `app/dashboard/individual/billing/page.tsx` | Individual current plan and pricing cards. |
| component | `app/dashboard/individual/billing/_components/BillingActions.tsx` | Client Razorpay Checkout loader/caller for subscriptions. |
| `/dashboard/individual/lists` | `app/dashboard/individual/lists/page.tsx` | Lists index with tenant list rows and plan usage. |
| `/dashboard/individual/lists/new` | `app/dashboard/individual/lists/new/page.tsx` | New-list form; calls `/api/individual/lists`. |
| `/dashboard/individual/lists/[listId]` | `app/dashboard/individual/lists/[listId]/page.tsx` | List detail, contacts, add/import actions, links to campaigns/sequences. |
| component | `app/dashboard/individual/lists/_components/DeleteListButton.tsx` | Client delete list button; calls `/api/individual/lists/[listId]`. |
| component | `app/dashboard/individual/lists/[listId]/_components/DeleteContactButton.tsx` | Client delete contact button; calls `/api/individual/lists/[listId]/contacts/[contactId]`. |
| `/dashboard/individual/lists/[listId]/campaigns` | `app/dashboard/individual/lists/[listId]/campaigns/page.tsx` | Campaigns for a specific list. |
| `/dashboard/individual/lists/[listId]/sequences/new` | `app/dashboard/individual/lists/[listId]/sequences/new/page.tsx` | New sequence page. |
| component | `app/dashboard/individual/lists/[listId]/sequences/new/_components/SequenceBuilder.tsx` | Client multi-step sequence builder; calls `/api/individual/sequences`. |
| `/dashboard/individual/campaigns` | `app/dashboard/individual/campaigns/page.tsx` | All campaigns for tenant’s lists. |
| `/dashboard/individual/campaigns/create` | `app/dashboard/individual/campaigns/create/page.tsx` | Create-campaign page with list selection/form. |
| `/dashboard/individual/campaigns/[campaignId]` | `app/dashboard/individual/campaigns/[campaignId]/page.tsx` | Campaign detail and send controls. |
| component | `app/dashboard/individual/campaigns/_components/CreateCampaignForm.tsx` | Client form for campaign creation. |
| component | `app/dashboard/individual/campaigns/_components/CampaignComposer.tsx` | Client subject/body editor. |
| component | `app/dashboard/individual/campaigns/_components/AiWriteButton.tsx` | Client button/dialog for `/api/individual/ai/generate`. |
| component | `app/dashboard/individual/campaigns/_components/DeleteCampaignButton.tsx` | Client delete/danger action. |
| component | `app/dashboard/individual/campaigns/[campaignId]/_components/SendCampaignButton.tsx` | Client immediate-send button. |
| `/dashboard/individual/settings` | `app/dashboard/individual/settings/page.tsx` | Gmail SMTP settings and logout. |
| component | `app/dashboard/individual/settings/_components/GmailSettingsForm.tsx` | Client/server-action form to save/test Gmail SMTP. |
| component | `app/dashboard/individual/settings/_components/LogoutButton.tsx` | Client/server-action logout. |
| action file | `app/dashboard/individual/settings/actions.ts` | `saveGmailSettings()` encrypts Gmail app password and tests SMTP; `logout()` signs out. |

---

## 10. Complete API route map

### Enterprise public SDK/API routes (`/api/v1/*`)

All API-key routes expect `x-api-key` unless noted.

| Method + URL | File | Main function | Behavior |
|---|---|---|---|
| `GET /api/v1/check-auth` | `app/api/v1/check-auth/route.ts` | `GET(req)` | Validates `x-api-key` against `tenants.apiKey`; returns `tenantId`, `name`, `hasAccess`. Used by CLI/integrators. |
| `POST /api/v1/identify` | `app/api/v1/identify/route.ts` | `POST(req)` | Rate limits by IP, validates API key, parses `{ email, userId?, event? }`, creates/fetches `endUsers`, fires `user.identified` webhook for new users, sends welcome email non-blocking, optionally marks an initial event as completed. |
| `POST /api/v1/track` | `app/api/v1/track/route.ts` | `POST(req)` | Rate limits by IP, validates API key, parses `{ userId, stepId/event }`, requires existing end user, updates `completedSteps`, fires `user.activated` webhook. |
| `POST /api/v1/config` | `app/api/v1/config/route.ts` | `POST(req)` | Validates API key and stores tenant `activationStep`. |
| `GET /api/v1/settings` | `app/api/v1/settings/route.ts` | `GET(req)` | Supabase-authenticated; returns current tenant automation and email-sender settings. |
| `POST /api/v1/settings` | `app/api/v1/settings/route.ts` | `POST(req)` | Supabase-authenticated; updates automation settings and encrypted Resend sender config. |
| `GET /api/v1/analytics-data` | `app/api/v1/analytics-data/route.ts` | `GET(req)` | Supabase-authenticated; returns Enterprise totals, funnel, 30-day trend, recovery, and user matrix. |
| `POST /api/v1/nudge-step` | `app/api/v1/nudge-step/route.ts` | `POST(req)` | Supabase-authenticated; sends manual nudge for step 1/2/3 to stuck eligible Enterprise end users, honoring unsubscribes and email rate limits. |

### Individual dashboard API routes

| Method + URL | File | Behavior |
|---|---|---|
| `GET /api/individual/lists` | `app/api/individual/lists/route.ts` | Authenticated Individual tenant; returns tenant lists. |
| `POST /api/individual/lists` | `app/api/individual/lists/route.ts` | Validates name/description and `validateListCreation`, creates list. |
| `DELETE /api/individual/lists/[listId]` | `app/api/individual/lists/[listId]/route.ts` | Verifies tenant owns list, deletes it. |
| `GET /api/individual/lists/[listId]/contacts` | `app/api/individual/lists/[listId]/contacts/route.ts` | Verifies tenant owns list, returns contacts. |
| `POST /api/individual/lists/[listId]/contacts` | `app/api/individual/lists/[listId]/contacts/route.ts` | Validates contact, enforces contact limit, inserts contact. |
| `DELETE /api/individual/lists/[listId]/contacts/[contactId]` | `app/api/individual/lists/[listId]/contacts/[contactId]/route.ts` | Verifies ownership and deletes contact. |
| `POST /api/individual/lists/[listId]/import-csv` | `app/api/individual/lists/[listId]/import-csv/route.ts` | Growth/Pro CSV import; parses CSV headers/rows, enforces contact limit, inserts non-duplicates. |
| `GET /api/individual/lists/[listId]/campaigns` | `app/api/individual/lists/[listId]/campaigns/route.ts` | Verifies list ownership, returns campaigns. |
| `POST /api/individual/lists/[listId]/campaigns` | `app/api/individual/lists/[listId]/campaigns/route.ts` | Validates subject/body/schedule, enforces campaign limits, creates campaign. |
| `POST /api/individual/sequences` | `app/api/individual/sequences/route.ts` | Creates a multi-step campaign sequence, sends first step immediately to active contacts, enforces plan/email limits, supports Gmail SMTP fallback to Resend. |
| `POST /api/individual/ai/generate` | `app/api/individual/ai/generate/route.ts` | Growth/Pro AI gate; calls Gemini campaign generation, records `aiUsage`. |

### Enterprise dashboard support routes under `/api/individual/*`

These names are historical/misleading: they are Enterprise-focused.

| Method + URL | File | Behavior |
|---|---|---|
| `GET /api/individual/drip-steps` | `app/api/individual/drip-steps/route.ts` | Authenticated Enterprise tenant; returns tenant `dripSteps`. |
| `POST /api/individual/drip-steps` | `app/api/individual/drip-steps/route.ts` | Authenticated Enterprise tenant; enforces plan `maxDripSteps`, replaces tenant drip-step rows. |
| `GET /api/individual/webhooks` | `app/api/individual/webhooks/route.ts` | Authenticated Enterprise Advanced tenant; returns webhooks. |
| `POST /api/individual/webhooks` | `app/api/individual/webhooks/route.ts` | Authenticated Enterprise Advanced tenant; validates HTTPS URL/events, max 5 webhooks, creates secret. |
| `DELETE /api/individual/webhooks` | `app/api/individual/webhooks/route.ts` | Authenticated Enterprise tenant; deletes webhook by id. |

### Tracking endpoints

| Method + URL | File | Behavior |
|---|---|---|
| `GET /api/track/open?c=&e=&t=` | `app/api/track/open/route.ts` | Verifies HMAC token; records `campaignEvents` open event; returns 1x1 transparent GIF. |
| `GET /api/track/click?c=&e=&t=&url=` | `app/api/track/click/route.ts` | Verifies HMAC token; records click event including target URL; redirects to decoded target. |

### Cron/automation endpoints

| Method + URL | File | Behavior |
|---|---|---|
| `GET /api/cron` | `app/api/cron/route.ts` | Main scheduled worker. Requires `Authorization: Bearer ${CRON_SECRET}` when `CRON_SECRET` is configured. Processes Enterprise stuck-user automations and Individual delayed sequence steps. |
| `GET /api/cron/process-stalls` | `app/api/cron/process-stalls/route.ts` | Older/simple stall processor: finds old end users with no `lastEmailedAt`, compares against tenant `activationStep`, sends basic nudge. |

### Billing/payment endpoints

| Method + URL | File | Behavior |
|---|---|---|
| `POST /api/razorpay/create-subscription` | `app/api/razorpay/create-subscription/route.ts` | Authenticated tenant; maps internal plan id to Razorpay plan env var, calls Razorpay Subscriptions API, returns subscription id. |
| `POST /api/razorpay/cancel-subscription` | `app/api/razorpay/cancel-subscription/route.ts` | Authenticated tenant; currently clears local subscription/plan back to free. |
| `POST /api/razorpay/create-order` | `app/api/razorpay/create-order/route.ts` | Deprecated; returns 410. |
| `POST /api/webhook/razorpay` | `app/api/webhook/razorpay/route.ts` | Verifies signature, deduplicates event id, resolves subscription plan, updates tenant plan/expiry/renewal/subscription id. |
| `POST /api/stripe/create-checkout` | `app/api/stripe/create-checkout/route.ts` | Legacy Stripe Checkout session creator. |
| `POST /api/stripe/create-portal` | `app/api/stripe/create-portal/route.ts` | Legacy Stripe Billing Portal session creator. |
| `POST /api/webhook/stripe` | `app/api/webhook/stripe/route.ts` | Legacy Stripe webhook processor with idempotency. |

### Misc API

| Method + URL | File | Behavior |
|---|---|---|
| `POST /api/onboard` | `app/api/onboard/route.ts` | Legacy/manual onboarding endpoint; validates API key/body, inserts or updates `endUsers`. |

---

## 11. Function and call-flow map by domain

### Auth/session helpers

- `createClient()` in `utils/supabase/server.ts`: server-side Supabase client bound to Next cookies.
- `createClient()` in `utils/supabase/client.ts`: browser-side Supabase client.
- `updateSession(request)` in `utils/supabase/middleware.ts`: refreshes cookies/session for middleware.
- `getSession()` in `lib/auth/get-session.ts`: React-cached Supabase `auth.getUser()` wrapper; returns `{ user }`.
- `getTenant(email)` in `lib/auth/get-tenant.ts`: React-cached Drizzle tenant lookup by email.
- `getUserTier()` in `lib/auth/get-user-tier.ts`: Supabase user → tenant tier helper.

### Tier/server actions

- `setTier(tier)` in `lib/actions/set-tier.ts`:
  - Calls server Supabase `createClient()`.
  - Calls `supabase.auth.getUser()`.
  - Reads/inserts/updates `tenants`.
  - Generates `obf_live_...` API key for Enterprise.
  - Sends welcome email with `buildEmailHtml()` through Resend.
- `generateApiKey()` in `app/actions/api-key.ts`:
  - Requires logged-in Supabase user.
  - Generates and stores a new API key on tenant.
  - Calls `revalidatePath('/dashboard')`.

### Enterprise API call flow

#### `OnboardFlow.identify()` SDK method

`sdk/src/index.ts`:

1. Constructor receives API key and optional `baseUrl`; default is `https://www.onboardflow.xyz/api/v1`.
2. `identify({ userId, email })` calls private `_request('/identify', body)`.
3. `_request()` sends JSON with `x-api-key`.
4. Server route `POST /api/v1/identify` validates and inserts/updates `endUsers`.

#### `OnboardFlow.track()` SDK method

1. `track({ userId, stepId })` calls `_request('/track', body)`.
2. Server route `POST /api/v1/track` validates tenant/user and appends `stepId` to `completedSteps`.
3. Non-blocking `deliverWebhookEvent(tenant.id, 'user.activated', payload)` runs for new step completion.

### Enterprise automation flow

#### Admin configuration

- Dashboard UI `app/dashboard/settings/page.tsx` or Enterprise drip-step pages fetch/save settings.
- `/api/v1/settings` updates legacy three-step tenant fields.
- `/api/individual/drip-steps` updates normalized `dripSteps` rows.

#### Main cron `/api/cron`

1. Optional `CRON_SECRET` Authorization check.
2. Finds Enterprise tenants with automation enabled or drip steps.
3. Resolves sender priority by tenant:
   - encrypted tenant Resend API key + from email;
   - verified Gmail SMTP;
   - shared Resend fallback.
4. For each tenant, evaluates end users against configured automations:
   - legacy step fields and/or `dripSteps`.
   - `completedSteps`, `createdAt`, `automationsReceived`, and configured delay determine eligibility.
5. Checks Enterprise email limits through `checkEmailRateLimit()`.
6. Sends email with `buildEmailHtml()`.
7. Calls `incrementEmailCount()`.
8. Updates user `automationsReceived` and `lastEmailedAt`.
9. Fires `deliverWebhookEvent(tenant.id, 'user.stuck', payload)` non-blocking.
10. Then processes Individual delayed sequence steps from `individualCampaigns` with `sequenceId` and `sequencePosition > 1`.

#### Manual nudge `/api/v1/nudge-step`

1. Requires logged-in Supabase user.
2. Reads `stepIndex` 1/2/3.
3. Loads tenant settings and candidate `endUsers`.
4. Filters unsubscribed emails.
5. Checks prior step completion and current step non-completion.
6. Sends configured email through resolved sender.
7. Updates `automationsReceived`/`lastEmailedAt` and Enterprise usage counts.

### Individual campaign flow

#### Lists and contacts

- Pages call REST routes under `/api/individual/lists`.
- Each route calls a local helper named `getVerifiedIndividualTenant()`:
  - Supabase `auth.getUser()`.
  - Tenant lookup by email.
  - Requires `tier === 'individual'`.
- Limit enforcement uses `lib/rate-limit/individual.ts`:
  - `validateListCreation(tenantId)` uses effective plan and current list count.
  - `validateContactAddition(tenantId, listId)` uses effective plan and contacts per list.
  - `validateCampaignCreation(tenantId, listId)` uses effective plan and current campaigns per list.

#### Campaign creation/send/tracking

- Campaign rows are stored in `individualCampaigns`.
- `CampaignComposer` and create forms write subject/body/schedule through list campaign endpoints/pages.
- `AiWriteButton` calls `/api/individual/ai/generate`; route checks effective plan `aiEnabled` then calls `generateCampaign()`.
- Sending code uses `buildEmailHtml()` and may use:
  - Gmail SMTP if tenant has verified SMTP fields;
  - shared Resend fallback.
- `buildEmailHtml()` can add unsubscribe links and tracking pixel.
- `injectTracking()` rewrites `https?://...` URLs to `/api/track/click?...` when tracking is enabled.
- `createOpenTrackingUrl()` builds `/api/track/open?...`.
- `createTrackingToken()` and `verifyTrackingToken()` use HMAC-SHA256 with `TRACKING_HMAC_SECRET` or a fallback development secret.

#### Sequences

`POST /api/individual/sequences`:

1. Requires Individual tenant.
2. Validates list ownership and plan features.
3. Creates multiple `individualCampaigns` with same `sequenceId` and increasing `sequencePosition`.
4. Sends first step immediately to non-unsubscribed contacts.
5. Increments monthly email usage.
6. Later sequence steps are sent by `/api/cron` after previous step `sentAt + sendDelayDays`.

### Billing flow

#### UI

- Individual: `app/dashboard/individual/billing/page.tsx` renders `INDIVIDUAL_PLANS` cards and `BillingActions`.
- Enterprise: `app/dashboard/enterprise/billing/page.tsx` renders `ENTERPRISE_PLANS` cards and likely reuses similar Razorpay behavior.
- `BillingActions` dynamically loads `https://checkout.razorpay.com/v1/checkout.js`, calls `/api/razorpay/create-subscription`, opens Razorpay Checkout, and reloads on successful handler callback.

#### Create subscription

`POST /api/razorpay/create-subscription`:

1. Requires `getSession()` user and `getTenant(user.email)`.
2. Accepts `{ planId }`.
3. Finds plan in Individual + Enterprise plan arrays.
4. Maps to env var named `RAZORPAY_PLAN_${planId.toUpperCase()}`.
5. Calls Razorpay Subscriptions API using Basic auth from `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`.
6. Returns `subscriptionId`.

#### Razorpay webhook

`POST /api/webhook/razorpay`:

1. Reads raw body and `x-razorpay-signature`.
2. Validates signature with `RAZORPAY_WEBHOOK_SECRET`.
3. Deduplicates using `processedWebhookEvents.stripeEventId`.
4. Handles subscription/payment events.
5. Resolves internal plan id from Razorpay plan id env vars.
6. Updates matching tenant by `razorpaySubscriptionId` with plan, expiry, renewal, and subscription id.

### Email helpers

- `buildEmailHtml(options)` in `lib/email/templates.ts`:
  - Escapes/normalizes plain body into HTML.
  - Optionally injects tracking pixel URL.
  - Optionally appends unsubscribe link using `unsubscribeToken` and `senderEmail`.
- `createUnsubscribeToken(email)` in `lib/email/templates.ts`:
  - HMAC-ish token helper based on email and secret.
- `encryptPassword(plain)` / `decryptPassword(stored)` in `lib/email/smtp.ts`:
  - AES encryption for SMTP/Resend secrets.
- `testSmtpConnection(email, password)`:
  - Creates Gmail transporter and verifies credentials.
- `createGmailTransporter(email, decryptedPassword)`:
  - Nodemailer Gmail service transporter.

### Webhook delivery helper

`deliverWebhookEvent(tenantId, eventType, payload)` in `lib/webhooks/deliver.ts`:

1. Selects active webhooks for tenant whose `events` array contains `eventType`.
2. For each webhook, builds JSON body with `event`, `createdAt`, and `data`.
3. Signs body with HMAC-SHA256 using webhook secret.
4. POSTs to webhook URL with signature header.
5. Inserts `webhookDeliveries` row with status/success.
6. Catches and stores failed deliveries without throwing to caller.

### Rate-limit/usage helpers

- `checkApiRateLimit(ip)` in `lib/rate-limit/api.ts`: in-memory LRU limit for public API calls.
- `checkEmailRateLimit(tenantId)` in `lib/rate-limit/enterprise.ts`: checks Enterprise monthly email usage/plan cap.
- `incrementEmailCount(tenantId)` in `lib/rate-limit/enterprise.ts`: increments tenant email usage counter.
- `checkEndUserLimit(tenantId, currentCount)` in `lib/rate-limit/enterprise.ts`: enforces Enterprise tracked-user cap.
- `getMonthlyEmailUsage(tenantId)` in `lib/rate-limit/email-usage.ts`: counts current-month usage/transactions.
- `incrementEmailUsage(tenantId, incrementBy)` in `lib/rate-limit/email-usage.ts`: records monthly Individual email usage.
- `validateListCreation`, `validateContactAddition`, `validateCampaignCreation` in `lib/rate-limit/individual.ts`: enforce Individual plan limits.

---

## 12. SDK and CLI

### SDK package

Location: `sdk/`

- `sdk/src/index.ts` exports class `OnboardFlow`.
- Methods:
  - `identify({ userId, email })` → `POST {baseUrl}/identify`.
  - `track({ userId, stepId })` → `POST {baseUrl}/track`.
- Private `_request(path, body)` sets JSON headers and `x-api-key`, throws on non-2xx response.

### CLI setup wizard

Location: `cli.js`

- Uses `@clack/prompts`.
- Asks user stack: MERN or Next.js App Router.
- For MERN, requests API key and writes generated `auth.js` with Express middleware using OnboardFlow-style API calls.
- For Next.js, writes starter helper/middleware-oriented files/snippets for integration.
- This is a local helper and not part of the Next app runtime.

---

## 13. Shared components

### UI primitives (`components/ui/*`)

- `button.tsx`: `Button` with variants `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`; styles are token based (`primary`, `accent`, `input`, etc.).
- `badge.tsx`: `Badge` variants.
- `card.tsx`: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- `input.tsx`, `textarea.tsx`, `label.tsx`, `switch.tsx`, `table.tsx`, `sonner.tsx`: shadcn-style primitives.

### Other shared components

- `components/submit-button.tsx`: pending-aware submit button using `useFormStatus()`.
- `components/analytics/FunnelChart.tsx`: Recharts funnel/analytics card.
- `components/analytics/ChartWrapper.tsx`: dynamic import wrapper to avoid SSR chart issues.
- `app/_components/PlanMeter.tsx`: plan usage meter with optional billing link.
- `app/_components/TierChips.tsx`: pre-auth landing tier chip UI; visual only, not persisted.

---

## 14. Environment variables seen in code

Likely required/used variables:

### Supabase/Auth

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

### Database

- `DATABASE_URL`

### Email/AI

- `RESEND_API_KEY`
- `SMTP_ENCRYPTION_KEY`
- `GEMINI_API_KEY`
- `TRACKING_HMAC_SECRET`

### Cron

- `CRON_SECRET`

### Razorpay

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PLAN_IND_STARTER`
- `RAZORPAY_PLAN_IND_GROWTH`
- `RAZORPAY_PLAN_IND_PRO`
- `RAZORPAY_PLAN_ENT_BASIC`
- `RAZORPAY_PLAN_ENT_ADVANCED`

### Stripe legacy

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Stripe price/customer-related env vars referenced by Stripe routes.

---

## 15. Known quirks and naming mismatches

1. `/api/individual/drip-steps` and `/api/individual/webhooks` are Enterprise endpoints despite the path name.
2. `processedWebhookEvents.stripeEventId` is used as a generic idempotency column, including Razorpay events.
3. README still says Stripe is “coming soon,” but Razorpay is the current subscription path in code.
4. The dashboard has both legacy shared `/dashboard/settings` and newer tier-specific `/dashboard/enterprise/*` and `/dashboard/individual/*` routes.
5. Some comments still say “MODIFIED” or “NEW FILE” from prior agent edits; they are historical and not necessarily meaningful.
6. `next lint` may fail in Next 15+ because the command has been removed/deprecated; use TypeScript/build checks as primary validation.

---

## 16. Suggested reading order for a new AI/contributor

1. `db/schema.ts` — understand all persistent objects first.
2. `lib/plans/limits.ts` and `lib/plans/get-tenant-plan.ts` — understand tiers and feature gates.
3. `middleware.ts`, `utils/supabase/*`, `lib/auth/*` — understand authentication and route protection.
4. `app/page.tsx`, `app/actions.ts`, `app/auth/callback/route.ts`, `app/tier-selection/*` — understand first-time user flow.
5. `app/dashboard/page.tsx`, `app/dashboard/enterprise/layout.tsx`, `app/dashboard/individual/layout.tsx` — understand tier routing and app shells.
6. Enterprise path: `/api/v1/*`, `/api/cron`, `lib/webhooks/deliver.ts`, `app/dashboard/enterprise/*`.
7. Individual path: `/api/individual/lists/*`, `/api/individual/sequences`, `/api/individual/ai/generate`, tracking helpers, `app/dashboard/individual/*`.
8. Billing path: `app/dashboard/*/billing`, `/api/razorpay/*`, `/api/webhook/razorpay`, then legacy Stripe routes only if needed.
9. SDK/CLI path: `sdk/src/index.ts`, `sdk/README.md`, `cli.js`.

---

## 17. Common change recipes

### Add a new authenticated dashboard page

1. Decide tier: Enterprise or Individual.
2. Add `app/dashboard/{tier}/new-page/page.tsx`.
3. The tier layout will already enforce login and tier.
4. Add nav link in `app/dashboard/{tier}/_components/NavLinks.tsx`.
5. Use token classes (`bg-background`, `text-foreground`, `bg-card`, `border-border`) so `.theme-deep` applies.

### Add an Enterprise SDK endpoint

1. Add route under `app/api/v1/.../route.ts`.
2. Validate `x-api-key` against `tenants.apiKey`.
3. Apply `checkApiRateLimit(ip)` if public/integrator-facing.
4. Read/write `endUsers` or relevant table.
5. If event-worthy, call `deliverWebhookEvent(...)` non-blocking.
6. Update `sdk/src/index.ts` if it should be public in the SDK.
7. Update `/docs` and this `context.md`.

### Add an Individual plan-gated feature

1. Add plan capability/limit in `lib/plans/limits.ts`.
2. Use `getTenantPlan(tenant.id)` in route/page.
3. Block feature in API route, not just UI.
4. Update billing highlights if relevant.
5. Update `PlanMeter`/dashboard cards if usage is surfaced.

### Add email sending code

1. Prefer tenant Gmail SMTP if `smtpVerified`, `smtpEmail`, `smtpPassword` exist.
2. Decrypt stored secrets with `decryptPassword()`.
3. Use `buildEmailHtml()` so unsubscribe/tracking conventions remain consistent.
4. Enforce monthly email limits before sending.
5. Increment usage after successful sends.
6. Never let webhook/non-critical side effects fail the user-facing request unless the main send itself must fail.

### Add webhook event type

1. Decide event name, e.g. `campaign.sent`.
2. Make sure webhook creation UI allows/selects that event if user-configurable.
3. Call `deliverWebhookEvent(tenantId, eventName, payload)` where event occurs.
4. Keep payload JSON-serializable.
5. Check `webhookDeliveries` for debugging.

---

## 18. Test/check commands

Useful local validation commands:

```bash
npx tsc --noEmit
npm run build
node tests.js
node tests.e2e.js
```

Notes:

- `node tests.js` expects a running app (`BASE_URL` defaults to local) and relevant env vars/API keys for full coverage.
- `node tests.e2e.js` is browser/e2e-style and may require a running web server and browser dependencies.
- Build/type checks may need real env vars because many routes instantiate provider clients at module scope.

---

## 19. Quick “which page loads from where” summary

- Initial visitor → `/` → `app/page.tsx` → `app/actions.ts` for login/OAuth.
- Magic-link callback → `/auth/callback` → `app/auth/callback/route.ts` → `/dashboard`.
- Dashboard router → `/dashboard` → `app/dashboard/page.tsx` → `/dashboard/enterprise` or `/dashboard/individual`.
- Enterprise shell → `app/dashboard/enterprise/layout.tsx` → child page.
- Individual shell → `app/dashboard/individual/layout.tsx` → child page.
- First-time user without tier → `/tier-selection` → `TierSelectionClient` → `setTier()` → tier dashboard.
- Enterprise SDK user → `sdk/src/index.ts` → `/api/v1/identify` and `/api/v1/track`.
- Enterprise automation → dashboard settings/drip steps → `/api/v1/settings` or `/api/individual/drip-steps` → `/api/cron` sends nudges.
- Individual marketer → lists/campaigns pages → `/api/individual/*` routes → campaign rows/contacts/email sends.
- Email recipient open/click → `/api/track/open` or `/api/track/click` → `campaignEvents`.
- Billing upgrade → dashboard billing page → `/api/razorpay/create-subscription` → Razorpay checkout → `/api/webhook/razorpay` updates tenant plan.
