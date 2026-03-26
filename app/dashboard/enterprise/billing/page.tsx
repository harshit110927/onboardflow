// NEW FILE — phase 2 stripe integration
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { tenants, creditTransactions, stripeSubscriptions } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { ENTERPRISE_LIMITS, CREDIT_PACKS } from "@/lib/plans/limits";
import { BillingActions } from "../../individual/billing/_components/BillingActions";

export default async function EnterpriseBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "enterprise") redirect("/dashboard");

  const planInfo = await getTenantPlan(tenant.id);

  const recentTransactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.tenantId, tenant.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(10);

  const params = await searchParams;
  const limits = ENTERPRISE_LIMITS[planInfo.plan];

  const dripStepsDisplay =
    limits.maxDripSteps === Infinity ? "Unlimited" : String(limits.maxDripSteps);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1">Manage your plan and credits</p>
        </div>

        {params.success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            ✓ Payment successful — your plan has been updated.
          </div>
        )}
        {params.cancelled && (
          <div className="rounded-lg border border-border bg-secondary/40 px-5 py-4 text-sm text-muted-foreground">
            Checkout was cancelled. No changes were made.
          </div>
        )}

        {/* Current plan */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Current Plan</h2>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-bold text-foreground">
                  {planInfo.plan === "premium" ? "Enterprise Premium" : "Enterprise Free"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  planInfo.plan === "premium"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  {planInfo.plan === "premium" ? "Active" : "Free"}
                </span>
              </div>
              {planInfo.plan === "premium" && planInfo.expiresAt && (
                <p className="text-sm text-muted-foreground">
                  Renews {planInfo.expiresAt.toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              )}
              {planInfo.plan === "free" && (
                <p className="text-sm text-muted-foreground">
                  {limits.maxTrackedUsers} users · {limits.maxEmailsPerDay} emails/day · {dripStepsDisplay} drip steps
                </p>
              )}
            </div>
            <BillingActions
              plan={planInfo.plan}
              tier="enterprise"
              hasStripeCustomer={!!tenant.stripeCustomerId}
              enterprisePremiumPriceId={process.env.STRIPE_ENTERPRISE_PREMIUM_PRICE_ID!}
            />
          </div>
        </div>

        {/* Credits */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Credits</h2>
            <span className="text-2xl font-bold text-primary">
              {(tenant.credits ?? 0).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Credits extend your plan limits. They never expire.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CREDIT_PACKS.map((pack) => (
              <BillingActions
                key={pack.id}
                plan={planInfo.plan}
                tier="enterprise"
                hasStripeCustomer={!!tenant.stripeCustomerId}
                creditPack={pack}
                creditPriceId={process.env[`STRIPE_CREDITS_${pack.price}_PRICE_ID`]!}
              />
            ))}
          </div>
        </div>

        {/* Transaction history */}
        {recentTransactions.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Recent Transactions</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Credits</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{tx.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tx.createdAt?.toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      tx.amount > 0 ? "text-emerald-600" : "text-destructive"
                    }`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <Link
            href="/dashboard/enterprise"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}