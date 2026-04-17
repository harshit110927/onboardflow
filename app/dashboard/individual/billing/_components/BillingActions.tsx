"use client";

import { useState } from "react";

type PlanCard = {
  id: string;
  label: string;
  priceInr: number;
  priceUsd: number;
  highlights: readonly string[];
};

type Props = {
  plan: PlanCard;
  isCurrent: boolean;
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

export function BillingActions({ plan, isCurrent }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) throw new Error("Razorpay failed to load");

      const res = await fetch("/api/razorpay/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = (await res.json()) as { subscriptionId?: string; error?: string };
      if (!res.ok || !data.subscriptionId) throw new Error(data.error ?? "Failed to create subscription");

      const rz = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscriptionId,
        name: "OnboardFlow",
        description: `${plan.label} subscription`,
        theme: { color: "#3d6b52" },
        handler: () => window.location.reload(),
        modal: { ondismiss: () => setLoading(false) },
      });

      rz.open();
    } catch {
      alert("Unable to start subscription checkout.");
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-xl bg-card p-5 flex flex-col gap-4 relative ${isCurrent ? "border-2 border-primary" : "border border-border"}`}>
      {isCurrent && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary text-primary-foreground text-[10px] px-3 py-1">
          Current plan
        </span>
      )}
      <div>
        <h3 className="text-lg font-semibold text-foreground">{plan.label}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          ₹{plan.priceInr.toLocaleString("en-IN")} / ${plan.priceUsd} per month
        </p>
      </div>

      <ul className="text-sm text-muted-foreground space-y-1">
        {plan.highlights.map((highlight) => (
          <li key={highlight}>• {highlight}</li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading || isCurrent}
        className={`mt-auto rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed ${isCurrent ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"}`}
      >
        {isCurrent ? "Active plan" : loading ? "Loading..." : "Subscribe"}
      </button>
    </div>
  );
}
