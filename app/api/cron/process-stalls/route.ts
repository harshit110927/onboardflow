import { db } from "@/db";
import { endUsers, tenants } from "@/db/schema";
import { eq, and, isNull, lt } from "drizzle-orm"; 
import { NextResponse } from "next/server";
import { Resend } from 'resend';
import { decryptPassword, createSmtpTransporter } from "@/lib/email/smtp";
import { buildEmailHtml } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailSender = (args: { to: string; subject: string; html: string }) => Promise<void>;

function resolveEmailSender(tenant: {
  name?: string | null;
  senderName?: string | null;
  resendApiKey?: string | null;
  resendFromEmail?: string | null;
  smtpVerified?: boolean | null;
  smtpEmail?: string | null;
  smtpPassword?: string | null;
  emailProvider?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
}): EmailSender {
  const fromLabel = tenant.senderName || (tenant.name ? `${tenant.name} Team` : "Dripmetric Team");
  if (tenant.emailProvider === "smtp" && tenant.smtpVerified && tenant.smtpHost && tenant.smtpPort && tenant.smtpEmail && tenant.smtpPassword) {
    try {
      const transporter = createSmtpTransporter(
        tenant.smtpHost,
        tenant.smtpPort,
        tenant.smtpEmail,
        decryptPassword(tenant.smtpPassword)
      );
      return async ({ to, subject, html }) => {
        await transporter.sendMail({ from: `"${fromLabel}" <${tenant.smtpEmail}>`, to, subject, html });
      };
    } catch {}
  }

  if ((!tenant.emailProvider || tenant.emailProvider === "resend") && tenant.resendApiKey && tenant.resendFromEmail) {
    try {
      const tenantResend = new Resend(decryptPassword(tenant.resendApiKey));
      const fromEmail = tenant.resendFromEmail;
      return async ({ to, subject, html }) => {
        await tenantResend.emails.send({ from: `${fromLabel} <${fromEmail}>`, to: [to], subject, html });
      };
    } catch {}
  }

  return async ({ to, subject, html }) => {
    await resend.emails.send({
      from: `${fromLabel} <hello@dripmetric.com>`,
      to: [to],
      subject,
      html,
    });
  };
}

export async function GET(req: Request) {
  // 1. Rule: "Stuck" means they joined > 1 minute ago
  const ONE_MINUTE_AGO = new Date(Date.now() - 1 * 60 * 1000); 

  // 2. Find Candidates (Old enough + Never emailed)
  // We explicitly fetch the tenantId so we can look up settings
  const candidates = await db.query.endUsers.findMany({
    where: and(
        lt(endUsers.createdAt, ONE_MINUTE_AGO), 
        isNull(endUsers.lastEmailedAt)          
    )
  });

  let emailsSent = 0;

  for (const user of candidates) {
    if (!user.tenantId || !user.email) continue;

    // 3. Get the Founder's Config (What is the Goal?)
    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId)
    });

    // If Founder hasn't set a goal, we can't check it.
    if (!tenant || !tenant.activationStep) {
        console.log(`Skipping ${user.externalId}: Founder hasn't defined an activation step.`);
        continue;
    }

    const requiredStep = tenant.activationStep;
    const completedSteps = (user.completedSteps as string[]) || [];

    // 4. THE CHECK: Did they do the required step?
    if (completedSteps.includes(requiredStep)) {
        continue; // They are good!
    }

    // 5. They failed! Send Nudge.
    try {
        console.log(`⚠️ User ${user.externalId} stuck on '${requiredStep}'. Sending Nudge...`);
        
        const emailSender = resolveEmailSender(tenant);
        
        const emailBody = `Hey, are you stuck? 🤔
Hi ${user.externalId},
We noticed you signed up but haven't completed the **${requiredStep}** step yet.
This is essential to getting started. Click the link below to finish up!
- The Team`;

        const html = buildEmailHtml({
          body: emailBody,
          senderEmail: tenant.senderName || (tenant.name ? `${tenant.name} Team` : "Dripmetric Team"),
        });

        await emailSender({
            to: user.email,
            subject: 'Quick question...',
            html,
        });

        // 6. Mark as emailed
        await db.update(endUsers)
            .set({ lastEmailedAt: new Date() })
            .where(eq(endUsers.id, user.id));

        emailsSent++;
    } catch (err) {
        console.error("Failed to send nudge:", err);
    }
  }

  return NextResponse.json({ 
    success: true, 
    candidatesFound: candidates.length,
    emailsSent: emailsSent 
  });
}