import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { subHours } from "date-fns";
import {
  checkEmailRateLimit,
  incrementEmailCount,
} from "@/lib/rate-limit/enterprise";

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
    return NextResponse.json({ success: true, emailsSent, emailsBlocked });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}