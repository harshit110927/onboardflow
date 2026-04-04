// MODIFIED — razorpay credits migration — replaced Stripe actions with Razorpay credit-pack purchase card flow
"use client";

import { useState } from "react";

type Props = {
  pack: {
    id: string;
    label: string;
    priceInr: number;
    priceUsd: number;
    credits: number;
    bonus: number;
    highlights: string[];
  };
  userEmail: string;
  tier: "individual" | "enterprise";
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

export function BillingActions({ pack, userEmail, tier }: Props) {
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        alert("Unable to load Razorpay. Please try again.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });

      const data = (await res.json()) as {
        orderId?: string;
        amount?: number;
        error?: string;
      };

      if (!res.ok || !data.orderId || !data.amount) {
        throw new Error(data.error ?? "Failed to create order");
      }

      const billingPath =
        tier === "enterprise"
          ? "/dashboard/enterprise/billing"
          : "/dashboard/individual/billing";

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: "INR",
        name: "OnboardFlow",
        description: `${pack.label} — ${pack.credits.toLocaleString()} Credits`,
        order_id: data.orderId,
        prefill: { email: userEmail },
        theme: { color: "#6366f1" },
        handler: () => {
          window.location.href = `${billingPath}?success=credits`;
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      razorpay.open();
    } catch {
      alert("Unable to start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{pack.label}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          ₹{pack.priceInr.toLocaleString("en-IN")} / ${pack.priceUsd}
        </p>
      </div>

      <div>
        <p className="text-xl font-bold text-foreground">
          {pack.credits.toLocaleString()} credits
        </p>
        {pack.bonus > 0 && (
          <span className="inline-flex mt-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            +{pack.bonus}% bonus
          </span>
        )}
      </div>

      <ul className="text-sm text-muted-foreground space-y-1">
        {pack.highlights.map((highlight) => (
          <li key={highlight}>• {highlight}</li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handlePurchase}
        disabled={loading}
        className="mt-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Loading..." : "Buy Now"}
      </button>
    </div>
  );
}
