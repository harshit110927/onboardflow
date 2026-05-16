import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { tenants, stripeSubscriptions, creditTransactions, processedWebhookEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const resend = new Resend(process.env.RESEND_API_KEY);

// Credit amounts per pack price ID
const CREDIT_PACK_MAP: Record<string, number> = {
  [process.env.STRIPE_CREDITS_10_PRICE_ID as string]: 10000,
  [process.env.STRIPE_CREDITS_25_PRICE_ID as string]: 27500,
  [process.env.STRIPE_CREDITS_50_PRICE_ID as string]: 60000,
  [process.env.STRIPE_CREDITS_100_PRICE_ID as string]: 130000,
};

async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: processedWebhookEvents.id })
      .from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.stripeEventId, eventId))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function markEventProcessed(eventId: string): Promise<void> {
  try {
    await db.insert(processedWebhookEvents).values({ stripeEventId: eventId });
  } catch {
    // Already inserted — safe to ignore
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  // Idempotency check — skip if already processed
  if (await isEventProcessed(event.id)) {
    return new NextResponse(null, { status: 200 });
  }

  try {
    switch (event.type) {

      // ── Checkout completed ──────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email;
        if (!email) break;

        if (session.mode === "subscription") {
          // Get subscription details for period end
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const periodEnd = new Date(
            subscription.items.data[0].current_period_end * 1000
          );

          // Determine which price was purchased
          const priceId = subscription.items.data[0]?.price.id;
          const isEnterprise =
            priceId === process.env.STRIPE_ENTERPRISE_PREMIUM_PRICE_ID;

          // Generate API key for enterprise if not already set
          const tenantRows = await db
            .select({ id: tenants.id, apiKey: tenants.apiKey })
            .from(tenants)
            .where(eq(tenants.email, email))
            .limit(1);

          const tenant = tenantRows[0];
          if (!tenant) break;

          const updateValues: Record<string, unknown> = {
            plan: "premium",
            planExpiresAt: periodEnd,
            stripeCustomerId: session.customer as string,
            hasAccess: true,
          };

          // Only generate API key for enterprise and only if not already set
          if (isEnterprise && !tenant.apiKey) {
            updateValues.apiKey =
              "obf_live_" + crypto.randomBytes(24).toString("hex");
          }

          await db
            .update(tenants)
            .set(updateValues)
            .where(eq(tenants.email, email));

          // Upsert stripe_subscriptions record
          const existingSub = await db
            .select({ id: stripeSubscriptions.id })
            .from(stripeSubscriptions)
            .where(eq(stripeSubscriptions.tenantId, tenant.id))
            .limit(1);

          if (existingSub.length > 0) {
            await db
              .update(stripeSubscriptions)
              .set({
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: subscription.id,
                stripePriceId: priceId,
                status: subscription.status,
                currentPeriodEnd: periodEnd,
              })
              .where(eq(stripeSubscriptions.tenantId, tenant.id));
          } else {
            await db.insert(stripeSubscriptions).values({
              tenantId: tenant.id,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              status: subscription.status,
              currentPeriodEnd: periodEnd,
            });
          }
        }

        if (session.mode === "payment") {
          // Credit pack purchase
          const lineItems = await stripe.checkout.sessions.listLineItems(
            session.id
          );
          const priceId = lineItems.data[0]?.price?.id;
          if (!priceId) break;

          const creditAmount = CREDIT_PACK_MAP[priceId];
          if (!creditAmount) break;

          const tenantRows = await db
            .select({ id: tenants.id, credits: tenants.credits })
            .from(tenants)
            .where(eq(tenants.email, email))
            .limit(1);

          const tenant = tenantRows[0];
          if (!tenant) break;

          const newBalance = (tenant.credits ?? 0) + creditAmount;

          await db
            .update(tenants)
            .set({ credits: newBalance, creditsUpdatedAt: new Date() })
            .where(eq(tenants.id, tenant.id));

          await db.insert(creditTransactions).values({
            tenantId: tenant.id,
            amount: creditAmount,
            type: "purchase",
            description: `Credit pack purchase — ${creditAmount.toLocaleString()} credits`,
          });
        }

        break;
      }

      // ── Subscription renewed ────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== "subscription_cycle") break;

        const customerId = invoice.customer as string;
        const subscriptionId = (invoice as any).subscription as string;

        if (!subscriptionId) break;

        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = new Date(
          subscription.items.data[0].current_period_end * 1000
        );

        await db
          .update(tenants)
          .set({ planExpiresAt: periodEnd })
          .where(eq(tenants.stripeCustomerId, customerId));

        await db
          .update(stripeSubscriptions)
          .set({
            status: subscription.status,
            currentPeriodEnd: periodEnd,
          })
          .where(
            eq(stripeSubscriptions.stripeSubscriptionId, subscriptionId)
          );

        break;
      }

      // ── Payment failed ──────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const tenantRows = await db
          .select({ email: tenants.email })
          .from(tenants)
          .where(eq(tenants.stripeCustomerId, customerId))
          .limit(1);

        const tenant = tenantRows[0];
        if (!tenant) break;

        await resend.emails.send({
          from: "Dripmetric <hello@dripmetric.com>",
          to: tenant.email,
          subject: "Action required — payment failed",
          text: `Hi,\n\nWe were unable to process your Dripmetric subscription payment. Your premium access will remain active for now, but please update your payment method to avoid any interruption.\n\nManage your billing: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/billing\n\nDripmetric`,
        });

        break;
      }

      // ── Subscription cancelled ──────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await db
          .update(tenants)
          .set({
            plan: "free",
            planExpiresAt: new Date(),
            hasAccess: false,
          })
          .where(eq(tenants.stripeCustomerId, customerId));

        await db
          .update(stripeSubscriptions)
          .set({ status: "canceled" })
          .where(
            eq(
              stripeSubscriptions.stripeSubscriptionId,
              subscription.id
            )
          );

        break;
      }
    }

    await markEventProcessed(event.id);
    return new NextResponse(null, { status: 200 });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new NextResponse("Webhook processing failed", { status: 500 });
  }
}