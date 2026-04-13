import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { tenants, individualLists, individualCampaigns, individualContacts, unsubscribedContacts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS } from "@/lib/plans/limits";
import { decryptPassword, createGmailTransporter } from "@/lib/email/smtp";
import { buildEmailHtml, createUnsubscribeToken } from "@/lib/email/templates";
import { Resend } from "resend";
import crypto from "crypto";
import { getMonthlyEmailUsage, incrementEmailUsage } from "@/lib/rate-limit/email-usage";

type StepInput = {
  subject: string;
  body: string;
  delayDays: number;
};

export async function POST(req: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 503 });
    }
    const resend = new Resend(resendApiKey);

    const supabase = await createClient();
    console.time("[AUTH] getUser");
    const { data: { user } } = await supabase.auth.getUser();
    console.timeEnd("[AUTH] getUser");
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantRows = await db
      .select({ id: tenants.id, tier: tenants.tier, smtpEmail: tenants.smtpEmail, smtpPassword: tenants.smtpPassword, smtpVerified: tenants.smtpVerified })
      .from(tenants)
      .where(eq(tenants.email, user.email))
      .limit(1);

    const tenant = tenantRows[0];
    if (!tenant || tenant.tier !== "individual") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await getTenantPlan(tenant.id);
    if (plan !== "premium") {
      return NextResponse.json({ error: "Sequences require Premium." }, { status: 403 });
    }

    const { listId, steps } = await req.json() as { listId: number; steps: StepInput[] };

    if (!listId || !Array.isArray(steps) || steps.length < 1 || steps.length > 5) {
      return NextResponse.json({ error: "Invalid sequence data." }, { status: 400 });
    }

    const listRows = await db
      .select({ id: individualLists.id })
      .from(individualLists)
      .where(eq(individualLists.id, listId))
      .limit(1);

    if (!listRows[0]) return NextResponse.json({ error: "List not found." }, { status: 404 });

    const sequenceId = crypto.randomUUID();

    const insertedIds: number[] = [];
    for (const [i, step] of steps.entries()) {
      const rows = await db
        .insert(individualCampaigns)
        .values({
          listId,
          subject: step.subject.trim(),
          body: step.body.trim(),
          status: "draft",
          sequenceId,
          sequencePosition: i + 1,
          sendDelayDays: i === 0 ? 0 : step.delayDays,
        })
        .returning({ id: individualCampaigns.id });

      insertedIds.push(rows[0].id);
    }

    const firstId = insertedIds[0];
    const contacts = await db
      .select({ name: individualContacts.name, email: individualContacts.email })
      .from(individualContacts)
      .where(eq(individualContacts.listId, listId));

    // Filter unsubscribed
    const unsubscribed = await db
      .select({ email: unsubscribedContacts.email })
      .from(unsubscribedContacts);
    const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email.toLowerCase()));
    const activeContacts = contacts.filter(
      (c) => !unsubscribedEmails.has(c.email.toLowerCase())
    );

    if (activeContacts.length > 0) {
      // FIX — enforce monthly email cap before first sequence send
      const monthlyLimit = INDIVIDUAL_LIMITS[plan].maxEmailsPerMonth;
      const monthlyUsed = await getMonthlyEmailUsage(tenant.id);
      if (monthlyUsed + activeContacts.length > monthlyLimit) {
        return NextResponse.json({ error: "Monthly email limit reached." }, { status: 400 });
      }

      const firstStep = steps[0];
      const useGmail = tenant.smtpVerified && tenant.smtpEmail && tenant.smtpPassword;

      if (useGmail) {
        const decrypted = decryptPassword(tenant.smtpPassword!);
        const transporter = createGmailTransporter(tenant.smtpEmail!, decrypted);
        for (const contact of activeContacts) {
          const body = firstStep.body.replace(/\{contact_name\}/g, contact.name);
          await transporter.sendMail({
            from: tenant.smtpEmail!,
            to: contact.email,
            subject: firstStep.subject,
            html: buildEmailHtml({
              body,
              contactEmail: contact.email,
              unsubscribeToken: createUnsubscribeToken(contact.email),
              senderEmail: tenant.smtpEmail!,
            }),
          });
        }
      } else {
        for (const contact of activeContacts) {
          const body = firstStep.body.replace(/\{contact_name\}/g, contact.name);
          await resend.emails.send({
            from: "OnboardFlow <onboarding@resend.dev>",
            to: contact.email,
            subject: firstStep.subject,
            html: buildEmailHtml({
              body,
              contactEmail: contact.email,
              unsubscribeToken: createUnsubscribeToken(contact.email),
              senderEmail: "onboarding@resend.dev",
            }),
          });
        }
      }

      await db
        .update(individualCampaigns)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(individualCampaigns.id, firstId));

      await incrementEmailUsage(tenant.id, activeContacts.length);
    }

    return NextResponse.json({ success: true, sequenceId });
  } catch (error) {
    console.error("Sequence creation error:", error);
    return NextResponse.json({ error: "Failed to create sequence." }, { status: 500 });
  }
}
