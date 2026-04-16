import { db } from "@/db";
import { individualLists, individualContacts } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";

type RateLimitResult = { allowed: true } | { allowed: false; reason: string };

export async function validateListCreation(tenantId: string): Promise<RateLimitResult> {
  try {
    const { plan } = await getTenantPlan(tenantId);
    const limits = INDIVIDUAL_LIMITS[plan as PlanTier];

    const result = await db
      .select({ value: count() })
      .from(individualLists)
      .where(eq(individualLists.userId, tenantId));

    const total = result[0]?.value ?? 0;

    if (total >= limits.maxLists) {
      return {
        allowed: false,
        reason: `You've reached the ${limits.maxLists}-list limit on your current plan.`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Server error. Please try again." };
  }
}

export async function validateContactAddition(
  listId: number,
  tenantId: string,
): Promise<RateLimitResult> {
  try {
    const { plan } = await getTenantPlan(tenantId);
    const limits = INDIVIDUAL_LIMITS[plan as PlanTier];

    const ownership = await db
      .select({ id: individualLists.id })
      .from(individualLists)
      .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenantId)))
      .limit(1);

    if (!ownership.length) return { allowed: false, reason: "List not found." };

    const result = await db
      .select({ value: count() })
      .from(individualContacts)
      .where(eq(individualContacts.listId, listId));

    const total = result[0]?.value ?? 0;

    if (total >= limits.maxContactsPerList) {
      return {
        allowed: false,
        reason: `This list is at the ${limits.maxContactsPerList}-contact limit on your current plan.`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Server error. Please try again." };
  }
}

export async function validateCampaignCreation(
  listId: number,
  tenantId: string,
): Promise<RateLimitResult> {
  try {
    const ownership = await db
      .select({ id: individualLists.id })
      .from(individualLists)
      .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenantId)))
      .limit(1);

    if (!ownership.length) return { allowed: false, reason: "List not found." };
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Server error. Please try again." };
  }
}
