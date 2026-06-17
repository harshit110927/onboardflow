"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ENTERPRISE_LIMITS, ENTERPRISE_PLANS, type EnterprisePlanTier } from "@/lib/plans/limits";



type PricingTier = {
  tier: EnterprisePlanTier;
  description: string;
  launchPriceUsd: number;
  regularPriceUsd: number;
  label: string;
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
    launchPriceUsd: 0,
    regularPriceUsd: 0,
    label: "Free",
    ctaLabel: "Start free",
    ctaHref: "/login",
  },
  {
    tier: "basic",
    label: "Startup",
    description: "A practical launch plan for early SaaS teams improving activation.",
    launchPriceUsd: 25,
    regularPriceUsd: 60,
    ctaLabel: "Get started",
    // TODO: Wire paid tier CTAs after the destination is confirmed.
    ctaHref: "#",
    isPopular: true,
  },
  {
    tier: "advanced",
    label: "Growth",
    description: "Scale onboarding automation with higher limits and richer insights.",
    launchPriceUsd: 50,
    regularPriceUsd: 120,
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

function formatUsd(monthlyPriceUsd: number) {
  if (monthlyPriceUsd === 0) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(monthlyPriceUsd);
}

function formatDripSteps(maxDripSteps: number) {
  return Number.isFinite(maxDripSteps) ? `${formatNumber(maxDripSteps)} drip steps` : "Unlimited drip steps";
}

function formatBooleanFeature(enabled: boolean, enabledLabel: string, disabledLabel: string) {
  return enabled ? enabledLabel : disabledLabel;
}

export default function PricingPage() {
  

  const planCards = useMemo(
    () =>
      pricingTiers.map((plan) => {
        const limits = ENTERPRISE_LIMITS[plan.tier];
        const paidPlanId = paidPlanIdsByTier[plan.tier];

        return {
          ...plan,
          paidPlanId,
          launchPrice: formatUsd(plan.launchPriceUsd),
          regularPrice: formatUsd(plan.regularPriceUsd),
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
    []
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
                <h2 className="text-2xl font-semibold text-[#1e1b4b]">{plan.label}</h2>
                <p className="mt-3 min-h-14 text-sm leading-6 text-[#64748b]">{plan.description}</p>
              </div>

              <div className="mt-8">
                {plan.regularPriceUsd > plan.launchPriceUsd ? (
                  <div className="space-y-3">
                    <p className="text-lg font-semibold text-[#64748b]">
                      <span className="line-through decoration-2">{plan.regularPrice}/month</span>
                    </p>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-semibold tracking-[-0.05em] text-[#1e1b4b]">{plan.launchPrice}</span>
                      <span className="pb-2 text-sm font-medium text-[#64748b]">/month</span>
                    </div>
                    <span className="inline-flex rounded-full bg-[#e0e7ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#4338ca]">
                      Launch Month Discount
                    </span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-semibold tracking-[-0.05em] text-[#1e1b4b]">{plan.launchPrice}</span>
                    <span className="pb-2 text-sm font-medium text-[#64748b]">/month</span>
                  </div>
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
