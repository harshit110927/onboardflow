import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { checkEndUserLimit } from "@/lib/rate-limit/enterprise";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import { checkApiRateLimit } from "@/lib/rate-limit/api";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkApiRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey)
    return NextResponse.json({ error: "Missing API Key" }, { status: 401 });

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.apiKey, apiKey),
  });
  if (!tenant)
    return NextResponse.json({ error: "Invalid API Key" }, { status: 403 });

  let body: { userId?: string; event?: string; stepId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { userId, event, stepId } = body;

  if (!userId || !stepId)
    return NextResponse.json({ error: "Missing data" }, { status: 400 });

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
      return NextResponse.json({ error: limit.reason }, { status: 403 });
    }

    return NextResponse.json(
      { error: "User not found. Call /identify first." },
      { status: 404 }
    );
  }

  const currentSteps = (user.completedSteps as string[]) || [];

  if (!currentSteps.includes(stepId)) {
    const newSteps = [...currentSteps, stepId];

    await db
      .update(endUsers)
      .set({ completedSteps: newSteps, lastSeenAt: new Date() })
      .where(eq(endUsers.id, user.id));

    // Fire webhook — non-blocking, never fail the request
    deliverWebhookEvent(tenant.id, "user.activated", {
      userId,
      stepId,
      completedSteps: newSteps,
    }).catch((err) => console.error("Webhook delivery error:", err));
  }

  return NextResponse.json({ success: true, step: stepId });
}
