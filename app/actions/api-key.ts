"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logAuditEvent } from "@/lib/compliance/audit";

export async function generateApiKey() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Unauthorized");

  const tenantRows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "enterprise") throw new Error("Unauthorized");

  const key = "obf_live_" + crypto.randomBytes(24).toString("hex");

  await db
    .update(tenants)
    .set({ apiKey: key })
    .where(eq(tenants.id, tenant.id));

  await logAuditEvent({ tenantId: tenant.id, action: "api_key.created", actorEmail: user.email });

  revalidatePath("/dashboard/enterprise");
  return key;
}
export async function deleteApiKey() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Unauthorized");

  const tenantRows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "enterprise") throw new Error("Unauthorized");

  await db.update(tenants).set({ apiKey: null }).where(eq(tenants.id, tenant.id));
  await logAuditEvent({ tenantId: tenant.id, action: "api_key.deleted", actorEmail: user.email });
  revalidatePath("/dashboard/enterprise");
}
