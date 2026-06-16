# Dripmetric

Works with any language capable of making HTTP requests.

Dripmetric is a SaaS onboarding automation platform: identify users, track onboarding events, detect stalled users, and send configured drip emails from your dashboard.

## Public API Platform

Use the public API from any backend language, or use the lightweight Node.js wrapper in `sdk/`.

- `POST /api/public/identify`
- `POST /api/public/track`
- `GET /api/public/health`
- `GET /api/public/version`

See `API.md` for cURL, Node.js, Python, Go, PHP, Ruby, and Java examples.

## Pricing

- Startup launch pricing: `$25/month` with regular `$60/month` shown as struck-through in the pricing UI.
- Growth launch pricing: `$50/month` with regular `$120/month` shown as struck-through in the pricing UI.

## Compliance routes

- `/privacy`
- `/terms`
- `/cookies`
- `/data-export`
- `/data-deletion`
- `/unsubscribe`

See `COMPLIANCE.md` and `SCHEMA_CHANGES.sql` for infrastructure and manual Supabase SQL.

## Development

```bash
npm install
npm run dev
npm run test:full
```

## Testing data modes

Set `USE_EXISTING_TEST_DATA=true` to use permanent Supabase test records and skip seeding/cleanup. Set `USE_EXISTING_TEST_DATA=false` to enable generated fixture mode; generated records must use the configured test marker and cleanup only touches marked records.
