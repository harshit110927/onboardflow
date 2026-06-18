import { redirect } from "next/navigation";
import Link from "next/link";
import { INDIVIDUAL_PLANS } from "@/lib/plans/limits";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { BillingActions } from "./_components/BillingActions";

export default async function IndividualBillingPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const planInfo = await getTenantPlan(tenant.id);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Billing & plan</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your subscription and payment details.</p>
        </div>

        <div className="rounded-xl border border-border bg-secondary/40 p-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-base font-semibold text-foreground">Current plan — <span className="capitalize">{planInfo.plan}</span></p>
            <p className="text-sm text-muted-foreground mt-1">
              {tenant.planRenewalDate && planInfo.plan !== "free"
                ? `Renews ${tenant.planRenewalDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : "No active paid renewal"}
            </p>
          </div>
          {tenant.razorpaySubscriptionId && (
            <form action="/api/razorpay/cancel-subscription" method="post">
              <button className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors" type="submit">
                Cancel plan
              </button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {INDIVIDUAL_PLANS.map((plan) => (
            <BillingActions key={plan.id} plan={plan} isCurrent={planInfo.plan === plan.planTier} />
          ))}

          {/* CUSTOM FEATURES & ANALYTICS TIER */}
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Custom / Enterprise</h2>
              <div className="mt-2 text-2xl font-semibold text-foreground">Custom</div>
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

        <Link href="/dashboard/individual/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Settings
        </Link>
      </div>
    </div>
  );
}
