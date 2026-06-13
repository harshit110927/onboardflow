# Complete site acceptance testing

The repository has two complementary suites traced from `master_context.md`:

- `npm run test:integration` exercises anonymous/authentication boundaries, public APIs, enterprise identify/track, payment webhooks, tracking, cron authorization, plan gates, malformed payloads, rate limits, and unauthenticated Individual APIs.
- `npm run test:acceptance` drives Chromium as an anonymous, Individual, and Enterprise user; creates uniquely marked list/contact/campaign/CRM and end-user lifecycle data; checks all primary dashboard screens; and deletes every seeded row in a `finally` block.
- `npm run test:all` runs both in order.

## One-time setup

Install Playwright without changing this application's dependency tree, then install Chromium:

```bash
npm install --no-save playwright
npx playwright install chromium
```

Create authenticated storage states for one dedicated Individual test tenant and one dedicated Enterprise test tenant. Sign into each account in Playwright and save its browser context to `.auth/individual.json` and `.auth/enterprise.json`. Never use production customer tenants.

Set these in `.env.local`:

```dotenv
BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://...
INDIVIDUAL_STATE=.auth/individual.json
ENTERPRISE_STATE=.auth/enterprise.json
TEST_INDIVIDUAL_TENANT_ID=<individual tenant uuid>
TEST_ENTERPRISE_TENANT_ID=<enterprise tenant uuid>
TEST_ENTERPRISE_API_KEY=<enterprise tenant x-api-key>
RAZORPAY_WEBHOOK_SECRET=<test secret>
CRON_SECRET=<test secret>
```

Start the app with the same environment, then run `npm run test:all`. Use a disposable/test database. The acceptance suite only deletes rows carrying its unique run marker and performs cleanup even after assertion failures or interruption errors handled by Node. A hard process kill cannot execute cleanup; if that occurs, remove rows whose names/emails start with `acceptance_` before rerunning.

## Coverage checklist

The acceptance suite verifies public/SEO/legal pages, global security headers, anonymous redirects, waitlist validation, all main Individual and Enterprise screens, Individual list/contact/campaign/note/tag/reminder creation, invalid input and ownership boundaries, Enterprise API-key authentication, identify/track/detail lifecycle, and invalid API credentials/payloads. The integration suite supplies the destructive or provider-facing edge cases that should not be driven through a browser, including webhook idempotency, cron secrets, tracking pixels/redirects, plan expiry, SQL-injection-shaped input, long input, and burst rate limiting.
