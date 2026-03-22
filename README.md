# OnboardFlow

A unified authentication and onboarding platform for developers and small businesses.

OnboardFlow comes in two tiers — **Enterprise** for developers building SaaS products, and **Individual** for freelancers and small businesses who want email list management without writing code.

Live: <a href="https://onboardflow-three.vercel.app">onboardflow-three.vercel.app</a>

---

## What it does

### Enterprise Tier — For Developers
Drop-in authentication and onboarding automation for your SaaS product. Install the SDK, get magic link auth, automated drip emails, and a developer dashboard — without building any of it from scratch.

### Individual Tier — For Small Businesses
No code required. Create email lists, manage contacts, build campaigns, and send emails directly from the dashboard. Free to start.

---

## Enterprise — Key Features

- **Magic Link Authentication** — Passwordless, secure login flows
- **Automated Onboarding Emails** — Drip sequences triggered by user behaviour (step completion, inactivity nudges)
- **Smart Nudges** — Re-engage users who haven't activated after 1 hour or 24 hours
- **Developer Dashboard** — Manage API keys, view user analytics, configure automation steps
- **Type-Safe SDK** — Full TypeScript support

## Individual — Key Features

- **Email Lists** — Create and manage up to 3 lists
- **Contact Management** — Add and remove contacts (up to 10 per list)
- **Email Campaigns** — Write, schedule, and send campaigns via Resend
- **Basic Analytics** — Track campaign status (draft, scheduled, sent)

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Database**: PostgreSQL via Supabase + Drizzle ORM
- **Auth**: Supabase Auth (Magic Link + Google OAuth)
- **Email**: Resend
- **Payments**: Stripe (coming soon)
- **Hosting**: Vercel

---

## Enterprise SDK — Quick Start

### Installation

Install the package via your preferred package manager:

    npm install onboardflow

### Configuration

1. Sign up at onboardflow-three.vercel.app
2. Choose the Enterprise tier
3. Copy your API key from the dashboard
4. Add to your .env.local file:

    NEXT_PUBLIC_ONBOARDFLOW_KEY=obf_live_xxxxxxxxxxxxx

### Initialize the client

Create a shared utility file at lib/onboardflow.ts:

    import { OnboardFlow } from '@onboardflow/sdk';
    
    export const onboard = new OnboardFlow({
      apiKey: process.env.NEXT_PUBLIC_ONBOARDFLOW_KEY,
    });

### Protect routes

In your middleware.ts file:

    import { onboardMiddleware } from '@onboardflow/sdk/next';
    
    export default onboardMiddleware({
      publicRoutes: ['/', '/login', '/pricing', '/api/webhook'],
      redirectTo: '/login',
    });
    
    export const config = {
      matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
    };

### Access user sessions

    import { onboard } from '@/lib/onboardflow';
    
    export default async function Dashboard() {
      const session = await onboard.getSession();
      if (!session) return ;
    
      return (
        
      );
    }

### Track onboarding events

    await onboard.events.track('feature_used', {
      featureName: 'AI Generator',
      userId: session.user.id
    });

---

## Rate Limits (Free Tier)

Enterprise: 20 emails per day, 300 emails per month, 50 end users tracked
Individual: 3 email lists, 10 contacts per list, 1 campaign per list

Limits will increase when we launch a paid plan. You will be notified first.

---

## Roadmap

- Stripe payment gating for Enterprise
- Campaign scheduling execution via cron
- Advanced analytics including open rates and click rates
- Bulk CSV contact import
- Premium Individual tier
- Custom domain support

---

## License

MIT License — Copyright 2026 OnboardFlow

---
