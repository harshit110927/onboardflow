import { db } from "@/db";
import { endUsers, tenants } from "@/db/schema";
import { eq, and, isNull, lt } from "drizzle-orm"; 
import { NextResponse } from "next/server";
import { Resend } from 'resend';

// Helper to make it crash-proof
const getResend = () => {
    if (process.env.RESEND_API_KEY) return new Resend(process.env.RESEND_API_KEY);
    return null;
}

const NUDGE_EMAIL = (userId: string, stepName: string) => `
  <div style="font-family: sans-serif; max-width: 600px;">
    <h2>Hey, are you stuck? 🤔</h2>
    <p>Hi ${userId},</p>
    <p>We noticed you signed up but haven't completed the <b>${stepName}</b> step yet.</p>
    <p>This is essential to getting started. Click the link below to finish up!</p>
    <p>- The Team</p>
  </div>
`;

export async function GET(req: Request) {
  const resend = getResend();
  if (!resend) return NextResponse.json({ error: "Resend Key Missing" }, { status: 500 });

  // 1. Rule: "Stuck" means they joined > 1 minute ago
  const ONE_MINUTE_AGO = new Date(Date.now() - 1 * 60 * 1000); 

  // 2. Find Candidates (Old enough + Never emailed)
  // We explicitly fetch the tenantId so we can look up settings
  const candidates = await db.query.endUsers.findMany({
    where: and(
        lt(endUsers.createdAt, ONE_MINUTE_AGO), 
        isNull(endUsers.lastEmailedAt)          
    )
  });

  let emailsSent = 0;

  for (const user of candidates) {
    if (!user.tenantId || !user.email) continue;

    // 3. Get the Founder's Config (What is the Goal?)
    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId)
    });

    // If Founder hasn't set a goal, we can't check it.
    if (!tenant || !tenant.activationStep) {
        console.log(`Skipping ${user.externalId}: Founder hasn't defined an activation step.`);
        continue;
    }

    const requiredStep = tenant.activationStep;
    const completedSteps = (user.completedSteps as string[]) || [];

    // 4. THE CHECK: Did they do the required step?
    if (completedSteps.includes(requiredStep)) {
        continue; // They are good!
    }

    // 5. They failed! Send Nudge.
    try {
        console.log(`⚠️ User ${user.externalId} stuck on '${requiredStep}'. Sending Nudge...`);
        
        await resend.emails.send({
            from: 'OnboardFlow <onboarding@resend.dev>',
            to: user.email, 
            subject: 'Quick question...',
            html: NUDGE_EMAIL(user.externalId, requiredStep),
        });

        // 6. Mark as emailed
        await db.update(endUsers)
            .set({ lastEmailedAt: new Date() })
            .where(eq(endUsers.id, user.id));

        emailsSent++;
    } catch (err) {
        console.error("Failed to send nudge:", err);
    }
  }

  return NextResponse.json({ 
    success: true, 
    candidatesFound: candidates.length,
    emailsSent: emailsSent 
  });
}