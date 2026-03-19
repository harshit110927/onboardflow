// NEW FILE — created for tier selection feature
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setTier } from "@/lib/actions/set-tier";
import type { Tier } from "@/lib/types/tier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TierSelectionClient() {
  const router = useRouter();
  const [pending, setPending] = useState<Tier | null>(null);

  async function handleSelect(tier: Tier) {
    setPending(tier);

    try {
      const result = await setTier(tier);
      router.push(result.redirectTo);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome to OnboardFlow
        </h1>
        <p className="mt-2 text-muted-foreground text-base">
          Choose how you&apos;ll use the platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-8 flex flex-col">
          <Badge variant="secondary" className="w-fit mb-4">
            For Developers
          </Badge>
          <h2 className="text-2xl font-semibold text-foreground">Enterprise</h2>
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            Build and ship authentication for your SaaS. Full SDK access, API
            keys, and webhooks included.
          </p>
          <ul className="mt-6 space-y-3 flex-1">
            {[
              "Magic link authentication",
              "Full SDK & API access",
              "Unlimited users",
              "Webhook support",
              "Stripe subscription gating",
              "Developer dashboard",
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <Button
            className="mt-8 w-full"
            onClick={() => handleSelect("enterprise")}
            disabled={pending !== null}
          >
            {pending === "enterprise" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Get Started
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 flex flex-col">
          <Badge
            className="w-fit mb-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
          >
            Free
          </Badge>
          <h2 className="text-2xl font-semibold text-foreground">Individual</h2>
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            Manage email lists and run campaigns without writing a single line of
            code.
          </p>
          <ul className="mt-6 space-y-3 flex-1">
            {[
              "Up to 3 email lists",
              "Up to 10 contacts per list",
              "1 campaign per list",
              "Email scheduling",
              "Basic analytics",
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted-foreground text-center">
            Free plan · No credit card needed
          </p>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => handleSelect("individual")}
            disabled={pending !== null}
          >
            {pending === "individual" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Start Free
          </Button>
        </div>
      </div>
    </div>
  );
}
