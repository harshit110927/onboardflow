import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { INDIVIDUAL_PLANS, ENTERPRISE_PLANS } from "@/lib/plans/limits";

export async function POST(req: Request) {
  const { user } = await getSession();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getTenant(user.email);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = (await req.json()) as { planId?: string };
  const allPlans = [...INDIVIDUAL_PLANS, ...ENTERPRISE_PLANS];
  const plan = allPlans.find((p) => p.id === planId);
  if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const razorpayPlanIdMap: Record<string, string | undefined> = {
    ind_starter: process.env.RAZORPAY_PLAN_IND_STARTER,
    ind_growth: process.env.RAZORPAY_PLAN_IND_GROWTH,
    ind_pro: process.env.RAZORPAY_PLAN_IND_PRO,
    ent_basic: process.env.RAZORPAY_PLAN_ENT_BASIC,
    ent_advanced: process.env.RAZORPAY_PLAN_ENT_ADVANCED,
  };

  const razorpayPlanId = razorpayPlanIdMap[planId as string];
  if (!razorpayPlanId) return NextResponse.json({ error: "Razorpay plan not configured" }, { status: 500 });

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const rzRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      quantity: 1,
      total_count: 12,
      notes: { tenant_id: tenant.id, plan_id: planId, tier: tenant.tier },
    }),
  });

  if (!rzRes.ok) return NextResponse.json({ error: "Failed to create subscription" }, { status: 502 });
  const subscription = (await rzRes.json()) as { id: string };
  return NextResponse.json({ subscriptionId: subscription.id });
}
