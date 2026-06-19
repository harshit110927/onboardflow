# Dripmetric SDK

Dripmetric is the ultimate zero-setup analytics and automated drip campaign platform.

Track user onboarding events without configuring any schemas. Dripmetric automatically discovers the events you send, identifies where users get stuck, and fires automated drip emails to bring them back—all from a single, lightweight Node.js SDK.

## Installation

```bash
npm install dripmetric
```

## Quick Start

```ts
import { Dripmetric } from "dripmetric";

// Initialize with the API Key found in your dashboard
const dripmetric = new Dripmetric(process.env.DRIPMETRIC_API_KEY!);

// 1. Identify your user when they sign up or log in
await dripmetric.identify({
  userId: "user_123",
  email: "founder@startup.com"
});

// 2. Track any step they take. You don't need to pre-register the stepId!
await dripmetric.track({
  userId: "user_123",
  stepId: "connected_repository"
});
```

## Features

- **Schema-less Ingestion:** Send whatever string you want as the `stepId`. Dripmetric will automatically discover it and populate it in your dashboard settings.
- **Automated Drip Interventions:** From the dashboard, select which events are crucial. If a user completes Step A but doesn't complete Step B within X hours, Dripmetric automatically emails them.
- **AI-Ready Integration:** Just show our docs to your AI coder (like Cursor or Copilot), and they can implement your entire analytics funnel in minutes.

---
*Note: This SDK securely wraps the Dripmetric REST API (`/api/public/identify` and `/api/public/track`).*
