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


## Identify payment properties

Pass optional user properties from your own backend when plan or payment state changes. Dripmetric does not connect to your payment processor directly; your server sends the relevant fields after your webhook or manual billing logic runs.

```ts
// In your Razorpay payment.captured webhook handler:
await onboard.identify({
  userId: user.id,
  email: user.email,
  properties: {
    plan: "basic",
    planValue: 79,
    customerType: "paying",
  },
});
```

## Get your API key

Sign up at [dripmetric.com](https://www.dripmetric.com) → choose Enterprise → copy your API key from the dashboard.

## Handling API errors

The SDK throws `DripmetricApiError` when Dripmetric returns a non-2xx response. The error includes `status` and `code`, matching the REST API error shape.

```ts
import { Dripmetric, DripmetricApiError } from "dripmetric";

try {
  await onboard.track({
    userId: "user_123",
    stepId: "created_project",
  });
} catch (error) {
  if (error instanceof DripmetricApiError) {
    console.error(error.status, error.code, error.message);
  }
}
```

## Rate Limits (Free Tier)

- 300 recovery emails/month
- 50 end users tracked

Limits increase on paid plans.
