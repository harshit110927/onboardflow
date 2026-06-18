import { redirect } from "next/navigation";
import Link from "next/link";
import { ENTERPRISE_PLANS, type EnterprisePlanTier } from "@/lib/plans/limits";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { BillingActions } from "../../individual/billing/_components/BillingActions";

const ENTERPRISE_LAUNCH_PRICES: Partial<Record<EnterprisePlanTier, { regularUsd: number; launchUsd: number; badge: string }>> = {
  basic: { regularUsd: 60, launchUsd: 25, badge: "Launch Month Discount" },
  advanced: { regularUsd: 120, launchUsd: 50, badge: "Launch Month Discount" },
};

export default async function EnterpriseBillingPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "enterprise") redirect("/dashboard");

  const planInfo = await getTenantPlan(tenant.id);


  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Current Plan</h2>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{planInfo.plan}</p>
          {tenant.planRenewalDate && planInfo.plan !== "free" && (
            <p className="text-xs text-muted-foreground mt-1">
              Renews on {tenant.planRenewalDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          {tenant.razorpaySubscriptionId && (
            <form action="/api/razorpay/cancel-subscription" method="post" className="mt-4">
              <button className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors" type="submit">
                Cancel Subscription
              </button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ENTERPRISE_PLANS.map((plan) => (
            <BillingActions
              key={plan.id}
              plan={plan}
              isCurrent={planInfo.plan === plan.planTier}
              launchPriceDisplay={ENTERPRISE_LAUNCH_PRICES[plan.planTier]}
            />
          ))}

          {/* CUSTOM FEATURES & ANALYTICS TIER */}
          <div className="rounded-lg border border-border bg-card p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Custom / Enterprise</h2>
              <div className="mt-2 text-3xl font-bold text-foreground">Custom</div>
              <p className="mt-4 text-sm text-muted-foreground">
                Need advanced analytics, ML-driven churn prediction, or custom SLA integrations? Consult with our team to build exactly what you need.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">✓ Advanced predictive ML models</li>
                <li className="flex items-center gap-2">✓ Custom dashboard integrations</li>
                <li className="flex items-center gap-2">✓ Dedicated support & SLA</li>
              </ul>
            </div>
            <a 
              href="mailto:hello@dripmetric.com?subject=Dripmetric%20Custom%20Plan%20Inquiry"
              className="mt-8 flex w-full items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Contact Sales
            </a>
          </div>
        </div>

        <Link href="/dashboard/enterprise" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
