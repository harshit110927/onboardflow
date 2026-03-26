// NEW FILE — phase 2 stripe integration
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { price_id, type } = await req.json() as {
      price_id: string;
      type: "subscription" | "credits";
    };

    if (!price_id || !type) {
      return NextResponse.json({ error: "Missing price_id or type" }, { status: 400 });
    }

    const tenantRows = await db
      .select({ id: tenants.id, tier: tenants.tier, stripeCustomerId: tenants.stripeCustomerId })
      .from(tenants)
      .where(eq(tenants.email, user.email))
      .limit(1);

    const tenant = tenantRows[0];
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const dashboardPath = tenant.tier === "enterprise"
      ? "/dashboard/enterprise"
      : "/dashboard/individual";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: type === "subscription" ? "subscription" : "payment",
      customer_email: tenant.stripeCustomerId ? undefined : user.email,
      customer: tenant.stripeCustomerId ?? undefined,
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${baseUrl}${dashboardPath}/billing?success=true`,
      cancel_url: `${baseUrl}${dashboardPath}/billing?cancelled=true`,
      metadata: {
        tenant_id: tenant.id,
        price_id,
        type,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}