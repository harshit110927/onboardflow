import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/rate-limit/api";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";

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

    let body: { userId?: string; email?: string; event?: string; stepId?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userId, email, event, stepId } = body;
    const stepCode = stepId ?? event;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    let user = await db.query.endUsers.findFirst({
      where: and(eq(endUsers.tenantId, tenant.id), eq(endUsers.email, email)),
    });

    if (!user) {
      [user] = await db
        .insert(endUsers)
        .values({
          tenantId: tenant.id,
          email,
          externalId: userId || email,
          completedSteps: [],
          createdAt: new Date(),
          lastSeenAt: new Date(),
        })
        .returning();

      // Fire webhook for new user — non-blocking
      deliverWebhookEvent(tenant.id, "user.identified", {
        email,
        userId: userId || email,
      }).catch((err) => console.error("Webhook delivery error:", err));
    }

    if (userId && user && user.externalId !== userId) {
      await db
        .update(endUsers)
        .set({ externalId: userId, lastSeenAt: new Date() })
        .where(eq(endUsers.id, user.id));
    }

    if (stepCode && user) {
      const currentSteps = (user.completedSteps as string[]) || [];
      if (!currentSteps.includes(stepCode)) {
        await db
          .update(endUsers)
          .set({
            completedSteps: [...currentSteps, stepCode],
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
