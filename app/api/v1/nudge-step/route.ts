import { db } from "@/db";
import { tenants, endUsers, unsubscribedContacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Resend } from "resend";
import { subHours } from "date-fns";
import { decryptPassword, createGmailTransporter } from "@/lib/email/smtp";
import { buildEmailHtml } from "@/lib/email/templates";
import { checkEmailRateLimit, incrementEmailCount } from "@/lib/rate-limit/enterprise";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    } catch {}
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
    } catch {}
  }
  return async ({ to, subject, html }) => {
    await resend.emails.send({
      from: "Dripmetric <hello@dripmetric.com>",
      to: [to],
      subject,
      html,
    });
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { stepIndex } = body; // 1, 2, or 3

    if (!stepIndex || ![1, 2, 3].includes(stepIndex)) {
      return NextResponse.json({ error: "stepIndex must be 1, 2, or 3" }, { status: 400 });
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.email, user.email!),
    });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    // Resolve which step config to use
    const stepConfig = stepIndex === 1
      ? {
          eventTrigger: tenant.activationStep || "connect_repo",
          emailSubject: tenant.emailSubject || "Complete your setup",
          emailBody: tenant.emailBody || "Hey, you haven't started yet.",
          delayHours: 1,
          prevTriggers: [] as string[],
        }
      : stepIndex === 2
      ? {
          eventTrigger: tenant.step2 || "",
          emailSubject: tenant.emailSubject2 || "Keep going",
          emailBody: tenant.emailBody2 || "You're almost there.",
          delayHours: 24,
          prevTriggers: [tenant.activationStep || "connect_repo"],
        }
      : {
          eventTrigger: tenant.step3 || "",
          emailSubject: tenant.emailSubject3 || "Almost there",
          emailBody: tenant.emailBody3 || "One last step.",
          delayHours: 24,
          prevTriggers: [
            tenant.activationStep || "connect_repo",
            tenant.step2 || "",
          ],
        };

    if (!stepConfig.eventTrigger) {
      return NextResponse.json(
        { error: `Step ${stepIndex} is not configured. Set it in Automation Settings first.` },
        { status: 400 }
      );
    }

    const tag = `nudge_step${stepIndex}`;
    const triggerTime = subHours(new Date(), stepConfig.delayHours);

    const allUsers = await db.query.endUsers.findMany({
      where: eq(endUsers.tenantId, tenant.id),
    });

    const emailSender = resolveEmailSender(tenant);
    const companyName = tenant.name || "Team";

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const user of allUsers) {
      if (!user.email) { skipped++; continue; }

      // Check unsubscribe
      const unsubCheck = await db
        .select({ email: unsubscribedContacts.email })
        .from(unsubscribedContacts)
        .where(eq(unsubscribedContacts.email, user.email.toLowerCase()))
        .limit(1);
      if (unsubCheck.length > 0) { skipped++; continue; }

      const completedSteps = (user.completedSteps as string[]) || [];
      const automationsReceived = (user.automationsReceived as string[]) || [];

      // Already received this nudge
      if (automationsReceived.includes(tag)) { skipped++; continue; }

      // Already completed this step
      if (completedSteps.includes(stepConfig.eventTrigger)) { skipped++; continue; }

      // Previous steps must be complete
      const prevComplete = stepConfig.prevTriggers.every(t => !t || completedSteps.includes(t));
      if (!prevComplete) { skipped++; continue; }

      // Must be old enough
      if (!user.createdAt || user.createdAt >= triggerTime) { skipped++; continue; }

      // Rate limit check
      const limit = await checkEmailRateLimit(tenant.id);
      if (!limit.allowed) {
        return NextResponse.json({
          error: `Rate limit reached: ${limit.reason}`,
          sent,
          skipped,
        }, { status: 429 });
      }

      try {
        const userName = user.email.split("@")[0];
        const emailBody = stepConfig.emailBody
          .replace(/{{name}}/g, userName)
          .replace(/{{email}}/g, user.email);

        await emailSender({
          to: user.email,
          subject: stepConfig.emailSubject,
          html: buildEmailHtml({
            body: emailBody,
            senderEmail: companyName,
          }),
        });

        await incrementEmailCount(tenant.id);

        const newTags = [...automationsReceived, tag];
        await db
          .update(endUsers)
          .set({ automationsReceived: newTags, lastEmailedAt: new Date() })
          .where(eq(endUsers.id, user.id));

        sent++;
      } catch (err) {
        errors.push(user.email);
        console.error(`Nudge failed for ${user.email}:`, err);
      }
    }

    return NextResponse.json({ success: true, sent, skipped, errors });
  } catch (error) {
    console.error("Nudge step error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}