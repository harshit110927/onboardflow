// MODIFIED — razorpay credits migration — added authenticated Razorpay order creation endpoint for tier-specific credit packs
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import {
  ENTERPRISE_CREDIT_PACKS,
  INDIVIDUAL_CREDIT_PACKS,
} from "@/lib/plans/limits";

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { packId?: string };
    const packId = body.packId;

    if (!packId) {
      return NextResponse.json({ error: "Missing packId" }, { status: 400 });
    }

    const tenantRows = await db
      .select({ id: tenants.id, tier: tenants.tier, email: tenants.email })
      .from(tenants)
      .where(eq(tenants.email, user.email))
      .limit(1);

    const tenant = tenantRows[0];
    if (!tenant || (tenant.tier !== "individual" && tenant.tier !== "enterprise")) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const availablePacks =
      tenant.tier === "enterprise" ? ENTERPRISE_CREDIT_PACKS : INDIVIDUAL_CREDIT_PACKS;

    const pack = availablePacks.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid packId" }, { status: 400 });
    }

    const currency = "INR";
    const amount = pack.amountInPaise;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay is not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `obf_${tenant.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          tenant_id: tenant.id,
          pack_id: pack.id,
          credits: String(pack.credits),
          user_email: tenant.email,
          tier: tenant.tier,
          label: pack.label,
        },
      }),
    });

    if (!razorpayRes.ok) {
      const errorText = await razorpayRes.text();
      console.error("Razorpay create-order API error:", errorText);
      return NextResponse.json({ error: "Failed to create order" }, { status: 502 });
    }

    const order = (await razorpayRes.json()) as RazorpayOrderResponse;

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      packId: pack.id,
      credits: pack.credits,
      label: pack.label,
    });
  } catch (error) {
    console.error("Razorpay create-order error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
