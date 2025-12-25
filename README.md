# OnboardFlow
A production-ready authentication and onboarding layer for modern SaaS applications.

OnboardFlow eliminates the complexity of building secure authentication and user onboarding flows from scratch. It provides a unified SDK that handles magic links, drip email campaigns, and subscription gating, allowing developers to focus exclusively on core product features.

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Protecting Routes (Middleware)](#1-protecting-routes-middleware)
  - [Accessing User Sessions](#2-accessing-user-sessions)
  - [Triggering Events](#3-triggering-events)
- [License](#license)

## Overview
### The Problem
Early-stage startups frequently lose significant development time implementing redundant infrastructure. Integrating secure authentication (Auth0/Supabase), payment processing (Stripe), and email automation (Resend/SendGrid) often takes weeks of engineering effort before the core product can be tested.

### The Solution
OnboardFlow offers a drop-in integration that connects these services instantly. By installing the SDK, developers gain a pre-built authentication flow, automated welcome emails, and subscription management without managing the underlying infrastructure.

## Key Features
- **Magic Link Authentication**: Secure, passwordless login flows that reduce friction and increase conversion rates.
- **Subscription Gating**: Built-in middleware to protect routes based on Stripe subscription status (Active, Past Due, Canceled).
- **Automated Onboarding**: Trigger email sequences automatically when users sign up or upgrade their plans.
- **Developer Dashboard**: A centralized view to manage API keys, view user sessions, and track revenue metrics.
- **Type-Safe SDK**: Full TypeScript support with comprehensive type definitions for user sessions and subscription data.

## Installation
Install the package via your preferred package manager:

```bash
npm install @onboardflow/sdk
# or
yarn add @onboardflow/sdk
```

## Configuration
To start using the SDK, you must initialize the client with your project credentials.

1. Navigate to the Developer Settings in your OnboardFlow dashboard.
2. Generate a new Public API Key.
3. Add the key to your environment variables file (`.env.local`):

```bash
NEXT_PUBLIC_ONBOARDFLOW_KEY=obf_live_xxxxxxxxxxxxx
```

### Client Initialization
Initialize the OnboardFlow instance in a shared utility file (e.g., `lib/onboardflow.ts`):

```typescript
import { OnboardFlow } from '@onboardflow/sdk';

export const onboard = new OnboardFlow({
  apiKey: process.env.NEXT_PUBLIC_ONBOARDFLOW_KEY,
});
```

## Usage
### 1. Protecting Routes (Middleware)
Use the provided middleware to automatically restrict access to unauthenticated users. This ensures that private routes are only accessible to users with valid sessions.

```typescript
// middleware.ts
import { onboardMiddleware } from '@onboardflow/sdk/next';

export default onboardMiddleware({
  // Routes that do not require authentication
  publicRoutes: ['/', '/login', '/pricing', '/api/webhook'],
  
  // redirect unauthenticated users here
  redirectTo: '/login',
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 2. Accessing User Sessions
Retrieve current user data server-side to customize the UI or validate permissions.

```typescript
// app/dashboard/page.tsx
import { onboard } from '@/lib/onboardflow';

export default async function Dashboard() {
  const session = await onboard.getSession();

  if (!session) {
    return <div>Access Denied</div>;
  }

  return (
    <section>
      <h1>Welcome, {session.user.email}</h1>
      <p>Current Status: <strong>{session.subscription.status}</strong></p>
    </section>
  );
}
```

### 3. Triggering Events
Manually trigger onboarding events from your application logic.

```typescript
await onboard.events.track('feature_used', {
  featureName: 'AI Generator',
  userId: session.user.id
});
```

## License
This project is licensed under the MIT License - see the LICENSE file for details.

Copyright © 2025 OnboardFlow.