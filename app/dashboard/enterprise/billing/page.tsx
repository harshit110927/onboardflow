import { redirect } from "next/navigation";
import Link from "next/link";
import { ENTERPRISE_PLANS } from "@/lib/plans/limits";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { BillingActions } from "../../individual/billing/_components/BillingActions";

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
            <BillingActions key={plan.id} plan={plan} />
          ))}
        </div>

        <Link href="/dashboard/enterprise" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
