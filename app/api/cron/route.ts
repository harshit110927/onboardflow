// MODIFIED — added per-tenant email sender resolution (Resend key > SMTP > shared fallback)
import { db } from "@/db";
import { tenants, endUsers, individualCampaigns, individualLists, individualContacts, dripSteps, unsubscribedContacts } from "@/db/schema";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { subHours } from "date-fns";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { checkEmailRateLimit, incrementEmailCount } from "@/lib/rate-limit/enterprise";
import { decryptPassword, createGmailTransporter } from "@/lib/email/smtp";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { ENTERPRISE_LIMITS, type EnterprisePlanTier } from "@/lib/plans/limits";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import { buildEmailHtml, wrapLinksWithTracking } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);

const hasReceived = (user: { automationsReceived?: string[] | null }, tag: string) => {
  return (user.automationsReceived || []).includes(tag);
};

function resolveEnterprisePlan(plan: string): EnterprisePlanTier {
  if (plan === "basic" || plan === "advanced" || plan === "free") return plan;
  return "free";
}

// Resolve which email sender to use for a tenant.
// Priority: tenant Resend key → tenant SMTP → shared fallback
type EmailSender = (args: { to: string; subject: string; html: string }) => Promise<void>;

function resolveEmailSender(tenant: {
  resendApiKey?: string | null;
  resendFromEmail?: string | null;
  smtpVerified?: boolean | null;
  smtpEmail?: string | null;
  smtpPassword?: string | null;
}): EmailSender {
  if (tenant.resendApiKey && tenant.resendFromEmail) {
    try {
      const tenantResend = new Resend(decryptPassword(tenant.resendApiKey));
      const fromEmail = tenant.resendFromEmail;
      return async ({ to, subject, html }) => {
        await tenantResend.emails.send({ from: fromEmail, to: [to], subject, html });
      };
    } catch (err) {
      console.error("Failed to initialize tenant Resend client, falling back:", err);
    }
  }

  if (tenant.smtpVerified && tenant.smtpEmail && tenant.smtpPassword) {
    try {
      const transporter = createGmailTransporter(
        tenant.smtpEmail,
        decryptPassword(tenant.smtpPassword)
      );
      return async ({ to, subject, html }) => {
        await transporter.sendMail({ from: tenant.smtpEmail!, to, subject, html });
      };
    } catch (err) {
      console.error("Failed to initialize SMTP transporter, falling back:", err);
    }
  }

  // Shared fallback — only works for Resend account owner's email
  return async ({ to, subject, html }) => {
    await resend.emails.send({
      from: "OnboardFlow <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });
  };
}

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
      const enterprisePlan = resolveEnterprisePlan(String(plan));
      const limits = ENTERPRISE_LIMITS[enterprisePlan];

      // Resolve this tenant's email sender once — reused for all their users
      const emailSender = resolveEmailSender(tenant);

      let automationSteps: {
        eventTrigger: string;
        emailSubject: string;
        emailBody: string;
        delayHours: number;
      }[];

      if (enterprisePlan === "advanced") {
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

      if (Number.isFinite(limits.maxDripSteps)) {
        automationSteps = automationSteps.slice(0, limits.maxDripSteps);
      }

      for (const user of users) {
        if (!user.email) continue;

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
            emailToSend = { subject: step.emailSubject, body: step.emailBody, tag };
            break;
          }
        }

        if (emailToSend) {
          const limit = await checkEmailRateLimit(tenant.id);
          if (!limit.allowed) {
            console.warn(`🚫 Rate limit hit for tenant ${tenant.email}: ${limit.reason}`);
            emailsBlocked++;
            continue;
          }

          try {
            console.log(`🚀 Sending [${emailToSend.tag}] to ${user.email}`);

            const emailBody = emailToSend.body.replace("{{name}}", user.email.split("@")[0]);

            await emailSender({
              to: user.email,
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
          .select({
            id: tenants.id,
            smtpEmail: tenants.smtpEmail,
            smtpPassword: tenants.smtpPassword,
            smtpVerified: tenants.smtpVerified,
          })
          .from(tenants)
          .where(eq(tenants.id, list.userId))
          .limit(1);

        const seqTenant = tenantRows[0];
        if (!seqTenant) continue;

        const contacts = await db
          .select({
            name: individualContacts.name,
            email: individualContacts.email,
            customFields: individualContacts.customFields,
          })
          .from(individualContacts)
          .where(eq(individualContacts.listId, step.listId));

        if (contacts.length === 0) continue;

        const useGmail = seqTenant.smtpVerified && seqTenant.smtpEmail && seqTenant.smtpPassword;

        try {
          if (useGmail) {
            const decrypted = decryptPassword(seqTenant.smtpPassword!);
            const transporter = createGmailTransporter(seqTenant.smtpEmail!, decrypted);
            for (const contact of contacts) {
              let body = step.body
                .replace(/\{name\}/g, contact.name)
                .replace(/\{email\}/g, contact.email)
                .replace(/\{contact_name\}/g, contact.name);
              const customFields = (contact.customFields as Record<string, string>) ?? {};
              for (const [key, value] of Object.entries(customFields)) {
                body = body.replace(new RegExp(`\\{${key}\\}`, "g"), value ?? "");
              }
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
              const trackingPixelUrl = baseUrl
                ? `${baseUrl}/api/track/pixel?campaignId=${step.id}&email=${encodeURIComponent(contact.email)}`
                : undefined;
              let html = buildEmailHtml({ body, trackingPixelUrl });
              if (baseUrl) {
                html = wrapLinksWithTracking(html, step.id, contact.email, baseUrl);
              }

              await transporter.sendMail({
                from: seqTenant.smtpEmail!,
                to: contact.email,
                subject: step.subject,
                html,
              });
            }
          } else {
            for (const contact of contacts) {
              let body = step.body
                .replace(/\{name\}/g, contact.name)
                .replace(/\{email\}/g, contact.email)
                .replace(/\{contact_name\}/g, contact.name);
              const customFields = (contact.customFields as Record<string, string>) ?? {};
              for (const [key, value] of Object.entries(customFields)) {
                body = body.replace(new RegExp(`\\{${key}\\}`, "g"), value ?? "");
              }
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
              const trackingPixelUrl = baseUrl
                ? `${baseUrl}/api/track/pixel?campaignId=${step.id}&email=${encodeURIComponent(contact.email)}`
                : undefined;
              let html = buildEmailHtml({ body, trackingPixelUrl });
              if (baseUrl) {
                html = wrapLinksWithTracking(html, step.id, contact.email, baseUrl);
              }

              await resend.emails.send({
                from: "OnboardFlow <onboarding@resend.dev>",
                to: contact.email,
                subject: step.subject,
                html,
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

    // ============ FOLLOW-UP REMINDER PROCESSING ============
    try {
      const now = new Date();

      const dueContacts = await db
        .select({
          contact: individualContacts,
          listUserId: individualLists.userId,
        })
        .from(individualContacts)
        .innerJoin(individualLists, eq(individualContacts.listId, individualLists.id))
        .where(
          and(
            isNotNull(individualContacts.followUpAt),
            eq(individualContacts.followUpSent, false),
            lte(individualContacts.followUpAt, now),
          ),
        );

      for (const { contact, listUserId } of dueContacts) {
        try {
          const ownerTenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, listUserId),
          });
          if (!ownerTenant?.email) continue;

          const sender = resolveEmailSender(ownerTenant);
          const noteSection = contact.followUpNote
            ? `\n\nYour note: "${contact.followUpNote}"`
            : "";
          const bodyText = `Hi ${ownerTenant.name || "there"},\n\nThis is your reminder to follow up with ${contact.name} (${contact.email}).${noteSection}\n\nLog into OnboardFlow to take action.`;

          const html = buildEmailHtml({
            body: bodyText,
          });

          await sender({
            to: ownerTenant.email,
            subject: `Reminder: Follow up with ${contact.name}`,
            html,
          });

          await db
            .update(individualContacts)
            .set({ followUpSent: true })
            .where(eq(individualContacts.id, contact.id));
        } catch (contactError) {
          console.error(`Failed to send reminder for contact ${contact.id}:`, contactError);
        }
      }
    } catch (reminderBlockError) {
      console.error("Reminder processing block failed:", reminderBlockError);
    }
    // ============ END FOLLOW-UP REMINDER PROCESSING ============

    return NextResponse.json({ success: true, emailsSent, emailsBlocked });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
