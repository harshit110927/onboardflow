import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { checkApiRateLimit } from "@/lib/rate-limit/api";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import { buildEmailHtml } from "@/lib/email/templates";
import { apiError } from "@/lib/api/errors";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimit = checkApiRateLimit(ip);
    if (!rateLimit.allowed) {
      return apiError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded", 429);
    }

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return apiError("INVALID_API_KEY", "Missing API Key", 401);
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.apiKey, apiKey),
    });

    if (!tenant) {
      return apiError("INVALID_API_KEY", "Invalid API Key", 401);
    }

    const rawBody = await req.text();
    if (!rawBody) {
      return apiError("MISSING_REQUIRED_FIELD", "Request body is required", 400);
    }

    let body: { email?: string; userId?: string; event?: string; properties?: Record<string, unknown> };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return apiError("MISSING_REQUIRED_FIELD", "Request body must be valid JSON", 400);
    }

    const { email, event, properties } = body;

    if (!email) {
      return apiError("MISSING_REQUIRED_FIELD", "email is required", 400);
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
          properties: properties && typeof properties === "object" && !Array.isArray(properties) ? properties : null,
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

    if (!isNewUser && user && properties && typeof properties === "object" && !Array.isArray(properties)) {
      await db
        .update(endUsers)
        .set({ properties, lastSeenAt: new Date() })
        .where(eq(endUsers.id, user.id));
    }

    // Send welcome email immediately for new users only
    if (isNewUser && user) {
      const userName = email.split("@")[0];
      const welcomeBody = tenant.emailSubject
        ? tenant.emailBody || `Hey ${userName}, welcome! Complete your first step to get started.`
        : `Hey ${userName}, welcome! Complete your first step to get started.`;

      resend.emails.send({
        from: "Dripmetric <hello@dripmetric.com>",
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
    return apiError("INTERNAL_ERROR", "Server Error", 500);
  }
}