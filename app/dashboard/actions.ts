'use server'

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

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
