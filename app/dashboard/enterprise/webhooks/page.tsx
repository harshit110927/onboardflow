import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, webhooks, webhookDeliveries } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { WebhooksManager } from "./_components/WebHooksManager";

export default async function WebhooksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "enterprise") redirect("/dashboard");

  const { plan } = await getTenantPlan(tenant.id);

  if (plan !== "advanced") {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <Link href="/dashboard/enterprise" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Dashboard
          </Link>
          <div className="rounded-lg border border-border bg-card p-8 text-center flex flex-col gap-4">
            <p className="text-2xl">🔒</p>
            <h1 className="text-xl font-bold text-foreground">Webhooks — Advanced Feature</h1>
            <p className="text-sm text-muted-foreground">
              Upgrade to Advanced to receive real-time webhook events when users activate, get stuck, or complete onboarding steps.
            </p>
            <Link
              href="/dashboard/enterprise/billing"
              className="self-center text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Upgrade to Advanced
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const existingWebhooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.tenantId, tenant.id));

  const recentDeliveries = await db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      eventType: webhookDeliveries.eventType,
      responseStatus: webhookDeliveries.responseStatus,
      success: webhookDeliveries.success,
      deliveredAt: webhookDeliveries.deliveredAt,
    })
    .from(webhookDeliveries)
    .orderBy(webhookDeliveries.deliveredAt)
    .limit(20);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/enterprise" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground">Webhooks</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receive HTTP POST requests when events happen in your onboarding flow.
          </p>
        </div>

        <WebhooksManager
          initialWebhooks={existingWebhooks}
          recentDeliveries={recentDeliveries}
        />
      </div>
    </div>
  );
}