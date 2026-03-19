// NEW FILE — created for tier selection feature
import { and, count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  individualCampaigns,
  individualContacts,
  individualLists,
} from "@/db/schema";
import { TIER_LIMITS } from "@/lib/types/tier";

type RateLimitResult = { allowed: true } | { allowed: false; reason: string };

export async function validateListCreation(
  tenantId: string,
): Promise<RateLimitResult> {
  try {
    const result = await db
      .select({ value: count() })
      .from(individualLists)
      .where(eq(individualLists.userId, tenantId));

    const total = Number(result[0]?.value ?? 0);

    if (total >= TIER_LIMITS.individual.maxLists) {
      return {
        allowed: false,
        reason: "You've reached the 3-list limit on the free plan.",
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
    const ownership = await db
      .select({ id: individualLists.id })
      .from(individualLists)
      .where(
        and(eq(individualLists.id, listId), eq(individualLists.userId, tenantId)),
      )
      .limit(1);

    if (!ownership.length) {
      return { allowed: false, reason: "List not found." };
    }

    const result = await db
      .select({ value: count() })
      .from(individualContacts)
      .where(eq(individualContacts.listId, listId));

    const total = Number(result[0]?.value ?? 0);

    if (total >= TIER_LIMITS.individual.maxContactsPerList) {
      return {
        allowed: false,
        reason: "This list is at the 10-contact limit.",
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
      .where(
        and(eq(individualLists.id, listId), eq(individualLists.userId, tenantId)),
      )
      .limit(1);

    if (!ownership.length) {
      return { allowed: false, reason: "List not found." };
    }

    const result = await db
      .select({ value: count() })
      .from(individualCampaigns)
      .where(eq(individualCampaigns.listId, listId));

    const total = Number(result[0]?.value ?? 0);

    if (total >= TIER_LIMITS.individual.maxCampaignsPerList) {
      return {
        allowed: false,
        reason: "Each list supports 1 campaign on the free plan.",
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Server error. Please try again." };
  }
}
