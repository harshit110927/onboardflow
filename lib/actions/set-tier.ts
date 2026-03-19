// NEW FILE — created for tier selection feature
"use server";

import crypto from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema";
import type { Tier } from "@/lib/types/tier";
import { createClient } from "@/utils/supabase/server";

export async function setTier(tier: Tier): Promise<{
  success: true;
  tier: Tier;
  redirectTo: string;
}> {
  if (tier !== "enterprise" && tier !== "individual") {
    throw new Error("Invalid tier");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    throw new Error("Unauthorized");
  }

  const existingTenants = await db
    .select()
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const existingTenant = existingTenants[0];
  const enterpriseApiKey =
    tier === "enterprise"
      ? `obf_live_${crypto.randomBytes(16).toString("hex")}`
      : undefined;

  if (!existingTenant) {
    await db
      .insert(tenants)
      .values({
        email: user.email,
        name: "Founder",
        tier,
        ...(enterpriseApiKey ? { apiKey: enterpriseApiKey } : {}),
      })
      .returning();
  } else {
    if (existingTenant.tier !== null) {
      throw new Error("Tier already set");
    }

    await db
      .update(tenants)
      .set({
        tier,
        ...(enterpriseApiKey ? { apiKey: enterpriseApiKey } : {}),
      })
      .where(eq(tenants.email, user.email));
  }

  return {
    success: true,
    tier,
    redirectTo:
      tier === "enterprise"
        ? "/dashboard/enterprise"
        : "/dashboard/individual",
  };
}
