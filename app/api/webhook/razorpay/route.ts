// MODIFIED — razorpay credits migration — added Razorpay webhook with signature verification, idempotency, and credit purchase ledgering
import crypto from "crypto";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  creditTransactions,
  processedWebhookEvents,
  tenants,
} from "@/db/schema";
import {
  ENTERPRISE_CREDIT_PACKS,
  INDIVIDUAL_CREDIT_PACKS,
} from "@/lib/plans/limits";

type RazorpayPaymentCapturedEvent = {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        notes?: {
          tenant_id?: string;
          pack_id?: string;
          credits?: string;
          user_email?: string;
          tier?: "individual" | "enterprise";
          label?: string;
        };
      };
    };
  };
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string)
    .update(body)
    .digest("hex");

  if (expected !== signature) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(body) as RazorpayPaymentCapturedEvent;

  if (event.event !== "payment.captured") {
    return new NextResponse("Ignored", { status: 200 });
  }

  const payment = event.payload.payment.entity;
  const eventId = `rz_${payment.id}`;

  const notes = payment.notes;
  const tenantId = notes?.tenant_id;
  const packId = notes?.pack_id;
  const tier = notes?.tier;
  const credits = notes?.credits ?? "0";
  const userEmail = notes?.user_email;
  const labelFromNotes = notes?.label;
  const creditAmount = Number(credits);

  if (!tenantId || !packId || !tier || !userEmail || !Number.isFinite(creditAmount) || creditAmount <= 0) {
    return new NextResponse("Invalid notes", { status: 400 });
  }

  const packs = tier === "enterprise" ? ENTERPRISE_CREDIT_PACKS : INDIVIDUAL_CREDIT_PACKS;
  const pack = packs.find((item) => item.id === packId);
  const label = labelFromNotes || pack?.label || "Credit Pack";

  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.tier, tier)))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant) {
    return new NextResponse("Tenant not found", { status: 404 });
  }

  const processed = await db.transaction(async (tx) => {
    const marker = await tx
      .insert(processedWebhookEvents)
      .values({ stripeEventId: eventId })
      .onConflictDoNothing()
      .returning({ id: processedWebhookEvents.id });

    if (marker.length === 0) {
      return false;
    }

    await tx
      .update(tenants)
      .set({
        credits: sql`${tenants.credits} + ${creditAmount}`,
        creditsUpdatedAt: sql`NOW()`,
      })
      .where(eq(tenants.id, tenant.id));

    await tx.insert(creditTransactions).values({
      tenantId: tenant.id,
      amount: creditAmount,
      type: "purchase",
      description: `Credit pack — ${label} (${credits} credits)`,
    });

    return true;
  });

  if (!processed) {
    return new NextResponse("OK", { status: 200 });
  }

  return new NextResponse("OK", { status: 200 });
}
