import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { checkEndUserLimit } from "@/lib/rate-limit/enterprise";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import { checkApiRateLimit } from "@/lib/rate-limit/api";
import { apiError } from "@/lib/api/errors";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimit = checkApiRateLimit(ip);
    if (!rateLimit.allowed) {
      return apiError("RATE_LIMIT_EXCEEDED", "Too many requests", 429);
    }
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey)
      return apiError("INVALID_API_KEY", "Missing API Key", 401);

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.apiKey, apiKey),
    });
    if (!tenant)
      return apiError("INVALID_API_KEY", "Invalid API Key", 401);

    let body: { userId?: string; event?: string; stepId?: string };
    try {
      body = await req.json();
    } catch {
      return apiError("MISSING_REQUIRED_FIELD", "Valid JSON body is required", 400);
    }
    const { userId, event, stepId } = body;
    const stepCode = stepId ?? event;

    if (!userId || !stepCode)
      return apiError("MISSING_REQUIRED_FIELD", "userId and stepId (or event) are required", 400);

    const user = await db.query.endUsers.findFirst({
      where: and(
        eq(endUsers.tenantId, tenant.id),
        eq(endUsers.externalId, userId)
      ),
    });

    if (!user) {
      const currentCountResult = await db
        .select({ total: count() })
        .from(endUsers)
        .where(eq(endUsers.tenantId, tenant.id));

      const currentCount = currentCountResult[0]?.total ?? 0;
      const limit = await checkEndUserLimit(tenant.id, currentCount);

      if (!limit.allowed) {
        return apiError("RATE_LIMIT_EXCEEDED", limit.reason, 429);
      }

      return apiError("USER_NOT_FOUND", "User not found. Call /identify first.", 404);
    }

    const currentSteps = (user.completedSteps as string[]) || [];

    if (!currentSteps.includes(stepCode)) {
      const newSteps = [...currentSteps, stepCode];

      await db
        .update(endUsers)
        .set({ completedSteps: newSteps, lastSeenAt: new Date() })
        .where(eq(endUsers.id, user.id));

      // Fire webhook — non-blocking, never fail the request
      deliverWebhookEvent(tenant.id, "user.activated", {
        userId,
        stepId: stepCode,
        completedSteps: newSteps,
      }).catch((err) => console.error("Webhook delivery error:", err));
    }

    return NextResponse.json({ success: true, step: stepCode });
  } catch (error) {
    console.error("Track error:", error);
    return apiError("INTERNAL_ERROR", "Server Error", 500);
  }
}
