import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema";

export const getTenant = cache(async (email: string) => {
  const tenantRows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.email, email))
    .limit(1);

  return tenantRows[0] ?? null;
});
