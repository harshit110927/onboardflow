import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { encryptPassword } from "@/lib/email/smtp";
import { Resend } from "resend";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.email, user.email!),
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...tenant,
    resendApiKey: tenant.resendApiKey ? "re_live_***" : null,
    resendFromEmail: tenant.resendFromEmail || null,
    smtpPassword: tenant.smtpPassword ? "***" : null,
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      automationEnabled,
      activationStep, emailSubject, emailBody,
      step2, emailSubject2, emailBody2,
      step3, emailSubject3, emailBody3,
      resendApiKey,
      resendFromEmail,
    } = body;

    const updates: Record<string, unknown> = {
      automationEnabled,
      activationStep,
      emailSubject,
      emailBody,
      step2,
      emailSubject2,
      emailBody2,
      step3,
      emailSubject3,
      emailBody3,
    };

    // Handle Resend API key
    if (resendApiKey && resendApiKey !== "re_live_***") {
      if (!resendApiKey.startsWith("re_")) {
        return NextResponse.json(
          { error: "Invalid Resend API key format. Keys start with re_" },
          { status: 400 }
        );
      }

      // Validate key is live by calling apiKeys.list()
      try {
        const testResend = new Resend(resendApiKey);
        await testResend.apiKeys.list();
      } catch {
        return NextResponse.json(
          { error: "Invalid Resend API key. Please check the key and try again." },
          { status: 400 }
        );
      }

      updates.resendApiKey = encryptPassword(resendApiKey);
    }

    // Handle clearing the Resend key
    if (resendApiKey === "") {
      updates.resendApiKey = null;
      updates.resendFromEmail = null;
    }

    if (resendFromEmail !== undefined) {
      updates.resendFromEmail = resendFromEmail || null;
    }

    await db.update(tenants)
      .set(updates)
      .where(eq(tenants.email, user.email!));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}