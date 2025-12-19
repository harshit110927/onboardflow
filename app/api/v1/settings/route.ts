import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.email, user.email!)
  });

  return NextResponse.json(tenant);
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get the data from the frontend
    const body = await req.json();
    
    // 2. Destructure to separate the "toggle" from the "text fields"
    // We explicitly pull out 'automationEnabled' to ensure it's saved
    const { 
        automationEnabled, 
        activationStep, emailSubject, emailBody,
        step2, emailSubject2, emailBody2,
        step3, emailSubject3, emailBody3
    } = body;

    // 3. Update the Database
    await db.update(tenants)
        .set({
            automationEnabled: automationEnabled, // 👈 The critical new field
            
            activationStep,
            emailSubject,
            emailBody,
            
            step2,
            emailSubject2,
            emailBody2,
            
            step3,
            emailSubject3,
            emailBody3,
        })
        .where(eq(tenants.email, user.email!));

    return NextResponse.json({ success: true });

  } catch (error) {
      console.error("Settings Error:", error);
      return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}