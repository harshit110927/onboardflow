// NEW FILE — phase 2 stripe integration
"use client";
import { useState } from "react";

type CreditPack = {
  id: string;
  price: number;
  credits: number;
  bonus: number;
};

type Props = {
  plan: "free" | "premium";
  tier: "individual" | "enterprise";
  hasStripeCustomer: boolean;
  individualPremiumPriceId?: string;
  enterprisePremiumPriceId?: string;
  creditPack?: CreditPack;
  creditPriceId?: string;
};

export function BillingActions({
  plan,
  tier,
  hasStripeCustomer,
  individualPremiumPriceId,
  enterprisePremiumPriceId,
  creditPack,
  creditPriceId,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleCheckout(priceId: string, type: "subscription" | "credits") {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_id: priceId, type }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Credit pack button
  if (creditPack && creditPriceId) {
    return (
      <button
        onClick={() => handleCheckout(creditPriceId, "credits")}
        disabled={loading}
        className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <p className="text-base font-bold text-foreground">${creditPack.price}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {creditPack.credits.toLocaleString()} credits
          {creditPack.bonus > 0 && (
            <span className="ml-1 text-emerald-600">+{creditPack.bonus}% bonus</span>
          )}
        </p>
      </button>
    );
  }

  // Manage subscription (premium users)
  if (plan === "premium") {
    return (
      <button
        onClick={handlePortal}
        disabled={loading}
        className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors disabled:opacity-60"
      >
        {loading ? "Loading..." : "Manage Subscription"}
      </button>
    );
  }

  // Upgrade button (free users)
  const priceId = tier === "individual" ? individualPremiumPriceId : enterprisePremiumPriceId;
  const price = tier === "individual" ? "$9.99" : "$49.99";

  if (!priceId) return null;

  return (
    <button
      onClick={() => handleCheckout(priceId, "subscription")}
      disabled={loading}
      className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? "Loading..." : `Upgrade to Premium — ${price}/month`}
    </button>
  );
}