import crypto from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, processedWebhookEvents } from "@/db/schema";
import { INDIVIDUAL_PLANS, ENTERPRISE_PLANS } from "@/lib/plans/limits";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (expected !== signature) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(body);
  const eventType = event.event;

  const eventId = `rz_${event.payload?.subscription?.entity?.id ?? event.payload?.payment?.entity?.id ?? Date.now()}`;
  const processed = await db
    .select({ id: processedWebhookEvents.id })
    .from(processedWebhookEvents)
    .where(eq(processedWebhookEvents.stripeEventId, eventId))
    .limit(1);

  if (processed.length > 0) return new NextResponse("OK", { status: 200 });

  const allPlans = [...INDIVIDUAL_PLANS, ...ENTERPRISE_PLANS];

  if (eventType === "subscription.activated" || eventType === "subscription.charged") {
    const sub = event.payload.subscription.entity;
    const notes = sub.notes;
    const tenantId = notes?.tenant_id;
    const planId = notes?.plan_id;

    if (!tenantId || !planId) return new NextResponse("Missing notes", { status: 400 });

    const plan = allPlans.find((p) => p.id === planId);
    if (!plan) return new NextResponse("Unknown plan", { status: 400 });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 35);

    await db
      .update(tenants)
      .set({
        plan: plan.planTier,
        planExpiresAt: expiresAt,
        planRenewalDate: expiresAt,
        razorpaySubscriptionId: sub.id,
      })
      .where(eq(tenants.id, tenantId));
  }

  if (eventType === "subscription.cancelled" || eventType === "subscription.expired") {
    const sub = event.payload.subscription.entity;
    const notes = sub.notes;
    const tenantId = notes?.tenant_id;
    if (!tenantId) return new NextResponse("Missing notes", { status: 400 });

    await db
      .update(tenants)
      .set({ razorpaySubscriptionId: null })
      .where(eq(tenants.id, tenantId));
  }

  await db.insert(processedWebhookEvents).values({ stripeEventId: eventId });
  return new NextResponse("OK", { status: 200 });
}
