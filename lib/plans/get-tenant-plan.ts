// NEW FILE — phase 1 premium foundation
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { PlanTier } from "./limits";

export type TenantPlanInfo = {
  plan: PlanTier;
  expiresAt: Date | null;
  credits: number;
  isActive: boolean;
};

export async function getTenantPlan(tenantId: string): Promise<TenantPlanInfo> {
  const rows = await db
    .select({
      plan: tenants.plan,
      planExpiresAt: tenants.planExpiresAt,
      credits: tenants.credits,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const tenant = rows[0];

  if (!tenant) {
    return { plan: "free", expiresAt: null, credits: 0, isActive: false };
  }

  // If plan is premium but has expired, treat as free
  const now = new Date();
  const isPremiumActive =
    tenant.plan === "premium" &&
    (tenant.planExpiresAt === null || tenant.planExpiresAt > now);

  const effectivePlan: PlanTier = isPremiumActive ? "premium" : "free";

  return {
    plan: effectivePlan,
    expiresAt: tenant.planExpiresAt,
    credits: tenant.credits,
    isActive: isPremiumActive,
  };
}

export async function getTenantPlanByEmail(
  email: string
): Promise<TenantPlanInfo & { tenantId: string | null }> {
  const rows = await db
    .select({
      id: tenants.id,
      plan: tenants.plan,
      planExpiresAt: tenants.planExpiresAt,
      credits: tenants.credits,
    })
    .from(tenants)
    .where(eq(tenants.email, email))
    .limit(1);

  const tenant = rows[0];

  if (!tenant) {
    return {
      plan: "free",
      expiresAt: null,
      credits: 0,
      isActive: false,
      tenantId: null,
    };
  }

  const now = new Date();
  const isPremiumActive =
    tenant.plan === "premium" &&
    (tenant.planExpiresAt === null || tenant.planExpiresAt > now);

  const effectivePlan: PlanTier = isPremiumActive ? "premium" : "free";

  return {
    plan: effectivePlan,
    expiresAt: tenant.planExpiresAt,
    credits: tenant.credits,
    isActive: isPremiumActive,
    tenantId: tenant.id,
  };
}