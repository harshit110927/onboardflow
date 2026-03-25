// MODIFIED — phase 1 premium foundation
import { db } from "@/db";
import { individualLists, individualContacts, individualCampaigns } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { INDIVIDUAL_LIMITS } from "@/lib/plans/limits";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";

type RateLimitResult = { allowed: true } | { allowed: false; reason: string };

export async function validateListCreation(tenantId: string): Promise<RateLimitResult> {
  try {
    const { plan } = await getTenantPlan(tenantId);
    const limits = INDIVIDUAL_LIMITS[plan];

    const result = await db
      .select({ value: count() })
      .from(individualLists)
      .where(eq(individualLists.userId, tenantId));

    const total = result[0]?.value ?? 0;

    if (total >= limits.maxLists) {
      if (plan === "free") {
        return {
          allowed: false,
          reason: `You've reached the ${limits.maxLists}-list limit on the free plan. Upgrade to Premium for up to 25 lists.`,
        };
      }
      return {
        allowed: false,
        reason: `You've reached the ${limits.maxLists}-list limit on your plan. Additional lists can be unlocked with credits.`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Server error. Please try again." };
  }
}

export async function validateContactAddition(
  listId: number,
  tenantId: string
): Promise<RateLimitResult> {
  try {
    const { plan } = await getTenantPlan(tenantId);
    const limits = INDIVIDUAL_LIMITS[plan];

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
      if (plan === "free") {
        return {
          allowed: false,
          reason: `This list is at the ${limits.maxContactsPerList}-contact limit on the free plan. Upgrade to Premium for up to 500 contacts per list.`,
        };
      }
      return {
        allowed: false,
        reason: `This list is at the ${limits.maxContactsPerList}-contact limit. Additional contacts can be unlocked with credits.`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Server error. Please try again." };
  }
}

export async function validateCampaignCreation(
  listId: number,
  tenantId: string
): Promise<RateLimitResult> {
  try {
    const { plan } = await getTenantPlan(tenantId);
    const limits = INDIVIDUAL_LIMITS[plan];

    const ownership = await db
      .select({ id: individualLists.id })
      .from(individualLists)
      .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenantId)))
      .limit(1);

    if (!ownership.length) return { allowed: false, reason: "List not found." };

    const result = await db
      .select({ value: count() })
      .from(individualCampaigns)
      .where(eq(individualCampaigns.listId, listId));

    const total = result[0]?.value ?? 0;

    if (total >= limits.maxCampaignsPerList) {
      if (plan === "free") {
        return {
          allowed: false,
          reason: `Each list supports ${limits.maxCampaignsPerList} campaign on the free plan. Upgrade to Premium for up to 10 campaigns per list.`,
        };
      }
      return {
        allowed: false,
        reason: `This list has reached its campaign limit. Additional campaign slots can be unlocked with credits.`,
      };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Server error. Please try again." };
  }
}