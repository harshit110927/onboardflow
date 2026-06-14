# Master Context for the Dripmetric / OnboardFlow Repository

> This file is a complete handoff document for the repository at `/workspace/onboardflow`. It explains what the product is, how the code is organized, how data moves through authentication, tier selection, dashboards, APIs, email sending, tracking, automation, billing, and developer integrations, and what is implemented where.

---

## 1. Executive Summary

This repository implements **Dripmetric**, a Next.js 15 App Router SaaS application that serves two related product modes from the same codebase:

1. **Enterprise tier** — developer-facing onboarding automation. A SaaS developer creates a Dripmetric tenant, receives an API key, integrates the SDK or HTTP API, identifies end users, tracks onboarding events, configures drip/nudge steps, views analytics, and optionally receives outbound webhooks.
2. **Individual tier** — no-code email marketing and CRM-like contact management for freelancers and small businesses. A user creates lists, adds/imports contacts, writes campaigns and sequences, optionally uses AI writing, sends email via Resend or Gmail SMTP, tracks opens/clicks, manages tags/notes/follow-ups, and sees a contact pipeline.

The app uses:

- **Next.js App Router** for pages, layouts, server actions, and API routes.
- **Supabase Auth** for magic-link and Google OAuth login.
- **PostgreSQL** accessed through **Drizzle ORM** for application data.
- **Resend** and **Nodemailer/Gmail SMTP** for email delivery.
- **Gemini** for AI campaign generation.
- **Stripe** and **Razorpay** payment integrations.
- A small **TypeScript SDK** in `sdk/` for Enterprise customers.
- A small setup **CLI** in `cli.js`.

The repository name and some older artifacts still use the previous **OnboardFlow** naming (`onboardflow.config.json`, `obf_live_` API keys, `X-OnboardFlow-Signature` webhook header), while the user-facing brand is mostly **Dripmetric**.

---

## 2. High-Level Product Areas

### 2.1 Public / Pre-auth Product

The public app contains:

- Landing page at `app/page.tsx`, whose main nav and footer link to the public pricing page.
- Waitlist endpoint at `app/api/waitlist/route.ts`.
- Login pages and server actions under `app/(auth)/login/*` and `app/actions.ts`.
- Auth callback at `app/auth/callback/route.ts`.
- Check-email waiting page at `app/check-email/page.tsx`.
- Public Enterprise pricing page at `app/pricing/page.tsx` with Free, Basic, and Advanced cards, monthly/annual pricing toggle, FAQ, Free CTA to `/login`, and placeholder paid CTAs pending a destination decision.
- Tier selection at `app/tier-selection/page.tsx` and `app/tier-selection/_components/TierSelectionClient.tsx`.
- Legal/static pages: `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/docs/page.tsx`.
- SEO helpers: `app/sitemap.xml/route.ts`, `public/robots.txt`, `app/api/og/route.tsx`.

### 2.2 Enterprise Product

Enterprise users get:

- `/dashboard/enterprise` overview dashboard.
- API key card and nudge controls.
- `/dashboard/enterprise/users` Users CRM screen with paginated end-user table, status tabs, email search, sortable columns, CSV export, and a disabled per-user nudge placeholder.
- Analytics powered by `/api/v1/analytics-data`.
- Automation settings powered by `/api/v1/settings` and dashboard settings pages.
- Configurable drip steps through `/dashboard/enterprise/drip-steps` and `/api/individual/drip-steps` despite the confusing route prefix.
- Outgoing webhook management through `/dashboard/enterprise/webhooks` and `/api/individual/webhooks`.
- Public developer API endpoints under `/api/v1/*`:
  - `/api/v1/check-auth`
  - `/api/v1/identify`
  - `/api/v1/track`
  - `/api/v1/config`
  - `/api/v1/settings`
  - `/api/v1/analytics-data`
  - `/api/v1/nudge-step`
  - `/api/v1/users`
  - `/api/v1/users/[userId]`

### 2.3 Individual Product

Individual users get:

- `/dashboard/individual` overview dashboard.
- `/dashboard/individual/lists` list management.
- `/dashboard/individual/lists/[listId]` contact management.
- `/dashboard/individual/lists/[listId]/campaigns` list-specific campaigns.
- `/dashboard/individual/lists/[listId]/sequences/new` sequence builder.
- `/dashboard/individual/campaigns` campaign overview.
- `/dashboard/individual/campaigns/create` campaign creation.
- `/dashboard/individual/campaigns/[campaignId]` campaign detail and send action.
- `/dashboard/individual/pipeline` CRM-style pipeline board.
- `/dashboard/individual/settings` Gmail/SMTP and account settings.
- `/dashboard/individual/billing` plan cards and billing actions.
- Individual API endpoints under `/api/individual/*` for lists, contacts, campaigns, imports, AI, pipeline, tags, notes, reminders, engagement, and webhooks.

---

## 3. Repository Structure

```text
app/                         Next.js App Router pages, layouts, API routes, server actions
app/_components/             Shared landing-page-only components/effects
app/(auth)/login/            Login page and login server action
app/api/                     All HTTP API route handlers
app/dashboard/               Authenticated dashboards and dashboard server actions
app/tier-selection/          First-run tier selection page/client
components/                  Shared UI and analytics components
components/ui/               shadcn-style reusable primitives
components/analytics/        Funnel/chart components used by analytics pages
db/                          Drizzle database client and schema
lib/                         Business logic helpers: auth, plans, limits, email, tracking, webhooks, AI
sdk/                         Published-package-style TypeScript SDK source and README
supabase/migrations/         SQL migrations and Drizzle migration metadata
utils/supabase/              Browser/server/middleware Supabase clients
public/                      Static public files
cli.js                       Local setup wizard for integrators
README.md                    Product README
API.md                       Public REST API reference with curl, Python, Ruby, and Node examples
context.md                   Older handoff/context file
master_context.md            This generated complete context document
```

---

## 4. Runtime and Build Configuration

### 4.1 Package and scripts

`package.json` declares the app as `dripmetric` and provides:

