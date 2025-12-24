import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/db'
import { tenants } from '@/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto' // 👈 Don't forget this import!

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('Stripe-Signature') as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (error: any) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const email = session.customer_details?.email

    if (email) {
      // 1. Generate the Key HERE 
      const newApiKey = "obf_live_" + crypto.randomBytes(24).toString("hex");

      // 2. Save it to the database
      await db.update(tenants)
        .set({ 
          hasAccess: true,
          stripeCustomerId: session.customer as string,
          apiKey: newApiKey // 👈 This is what you were missing!
        })
        .where(eq(tenants.email, email))
    }
  }

  return new NextResponse(null, { status: 200 })
}