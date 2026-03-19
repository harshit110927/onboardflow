// NEW FILE — created for tier selection feature
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema";
import type { Tier } from "@/lib/types/tier";
import { createClient } from "@/utils/supabase/server";

export async function getUserTier(): Promise<Tier | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return null;
    }

    const rows = await db
      .select({ tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.email, user.email))
      .limit(1);

    const tier = rows[0]?.tier;

    if (tier === "enterprise" || tier === "individual") {
      return tier;
    }

    return null;
  } catch {
    return null;
  }
}
