import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";

export async function POST() {
  const { user } = await getSession();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getTenant(user.email);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!tenant.razorpaySubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  await fetch(`https://api.razorpay.com/v1/subscriptions/${tenant.razorpaySubscriptionId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cancel_at_cycle_end: true }),
  });

  await db.update(tenants).set({ razorpaySubscriptionId: null }).where(eq(tenants.id, tenant.id));

  return NextResponse.json({ success: true });
}
