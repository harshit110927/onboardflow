import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react"; // (assuming you're using Next.js cache)
import type { PlanTier, EnterprisePlanTier } from "./limits";

export type TenantPlanInfo = {
  plan: PlanTier | EnterprisePlanTier;
  expiresAt: Date | null;
  isActive: boolean;
};

export const getTenantPlan = cache(async (tenantId: string): Promise<TenantPlanInfo> => {
  const rows = await db
    .select({ plan: tenants.plan, planExpiresAt: tenants.planExpiresAt, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const tenant = rows[0];
  if (!tenant) return { plan: "free", expiresAt: null, isActive: false };

  const now = new Date();
  const expired = tenant.planExpiresAt && tenant.planExpiresAt < now;
  const effectivePlan = expired ? "free" : (tenant.plan as PlanTier | EnterprisePlanTier);

  return {
    plan: effectivePlan,
    expiresAt: tenant.planExpiresAt,
    isActive: effectivePlan !== "free",
  };
});
