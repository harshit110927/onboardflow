import crypto from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, processedWebhookEvents } from "@/db/schema";
import { INDIVIDUAL_PLANS, ENTERPRISE_PLANS } from "@/lib/plans/limits";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const razorpayEventIdHeader = req.headers.get("x-razorpay-event-id");

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

  const eventId =
    razorpayEventIdHeader ??
    `rz_${eventType}_${event.payload?.subscription?.entity?.id ?? event.payload?.payment?.entity?.id ?? event.created_at ?? Date.now()}`;
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
<<<<<<< codex/migrate-to-subscription-based-model-js2kvm
    const planIdFromNotes = notes?.plan_id;

    if (!tenantId) return new NextResponse("Missing tenant note", { status: 400 });

    const razorpayPlanIdMap: Record<string, string | undefined> = {
      ind_starter: process.env.RAZORPAY_PLAN_IND_STARTER,
      ind_growth: process.env.RAZORPAY_PLAN_IND_GROWTH,
      ind_pro: process.env.RAZORPAY_PLAN_IND_PRO,
      ent_basic: process.env.RAZORPAY_PLAN_ENT_BASIC,
      ent_advanced: process.env.RAZORPAY_PLAN_ENT_ADVANCED,
    };

    let resolvedPlanId = planIdFromNotes;
    if (!resolvedPlanId) {
      const byRazorpayPlanId = Object.entries(razorpayPlanIdMap).find(
        ([, razorpayPlanId]) => razorpayPlanId && razorpayPlanId === sub.plan_id,
      );
      resolvedPlanId = byRazorpayPlanId?.[0];
    }

    if (!resolvedPlanId) return new NextResponse("Missing plan mapping", { status: 400 });

    const plan = allPlans.find((p) => p.id === resolvedPlanId);
    if (!plan) return new NextResponse("Unknown plan", { status: 400 });

    const renewalFromWebhook = typeof sub.current_end === "number"
      ? new Date(sub.current_end * 1000)
      : null;
    const expiresAt = renewalFromWebhook ?? new Date();
    if (!renewalFromWebhook) {
      expiresAt.setDate(expiresAt.getDate() + 35);
    }

=======
    const planId = notes?.plan_id;

    if (!tenantId || !planId) return new NextResponse("Missing notes", { status: 400 });

    const plan = allPlans.find((p) => p.id === planId);
    if (!plan) return new NextResponse("Unknown plan", { status: 400 });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 35);

>>>>>>> main
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
