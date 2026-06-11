"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ENTERPRISE_LIMITS, ENTERPRISE_PLANS, type EnterprisePlanTier } from "@/lib/plans/limits";

const ANNUAL_DISCOUNT_RATE = 0.2;

type BillingCycle = "monthly" | "annual";

type PricingTier = {
  tier: EnterprisePlanTier;
  description: string;
  monthlyPriceUsd: number;
  ctaLabel: string;
  ctaHref: string;
  isPopular?: boolean;
};

const paidPlanIdsByTier = Object.fromEntries(
  ENTERPRISE_PLANS.map((plan) => [plan.planTier, plan.id])
) as Partial<Record<EnterprisePlanTier, (typeof ENTERPRISE_PLANS)[number]["id"]>>;

const pricingTiers: PricingTier[] = [
  {
    tier: "free",
    description: "Explore Dripmetric with a lightweight onboarding automation setup.",
    monthlyPriceUsd: 0,
    ctaLabel: "Start free",
    ctaHref: "/login",
  },
  {
    tier: "basic",
    description: "A practical launch plan for early SaaS teams improving activation.",
    monthlyPriceUsd: 79,
    ctaLabel: "Get started",
    // TODO: Wire paid tier CTAs after the destination is confirmed.
    ctaHref: "#",
    isPopular: true,
  },
  {
    tier: "advanced",
    description: "Scale onboarding automation with higher limits and richer insights.",
    monthlyPriceUsd: 149,
    ctaLabel: "Get started",
    // TODO: Wire paid tier CTAs after the destination is confirmed.
    ctaHref: "#",
  },
];

const faqItems = [
  {
    question: "What counts as a tracked user?",
    answer:
      "A tracked user is any end user your application identifies via the identify() SDK call or REST API.",
  },
  {
    question: "Is there a free trial?",
    answer: "The free tier is free forever with no time limit.",
  },
  {
    question: "Can I change my plan later?",
    answer: "Yes, upgrade or downgrade any time from the billing page inside your dashboard.",
  },
];

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatPrice(monthlyPriceUsd: number, billingCycle: BillingCycle) {
  const effectivePrice = billingCycle === "annual" ? monthlyPriceUsd * (1 - ANNUAL_DISCOUNT_RATE) : monthlyPriceUsd;

  if (effectivePrice === 0) return "$0";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(effectivePrice) ? 0 : 2,
  }).format(effectivePrice);
}

function formatDripSteps(maxDripSteps: number) {
  return Number.isFinite(maxDripSteps) ? `${formatNumber(maxDripSteps)} drip steps` : "Unlimited drip steps";
}

function formatBooleanFeature(enabled: boolean, enabledLabel: string, disabledLabel: string) {
  return enabled ? enabledLabel : disabledLabel;
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const planCards = useMemo(
    () =>
      pricingTiers.map((plan) => {
        const limits = ENTERPRISE_LIMITS[plan.tier];
        const paidPlanId = paidPlanIdsByTier[plan.tier];

        return {
          ...plan,
          paidPlanId,
          price: formatPrice(plan.monthlyPriceUsd, billingCycle),
          limits,
          features: [
            `${formatNumber(limits.maxTrackedUsers)} tracked users`,
            `${formatNumber(limits.maxEmailsPerMonth)} emails/month`,
            formatDripSteps(limits.maxDripSteps),
            formatBooleanFeature(limits.webhooksEnabled, "Webhooks enabled", "No webhooks"),
            formatBooleanFeature(
              limits.advancedAnalyticsEnabled,
              "Advanced analytics enabled",
              "No advanced analytics"
            ),
          ],
        };
      }),
    [billingCycle]
  );

  return (
    <main className="min-h-screen bg-[#f0effe] text-[#1e1b4b]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <nav className="flex items-center justify-between gap-4" aria-label="Pricing navigation">
          <Link href="/" className="text-sm font-semibold text-[#4338ca] transition-colors hover:text-[#1e1b4b]">
            ← Back to Dripmetric
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[#d7d2f4] bg-white px-4 py-2 text-sm font-semibold text-[#4338ca] shadow-sm transition hover:-translate-y-0.5 hover:border-[#a5b4fc] hover:shadow-md"
          >
            Log in
          </Link>
        </nav>

        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6366f1]">Enterprise pricing</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#1e1b4b] sm:text-5xl">
            Start free, then scale your SaaS onboarding.
          </h1>
          <p className="mt-5 text-base leading-7 text-[#64748b] sm:text-lg">
            Choose the Enterprise plan that matches your tracked user volume, email cadence, drip complexity, and analytics needs.
          </p>
        </div>

        <div className="mx-auto flex rounded-full border border-[#d7d2f4] bg-white p-1 shadow-sm" aria-label="Billing cycle toggle">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              billingCycle === "monthly" ? "bg-[#4338ca] text-white shadow" : "text-[#64748b] hover:text-[#1e1b4b]"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("annual")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              billingCycle === "annual" ? "bg-[#4338ca] text-white shadow" : "text-[#64748b] hover:text-[#1e1b4b]"
            }`}
          >
            Annual <span className="ml-1 text-xs opacity-80">Save 20%</span>
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {planCards.map((plan) => (
            <article
              key={plan.tier}
              className={`relative flex flex-col rounded-3xl border bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                plan.isPopular ? "border-[#6366f1] ring-4 ring-[#c7d2fe]" : "border-[#e2e0f5]"
              }`}
            >
              {plan.isPopular ? (
                <div className="absolute right-6 top-6 rounded-full bg-[#4338ca] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white">
                  Most popular
                </div>
              ) : null}

              <div className="pr-28 lg:pr-0 xl:pr-24">
                <h2 className="text-2xl font-semibold capitalize text-[#1e1b4b]">{plan.tier}</h2>
                <p className="mt-3 min-h-14 text-sm leading-6 text-[#64748b]">{plan.description}</p>
              </div>

              <div className="mt-8">
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-semibold tracking-[-0.05em] text-[#1e1b4b]">{plan.price}</span>
                  <span className="pb-2 text-sm font-medium text-[#64748b]">/month</span>
                </div>
                {billingCycle === "annual" ? (
                  <p className="mt-2 text-sm text-[#64748b]">Billed annually as a 20% discounted monthly equivalent.</p>
                ) : (
                  <p className="mt-2 text-sm text-[#64748b]">Monthly billing with no annual commitment.</p>
                )}
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-[#1e1b4b]">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff] text-xs font-bold text-[#4338ca]">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                data-plan-id={plan.paidPlanId}
                className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${
                  plan.isPopular
                    ? "bg-[#4338ca] text-white shadow-lg shadow-indigo-200 hover:bg-[#312e81]"
                    : "border border-[#d7d2f4] bg-[#f8f7ff] text-[#4338ca] hover:border-[#a5b4fc] hover:bg-white"
                }`}
              >
                {plan.ctaLabel}
              </Link>
            </article>
          ))}
        </div>

        <section className="rounded-3xl border border-[#e2e0f5] bg-white p-7 shadow-sm sm:p-10" aria-labelledby="pricing-faq">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6366f1]">FAQ</p>
            <h2 id="pricing-faq" className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#1e1b4b]">
              Pricing questions, answered.
            </h2>
          </div>

          <div className="mx-auto mt-8 grid max-w-4xl gap-4">
            {faqItems.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-[#ece9ff] bg-[#fafaff] p-5 open:bg-white">
                <summary className="cursor-pointer list-none text-base font-semibold text-[#1e1b4b] marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span className="text-[#6366f1] transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-[#64748b]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
