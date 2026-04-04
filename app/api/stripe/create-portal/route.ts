// MODIFIED — razorpay credits migration — Stripe checkout/portal suppressed behind STRIPE_ENABLED gate
// NEW FILE — phase 2 stripe integration
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  // STRIPE SUPPRESSED — Stripe India approval pending
  // TO RE-ENABLE: Remove the 4 lines below
  if (process.env.STRIPE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Stripe payments temporarily unavailable. Please use the credit purchase system." },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantRows = await db
      .select({ stripeCustomerId: tenants.stripeCustomerId, tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.email, user.email))
      .limit(1);

    const tenant = tenantRows[0];

    if (!tenant?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please subscribe first." },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const returnPath = tenant.tier === "enterprise"
      ? "/dashboard/enterprise/billing"
      : "/dashboard/individual/billing";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${baseUrl}${returnPath}`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}