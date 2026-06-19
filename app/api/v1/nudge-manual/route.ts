import { db } from "@/db";
import { tenants, endUsers, unsubscribedContacts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Resend } from "resend";
import { decryptPassword, createSmtpTransporter } from "@/lib/email/smtp";
import { buildEmailHtml } from "@/lib/email/templates";
import { checkEmailRateLimit, incrementEmailCount } from "@/lib/rate-limit/enterprise";

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

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reqBody = await req.json();
    const { email, subject, body: emailBody } = reqBody;

    if (!email || !subject || !emailBody) {
      return NextResponse.json({ error: "Email, subject, and body are required." }, { status: 400 });
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.email, user.email!),
    });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const endUser = await db.query.endUsers.findFirst({
      where: and(eq(endUsers.tenantId, tenant.id), eq(endUsers.email, email)),
    });
    if (!endUser) return NextResponse.json({ error: "User not found in your audience." }, { status: 404 });

    const unsubCheck = await db.query.unsubscribedContacts.findFirst({
        where: eq(unsubscribedContacts.email, email.toLowerCase())
    });
    if (unsubCheck) return NextResponse.json({ error: "This user has unsubscribed." }, { status: 400 });

    const limit = await checkEmailRateLimit(tenant.id);
    if (!limit.allowed) {
      return NextResponse.json({ error: `Rate limit reached: ${limit.reason}` }, { status: 429 });
    }

    const emailSender = resolveEmailSender(tenant);
    const fromLabel = tenant.senderName || (tenant.name ? `${tenant.name} Team` : "Dripmetric Team");
    const userName = email.split("@")[0];

    const parsedBody = emailBody
      .replace(/{{name}}/g, userName)
      .replace(/{{email}}/g, email);

    await emailSender({
      to: email,
      subject,
      html: buildEmailHtml({
        body: parsedBody,
        senderEmail: fromLabel,
      }),
    });

    await incrementEmailCount(tenant.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Manual nudge error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
