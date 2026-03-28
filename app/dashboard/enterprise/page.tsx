import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { ApiKeyCard } from "@/app/dashboard/ApiKeyCard";

export default async function EnterpriseDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tierCheck = await db
    .select({ tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email!))
    .limit(1);

  const tier = tierCheck[0]?.tier ?? null;
  if (!tier) redirect("/tier-selection");
  if (tier !== "enterprise") redirect("/dashboard/individual");

  const tenantRows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.email, user.email!))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant) return <div>Error loading account. Please refresh.</div>;

  const planInfo = await getTenantPlan(tenant.id);

  const allUsers = await db.query.endUsers.findMany({
    where: eq(endUsers.tenantId, tenant.id),
  });

  const totalUsers = allUsers.length;
  const activationStep = tenant.activationStep || "connect_repo";
  const activatedCount = allUsers.filter((u) => {
    const steps = (u.completedSteps as string[]) || [];
    return steps.includes(activationStep);
  }).length;
  const completionRate = totalUsers > 0
    ? Math.round((activatedCount / totalUsers) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back, {tenant.name}
            </h1>
            <p className="text-muted-foreground">Executive Overview</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              planInfo.plan === "premium"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-secondary text-muted-foreground"
            }`}>
              {planInfo.plan === "premium" ? "Premium" : "Free Plan"}
            </span>
            <Link
              href="/dashboard/settings"
              className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors"
            >
              Settings
            </Link>
            {planInfo.plan === "premium" && (
              <>
                <Link
                  href="/dashboard/enterprise/drip-steps"
                  className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors"
                >
                  Drip Steps
                </Link>
                <Link
                  href="/dashboard/enterprise/webhooks"
                  className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors"
                >
                  Webhooks
                </Link>
              </>
            )}
            <Link
              href="/docs"
              className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/dashboard/enterprise/billing"
              className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 transition-opacity"
            >
              {planInfo.plan === "premium" ? "Manage Billing" : "Upgrade"}
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground mb-4">Onboarding Health</p>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-3xl font-bold text-foreground">{totalUsers}</div>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{completionRate}%</div>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/dashboard/analytics"
                className="block text-center text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
              >
                View Detailed Dashboard →
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground mb-4">Subscription</p>
            {planInfo.plan === "premium" ? (
              <div className="flex flex-col gap-2">
                <div className="text-2xl font-bold text-emerald-700">Enterprise Premium</div>
                {planInfo.expiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Renews {planInfo.expiresAt.toLocaleDateString("en-US", {
                      month: "long", day: "numeric", year: "numeric",
                    })}
                  </p>
                )}
                <Link
                  href="/dashboard/enterprise/billing"
                  className="mt-4 text-center text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
                >
                  Manage Subscription
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-2xl font-bold text-foreground">
                  $49.99 <span className="text-sm font-normal text-muted-foreground">/ month</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  2,000 users · 500 emails/day · Unlimited drip steps · Webhooks
                </p>
                <Link
                  href="/dashboard/enterprise/billing"
                  className="text-center text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
                >
                  Upgrade to Premium
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* API Key */}
        {tenant.apiKey && (
          <ApiKeyCard apiKey={tenant.apiKey} />
        )}

      </div>
    </div>
  );
}