- `npm run dev` → `next dev`
- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run lint` → `next lint`

Important dependencies include Next 15, React 19, Supabase SSR/client libraries, Drizzle, postgres, Resend, Nodemailer, Stripe, Gemini, PapaParse, Recharts, Zod, Tailwind utilities, Radix UI primitives, and Sonner.

### 4.2 Next.js config

`next.config.js` sets security-related response headers globally:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, microphone, geolocation
- `X-DNS-Prefetch-Control: on`

### 4.3 Tailwind and styling

`tailwind.config.ts` scans `app/`, `components/`, and `pages/`, uses class-based dark mode, and maps color tokens to CSS variables. Global styles live in `app/globals.css`.

### 4.4 Drizzle configuration

`drizzle.config.ts` loads `.env.local`, points Drizzle to `db/schema.ts`, writes migrations to `supabase/migrations`, uses PostgreSQL, and reads `DATABASE_URL`.

---

## 5. Environment Variables and External Services

The code expects these environment variables in different places:

### 5.1 Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Used by browser, server, and middleware Supabase clients.

### 5.2 Database

- `DATABASE_URL`

Used by `db/index.ts` to create the Postgres client and Drizzle DB object.

### 5.3 Email

- `RESEND_API_KEY` — shared fallback Resend sender and system emails.
- `ENCRYPTION_KEY` or equivalent expected by SMTP helper if present in `lib/email/smtp.ts`.
- Tenant-specific encrypted Resend and SMTP credentials are stored on `tenants`.

### 5.4 AI

- `GEMINI_API_KEY`

Used by `lib/ai/generate-campaign.ts`.

### 5.5 Tracking

- `TRACKING_HMAC_SECRET`
- `NEXT_PUBLIC_BASE_URL` or `NEXT_PUBLIC_APP_URL`

Used by tracking token and URL helpers.

### 5.6 Payments

Stripe and Razorpay routes expect standard secrets/IDs, including:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Stripe price IDs used by checkout route and webhook mapping.
- Razorpay key/secret and webhook secret values used by Razorpay order/subscription/webhook routes.

### 5.7 Cron

- `CRON_SECRET`

`app/api/cron/route.ts` requires a matching `Authorization: Bearer <CRON_SECRET>` header.

---

## 6. Database Layer

### 6.1 DB client

`db/index.ts` creates a `postgres` client and exports `db = drizzle(client, { schema })`. In production it creates a direct client. In development it stores the client on `global.postgresClient` to survive hot reloads without opening many connections.

### 6.2 Primary schema file

`db/schema.ts` is the canonical TypeScript schema for most application tables. Some raw SQL code also references an `email_usage` table that is not represented as a Drizzle `pgTable` in this file, so migrations must contain it separately for email usage features to work.

### 6.2.1 Manual schema changes to apply when not running Drizzle migrations

When applying database changes by copy-pasting SQL instead of running Drizzle migrations, apply every schema change listed here in order:

1. `supabase/migrations/0002_add_end_users_properties.sql` adds customer-supplied identify metadata to Enterprise end users:

```sql
ALTER TABLE "end_users" ADD COLUMN IF NOT EXISTS "properties" jsonb;
```

This column is nullable, has no default, and is intentionally additive/safe for a live database.

No database schema change was added for the public `/api/v1/users` endpoints; they read existing `end_users` and `tenants` data only.

### 6.3 Tables and relationships

#### `tenants`

Root account row. One Supabase-authenticated app user maps to one tenant by email.

Important columns:

- Identity: `id`, `email`, `name`.
- Legacy access: `licenseKey`, `hasAccess`.
- Enterprise API: `apiKey`.
- Billing: `stripeCustomerId`, `razorpaySubscriptionId`, `plan`, `planExpiresAt`, `planRenewalDate`, `credits`, `creditsUpdatedAt`.
- Product branch: `tier` is `enterprise`, `individual`, or `null` until tier selection.
- Enterprise automation: `automationEnabled`, `activationStep`, `emailSubject`, `emailBody`, `step2`, `emailSubject2`, `emailBody2`, `step3`, `emailSubject3`, `emailBody3`.
- Tenant senders: encrypted `resendApiKey`, `resendFromEmail`, `smtpEmail`, encrypted `smtpPassword`, `smtpVerified`, `smtpProvider`.
- Miscellaneous: `whatsappTemplate`.

#### `endUsers`

Enterprise customers' users tracked by tenant.

Important columns:

- `tenantId` references `tenants.id`.
- `externalId` is the customer application's user ID.
- `email` is optional but required for email automations.
- `properties` is nullable JSONB metadata supplied by the customer backend through identify calls, commonly containing plan/payment state such as `plan`, `planValue`, and `customerType`; public user listing/detail APIs return this field as `object | null`.
- `completedSteps` is JSON string array of event/step codes.
- `lastEmailedAt` records latest automation email.
- `automationsReceived` is an array of tags such as `nudge_step1`.
- `lastSeenAt` and `createdAt` power analytics and inactivity logic.

#### `individualLists`

Email lists for Individual tenants.

- `userId` references `tenants.id`.
- Contains list name, description, timestamps.

#### `individualContacts`

Contacts belong to `individualLists`.

- `listId` references `individualLists.id` with cascade delete.
- `name`, `email`, `phone`.
- `customFields` JSON object.
- Follow-up fields: `followUpAt`, `followUpNote`, `followUpSent`.
- CRM pipeline: `pipelineStage` defaulting to `new`.
- Unique index on `(listId, email)` prevents duplicates inside one list.

#### `contactNotes`

Notes attached to a contact and tenant.

- `contactId` references `individualContacts.id` with cascade delete.
- `tenantId` references `tenants.id` with cascade delete.
- `body`, `createdAt`, `updatedAt`.

#### `contactTags`

Tenant-scoped tag definitions.

- `tenantId`, `name`, `color`.
- Unique constraint on `(tenantId, name)`.

#### `contactTagAssignments`

Many-to-many link between contacts and tags.

- Composite primary key `(contactId, tagId)`.

#### `individualCampaigns`

Campaigns and sequence steps for Individual tenants.

- `listId` references `individualLists.id`.
- `subject`, `body`, `status` (`draft`, `scheduled`, `sent`, etc.).
- `scheduledAt`, `sentAt`, `createdAt`.
- Sequence metadata: `sequenceId`, `sequencePosition`, `sendDelayDays`.

#### `campaignEvents`

Open/click tracking for Individual campaigns.

- `campaignId` references `individualCampaigns.id`.
- `contactEmail` stores recipient email.
- `eventType` stores values like `open`, `opened`, `click`, or `clicked` depending on route.
- `eventData` and `occurredAt` store details.

#### `unsubscribedContacts`

Global unsubscribe table keyed by email.

- All campaign/automation send paths should check this before sending.

#### `waitlistEntries`

Public waitlist submissions.

- Unique email.
- Source defaults to `v2_landing`.
- Stores user agent and created timestamp.

#### `creditTransactions`

Ledger for credit purchases and credit usage.

#### `stripeSubscriptions`

Stripe subscription mirror table.

#### `processedWebhookEvents`

Idempotency table for external payment webhooks. Column is named `stripeEventId`, but Razorpay code also stores Razorpay event IDs here.

#### `aiUsage`

Monthly AI generation tracking for Individual tenants.

#### `dripSteps`

Enterprise configurable drip/nudge steps.

- `tenantId`, `position`, `eventTrigger`, `emailSubject`, `emailBody`, `delayHours`.

#### `webhooks`

Enterprise outgoing webhook endpoints.

- `tenantId`, HTTPS `url`, subscribed `events`, signing `secret`, `active` flag.

#### `webhookDeliveries`

Audit log of outgoing webhook attempts.

- `webhookId`, `eventType`, JSON payload string, response status, delivery timestamp, success flag.

---

## 7. Authentication and Tenant Lifecycle

### 7.1 Supabase clients

- `utils/supabase/client.ts` exports `createClient()` for browser code using `createBrowserClient`.
- `utils/supabase/server.ts` exports async `createClient()` for server components/actions/routes. It uses `cookies()` and gracefully ignores cookie writes from server components.
- `utils/supabase/middleware.ts` exports `updateSession()` that refreshes the user session and writes cookies into a `NextResponse`.
- The active root `middleware.ts` manually creates a Supabase server client and calls `supabase.auth.getUser()` on matched routes.

### 7.2 Login flow

There are two login action files:

- `app/actions.ts` contains the main login action and Google OAuth action used by the public landing/auth flow.
- `app/(auth)/login/actions.ts` contains another magic-link login action scoped to the login route group.

The main flow:

1. User submits email on login form.
2. Server action calls `supabase.auth.signInWithOtp` with dynamic redirect to `/auth/callback`.
3. User is redirected to `/check-email`.
4. User clicks the magic link.
5. Supabase redirects to `app/auth/callback/route.ts`.
6. Callback exchanges code for a session.
7. The app checks whether a tenant row exists and whether `tier` is set.
8. User goes to `/tier-selection` if no tier is set; otherwise to the proper dashboard.

Google OAuth flow in `app/actions.ts` calls `supabase.auth.signInWithOAuth({ provider: "google" })` with redirect to `/auth/callback`.

### 7.3 Middleware routing rules

Root `middleware.ts` applies to:

- `/dashboard/:path*`
- `/account/:path*`
- `/tier-selection`

Rules:

1. `/tier-selection` without a logged-in user redirects to `/login`.
2. For logged-in users, middleware loads the tenant row from Supabase's `tenants` table by email and reads `tier`.
3. Dashboard access without a selected tier redirects to `/tier-selection`.
4. Visiting `/tier-selection` after tier is already selected redirects to `/dashboard/enterprise` or `/dashboard/individual`.

### 7.4 Tenant creation and tier selection

`lib/actions/set-tier.ts` is the key first-run server action.

Input:

- `tier: "enterprise" | "individual"`.

Logic:

1. Authenticates the Supabase user.
2. Loads tenant by email.
3. If selecting Enterprise, generates API key with prefix `obf_live_` and random hex bytes.
4. If no tenant exists, inserts a new `tenants` row with email, default name `Founder`, tier, and optional API key.
5. If tenant exists with `tier === null`, updates it.
6. If tenant already has a tier, throws `Tier already set`.
7. Sends a non-blocking welcome email through Resend.
8. Returns redirect target based on tier.

### 7.5 Cached auth helpers

- `lib/auth/get-session.ts` returns cached Supabase user.
- `lib/auth/get-tenant.ts` returns cached tenant row by email.
- `lib/auth/get-user-tier.ts` returns cached/current user's tier or null.

These helpers are used heavily by dashboard server components.

---

## 8. Plan, Billing, and Limit Model

### 8.1 Plan constants

`lib/plans/limits.ts` defines all plan tiers and limits.

Individual plan tiers:

- `free`
- `starter`
- `growth`
- `pro`

Enterprise plan tiers:

- `free`
- `basic`
- `advanced`

### 8.2 Individual limits

- Free: 1 list, 25 contacts/list, 50 emails/month, no CSV import, no tracking, no AI.
- Starter: 3 lists, 100 contacts/list, 500 emails/month, no CSV import, no tracking, no AI.
- Growth: 10 lists, 200 contacts/list, 2,000 emails/month, CSV import enabled, tracking enabled, AI enabled.
- Pro: 15 lists, 500 contacts/list, 6,000 emails/month, CSV import enabled, tracking enabled, AI enabled.

Individual paid plan cards:

- `ind_starter` → `starter`
- `ind_growth` → `growth`
- `ind_pro` → `pro`

### 8.3 Enterprise limits

- Free: 50 tracked users, 300 emails/month, 3 drip steps, no webhooks, no advanced analytics.
- Basic: 500 tracked users, 3,000 emails/month, 3 drip steps, no webhooks, no advanced analytics.
- Advanced: 2,000 tracked users, 10,000 emails/month, unlimited drip steps, webhooks enabled, advanced analytics enabled.

Enterprise paid plan cards:

- `ent_basic` → `basic`
- `ent_advanced` → `advanced`

### 8.4 Effective plan resolution

`lib/plans/get-tenant-plan.ts` loads tenant billing fields and returns current plan metadata. If tenant is missing or `planExpiresAt` is in the past, the effective plan falls back to `free`.

### 8.5 Individual rate limits

`lib/rate-limit/individual.ts` provides:

- `validateListCreation(tenantId)` — checks current list count against the plan's `maxLists`.
- `validateContactAddition(listId, tenantId)` — verifies list ownership and checks contact count against `maxContactsPerList`.
- `validateCampaignCreation(listId, tenantId)` — currently validates list ownership but does not impose a campaign count limit.

### 8.6 Enterprise rate limits

`lib/rate-limit/enterprise.ts` provides:

- `checkEmailRateLimit(tenantId)` — checks monthly email usage against Enterprise plan limit using raw SQL against `email_usage`.
- `incrementEmailCount(tenantId)` — increments daily/monthly email usage.
- `checkEndUserLimit(tenantId, currentCount)` — checks Enterprise tracked end-user count.

### 8.7 Generic email usage helpers

`lib/rate-limit/email-usage.ts` provides:

- `getMonthlyEmailUsage(tenantId)`
- `incrementEmailUsage(tenantId, incrementBy = 1)`

These are used by Individual campaign sending and billing UI logic.

### 8.8 API rate limiting

`lib/rate-limit/api.ts` provides in-memory per-IP API rate limiting for high-frequency API routes like `/api/v1/identify` and `/api/v1/track`. This is process-local and resets on server restart or serverless cold starts.

---

## 9. Enterprise Data Flow

### 9.1 API key generation

1. User logs in and chooses Enterprise in tier selection.
2. `setTier("enterprise")` creates or updates a tenant.
3. The tenant receives `apiKey = obf_live_<random>`.
4. Dashboard displays the API key through components such as `app/dashboard/ApiKeyCard.tsx`.
5. SDK or customer app sends this key in `x-api-key` headers for `/api/v1/*` endpoints.

### 9.2 SDK flow

`sdk/src/index.ts` exports class `Dripmetric`.

Constructor:

```ts
new Dripmetric(apiKey, { baseUrl? })
```

Defaults:

- `baseUrl = "https://www.dripmetric.com/api/v1"`

Methods:

- `identify({ userId, email, properties? })` → POST `/identify` with `x-api-key`; when `properties` is omitted the SDK sends the same body as before.
- `track({ userId, stepId })` → POST `/track` with `x-api-key`.

Each request:

1. Sends JSON body.
2. Uses `Content-Type: application/json` and `x-api-key`.
3. Throws `Dripmetric error (<status>)` when API response is not OK.
4. Returns parsed JSON on success.

### 9.3 Enterprise identify flow

Endpoint: `app/api/v1/identify/route.ts`.

Input:

- Header `x-api-key`.
- Body: `{ email, userId?, event?, properties? }`, where `properties` is an optional object for customer-supplied metadata such as plan/payment state.

Logic:

1. Applies per-IP API rate limit.
2. Validates API key against `tenants.apiKey`.
3. Parses JSON body manually from text for safer invalid-body handling.
4. Requires `email`.
5. Looks up `endUsers` by `(tenantId, email)`.
6. If no user exists:
   - Inserts `endUsers` with tenant ID, email, external ID = `userId || email`, optional `properties` or `null`, empty `completedSteps`, and timestamps.
   - Fires non-blocking outgoing webhook event `user.identified`.
7. If a user already exists and `properties` is provided, merges incoming properties over existing `endUsers.properties` so new keys overwrite matches and missing keys are preserved.
8. If this was a new user:
   - Sends an immediate welcome email via shared Resend sender.
   - Uses `tenant.emailSubject` and `tenant.emailBody` as the welcome copy if present.
9. If `event` is included:
   - Adds it to `completedSteps` if not already present.
   - Updates `lastSeenAt`.
10. Returns `{ success: true }`.

Data written:

- `endUsers`
- Possibly `webhookDeliveries` asynchronously through webhook delivery.

### 9.4 Enterprise track flow

Endpoint: `app/api/v1/track/route.ts`.

Input:

- Header `x-api-key`.
- Body: `{ userId, event? }` or `{ userId, stepId? }`.

Logic:

1. Applies per-IP API rate limit.
2. Validates API key against `tenants.apiKey`.
3. Parses JSON.
4. Resolves `stepCode = stepId ?? event`.
5. Requires `userId` and `stepCode`.
6. Looks up `endUsers` by `(tenantId, externalId = userId)`.
7. If user is missing:
   - Counts current tenant end users.
   - Checks plan's tracked-user limit.
   - Returns 404 telling caller to call `/identify` first.
8. If user exists and step is new:
   - Appends `stepCode` into `completedSteps`.
   - Updates `lastSeenAt`.
   - Fires non-blocking webhook event `user.activated` with user ID, step ID, and completed steps.
9. Error responses use the standard public API shape `{ success: false, error: { code, message } }`.
10. Returns `{ success: true, step: stepCode }`.

Data written:

- `endUsers.completedSteps`
- `endUsers.lastSeenAt`
- `webhookDeliveries` asynchronously when matching webhooks exist.

### 9.5 Enterprise users API flow

List endpoint: `app/api/v1/users/route.ts`.
Detail endpoint: `app/api/v1/users/[userId]/route.ts`.
Shared helpers: `lib/api/users.ts` and `lib/api/errors.ts`.

Input:

- Header `x-api-key`.
- `GET /api/v1/users` query parameters: optional `status` (`stalled`, `activated`, `at_risk`, `churned`), optional `page` defaulting to 1, and optional `limit` defaulting to 50 with a max clamp of 200.
- `GET /api/v1/users/[userId]` path parameter: `userId`, matched against `endUsers.externalId`.

Logic:

1. Applies the same per-IP API rate limit helper used by identify/track.
2. Validates API key against `tenants.apiKey`.
3. Reads end users for the authenticated tenant.
4. Computes status at request time without storing it:
   - `churned` if `properties.customerType === "churned"`.
   - `at_risk` if the user has at least one automation tag, `lastSeenAt` is more than 14 days ago, and the user is paying (`properties.customerType === "paying"` or `properties.planValue > 0`).
   - `stalled` if the tenant has an `activationStep` and the user has not completed it, or if no activation step is configured and the user has no completed steps.
   - `activated` if the user completed the tenant activation step, or if no activation step is configured and the user has any completed step.
5. The list endpoint filters by computed status server-side, paginates after filtering, and returns `success`, `users`, `total`, `page`, and `limit`.
6. The detail endpoint returns one formatted user or a standard `USER_NOT_FOUND` error.

No data is written by these endpoints.

### 9.6 Enterprise Users CRM dashboard flow

Page: `app/dashboard/enterprise/users/page.tsx`.
Client component: `app/dashboard/enterprise/users/UsersClient.tsx`.
Loading route: `app/dashboard/enterprise/users/loading.tsx`.
Nav: `app/dashboard/enterprise/_components/NavLinks.tsx`.

Flow:

1. The route is a server component that authenticates with the same `getSession()` helper used by the Enterprise overview page.
2. It loads the tenant by email with `getTenant()`, requires `tenant.tier === "enterprise"`, and redirects non-Enterprise users away.
3. It passes `tenant.apiKey` into the client component as a prop, matching the existing dashboard pattern used by `ApiKeyCard`.
4. The client component fetches `GET /api/v1/users?page=<page>&limit=50` with the `x-api-key` header and renders a table with:
   - Email.
   - Customer type badge from `properties.customerType`.
   - Plan summary from `properties.plan`, `properties.planValue`, and optional currency metadata.
   - Current step from the last completed step string.
   - Relative last active time from `lastSeenAt`.
   - Computed API status badge.
   - Email/nudge count from `automationsReceived.length`.
   - Disabled `Send nudge` action placeholder because the current nudge endpoint only targets all eligible users by step.
5. Client-side controls provide status tabs, case-insensitive email search, sortable table headers, default status ordering of stalled -> at-risk -> activated -> churned, and 50-row page navigation.
6. The CSV export button fetches `GET /api/v1/users?limit=200` and downloads a client-generated CSV with `email`, `customerType`, `plan`, `planValue`, `currentStep`, `lastSeenAt`, `status`, and `emailsSent`.
7. No backend `/api/v1/users` behavior is changed by this dashboard page.

### 9.7 Enterprise config flow

Endpoint: `app/api/v1/config/route.ts`.

Input:

- Header `x-api-key`.
- Body: `{ activationStep }`.

Logic:

1. Requires API key.
2. Requires activation step name.
3. Updates the tenant whose `apiKey` matches.
4. Returns success message.

This is a lightweight API for integrators to set the first activation step code.

### 9.8 Enterprise check-auth flow

Endpoint: `app/api/v1/check-auth/route.ts`.

Input:

- Header `x-api-key`.

Logic:

1. Requires API key.
2. Looks up tenant by `apiKey`.
3. Returns `{ success, tenantId, name, hasAccess }` if valid.

This is useful for CLI setup or SDK validation.

### 9.9 Enterprise analytics data flow

Endpoint: `app/api/v1/analytics-data/route.ts`.

Input:

- Supabase authenticated dashboard user.

Logic:

1. Authenticates Supabase user.
2. Loads tenant by user email.
3. Loads up to 100 `endUsers` for that tenant ordered by newest first.
4. Reads configured step names from tenant:
   - `activationStep` or default `connect_repo`.
   - optional `step2`.
   - optional `step3`.
5. Computes:
   - `totalUsers`.
   - activation count for each configured step.
   - percent completion for each step relative to total users.
   - `funnelData` for charts.
   - last-30-day `trendData` for signups and activations.
   - `recoveryData` as a proxy based on users who completed step 1 and also have a non-null `lastEmailedAt`; this is not exact post-nudge attribution because step completions and nudge tags do not store per-step timestamps.
   - `userMatrix` for recent users and boolean step status.
6. Returns JSON consumed by `app/dashboard/analytics/page.tsx`.

### 9.10 Enterprise automation settings flow

Endpoint: `app/api/v1/settings/route.ts`.

GET:

1. Authenticates Supabase user.
2. Loads tenant by email.
3. Returns tenant settings but masks secrets:
   - `resendApiKey` becomes `re_live_***` if present.
   - `smtpPassword` becomes `***` if present.

POST:

1. Authenticates Supabase user.
2. Reads automation fields, Resend fields, WhatsApp template.
3. Builds update object for tenant.
4. If a non-placeholder Resend key is provided:
   - Requires key to start with `re_`.
   - Validates it by calling `apiKeys.list()` on a Resend client.
   - Encrypts and stores it.
5. Empty `resendApiKey` clears key and from email.
6. Updates the tenant by email.

### 9.11 Manual nudge flow

Endpoint: `app/api/v1/nudge-step/route.ts`.

Input:

- Supabase-authenticated dashboard user.
- Body: `{ stepIndex: 1 | 2 | 3 }`.

Logic:

1. Loads current tenant.
2. Resolves step configuration:
   - Step 1 uses `activationStep`, `emailSubject`, `emailBody`, 1-hour delay, no previous triggers.
   - Step 2 uses `step2`, `emailSubject2`, `emailBody2`, 24-hour delay, and requires step 1 complete.
   - Step 3 uses `step3`, `emailSubject3`, `emailBody3`, 24-hour delay, and requires steps 1 and 2 complete.
3. Rejects if requested step has no trigger configured.
4. Loads all `endUsers` for tenant.
5. Resolves email sender in priority order:
   - Tenant Resend key + from email.
   - Tenant verified SMTP/Gmail credentials.
   - Shared Resend fallback.
6. For each end user:
   - Skip users without email.
   - Skip globally unsubscribed email addresses.
   - Skip if automation tag already received.
   - Skip if target step is already complete.
   - Skip if required previous steps are not complete.
   - Skip if user is too new for delay threshold.
   - Check monthly Enterprise email limit.
   - Personalize `{{name}}` and `{{email}}` in body.
   - Send email.
   - Increment email usage.
   - Append automation tag and set `lastEmailedAt` to the most recent email time; no per-step email timestamp is stored.
7. Returns counts: sent, skipped, errors.

### 9.12 Cron automation flow

Endpoint: `app/api/cron/route.ts`.

Input:

- `GET` with `Authorization: Bearer <CRON_SECRET>`.

Logic includes three major jobs:

1. Enterprise drip/nudge automation:
   - Finds tenants where `automationEnabled = true`.
   - Loads tenant end users.
   - Loads `dripSteps` for tenant.
   - Checks unsubscribe state.
   - Checks whether user completed target event and whether prior automation was sent.
   - Sends email through tenant Resend, tenant SMTP, or shared fallback.
   - Increments email usage.
   - Updates `endUsers.automationsReceived` and overwrites `lastEmailedAt`; no per-step email timestamp is stored.
2. Individual scheduled campaign sequence processing:
   - Finds draft campaign steps with `sequenceId` and send timing rules.
   - Checks previous sequence step sent state and delay.
   - Loads list owner tenant and contacts.
   - Sends personalized campaign emails.
   - Marks campaign sent.
3. Individual follow-up reminders:
   - Finds contacts with `followUpAt <= now` and `followUpSent = false`.
   - Loads owner tenant.
   - Sends follow-up email/reminder.
   - Marks follow-up sent.

`app/api/cron/process-stalls/route.ts` is a narrower older cron-style endpoint that finds stale Enterprise end users and sends a nudge using shared Resend.

---

## 10. Enterprise Drip Steps and Webhooks

### 10.1 Drip steps UI/API

UI:

- `app/dashboard/enterprise/drip-steps/page.tsx`
- `app/dashboard/enterprise/drip-steps/_components/DripStepsEditor.tsx`

API:

- `app/api/individual/drip-steps/route.ts`

Despite the `/api/individual` prefix, this API is Enterprise-only. It authenticates the user, requires `tenant.tier === "enterprise"`, checks the plan limit, and manages `dripSteps`.

Data flow:

1. Page authenticates user and loads tenant.
2. It gates access based on Enterprise plan (`basic`/`advanced` depending logic in route/page).
3. It loads `dripSteps` ordered by position.
4. Client editor sends updates to API route.
5. API writes rows to `dripSteps`.
6. Cron route later reads `dripSteps` to decide email automation.

### 10.2 Webhook management

UI:

- `app/dashboard/enterprise/webhooks/page.tsx`
- `app/dashboard/enterprise/webhooks/_components/WebHooksManager.tsx`

API:

- `app/api/individual/webhooks/route.ts`

Despite the `/api/individual` prefix, this is Enterprise-only and requires Advanced plan.

GET:

1. Authenticates tenant.
2. Requires `plan === "advanced"`.
3. Returns tenant webhooks.

POST:

1. Authenticates tenant.
2. Requires Advanced plan.
3. Limits to 5 webhooks.
4. Requires URL to start with `https://`.
5. Requires non-empty events array.
6. Generates a random secret.
7. Inserts row into `webhooks`.

DELETE:

1. Authenticates tenant.
2. Deletes webhook by ID.

Important caveat: DELETE only filters by `webhooks.id` in the current code, not by `tenantId`, so tenant-scoped ownership should be tightened.

### 10.3 Outbound webhook delivery

Helper: `lib/webhooks/deliver.ts`.

Flow:

1. Called from Enterprise identify/track events.
2. Loads active webhooks for tenant.
3. Skips webhooks whose `events` array does not include the event type or `*`.
4. Builds JSON body: `{ event, data, timestamp }`.
5. Signs body with HMAC-SHA256 using webhook secret.
6. Sends POST to webhook URL with:
   - `Content-Type: application/json`
   - `X-OnboardFlow-Signature: sha256=<signature>`
   - `X-OnboardFlow-Event: <eventType>`
7. Timeout is 10 seconds.
8. Inserts `webhookDeliveries` row with status and success flag.

---

## 11. Individual Data Flow

### 11.1 Verified Individual tenant pattern

Most Individual routes repeat this pattern:

1. Create Supabase server client.
2. Get Supabase user.
3. Load tenant by user email.
4. Require tenant exists.
5. Require tenant tier is `individual` for core Individual endpoints.
6. For list/contact/campaign-specific operations, verify the entity belongs to that tenant through joins or owner checks.

### 11.2 Lists flow

UI:

- `app/dashboard/individual/lists/page.tsx`
- `app/dashboard/individual/lists/new/page.tsx`
- `app/dashboard/individual/lists/_components/DeleteListButton.tsx`

API:

- `app/api/individual/lists/route.ts`
- `app/api/individual/lists/[listId]/route.ts`

GET `/api/individual/lists`:

1. Authenticates Individual tenant.
2. Loads all lists where `individualLists.userId = tenant.id`, newest first.
3. Returns `{ lists }`.

POST `/api/individual/lists`:

1. Authenticates Individual tenant.
2. Validates body with Zod: `name`, optional `description`.
3. Calls `validateListCreation` to enforce plan's max list count.
4. Inserts `individualLists` row.
5. Returns inserted list.

DELETE `/api/individual/lists/[listId]`:

1. Authenticates Individual tenant.
2. Parses list ID.
3. Verifies list belongs to tenant.
4. Deletes list. Cascading deletes contacts and campaigns because schema references use cascade for child rows.

### 11.3 Contacts flow

UI:

- `app/dashboard/individual/lists/[listId]/page.tsx`
- `app/dashboard/individual/lists/[listId]/_components/ContactsManager.tsx`
- `app/dashboard/individual/lists/[listId]/_components/DeleteContactButton.tsx`

API:

- `app/api/individual/lists/[listId]/contacts/route.ts`
- `app/api/individual/lists/[listId]/contacts/[contactId]/route.ts`
- `app/api/individual/contacts/import/route.ts`
- `app/api/individual/lists/[listId]/import-csv/route.ts`

Typical contact creation:

1. Client submits name, email, optional phone.
2. API authenticates tenant.
3. API verifies list ownership.
4. Zod validates body.
5. `validateContactAddition` enforces contacts-per-list limit.
6. Insert into `individualContacts`.
7. Unique `(listId, email)` prevents duplicates.

Contact listing:

1. API verifies list ownership.
2. Loads contacts ordered by creation.
3. Joins tag assignments/tags where needed.
4. Returns contacts with tag metadata.

Contact deletion:

1. API verifies list ownership and contact ownership.
2. Deletes contact by ID.
3. Cascades remove notes/tag assignments/events depending references.

CSV import:

1. API authenticates tenant.
2. Checks plan feature `csvImportEnabled`.
3. Parses CSV using PapaParse.
4. Validates/normalizes rows.
5. Checks list ownership and contact limit.
6. Inserts contacts or reports skipped/duplicate rows.

### 11.4 Campaign flow

UI:

- `app/dashboard/individual/campaigns/page.tsx`
- `app/dashboard/individual/campaigns/create/page.tsx`
- `app/dashboard/individual/campaigns/[campaignId]/page.tsx`
- `app/dashboard/individual/campaigns/_components/CreateCampaignForm.tsx`
- `app/dashboard/individual/campaigns/_components/CampaignComposer.tsx`
- `app/dashboard/individual/campaigns/_components/SendCampaignButton.tsx`
- `app/dashboard/individual/campaigns/_components/DeleteCampaignButton.tsx`

API:

- `app/api/individual/lists/[listId]/campaigns/route.ts`
- Server actions inside campaign page files.

Campaign creation flow:

1. User selects/opens list and writes subject/body.
2. API/server action verifies tenant and list ownership.
3. Validates campaign creation.
4. Inserts `individualCampaigns` with `status = draft` unless scheduling data is provided.

Campaign detail page:

1. Authenticates user.
2. Loads campaign by ID joined through `individualLists` to verify ownership.
3. Loads contacts for campaign list.
4. Loads plan to decide whether tracking is enabled.
5. Loads campaign events for open/click stats when relevant.
6. Renders send/schedule actions.

Send campaign flow:

1. Server action verifies user, tenant, campaign ownership, and campaign status.
2. Loads list contacts.
3. Loads global unsubscribed emails and excludes them.
4. Checks plan monthly email usage.
5. Sends personalized emails.
6. For tracking-enabled plans, body can include tracked URLs/open pixel.
7. Updates `individualCampaigns.status = sent` and `sentAt = now`.
8. Increments email usage.

Personalization convention:

- Campaign bodies can use placeholders like `{name}` or similar replacement logic depending component/server action.
- Unsubscribe links are generated from `lib/email/templates.ts`.

### 11.5 Sequence flow

UI:

- `app/dashboard/individual/lists/[listId]/sequences/new/page.tsx`
- `app/dashboard/individual/lists/[listId]/sequences/new/_components/SequenceBuilder.tsx`

API:

- `app/api/individual/sequences/route.ts`

Data model:

- Sequence steps are stored as multiple rows in `individualCampaigns` sharing the same `sequenceId`.
- Each row has `sequencePosition` and `sendDelayDays`.

Flow:

1. User creates multiple email steps in sequence builder.
2. API validates list ownership.
3. Inserts multiple campaign rows with common `sequenceId`.
4. Cron route processes draft sequence steps:
   - Step 1 can send immediately/scheduled based on delay.
   - Later steps wait until previous `sequencePosition` has status `sent` and delay has elapsed.
5. Cron sends to list contacts and marks each campaign step sent.

### 11.6 AI campaign generation flow

UI:

- `app/dashboard/individual/campaigns/_components/AiWriteButton.tsx`

API/helper:

- `app/api/individual/ai/generate/route.ts`
- `lib/ai/generate-campaign.ts`

Flow:

1. User provides business description, tone, and campaign type.
2. API authenticates user and requires tenant tier `individual`.
3. It checks `getTenantPlan` and requires plan feature `aiEnabled`.
4. It counts `aiUsage` rows for current month and enforces the configured monthly quota in route logic.
5. It calls `generateCampaign`.
6. `generateCampaign` builds a prompt and calls Gemini model `gemini-2.5-flash`.
7. It expects response format:
   - `SUBJECT: ...`
   - `BODY:` followed by body.
8. It parses subject and body.
9. API stores `aiUsage` with token count and returns generated subject/body.

### 11.7 Tracking flow for Individual campaigns

Helpers:

- `lib/tracking/hmac.ts`
- `lib/tracking/inject.ts`

Routes:

- `app/api/track/open/route.ts`
- `app/api/track/click/route.ts`
- `app/api/track/pixel/route.ts`

Open tracking modern helper flow:

1. `createOpenTrackingUrl(campaignId, contactEmail)` builds `/api/track/open?cid=<id>&email=<email>&token=<hmac>`.
2. `/api/track/open` always returns a 1x1 transparent GIF so email rendering never breaks.
3. If `cid`, `email`, and token are valid, it inserts `campaignEvents` row with `eventType = "open"`.

Click tracking helper flow:

1. `injectTracking()` finds raw URLs in body and wraps them with `/api/track/click?cid=<id>&email=<email>&url=<encoded>&token=<hmac>`.
2. Intended behavior is to verify token, insert click event, and redirect to original URL.

Current caveat:

- `app/api/track/click/route.ts` currently reads `campaignId` rather than `cid` and does not verify the token. It inserts `eventType = "clicked"` when `campaignId` and email are present. This means URLs generated by `injectTracking()` may not be recorded by this route without parameter normalization.
- `app/api/track/pixel/route.ts` is an older pixel route that expects `campaignId` and records `eventType = "opened"` without HMAC verification.
- Dashboard analytics code should account for both old and new event type names if both routes remain active.

### 11.8 Unsubscribe flow

Page:

- `app/unsubscribe/page.tsx`

Helper:

- `lib/email/templates.ts`

Flow:

1. Email templates include an unsubscribe link with `email` and token.
2. User opens `/unsubscribe?email=<email>&token=<token>`.
3. Page recomputes expected token using `createUnsubscribeToken(email)`.
4. If token is invalid, shows invalid link page.
5. If valid, inserts email into `unsubscribedContacts` with lowercase email, ignoring conflicts.
6. All send paths should check this table and skip unsubscribed users.

### 11.9 Pipeline, tags, notes, timeline, engagement, reminders

Pipeline UI:

- `app/dashboard/individual/pipeline/page.tsx`

Pipeline API:

- `app/api/individual/pipeline/route.ts`

Flow:

1. Client fetches `/api/individual/pipeline` optionally filtered by list ID.
2. API loads contacts for tenant and groups/returns stages.
3. Client can update a contact's `pipelineStage` through POST/PATCH logic in the route.
4. `individualContacts.pipelineStage` stores the stage.

Tags APIs:

- `app/api/individual/tags/route.ts` manages tenant tag definitions.
- `app/api/individual/contacts/[id]/tags/route.ts` manages tag assignments for a contact.

Notes API:

- `app/api/individual/contacts/[id]/notes/route.ts` creates/lists/deletes contact notes.

Timeline API:

- `app/api/individual/contacts/[id]/timeline/route.ts` combines contact notes, campaign events, and contact metadata into chronological activity.

Engagement API:

- `app/api/individual/contacts/[id]/engagement/route.ts` computes engagement stats from campaign events and campaigns for a contact's email.

Reminder API:

- `app/api/individual/contacts/[id]/reminder/route.ts` sets or clears `followUpAt`, `followUpNote`, and `followUpSent` on contacts.
- Cron route sends or flags follow-up reminders when due.

---

## 12. Email System

### 12.1 Templates

`lib/email/templates.ts` centralizes email HTML generation and unsubscribe token/link helpers.

Common behavior:

- Wrap plain text body into branded HTML.
- Include unsubscribe links where applicable.
- Support sender/company information.

### 12.2 SMTP/Gmail

`lib/email/smtp.ts` handles:

- Encrypting stored SMTP passwords/API keys.
- Decrypting credentials before use.
- Creating Gmail transporters through Nodemailer.

Tenant SMTP fields live on `tenants`:

- `smtpEmail`
- encrypted `smtpPassword`
- `smtpVerified`
- `smtpProvider`

Individual settings UI uses these fields through `app/dashboard/individual/settings/*`.

### 12.3 Sender priority

Enterprise nudge and cron sender resolution uses this order:

1. Tenant Resend API key + tenant from email.
2. Tenant verified SMTP credentials.
3. Shared Resend fallback from `RESEND_API_KEY`.

This priority lets paid/advanced users send from their own domain/inbox while free or unconfigured tenants use the shared sender.

---

## 13. Billing and Payments

### 13.1 Billing pages/components

Individual:

- `app/dashboard/individual/billing/page.tsx`
- `app/dashboard/individual/billing/_components/BillingActions.tsx`

Enterprise:

- `app/dashboard/enterprise/billing/page.tsx`

Payments/success:

- `app/payment/success/page.tsx`

### 13.2 Stripe routes

- `app/api/stripe/create-checkout/route.ts`
- `app/api/stripe/create-portal/route.ts`
- `app/api/webhook/stripe/route.ts`

Stripe webhook route handles events like checkout completion, invoice/payment updates, and subscription cancellations. It:

1. Verifies Stripe signature.
2. Uses `processedWebhookEvents` for idempotency.
3. Loads tenant by customer email or customer ID.
4. Updates `tenants` billing fields and plan.
5. Upserts `stripeSubscriptions`.
6. May insert `creditTransactions` for credit purchases.
7. Sends email notifications for some events.

### 13.3 Razorpay routes

- `app/api/razorpay/create-order/route.ts`
- `app/api/razorpay/create-subscription/route.ts`
- `app/api/razorpay/cancel-subscription/route.ts`
- `app/api/webhook/razorpay/route.ts`

Razorpay webhook route:

1. Verifies `x-razorpay-signature`.
2. Parses event body.
3. Stores event ID in `processedWebhookEvents.stripeEventId` for idempotency.
4. Reads tenant ID and plan information from Razorpay notes or plan mapping.
5. Updates `tenants.plan`, `razorpaySubscriptionId`, expiry/renewal fields.
6. Handles cancellation by setting plan back to `free` or clearing subscription data.

---

## 14. Dashboard Pages and Components

### 14.1 Shared dashboard routing

- `app/dashboard/page.tsx` redirects or routes users toward the dashboard for their tier.
- `app/dashboard/actions.ts` contains dashboard-level server actions.
- `app/dashboard/settings/page.tsx` and `app/dashboard/settings/actions.ts` are shared/legacy settings pages.
- `app/dashboard/ApiKeyCard.tsx` shows/copies Enterprise API key.

### 14.2 Individual layout and nav

- `app/dashboard/individual/layout.tsx` wraps Individual dashboard pages.
- `app/dashboard/individual/_components/NavLinks.tsx` renders Individual navigation.
- Loading skeletons live in `loading.tsx` files under Individual routes.

### 14.3 Individual overview page

`app/dashboard/individual/page.tsx`:

1. Requires session.
2. Loads tenant by email.
3. Loads lists, contacts count, campaigns count, recent campaigns, and plan info.
4. Displays plan meter/cards and quick action links.

### 14.4 Lists page

`app/dashboard/individual/lists/page.tsx`:

1. Requires session and tenant.
2. Loads plan.
3. Loads lists and aggregate contact/campaign counts.
4. Renders list cards and delete buttons.
5. Contains a server action for deleting lists after ownership verification.

### 14.5 List detail page

`app/dashboard/individual/lists/[listId]/page.tsx`:

1. Requires session and tenant.
2. Parses list ID.
3. Loads plan, list, contacts, campaign counts, tags, and tracking events.
4. Passes data to `ContactsManager` for client-side contact operations.

### 14.6 Campaign pages

`app/dashboard/individual/campaigns/page.tsx`:

- Lists campaigns with counts and tracking metrics.
- Includes server actions for creating and deleting campaigns.

`app/dashboard/individual/campaigns/[campaignId]/page.tsx`:

- Loads campaign, list, contacts, unsubscribes, events, and plan.
- Provides server action for sending campaign.
- Uses `SendCampaignButton` as client trigger.

### 14.7 Pipeline page

`app/dashboard/individual/pipeline/page.tsx` is a client page that fetches pipeline data from `/api/individual/pipeline` and updates stages via API requests.

### 14.8 Individual settings

`app/dashboard/individual/settings/page.tsx` loads tenant email settings. Components:

- `GmailSettingsForm.tsx` handles SMTP/Gmail settings.
- `LogoutButton.tsx` signs the user out.
- `actions.ts` contains server-side settings actions.

### 14.9 Enterprise layout and nav

- `app/dashboard/enterprise/layout.tsx` wraps Enterprise dashboard pages.
- `app/dashboard/enterprise/_components/NavLinks.tsx` renders Enterprise nav.
- `NudgeButton.tsx` calls `/api/v1/nudge-step` to manually send nudges.

### 14.10 Enterprise overview

`app/dashboard/enterprise/page.tsx`:

1. Requires session and tenant.
2. Loads plan info.
3. Loads all tenant end users.
4. Computes dashboard metrics such as user counts and activation progress.
5. Shows API key, plan status, automation controls, and onboarding overview.

### 14.11 Analytics dashboard

`app/dashboard/analytics/page.tsx` is a client analytics page that fetches `/api/v1/analytics-data` and renders chart components from `components/analytics`.

---

## 15. Public API and Route Inventory

The root `API.md` documents the public REST API for non-JavaScript integrators. It covers authentication, base URL, `/identify`, `/track`, `/users`, `/users/:userId`, curl/Python/Ruby/Node examples, standard error responses, and rate-limit reference.

Public REST/API-key endpoints should return errors as:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API Key"
  }
}
```

Current standard public API error codes are `INVALID_API_KEY`, `MISSING_REQUIRED_FIELD`, `USER_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, and `INTERNAL_ERROR`.

### 15.1 Enterprise/developer API

| Route | Method | Purpose | Auth |
| --- | --- | --- | --- |
| `/api/v1/check-auth` | GET | Validate API key and return tenant info | `x-api-key` |
| `/api/v1/identify` | POST | Create/find Enterprise end user and optionally mark an event | `x-api-key` |
| `/api/v1/track` | POST | Mark onboarding step complete for an identified end user | `x-api-key` |
| `/api/v1/users` | GET | List tracked Enterprise end users with computed status, metadata, pagination, and optional status filter | `x-api-key` |
| `/api/v1/users/[userId]` | GET | Fetch one tracked Enterprise end user by external ID with computed status | `x-api-key` |
| `/api/v1/config` | POST | Set tenant activation step | `x-api-key` |
| `/api/v1/settings` | GET/POST | Dashboard automation/settings read/write | Supabase session |
| `/api/v1/analytics-data` | GET | Enterprise analytics JSON | Supabase session |
| `/api/v1/nudge-step` | POST | Manually send step nudges | Supabase session |
| `/api/onboard` | POST | Legacy API-key authorization/demo endpoint | Bearer API key |

### 15.2 Individual API

| Route | Purpose |
| --- | --- |
| `/api/individual/lists` | List/create Individual lists |
| `/api/individual/lists/[listId]` | Delete one list |
| `/api/individual/lists/[listId]/contacts` | List/create contacts in a list |
| `/api/individual/lists/[listId]/contacts/[contactId]` | Update/delete a contact |
| `/api/individual/lists/[listId]/campaigns` | Manage campaigns for one list |
| `/api/individual/sequences` | Create/manage campaign sequences |
| `/api/individual/lists/[listId]/import-csv` | CSV import for a specific list |
| `/api/individual/contacts/import` | Contact import endpoint |
| `/api/individual/ai/generate` | AI subject/body generation |
| `/api/individual/pipeline` | Pipeline contacts and stage updates |
| `/api/individual/tags` | Tenant tag definitions |
| `/api/individual/contacts/[id]/tags` | Contact tag assignments |
| `/api/individual/contacts/[id]/notes` | Contact notes |
| `/api/individual/contacts/[id]/timeline` | Contact timeline |
| `/api/individual/contacts/[id]/engagement` | Contact engagement stats |
| `/api/individual/contacts/[id]/reminder` | Follow-up reminder set/clear |
| `/api/individual/drip-steps` | Enterprise drip-step management despite prefix |
| `/api/individual/webhooks` | Enterprise webhook management despite prefix |

### 15.3 Tracking and unsubscribe routes

| Route | Purpose |
| --- | --- |
| `/api/track/open` | HMAC-protected open pixel route using `cid` |
| `/api/track/click` | Redirect/click tracking route, currently uses `campaignId` |
| `/api/track/pixel` | Legacy open pixel route using `campaignId` |
| `/unsubscribe` | Token-verified unsubscribe page |

### 15.4 Cron and payment routes

| Route | Purpose |
| --- | --- |
| `/api/cron` | Main automation/scheduled sequence/follow-up cron |
| `/api/cron/process-stalls` | Older stale-user nudge cron |
| `/api/stripe/create-checkout` | Create Stripe checkout |
| `/api/stripe/create-portal` | Create Stripe customer portal |
| `/api/webhook/stripe` | Stripe webhook handler |
| `/api/razorpay/create-order` | Create Razorpay order |
| `/api/razorpay/create-subscription` | Create Razorpay subscription |
| `/api/razorpay/cancel-subscription` | Cancel Razorpay subscription |
| `/api/webhook/razorpay` | Razorpay webhook handler |
| `/api/waitlist` | Public waitlist sign-up |
| `/api/og` | Open Graph image |

---

## 16. Variable Passing and State Movement

### 16.1 Supabase user email to tenant

Almost every dashboard operation starts with:

1. `createClient()` from `utils/supabase/server.ts`.
2. `supabase.auth.getUser()`.
3. `user.email`.
4. Query `tenants.email = user.email`.
5. Use `tenant.id` as the application-level ownership key.

So the central identity bridge is:

```text
Supabase auth user.email -> tenants.email -> tenants.id -> all product data
```

### 16.2 Enterprise customer user ID to end user

Enterprise SDK sends:

```text
customer app user.id -> SDK userId -> /api/v1/identify externalId -> endUsers.externalId
```

Then track calls use the same `userId`:

```text
SDK track userId -> /api/v1/track -> lookup endUsers.externalId -> append completedSteps
```

Important nuance:

- `/identify` currently looks up by email, not external ID.
- `/track` looks up by external ID.
- If a customer calls `identify` without `userId`, `externalId` becomes the email, so future `track` must use email as `userId`.

### 16.3 Onboarding step variable flow

Step names originate from:

- `tenants.activationStep`
- `tenants.step2`
- `tenants.step3`
- `dripSteps.eventTrigger`
- SDK `track({ stepId })`
- API `track({ event })`

These step codes are stored as strings in `endUsers.completedSteps`. Analytics, automation skipping logic, and funnel charts all use string inclusion checks against `completedSteps`.

### 16.4 Individual list ownership flow

```text
tenants.id -> individualLists.userId -> individualContacts.listId / individualCampaigns.listId
```

Most Individual authorization uses this chain:

1. Load tenant by authenticated email.
2. Ensure list row has `userId = tenant.id`.
3. Only then read/write contacts/campaigns under that list.

### 16.5 Campaign tracking variable flow

```text
individualCampaigns.id + contact email -> HMAC token -> tracking URL -> campaignEvents row
```

The campaign ID and contact email are passed through open/click URLs. The modern open route verifies token before inserting `campaignEvents`.

### 16.6 Plan/limit variable flow

```text
tenants.plan + tenants.planExpiresAt -> getTenantPlan(tenant.id) -> limit constants -> validation helper/API/page
```

Plan gates affect:

- List count.
- Contact count per list.
- Monthly email count.
- CSV import availability.
- Tracking availability.
- AI availability.
- Enterprise end-user count.
- Enterprise drip-step count.
- Enterprise webhook availability.

### 16.7 Email sender variable flow

```text
tenant resend/smtp fields -> decrypt if needed -> choose sender -> send -> increment usage -> mark entity sent/emailed
```

Tenant-specific credentials override shared fallback senders.

---

## 17. SDK, CLI, and Config Artifacts

### 17.1 SDK

Directory: `sdk/`.

Files:

- `sdk/src/index.ts` — `Dripmetric` class.
- `sdk/package.json` — package metadata.
- `sdk/README.md` — installation and usage docs.
- `sdk/tsconfig.json` — SDK TypeScript build config.

The SDK is small and only wraps identify/track calls. Its README includes an example of forwarding Razorpay webhook-derived plan data through `identify({ properties })`; Dripmetric does not directly integrate with the customer payment processor for this metadata path.

### 17.2 CLI

`cli.js` is a setup wizard using `@clack/prompts`.

Current behavior:

1. Asks user stack: MERN or Next.js.
2. MERN flow asks for Dripmetric API key.
3. Generates `auth.js` in the current working directory.
4. The generated file contains an Express router and a mocked SDK call for identify.
5. Next.js generator path says "coming soon".

### 17.3 Config file

`onboardflow.config.json` is a sample/local config schema artifact. It contains:

- Version.
- Empty flows array.
- Theme tokens.
- Supabase/email integration placeholders.
- Feature flags.

This is not heavily wired into the current app code.

---

## 18. Tests and Local Verification Files

- `tests.js` is the integration-style HTTP test runner. It covers authentication boundaries, public and Enterprise APIs, Razorpay webhooks, tracking, cron authorization, plan gates, malformed payloads, rate limiting, and unauthenticated Individual API boundaries.
- `tests.e2e.js` is the cleanup-safe real-user acceptance runner. It drives Chromium with anonymous, Individual, and Enterprise browser contexts; creates uniquely marked list/contact/campaign/CRM and Enterprise end-user data; verifies the primary dashboard screens and API lifecycles; and removes every seeded row from the database in a `finally` block.
- `TESTING.md` contains the detailed testing setup, environment-variable reference, cleanup guarantees, and coverage checklist.
- `package.json` provides:
  - `npm run test:integration` → runs `tests.js`.
  - `npm run test:acceptance` → runs `tests.e2e.js`.
  - `npm run test:all` → runs integration and acceptance suites in order.
- `npm run lint` maps to `next lint`, but with Next 15 this command may be unavailable/deprecated depending local Next behavior.
- TypeScript checking can be done with `npx tsc --noEmit` if dependencies are installed.

### 18.1 One-time acceptance-test setup

Install Playwright and its Chromium browser without changing the application dependency tree:

```bash
npm install --no-save playwright
npx playwright install chromium
```

Create authenticated Playwright storage-state files for dedicated test accounts:

- `.auth/individual.json` for a tenant whose tier is `individual`.
- `.auth/enterprise.json` for a tenant whose tier is `enterprise`.

Do not use production customer accounts. Set the following values in `.env.local`:

```dotenv
BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://...
INDIVIDUAL_STATE=.auth/individual.json
ENTERPRISE_STATE=.auth/enterprise.json
TEST_INDIVIDUAL_TENANT_ID=<individual tenant uuid>
TEST_ENTERPRISE_TENANT_ID=<enterprise tenant uuid>
TEST_ENTERPRISE_API_KEY=<enterprise tenant x-api-key>
RAZORPAY_WEBHOOK_SECRET=<test webhook secret>
CRON_SECRET=<test cron secret>
```

The application server and the test process must use the same test environment and database.

### 18.2 Running tests

Start the application:

```bash
npm run dev
```

In another terminal, run the full test workflow:

```bash
npm run test:all
```

Suites can also be run independently:

```bash
npm run test:integration
npm run test:acceptance
```

Run static verification separately:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Use a disposable/test database. The acceptance suite generates a unique `acceptance_*` marker for its data and cleans matching relational records in dependency-safe order, even when assertions fail. A hard process kill cannot execute JavaScript cleanup; after such a kill, manually remove records carrying the `acceptance_*` marker before rerunning.

---

## 19. Current Naming and Consistency Notes

The codebase has several naming leftovers and route-prefix inconsistencies:

1. Brand is **Dripmetric**, but old **OnboardFlow** names remain in:
   - Repo path.
   - `onboardflow.config.json`.
   - API key prefix `obf_live_`.
   - Webhook header `X-OnboardFlow-Signature`.
   - Some route comments and older context.
2. Enterprise webhook and drip-step APIs live under `/api/individual/*`, even though the route logic requires Enterprise tenants.
3. Tracking has both old and new open/click parameter names and event type values.
4. `db/schema.ts` does not define the raw-SQL `email_usage` table used by email usage helpers.
5. There are duplicate login server actions in `app/actions.ts` and `app/(auth)/login/actions.ts`.
6. Some README roadmap items are already partly implemented, such as Stripe/Razorpay payment logic, CSV import, tracking, and cron scheduling.

---

## 20. Mental Model: End-to-End Flows

### 20.1 New user becomes an Individual customer

```text
Landing/login -> Supabase magic link/OAuth -> auth callback -> no tenant/tier -> tier selection -> setTier("individual") -> tenants row -> /dashboard/individual -> create list -> add/import contacts -> create campaign -> send -> campaignEvents/open/click -> dashboard stats
```

### 20.2 New user becomes an Enterprise customer

```text
Landing/login -> Supabase magic link/OAuth -> auth callback -> tier selection -> setTier("enterprise") -> tenants row with API key -> dashboard shows API key -> customer installs SDK -> identify users -> track events -> endUsers.completedSteps -> analytics + automations + webhooks
```

### 20.3 Enterprise automation lifecycle

```text
Tenant configures activationStep/step2/step3 or dripSteps -> customer app identifies end user -> user remains incomplete after configured delay -> cron or manual nudge checks completedSteps + automationsReceived + unsubscribe + email limits -> sends email -> records automation tag strings in automationsReceived + overwrites lastEmailedAt -> analytics can only compute proxy recovery, not exact post-email attribution
```

### 20.4 Individual campaign lifecycle

```text
Tenant creates list -> contacts added -> campaign draft created -> optional AI writes subject/body -> optional tracking injected based on plan -> send action or cron sends to non-unsubscribed contacts -> email_usage incremented -> campaign status set sent -> open/click routes insert campaignEvents -> dashboard computes metrics
```

### 20.5 Billing lifecycle

```text
User picks paid plan -> Stripe/Razorpay checkout/subscription route creates payment object -> provider webhook verifies event -> idempotency check -> tenant plan/subscription fields updated -> getTenantPlan returns effective paid plan -> limit helpers unlock features and larger quotas
```

---

## 21. Files Most Important for Future Work

If you need to change core behavior, these are the highest-impact files:

### App identity and routing

- `middleware.ts`
- `utils/supabase/server.ts`
- `app/auth/callback/route.ts`
- `lib/actions/set-tier.ts`
- `lib/auth/get-session.ts`
- `lib/auth/get-tenant.ts`

### Data model

- `db/schema.ts`
- `db/index.ts`
- `supabase/migrations/*`

### Plans and limits

- `lib/plans/limits.ts`
- `lib/plans/get-tenant-plan.ts`
- `lib/rate-limit/individual.ts`
- `lib/rate-limit/enterprise.ts`
- `lib/rate-limit/email-usage.ts`

### Enterprise API/automation

- `app/api/v1/identify/route.ts`
- `app/api/v1/track/route.ts`
- `app/api/v1/settings/route.ts`
- `app/api/v1/nudge-step/route.ts`
- `app/api/v1/analytics-data/route.ts`
- `app/api/cron/route.ts`
- `lib/webhooks/deliver.ts`

### Individual product

- `app/api/individual/lists/route.ts`
- `app/api/individual/lists/[listId]/contacts/route.ts`
- `app/api/individual/lists/[listId]/campaigns/route.ts`
- `app/api/individual/sequences/route.ts`
- `app/api/individual/pipeline/route.ts`
- `app/dashboard/individual/*`

### Email/tracking

- `lib/email/templates.ts`
- `lib/email/smtp.ts`
- `lib/tracking/hmac.ts`
- `lib/tracking/inject.ts`
- `app/api/track/open/route.ts`
- `app/api/track/click/route.ts`
- `app/api/track/pixel/route.ts`
- `app/unsubscribe/page.tsx`

### Payments

- `app/api/webhook/stripe/route.ts`
- `app/api/webhook/razorpay/route.ts`
- `app/api/stripe/create-checkout/route.ts`
- `app/api/razorpay/create-subscription/route.ts`

---

## 22. Practical Development Guidance

1. Treat `tenants.id` as the source of authorization ownership for all app data.
2. Always derive tenant from Supabase user email for dashboard routes.
3. Always derive Enterprise tenant from `x-api-key` for public SDK routes.
4. When adding a new Individual endpoint, verify ownership through `individualLists.userId = tenant.id` before touching contacts/campaigns.
5. When adding a new Enterprise endpoint, verify `tenant.tier === "enterprise"` and use `getTenantPlan` for gates.
6. When sending email, check unsubscribes, check monthly email limits, then increment usage after successful sends.
7. When storing secrets, encrypt before writing to `tenants` and mask on read.
8. When adding tracking URLs, normalize parameter names (`cid` vs `campaignId`) and event types (`open/opened`, `click/clicked`).
9. When adding payment plans, update `lib/plans/limits.ts`, payment creation routes, webhook plan mapping, and billing UI together.
10. When adding tables used through raw SQL, also add Drizzle schema definitions or clearly document why raw SQL is used.

---

## 23. Known Areas to Tighten

These are not necessarily bugs in every environment, but they are important future-maintenance notes:

1. **Webhook DELETE ownership** — `app/api/individual/webhooks/route.ts` should delete by both `id` and `tenantId`.
2. **Tracking parameter mismatch** — `injectTracking()` uses `cid`, but click route reads `campaignId`.
3. **Tracking event naming mismatch** — open routes record `open` and `opened`; click route records `clicked` while some analytics may expect `click`.
4. **`email_usage` schema visibility** — helpers use raw SQL for a table not declared in `db/schema.ts`.
5. **API route naming** — Enterprise drip/webhook APIs should eventually move from `/api/individual/*` to `/api/enterprise/*` or have compatibility aliases.
6. **Duplicate login actions** — consolidate `app/actions.ts` and `app/(auth)/login/actions.ts` if both are not needed.
7. **Identify lookup mismatch** — `/identify` finds users by email, `/track` finds by external ID. This is workable but can surprise SDK users.
8. **Welcome email content source** — Enterprise identify uses `tenant.emailSubject/emailBody`, which are also step-1 nudge fields; separate welcome templates may be cleaner.
9. **In-memory API rate limit** — serverless scaling will make limits per-instance rather than global.
10. **Migration drift** — because schema and raw SQL features evolved over time, confirm deployed migrations include all columns/tables in `db/schema.ts` plus `email_usage`.

---

## 24. One-Sentence Architecture Summary

Dripmetric is a tenant-centered Next.js SaaS where Supabase authenticates app users, `tenants` owns all product data, Enterprise customers push user onboarding events through API-key-protected SDK endpoints into `endUsers`, Individual customers manage lists/contacts/campaigns through dashboard/API routes into `individual*` tables, and shared plan/email/tracking/payment helpers enforce limits and power automations across both product tiers.
