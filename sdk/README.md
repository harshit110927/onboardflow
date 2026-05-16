# dripmetric

Official SDK for [Dripmetric](https://www.dripmetric.com) — track user onboarding steps and automate drip emails.

## Install

```bash
npm install dripmetric
```

## Usage

```ts
import { Dripmetric } from "dripmetric";

const onboard = new Dripmetric("obf_live_your_api_key");

// Call on signup or login
await onboard.identify({
  userId: "user_123",
  email: "alice@example.com",
});

// Call when a user completes an onboarding step
// stepId must match the Event Name (Code) in your dashboard
await onboard.track({
  userId: "user_123",
  stepId: "created_project",
});
```

## Get your API key

Sign up at [dripmetric.com](https://www.dripmetric.com) → choose Enterprise → copy your API key from the dashboard.

## Rate Limits (Free Tier)

- 20 emails/day, 300 emails/month
- 50 end users tracked

Limits increase on paid plans.