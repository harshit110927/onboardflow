import { db } from "@/db";
import { tenants, endUsers, individualCampaigns, individualLists, individualContacts, dripSteps, unsubscribedContacts } from "@/db/schema";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { subHours } from "date-fns";
import { and, eq, isNotNull } from "drizzle-orm";
import { checkEmailRateLimit, incrementEmailCount } from "@/lib/rate-limit/enterprise";
import { decryptPassword, createGmailTransporter } from "@/lib/email/smtp";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import { deductCredits } from "@/lib/credits/deduct";
import { buildEmailHtml } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);

const hasReceived = (user: { automationsReceived?: string[] | null }, tag: string) => {
  return (user.automationsReceived || []).includes(tag);
};

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

      const { plan } = await getTenantPlan(tenant.id);

      let automationSteps: {
        eventTrigger: string;
        emailSubject: string;
        emailBody: string;
        delayHours: number;
      }[];

      if (plan === "premium") {
        const dbSteps = await db
          .select()
          .from(dripSteps)
          .where(eq(dripSteps.tenantId, tenant.id))
          .orderBy(dripSteps.position);

        if (dbSteps.length > 0) {
          automationSteps = dbSteps.map((s) => ({
            eventTrigger: s.eventTrigger,
            emailSubject: s.emailSubject,
            emailBody: s.emailBody,
            delayHours: s.delayHours,
          }));
        } else {
          automationSteps = [
            { eventTrigger: tenant.activationStep || "connect_repo", emailSubject: tenant.emailSubject || "Complete your setup", emailBody: tenant.emailBody || "Hey, you need to connect your repo!", delayHours: 1 },
            { eventTrigger: tenant.step2 || "invited_teammate", emailSubject: tenant.emailSubject2 || "Keep going", emailBody: tenant.emailBody2 || "Invite your team now.", delayHours: 24 },
            { eventTrigger: tenant.step3 || "upgraded_to_pro", emailSubject: tenant.emailSubject3 || "Almost there", emailBody: tenant.emailBody3 || "Upgrade to Pro.", delayHours: 24 },
          ];
        }
      } else {
        automationSteps = [
          { eventTrigger: tenant.activationStep || "connect_repo", emailSubject: tenant.emailSubject || "Complete your setup", emailBody: tenant.emailBody || "Hey, you need to connect your repo!", delayHours: 1 },
          { eventTrigger: tenant.step2 || "invited_teammate", emailSubject: tenant.emailSubject2 || "Keep going", emailBody: tenant.emailBody2 || "Invite your team now.", delayHours: 24 },
          { eventTrigger: tenant.step3 || "upgraded_to_pro", emailSubject: tenant.emailSubject3 || "Almost there", emailBody: tenant.emailBody3 || "Upgrade to Pro.", delayHours: 24 },
        ];
      }

      for (const user of users) {
        if (!user.email) continue;

        // Check unsubscribe
        const unsubCheck = await db
          .select({ email: unsubscribedContacts.email })
          .from(unsubscribedContacts)
          .where(eq(unsubscribedContacts.email, user.email.toLowerCase()))
          .limit(1);
        if (unsubCheck.length > 0) continue;

        const stepsCompleted = (user.completedSteps as string[]) || [];
        let emailToSend: { subject: string; body: string; tag: string } | null = null;

        for (const [idx, step] of automationSteps.entries()) {
          const tag = `nudge_step${idx + 1}`;
          const triggerTime = subHours(new Date(), step.delayHours);

          const prevStepsComplete = automationSteps
            .slice(0, idx)
            .every((s) => stepsCompleted.includes(s.eventTrigger));

          if (
            prevStepsComplete &&
            user.createdAt &&
            user.createdAt < triggerTime &&
            !stepsCompleted.includes(step.eventTrigger) &&
            !hasReceived(user, tag)
          ) {
            emailToSend = {
              subject: step.emailSubject,
              body: step.emailBody,
              tag,
            };
            break;
          }
        }

        if (emailToSend) {
          const limit = await checkEmailRateLimit(tenant.id);

          if (!limit.allowed) {
            if (limit.isOverage) {
              const deduction = await deductCredits(tenant.id, 3, "usage_email", "Enterprise automated email (credit overage)");
              if (!deduction.success) {
                console.warn(`🚫 No credits for tenant ${tenant.email}: ${deduction.error}`);
                emailsBlocked++;
                break;
              }
            } else {
              console.warn(`🚫 Rate limit hit for tenant ${tenant.email}: ${limit.reason}`);
              emailsBlocked++;
              break;
            }
          }

          try {
            console.log(`🚀 Sending [${emailToSend.tag}] to ${user.email}`);

            const emailBody = emailToSend.body.replace("{{name}}", user.email.split("@")[0]);
            await resend.emails.send({
              from: "OnboardFlow <onboarding@resend.dev>",
              to: [user.email],
              subject: emailToSend.subject,
              html: buildEmailHtml({ body: emailBody }),
            });

            await incrementEmailCount(tenant.id);

            const newTags = [...(user.automationsReceived || []), emailToSend.tag];

            await db
              .update(endUsers)
              .set({ automationsReceived: newTags, lastEmailedAt: new Date() })
              .where(eq(endUsers.id, user.id));

            emailsSent++;

            deliverWebhookEvent(tenant.id, "user.stuck", {
              userEmail: user.email,
              tag: emailToSend.tag,
            }).catch((err) => console.error("Webhook delivery error:", err));

          } catch (err) {
            console.error(`Failed to send to ${user.email}`, err);
          }
        }
      }
    }

    console.log(`✅ Done — ${emailsSent} sent, ${emailsBlocked} blocked by rate limit`);

    // ── Individual sequence processing ──────────────────────────────
    try {
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

        const sendAfter = new Date(prev.sentAt);
        sendAfter.setDate(sendAfter.getDate() + step.sendDelayDays);
        if (new Date() < sendAfter) continue;

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
              const body = step.body.replace(/\{contact_name\}/g, contact.name);
              await transporter.sendMail({
                from: seqTenant.smtpEmail!,
                to: contact.email,
                subject: step.subject,
                html: buildEmailHtml({ body }),
              });
            }
          } else {
            for (const contact of contacts) {
              const body = step.body.replace(/\{contact_name\}/g, contact.name);
              await resend.emails.send({
                from: "OnboardFlow <onboarding@resend.dev>",
                to: contact.email,
                subject: step.subject,
                html: buildEmailHtml({ body }),
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