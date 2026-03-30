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

  // Send welcome email — non-blocking
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const isEnterprise = tier === "enterprise";
    const subject = isEnterprise
      ? "Welcome to OnboardFlow — Get started in 3 lines"
      : "Welcome to OnboardFlow — Send your first campaign";

    const body = isEnterprise
      ? `Welcome to OnboardFlow Enterprise!\n\nYou can start tracking your users with 3 lines of code:\n\n1. Install the SDK: npm install @onboardflow/sdk\n2. Add your API key to your environment variables\n3. Call identify() when a user signs up\n\nYour API key is available in your dashboard.\n\nIf you need help, reply to this email.`
      : `Welcome to OnboardFlow!\n\nHere's how to send your first campaign in 3 steps:\n\n1. Create an email list\n2. Add your contacts\n3. Write and send your campaign\n\nHead to your dashboard to get started.\n\nIf you need help, reply to this email.`;

    await resend.emails.send({
      from: "OnboardFlow <onboarding@resend.dev>",
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
    redirectTo:
      tier === "enterprise"
        ? "/dashboard/enterprise"
        : "/dashboard/individual",
  };
}