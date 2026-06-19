"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { encryptPassword, testSmtpConnection } from "@/lib/email/smtp";

async function getAuthenticatedTenant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const rows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = rows[0];
  if (!tenant || tenant.tier !== "individual") return null;
  return tenant;
}

export type ActionResult = { success: true } | { success: false; error: string };

export async function connectGmail(formData: FormData): Promise<ActionResult> {
  const tenant = await getAuthenticatedTenant();
  if (!tenant) return { success: false, error: "Unauthorized." };

  const email = (formData.get("smtpEmail") as string)?.trim().toLowerCase();
  const password = (formData.get("smtpPassword") as string)?.trim();

  if (!email || !password) return { success: false, error: "Email and App Password are required." };
  if (!email.endsWith("@gmail.com")) return { success: false, error: "Only Gmail addresses are supported." };
  if (password.length < 16) return { success: false, error: "App Passwords are 16 characters. Check you copied it correctly." };

  try {
    await testSmtpConnection("smtp.gmail.com", 465, email, password);
  } catch {
    return {
      success: false,
      error: "Could not connect to Gmail. Make sure 2-Step Verification is on and you used an App Password, not your real password.",
    };
  }

  const encrypted = encryptPassword(password);

  await db
    .update(tenants)
    .set({
      smtpEmail: email,
      smtpPassword: encrypted,
      smtpVerified: true,
      emailProvider: "smtp",
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
    })
    .where(eq(tenants.id, tenant.id));

  revalidatePath("/dashboard/individual/settings");
  return { success: true };
}

export async function disconnectGmail(): Promise<ActionResult> {
  const tenant = await getAuthenticatedTenant();
  if (!tenant) return { success: false, error: "Unauthorized." };

  await db
    .update(tenants)
    .set({
      smtpEmail: null,
      smtpPassword: null,
      smtpVerified: false,
      emailProvider: "resend",
      smtpHost: null,
      smtpPort: null,
    })
    .where(eq(tenants.id, tenant.id));

  revalidatePath("/dashboard/individual/settings");
  return { success: true };
}

export async function sendTestEmail(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { success: false, error: "Unauthorized." };

  const rows = await db
    .select({
      id: tenants.id,
      tier: tenants.tier,
      smtpEmail: tenants.smtpEmail,
      smtpPassword: tenants.smtpPassword,
      smtpVerified: tenants.smtpVerified,
      smtpHost: tenants.smtpHost,
      smtpPort: tenants.smtpPort,
      emailProvider: tenants.emailProvider,
    })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = rows[0];
  if (!tenant || tenant.tier !== "individual") return { success: false, error: "Unauthorized." };
  if (!tenant.smtpVerified || !tenant.smtpEmail || !tenant.smtpPassword || !tenant.smtpHost || !tenant.smtpPort) {
    return { success: false, error: "No SMTP connected." };
  }

  const { decryptPassword, createSmtpTransporter } = await import("@/lib/email/smtp");
  const decrypted = decryptPassword(tenant.smtpPassword);
  const transporter = createSmtpTransporter(tenant.smtpHost, tenant.smtpPort, tenant.smtpEmail, decrypted);

  await transporter.sendMail({
    from: tenant.smtpEmail,
    to: user.email,
    subject: "Dripmetric — Test Email",
    text: "Your Gmail is connected and working correctly with Dripmetric.",
  });

  return { success: true };
}