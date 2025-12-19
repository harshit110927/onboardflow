'use server'

import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// Initialize Stripe with your Secret Key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export async function createCheckoutSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Create the Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email!, // Pre-fill the user's email
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'OnboardFlow Lifetime License',
          description: 'Unlimited access to all features',
        },
        unit_amount: 4900, 
      },
      quantity: 1,
    }],
    // Where to send them after they pay
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success`,
    // Where to send them if they click "Back"
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
    
    // CRITICAL: Pass the user's email so our Webhook knows who paid later
    client_reference_id: user.email, 
  })

  // Redirect the user to the Stripe Checkout page
  redirect(session.url!)
}

export async function generateApiKey(userEmail: string) {
    // 1. Generate a random secure string (32 characters hex)
    const rawKey = crypto.randomBytes(24).toString('hex');
    // 2. Add your prefix so it looks professional
    const newApiKey = `obf_live_${rawKey}`;
  
    // 3. Save it to the database
    await db.update(tenants)
      .set({ apiKey: newApiKey })
      .where(eq(tenants.email, userEmail));
  
    // 4. Refresh the dashboard so the user sees it immediately
    revalidatePath('/dashboard');
  }