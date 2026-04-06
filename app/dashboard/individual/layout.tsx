// MODIFIED — razorpay credits migration — added shared CreditMeter to individual top navigation
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import CreditMeter from "@/app/_components/CreditMeter";
import { NavLinks } from "./_components/NavLinks";

export default async function IndividualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    .select({
      id: tenants.id,
      email: tenants.email,
      tier: tenants.tier,
      plan: tenants.plan,
      planExpiresAt: tenants.planExpiresAt,
      credits: tenants.credits,
    })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  // FIX — derive effective plan inline to avoid extra getTenantPlan DB call in layout
  const now = new Date();
  const effectivePlan = tenant.plan === "premium" &&
    (tenant.planExpiresAt === null || tenant.planExpiresAt > now)
    ? "premium"
    : "free";
  const initials = user.email.slice(0, 2).toUpperCase();
  // FIX — use tenant credits directly from existing tenant query
  const creditBalance = tenant.credits ?? 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top Nav */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link
            href="/dashboard/individual"
            className="font-bold text-foreground tracking-tight text-base shrink-0"
          >
            OnboardFlow
          </Link>

          {/* FIX — use client nav links for active route styling */}
          <NavLinks />

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium hidden sm:block ${effectivePlan === "premium" ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
              {effectivePlan === "premium" ? "Premium" : "Free Plan"}
            </span>
            <div className="hidden sm:block">
              <CreditMeter
                credits={creditBalance}
                tier="individual"
                billingPath="/dashboard/individual/billing"
              />
            </div>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
              {initials}
            </div>
          </div>

        </div>

        {/* Mobile nav */}
        <div className="sm:hidden border-t border-border">
          <div className="flex">
            {[
              { href: "/dashboard/individual", label: "Dashboard" },
              { href: "/dashboard/individual/lists", label: "Lists" },
              { href: "/dashboard/individual/campaigns", label: "Campaigns" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 text-center text-xs py-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {/* FIX — wrap children in Suspense fallback for smoother route transitions */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>

    </div>
  );
}
