// NEW FILE — created for tier selection feature
"use server";

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/db";
import { tenants } from "@/db/schema";
import type { Tier } from "@/lib/types/tier";
import { createClient } from "@/utils/supabase/server";
import { buildEmailHtml } from "@/lib/email/templates";

export async function setTier(tier: Tier): Promise<{
  success: true;
  tier: Tier;
  redirectTo: string;
}> {
  if (tier !== "enterprise") {
    throw new Error("New accounts are currently available for Enterprise only");
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
  const enterpriseApiKey = `obf_live_${crypto.randomBytes(16).toString("hex")}`;

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

  // Send welcome email — non-blocking
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = "Welcome to Dripmetric — Get started in 3 lines";
    const body = `Welcome to Dripmetric Enterprise!\n\nYou can start tracking your users with 3 lines of code:\n\n1. Install the SDK: npm install dripmetric\n2. Add your API key to your environment variables\n3. Call identify() when a user signs up\n\nYour API key is available in your dashboard.\n\nIf you need help, reply to this email.`;

    await resend.emails.send({
      from: "Dripmetric <hello@dripmetric.com>",
      to: user.email,
      subject,
      html: buildEmailHtml({ body }),
    });
  } catch (err) {
    console.error("Welcome email failed:", err);
  }

  return {
    success: true,
    tier,
    redirectTo: "/dashboard/enterprise",
  };
}
