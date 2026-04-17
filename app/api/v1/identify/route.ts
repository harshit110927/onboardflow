import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { checkApiRateLimit } from "@/lib/rate-limit/api";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import { buildEmailHtml } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimit = checkApiRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 401 });
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.apiKey, apiKey),
    });

    if (!tenant) {
      return NextResponse.json({ error: "Invalid API Key" }, { status: 403 });
    }

    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }

    let body: { email?: string; userId?: string; event?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { email, event } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    let user = await db.query.endUsers.findFirst({
      where: and(eq(endUsers.tenantId, tenant.id), eq(endUsers.email, email)),
    });

    const isNewUser = !user;

    if (!user) {
      [user] = await db
        .insert(endUsers)
        .values({
          tenantId: tenant.id,
          email,
          externalId: body.userId || email,
          completedSteps: [],
          createdAt: new Date(),
          lastSeenAt: new Date(),
        })
        .returning();

      deliverWebhookEvent(tenant.id, "user.identified", {
        email,
        userId: email,
      }).catch((err) => console.error("Webhook delivery error:", err));
    }

    // Send welcome email immediately for new users only
    if (isNewUser && user) {
      const userName = email.split("@")[0];
      const welcomeBody = tenant.emailSubject
        ? tenant.emailBody || `Hey ${userName}, welcome! Complete your first step to get started.`
        : `Hey ${userName}, welcome! Complete your first step to get started.`;

      resend.emails.send({
        from: "OnboardFlow <onboarding@resend.dev>",
        to: email,
        subject: tenant.emailSubject || "Welcome — let's get you started",
        html: buildEmailHtml({ body: welcomeBody }),
      }).catch((err) => console.error("Welcome email error:", err));
    }

    if (event && user) {
      const currentSteps = (user.completedSteps as string[]) || [];
      if (!currentSteps.includes(event)) {
        await db
          .update(endUsers)
          .set({
            completedSteps: [...currentSteps, event],
            lastSeenAt: new Date(),
          })
          .where(eq(endUsers.id, user.id));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Identify error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}