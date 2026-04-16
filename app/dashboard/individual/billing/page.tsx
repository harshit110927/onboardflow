import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { INDIVIDUAL_PLANS, type PlanTier } from "@/lib/plans/limits";
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
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground">Billing</span>
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INDIVIDUAL_PLANS.map((plan) => (
            <BillingActions key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
}
