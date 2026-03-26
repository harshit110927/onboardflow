import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
//import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { subHours } from "date-fns";
import {
  checkEmailRateLimit,
  incrementEmailCount,
} from "@/lib/rate-limit/enterprise";
import { individualCampaigns, individualLists, individualContacts } from "@/db/schema";
import { and, eq, isNotNull, lt, inArray } from "drizzle-orm";
import { decryptPassword, createGmailTransporter } from "@/lib/email/smtp";

const resend = new Resend(process.env.RESEND_API_KEY);

const hasReceived = (user: { automationsReceived?: string[] | null }, tag: string) => {
  return (user.automationsReceived || []).includes(tag);
};

export async function GET(req: Request) {
  try {
    console.log("🤖 CRON JOB STARTED");

    const activeTenants = await db.query.tenants.findMany({
      where: eq(tenants.automationEnabled, true),
    });

    console.log(`Found ${activeTenants.length} active tenants`);

    let emailsSent = 0;
    let emailsBlocked = 0;

    for (const tenant of activeTenants) {
      const users = await db.query.endUsers.findMany({
        where: eq(endUsers.tenantId, tenant.id),
      });

      const step1Event = tenant.activationStep || "connect_repo";
      const step2Event = tenant.step2 || "invited_teammate";
      const step3Event = tenant.step3 || "upgraded_to_pro";

      for (const user of users) {
        if (!user.email) continue;

        const stepsCompleted = (user.completedSteps as string[]) || [];
        const oneHourAgo = subHours(new Date(), 1);
        const twentyFourHoursAgo = subHours(new Date(), 24);

        let emailToSend: {
          subject: string;
          body: string;
          tag: string;
        } | null = null;

        if (
          user.createdAt &&
          user.createdAt < oneHourAgo &&
          !stepsCompleted.includes(step1Event) &&
          !hasReceived(user, "nudge_step1")
        ) {
          emailToSend = {
            subject: tenant.emailSubject || "Complete your setup",
            body: tenant.emailBody || "Hey, you need to connect your repo!",
            tag: "nudge_step1",
          };
        } else if (
          stepsCompleted.includes(step1Event) &&
          !stepsCompleted.includes(step2Event) &&
          user.createdAt &&
          user.createdAt < twentyFourHoursAgo &&
          !hasReceived(user, "nudge_step2")
        ) {
          emailToSend = {
            subject: tenant.emailSubject2 || "Keep going",
            body: tenant.emailBody2 || "Invite your team now.",
            tag: "nudge_step2",
          };
        } else if (
          stepsCompleted.includes(step2Event) &&
          !stepsCompleted.includes(step3Event) &&
          user.createdAt &&
          user.createdAt < twentyFourHoursAgo &&
          !hasReceived(user, "nudge_step3")
        ) {
          emailToSend = {
            subject: tenant.emailSubject3 || "Almost there",
            body: tenant.emailBody3 || "Upgrade to Pro.",
            tag: "nudge_step3",
          };
        }

        if (emailToSend) {
          // Check rate limit before sending
          const limit = await checkEmailRateLimit(tenant.id);

          if (!limit.allowed) {
            console.warn(
              `🚫 Rate limit hit for tenant ${tenant.email}: ${limit.reason}`
            );
            emailsBlocked++;
            // Skip remaining users for this tenant — limit is per tenant
            break;
          }

          try {
            console.log(`🚀 Sending [${emailToSend.tag}] to ${user.email}`);

            await resend.emails.send({
              from: "Acme <onboarding@resend.dev>",
              to: [user.email],
              subject: emailToSend.subject,
              text: emailToSend.body.replace(
                "{{name}}",
                user.email.split("@")[0]
              ),
            });

            // Increment usage counter
            await incrementEmailCount(tenant.id);

            const newTags = [
              ...(user.automationsReceived || []),
              emailToSend.tag,
            ];

            await db
              .update(endUsers)
              .set({
                automationsReceived: newTags,
                lastEmailedAt: new Date(),
              })
              .where(eq(endUsers.id, user.id));

            emailsSent++;
          } catch (err) {
            console.error(`Failed to send to ${user.email}`, err);
          }
        }
      }
    }

    console.log(
      `✅ Done — ${emailsSent} sent, ${emailsBlocked} blocked by rate limit`
    );
    // ── Individual sequence processing ─────────────────────────────────
try {
  // Find all unsent sequence steps (position > 1, status draft, has sequenceId)
  const pendingSteps = await db
    .select()
    .from(individualCampaigns)
    .where(
      and(
        eq(individualCampaigns.status, "draft"),
        isNotNull(individualCampaigns.sequenceId)
      )
    );

  for (const step of pendingSteps) {
    if (!step.sequenceId || step.sequencePosition <= 1) continue;

    // Find the previous step
    const prevSteps = await db
      .select({ sentAt: individualCampaigns.sentAt, status: individualCampaigns.status })
      .from(individualCampaigns)
      .where(
        and(
          eq(individualCampaigns.sequenceId, step.sequenceId),
          eq(individualCampaigns.sequencePosition, step.sequencePosition - 1)
        )
      )
      .limit(1);

    const prev = prevSteps[0];
    if (!prev || prev.status !== "sent" || !prev.sentAt) continue;

    // Check if delay has passed
    const sendAfter = new Date(prev.sentAt);
    sendAfter.setDate(sendAfter.getDate() + step.sendDelayDays);
    if (new Date() < sendAfter) continue;

    // Get list and tenant
    const listRows = await db
      .select({ id: individualLists.id, userId: individualLists.userId })
      .from(individualLists)
      .where(eq(individualLists.id, step.listId))
      .limit(1);

    const list = listRows[0];
    if (!list) continue;

    const tenantRows = await db
      .select({ id: tenants.id, smtpEmail: tenants.smtpEmail, smtpPassword: tenants.smtpPassword, smtpVerified: tenants.smtpVerified })
      .from(tenants)
      .where(eq(tenants.id, list.userId))
      .limit(1);

    const seqTenant = tenantRows[0];
    if (!seqTenant) continue;

    const contacts = await db
      .select({ name: individualContacts.name, email: individualContacts.email })
      .from(individualContacts)
      .where(eq(individualContacts.listId, step.listId));

    if (contacts.length === 0) continue;

    const useGmail = seqTenant.smtpVerified && seqTenant.smtpEmail && seqTenant.smtpPassword;

    try {
      if (useGmail) {
        const decrypted = decryptPassword(seqTenant.smtpPassword!);
        const transporter = createGmailTransporter(seqTenant.smtpEmail!, decrypted);
        for (const contact of contacts) {
          await transporter.sendMail({
            from: seqTenant.smtpEmail!,
            to: contact.email,
            subject: step.subject,
            text: step.body.replace(/\{contact_name\}/g, contact.name),
          });
        }
      } else {
        for (const contact of contacts) {
          await resend.emails.send({
            from: "OnboardFlow <onboarding@resend.dev>",
            to: contact.email,
            subject: step.subject,
            text: step.body.replace(/\{contact_name\}/g, contact.name),
          });
        }
      }

      await db
        .update(individualCampaigns)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(individualCampaigns.id, step.id));

      emailsSent++;
    } catch (err) {
      console.error(`Sequence step ${step.id} failed:`, err);
    }
  }
} catch (err) {
  console.error("Sequence processing error:", err);
}
    return NextResponse.json({ success: true, emailsSent, emailsBlocked });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}