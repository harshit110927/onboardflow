import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ApiKeyCard } from "@/app/dashboard/ApiKeyCard";
import { db } from "@/db";
import { endUsers } from "@/db/schema";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";

type StepMetric = {
  label: string;
  eventName: string;
  count: number;
  percent: number;
};

export default async function EnterpriseDashboardPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant) redirect("/tier-selection");
  if (tenant.tier !== "enterprise") redirect("/dashboard/individual");

  const planInfo = await getTenantPlan(tenant.id);
  const allUsers = await db.query.endUsers.findMany({
    where: eq(endUsers.tenantId, tenant.id),
  });

  const totalUsers = allUsers.length;
  const step1 = tenant.activationStep || "connect_repo";
  const step2 = tenant.step2 || "";
  const step3 = tenant.step3 || "";

  const countForStep = (eventName: string) => {
    if (!eventName) return 0;
    return allUsers.filter((u) =>
      ((u.completedSteps as string[]) || []).includes(eventName),
    ).length;
  };

  const step1Count = countForStep(step1);
  const step2Count = countForStep(step2);
  const step3Count = countForStep(step3);

  const metrics: StepMetric[] = [
    {
      label: "Step 1",
      eventName: step1,
      count: step1Count,
      percent: totalUsers > 0 ? Math.round((step1Count / totalUsers) * 100) : 0,
    },
    ...(step2
      ? [{
        label: "Step 2",
        eventName: step2,
        count: step2Count,
        percent: totalUsers > 0 ? Math.round((step2Count / totalUsers) * 100) : 0,
      }]
      : []),
    ...(step3
      ? [{
        label: "Step 3",
        eventName: step3,
        count: step3Count,
        percent: totalUsers > 0 ? Math.round((step3Count / totalUsers) * 100) : 0,
      }]
      : []),
  ];

  const planLabel =
    planInfo.plan === "free"
      ? "Free"
      : planInfo.plan === "basic"
        ? "Basic"
        : "Advanced";

  const stuckCount = totalUsers - step1Count;
  const completionRate = totalUsers > 0 ? Math.round((step1Count / totalUsers) * 100) : 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back, {tenant.name}
            </h1>
            <p className="text-muted-foreground">
              Monitor funnel performance, automate nudges, and manage your integration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                planInfo.plan !== "free"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {planLabel} Plan
            </span>
            <Link
              href="/dashboard/analytics"
              className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
            >
              Analytics
            </Link>
            <Link
              href="/dashboard/settings"
              className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
            >
              Automation Settings
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
            >
              Docs
            </Link>
            <Link
              href="/dashboard/enterprise/billing"
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90"
            >
              {planInfo.plan === "free" ? "Upgrade" : "Manage Billing"}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Users
            </p>
            <p className="mt-2 text-3xl font-bold text-foreground">{totalUsers}</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Activated
            </p>
            <p className="mt-2 text-3xl font-bold text-primary">{step1Count}</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stuck Before Step 1
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{Math.max(0, stuckCount)}</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Completion Rate
            </p>
            <p className="mt-2 text-3xl font-bold text-foreground">{completionRate}%</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Funnel Step Breakdown</h2>
            <p className="text-sm text-muted-foreground">
              This mirrors the old analytics intent: see where users are dropping off by step.
            </p>
          </div>

          <div className="divide-y divide-border">
            {metrics.map((metric) => (
              <div key={metric.label} className="grid gap-2 px-6 py-4 md:grid-cols-3 md:items-center">
                <div>
                  <p className="text-sm font-semibold text-foreground">{metric.label}</p>
                  <p className="text-xs text-muted-foreground">{metric.eventName}</p>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${metric.percent}%` }}
                  />
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {metric.count} users ({metric.percent}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold text-foreground">Automation Controls</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit drip step event names, subjects, and email copy from settings.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dashboard/settings"
                className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                Open Settings
              </Link>
              {planInfo.plan === "advanced" && (
                <>
                  <Link
                    href="/dashboard/enterprise/drip-steps"
                    className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                  >
                    Drip Steps
                  </Link>
                  <Link
                    href="/dashboard/enterprise/webhooks"
                    className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                  >
                    Webhooks
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold text-foreground">Resources</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              View setup docs, analyze cohort/funnel metrics, and manage your API integration.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/docs"
                className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                Open Docs
              </Link>
              <Link
                href="/dashboard/analytics"
                className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                Open Analytics
              </Link>
            </div>
          </div>
        </div>

        {tenant.apiKey && <ApiKeyCard apiKey={tenant.apiKey} />}
      </div>
    </div>
  );
}
