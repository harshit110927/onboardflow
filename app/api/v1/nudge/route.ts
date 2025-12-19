import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Resend } from 'resend';

// Initialize Resend (It will look for process.env.RESEND_API_KEY)
// For now, you can hardcode your key here for testing or use env var
const resend = new Resend(process.env.RESEND_API_KEY || "re_123456789"); 

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.email, user.email!)
    });
    if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

    const { targetStep } = await req.json(); // "step1", "step2", or "step3"

    // 1. CONFIGURE THE CAMPAIGN
    // We determine: 
    // - What event are we looking for? (Goal)
    // - What event MUST they have done before? (Prerequisite)
    // - Which email template do we use?
    
    let goalEvent = "";
    let prerequisiteEvent = "";
    let subject = "";
    let bodyTemplate = "";

    if (targetStep === "step1") {
        goalEvent = tenant.activationStep || "connect_repo";
        subject = tenant.emailSubject || "Complete your setup";
        bodyTemplate = tenant.emailBody || "Hey {{name}}, you need to connect your repo!";
        // No prerequisite for Step 1
    } 
    else if (targetStep === "step2") {
        goalEvent = tenant.step2 || "";
        prerequisiteEvent = tenant.activationStep || "connect_repo"; // Must have done Step 1
        subject = tenant.emailSubject2 || "Keep going!";
        bodyTemplate = tenant.emailBody2 || "Hey {{name}}, great start. Now invite a teammate.";
    } 
    else if (targetStep === "step3") {
        goalEvent = tenant.step3 || "";
        prerequisiteEvent = tenant.step2 || ""; // Must have done Step 2
        subject = tenant.emailSubject3 || "Almost there!";
        bodyTemplate = tenant.emailBody3 || "Hey {{name}}, upgrade to pro now.";
    }

    if (!goalEvent) return NextResponse.json({ error: "Step is not configured in Settings" }, { status: 400 });

    // 2. FIND THE TARGET AUDIENCE
    const allUsers = await db.query.endUsers.findMany({
        where: eq(endUsers.tenantId, tenant.id)
    });

    const usersToNudge = allUsers.filter(u => {
        const steps = u.completedSteps as string[] || [];
        
        // RULE 1: Must NOT have completed the goal
        const hasDoneGoal = steps.includes(goalEvent);
        if (hasDoneGoal) return false;

        // RULE 2: If there is a prerequisite, they MUST have done it
        if (prerequisiteEvent) {
            const hasDonePrereq = steps.includes(prerequisiteEvent);
            if (!hasDonePrereq) return false;
        }

        // RULE 3: Don't spam (Optional: check if emailed recently)
        // if (u.lastEmailedAt && differenceInHours(new Date(), u.lastEmailedAt) < 24) return false;

        return true;
    });

    if (usersToNudge.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "No eligible users found." });
    }

    // 3. SEND THE EMAILS (Batch Process)
    let successCount = 0;

    for (const u of usersToNudge) {
        // 🛡️ SAFETY CHECK: If for some reason email is null, skip this user
        if (!u.email) continue; 

        // Personalize the message
        // Now TypeScript knows u.email is definitely a string
        const personalizedBody = bodyTemplate.replace("{{name}}", u.email.split('@')[0]);

        try {
            // 🚨 THE REAL SENDING LOGIC
            await resend.emails.send({
                from: 'Acme <onboarding@resend.dev>', // You will customize this later
                to: [u.email], 
                subject: subject,
                text: personalizedBody, 
            });

            // Update DB to remember we emailed them
            await db.update(endUsers)
                .set({ lastEmailedAt: new Date() })
                .where(eq(endUsers.id, u.id));

            successCount++;
            console.log(`✅ Email sent to ${u.email}`);
        } catch (err) {
            console.error(`❌ Failed to send to ${u.email}`, err);
        }
    }

    return NextResponse.json({ success: true, count: successCount });
  } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}