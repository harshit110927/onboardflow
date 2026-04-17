# onboardflow

Official SDK for [OnboardFlow](https://www.onboardflow.xyz) — track user onboarding steps and automate drip emails.

## Install

```bash
npm install onboardflow
```

## Usage

```ts
import { OnboardFlow } from "onboardflow";

const onboard = new OnboardFlow("obf_live_your_api_key");

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

Sign up at [onboardflow.xyz](https://www.onboardflow.xyz) → choose Enterprise → copy your API key from the dashboard.

## Rate Limits (Free Tier)

- 20 emails/day, 300 emails/month
- 50 end users tracked

Limits increase on paid plans.