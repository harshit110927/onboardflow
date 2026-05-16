// MODIFIED — subscription migration
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { NavLinks } from "./_components/NavLinks";

export default async function IndividualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  // FIX — derive effective plan inline to avoid extra getTenantPlan DB call in layout
  const now = new Date();
  const effectivePlan = tenant.planExpiresAt && tenant.planExpiresAt < now ? "free" : tenant.plan;
  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="theme-deep min-h-screen bg-background flex flex-col">

      {/* Top Nav */}
      <header className="app-shell-nav border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link
            href="/dashboard/individual"
            // FIX — avoid eager prefetch storm from persistent dashboard header links
            prefetch={false}
            className="font-medium tracking-tight text-base shrink-0"
          >
            Dripmetric
          </Link>

          {/* FIX — use client nav links for active route styling */}
          <NavLinks />

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium hidden sm:block ${effectivePlan !== "free" ? "bg-emerald-950/40 text-emerald-300" : "bg-white/10 text-white/70"}`}>
              {effectivePlan === "free" ? "Free" : String(effectivePlan).charAt(0).toUpperCase() + String(effectivePlan).slice(1)}
            </span>
            <div className="h-8 w-8 rounded-full bg-emerald-800/90 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
          </div>

        </div>

        {/* Mobile nav */}
        <div className="sm:hidden border-t border-white/10">
          <div className="flex">
            {[
              { href: "/dashboard/individual", label: "Dashboard" },
              { href: "/dashboard/individual/lists", label: "Lists" },
              { href: "/dashboard/individual/pipeline", label: "Pipeline" },
              { href: "/dashboard/individual/campaigns", label: "Campaigns" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                // FIX — disable mobile nav prefetch for the same DB-connection protection as desktop links
                prefetch={false}
                className="nav-link flex-1 text-center text-xs py-2.5 hover:text-white hover:bg-white/10 transition-colors"
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
