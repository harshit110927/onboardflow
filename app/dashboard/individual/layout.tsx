import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";

export default async function IndividualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    .select({ id: tenants.id, email: tenants.email, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const planInfo = await getTenantPlan(tenant.id);
  const initials = user.email.slice(0, 2).toUpperCase();
  const creditBalance = planInfo.credits;

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

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {[
              { href: "/dashboard/individual", label: "Dashboard" },
              { href: "/dashboard/individual/lists", label: "Lists" },
              { href: "/dashboard/individual/campaigns", label: "Campaigns" },
              { href: "/dashboard/individual/billing", label: "Billing" },
              { href: "/dashboard/individual/settings", label: "Settings" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium hidden sm:block ${planInfo.plan === "premium" ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
              {planInfo.plan === "premium" ? "Premium" : "Free Plan"}
            </span>
            {creditBalance > 0 && (
              <Link
                href="/dashboard/individual/billing"
                className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium hidden sm:block hover:bg-primary/20 transition-colors"
              >
                {creditBalance.toLocaleString()} credits
              </Link>
            )}
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
        {children}
      </main>

    </div>
  );
}