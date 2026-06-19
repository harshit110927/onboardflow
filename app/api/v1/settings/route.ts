import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { encryptPassword, testSmtpConnection } from "@/lib/email/smtp";
import { Resend } from "resend";
import { dogfoodTrack } from "@/lib/tracking/dogfood";

export async function GET(req: Request) {
  try {
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
      emailProvider: tenant.emailProvider || "resend",
      smtpHost: tenant.smtpHost || null,
      smtpPort: tenant.smtpPort || 465,
      smtpEmail: tenant.smtpEmail || null,
      whatsappTemplate: tenant.whatsappTemplate ?? "Hi {name}, ",
    });
  } catch (error) {
    console.error("Settings GET Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
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
      whatsappTemplate,
      emailProvider,
      smtpHost,
      smtpPort,
      smtpEmail,
      smtpPassword,
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
      emailProvider,
      ...(smtpHost && { smtpHost: String(smtpHost) }),
      ...(smtpPort && { smtpPort: Number(smtpPort) }),
      ...(smtpEmail && { smtpEmail: String(smtpEmail) }),
      ...(whatsappTemplate !== undefined && { whatsappTemplate: String(whatsappTemplate) }),
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

    if (emailProvider === "smtp" && smtpHost && smtpPort && smtpEmail && smtpPassword) {
      if (smtpPassword !== "***") {
        try {
          await testSmtpConnection(smtpHost, Number(smtpPort), smtpEmail, smtpPassword);
          updates.smtpPassword = encryptPassword(smtpPassword);
          updates.smtpVerified = true;
        } catch (err) {
          console.error("SMTP Validation Error:", err);
          return NextResponse.json(
            { error: "Invalid SMTP configuration. Could not connect." },
            { status: 400 }
          );
        }
      }
    } else if (emailProvider === "smtp") {
      // It might be missing fields
      if (!updates.smtpPassword && smtpPassword !== "***") {
        // If password is not provided and not existing, fail. But maybe we don't need to enforce here if they just changed something else.
      }
    }

    await db.update(tenants)
      .set(updates)
      .where(eq(tenants.email, user.email!));

    // Dogfood track
    dogfoodTrack(user.id, "configured_automation").catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
