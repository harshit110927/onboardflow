import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, isNull, and, arrayContains, not, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Resend } from 'resend';
import { subHours } from "date-fns"; // Make sure to install date-fns if missing

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to check array includes (since Drizzle array search can be tricky depending on driver)
const hasReceived = (user: any, tag: string) => {
    return (user.automationsReceived || []).includes(tag);
};

export async function GET(req: Request) {
    // SECURITY: In production, verify a secret token so random people can't trigger your bot
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { return new Response('Unauthorized', { status: 401 }); }

    try {
        console.log("🤖 CRON JOB STARTED");

        // 1. Find all Tenants with Auto-Pilot ENABLED
        const activeTenants = await db.query.tenants.findMany({
            where: eq(tenants.automationEnabled, true)
        });

        console.log(`found ${activeTenants.length} active tenants`);

        let emailsSent = 0;

        // 2. Loop through each tenant (For MVP this is fine; for 10k tenants, use a queue)
        for (const tenant of activeTenants) {
            
            // Fetch users for this tenant
            const users = await db.query.endUsers.findMany({
                where: eq(endUsers.tenantId, tenant.id)
            });

            // Define Milestones
            const step1Event = tenant.activationStep || "connect_repo";
            const step2Event = tenant.step2 || "invited_teammate"; // Example default
            const step3Event = tenant.step3 || "upgraded_to_pro";  // Example default

            for (const user of users) {
                if (!user.email) continue;
                
                const stepsCompleted = user.completedSteps as string[] || [];
                const oneHourAgo = subHours(new Date(), 1);
                const twentyFourHoursAgo = subHours(new Date(), 24);

                let emailToSend: { subject: string, body: string, tag: string } | null = null;

                // --- LOGIC 1: THE 1-HOUR ACTIVATION NUDGE ---
                // User signed up > 1 hour ago, hasn't done Step 1, and hasn't received this email yet.
                if (
                    user.createdAt && user.createdAt < oneHourAgo && // Older than 1 hour
                    !stepsCompleted.includes(step1Event) &&          // Stuck at Step 1
                    !hasReceived(user, "nudge_step1")                // Haven't emailed yet
                ) {
                    emailToSend = {
                        subject: tenant.emailSubject || "Complete your setup",
                        body: tenant.emailBody || "Hey, you need to connect your repo!",
                        tag: "nudge_step1"
                    };
                }

                // --- LOGIC 2: THE 24-HOUR STEP 2 NUDGE ---
                // User has done Step 1, but NOT Step 2. Stuck for > 24 hours (based on last seen or created).
                else if (
                    stepsCompleted.includes(step1Event) &&           // Passed Step 1
                    !stepsCompleted.includes(step2Event) &&          // Stuck at Step 2
                    user.createdAt && user.createdAt < twentyFourHoursAgo && // Older than 24h
                    !hasReceived(user, "nudge_step2")                // Haven't emailed yet
                ) {
                     emailToSend = {
                        subject: tenant.emailSubject2 || "Keep going",
                        body: tenant.emailBody2 || "Invite your team now.",
                        tag: "nudge_step2"
                    };
                }

                // --- LOGIC 3: THE 24-HOUR STEP 3 NUDGE ---
                else if (
                    stepsCompleted.includes(step2Event) &&           // Passed Step 2
                    !stepsCompleted.includes(step3Event) &&          // Stuck at Step 3
                    user.createdAt && user.createdAt < twentyFourHoursAgo && 
                    !hasReceived(user, "nudge_step3")
                ) {
                     emailToSend = {
                        subject: tenant.emailSubject3 || "Almost there",
                        body: tenant.emailBody3 || "Upgrade to Pro.",
                        tag: "nudge_step3"
                    };
                }

                // 🚀 SEND IF MATCHED
                if (emailToSend) {
                    try {
                        console.log(`🚀 Sending [${emailToSend.tag}] to ${user.email}`);
                        
                        await resend.emails.send({
                            from: 'Acme <onboarding@resend.dev>',
                            to: [user.email],
                            subject: emailToSend.subject,
                            text: emailToSend.body.replace("{{name}}", user.email.split('@')[0]),
                        });

                        // UPDATE USER RECORD
                        // We append the tag to 'automationsReceived' so we never send this again
                        const newTags = [...(user.automationsReceived || []), emailToSend.tag];
                        
                        await db.update(endUsers)
                            .set({ 
                                automationsReceived: newTags,
                                lastEmailedAt: new Date()
                            })
                            .where(eq(endUsers.id, user.id));

                        emailsSent++;

                    } catch (err) {
                        console.error(`Failed to send to ${user.email}`, err);
                    }
                }
            }
        }

        return NextResponse.json({ success: true, emailsSent });
    } catch (error) {
        console.error("Cron Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}