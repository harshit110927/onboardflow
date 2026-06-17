import crypto from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { INDIVIDUAL_PLANS, ENTERPRISE_PLANS } from "@/lib/plans/limits";

export async function POST(req: Request) {
  const { user } = await getSession();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getTenant(user.email);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, planId } = body;

  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !planId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Razorpay secret not configured" }, { status: 500 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(razorpay_payment_id + "|" + razorpay_subscription_id, "utf-8")
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const allPlans = [...INDIVIDUAL_PLANS, ...ENTERPRISE_PLANS];
  const plan = allPlans.find((p) => p.id === planId);
  if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  // For immediate verification, set renewal date to ~1 month from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await db
    .update(tenants)
    .set({
      plan: plan.planTier,
      planExpiresAt: expiresAt,
      planRenewalDate: expiresAt,
      razorpaySubscriptionId: razorpay_subscription_id,
    })
    .where(eq(tenants.id, tenant.id));

  return NextResponse.json({ success: true });
}
