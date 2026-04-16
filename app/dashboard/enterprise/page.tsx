import { redirect } from "next/navigation";
import { db } from "@/db";
import { endUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { ApiKeyCard } from "@/app/dashboard/ApiKeyCard";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";

export default async function EnterpriseDashboardPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");
  const tenant = await getTenant(user.email);
  if (!tenant) redirect("/tier-selection");
  if (tenant.tier !== "enterprise") redirect("/dashboard/individual");

  const planInfo = await getTenantPlan(tenant.id);

  const allUsers = await db.query.endUsers.findMany({ where: eq(endUsers.tenantId, tenant.id) });
  const totalUsers = allUsers.length;
  const activationStep = tenant.activationStep || "connect_repo";
  const activatedCount = allUsers.filter((u) => ((u.completedSteps as string[]) || []).includes(activationStep)).length;
  const completionRate = totalUsers > 0 ? Math.round((activatedCount / totalUsers) * 100) : 0;

  const planLabel = planInfo.plan === "free" ? "Free" : planInfo.plan === "basic" ? "Basic" : "Advanced";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, {tenant.name}</h1>
            <p className="text-muted-foreground">Executive Overview</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${planInfo.plan !== "free" ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
              {planLabel}
            </span>
            <Link href="/dashboard/settings" className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors">Settings</Link>
            {planInfo.plan === "advanced" && (
              <>
                <Link href="/dashboard/enterprise/drip-steps" className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors">Drip Steps</Link>
                <Link href="/dashboard/enterprise/webhooks" className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors">Webhooks</Link>
              </>
            )}
            <Link href="/dashboard/enterprise/billing" className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 transition-opacity">
              {planInfo.plan === "free" ? "Upgrade" : "Manage Billing"}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground mb-4">Onboarding Health</p>
            <div className="flex justify-between items-end">
              <div><div className="text-3xl font-bold text-foreground">{totalUsers}</div><p className="text-xs text-muted-foreground">Total Users</p></div>
              <div className="text-right"><div className="text-3xl font-bold text-primary">{completionRate}%</div><p className="text-xs text-muted-foreground">Completion Rate</p></div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground mb-4">Subscription</p>
            <div className="text-2xl font-bold text-foreground">{planLabel} Plan</div>
            {tenant.planRenewalDate && planInfo.plan !== "free" && (
              <p className="text-xs text-muted-foreground mt-1">
                Renews {tenant.planRenewalDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        </div>

        {tenant.apiKey && <ApiKeyCard apiKey={tenant.apiKey} />}
      </div>
    </div>
  );
}
