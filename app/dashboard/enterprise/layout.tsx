import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { EnterpriseNavLinks } from "./_components/NavLinks";

export default async function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "enterprise") redirect("/dashboard");

  const planInfo = await getTenantPlan(tenant.id);
  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="theme-deep min-h-screen bg-background flex flex-col">
      <header className="app-shell-nav border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/dashboard/enterprise" prefetch={false} className="font-medium tracking-tight text-base shrink-0">
            OnboardFlow
          </Link>

          <EnterpriseNavLinks />

          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium hidden sm:block ${planInfo.plan !== "free" ? "bg-emerald-950/40 text-emerald-300" : "bg-white/10 text-white/70"}`}>
              {planInfo.plan === "free" ? "Free" : planInfo.plan.charAt(0).toUpperCase() + planInfo.plan.slice(1)}
            </span>
            <div className="h-8 w-8 rounded-full bg-emerald-800/90 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
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
