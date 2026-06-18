import { db } from "@/db";
import { unsubscribedContacts } from "@/db/schema";
import { eq } from "drizzle-orm";

export type GuardUser = {
  email: string | null;
  lastEmailedAt: Date | null;
  automationsReceived: string[] | null;
};

export async function shouldSendAutomation(
  user: GuardUser,
  targetRiskLabel: string
): Promise<boolean> {
  const now = new Date();

  // 1. Ensure we actually have an email to send to
  if (!user.email) {
    return false;
  }

  // 2. Unsubscribed check
  const unsubscribed = await db.query.unsubscribedContacts.findFirst({
    where: eq(unsubscribedContacts.email, user.email),
  });
  if (unsubscribed) {
    return false;
  }

  // 3. last_emailed_at is < 5 days ago check (cooldown period)
  if (user.lastEmailedAt) {
    const daysSinceEmail = (now.getTime() - user.lastEmailedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEmail < 5) {
      return false;
    }
  }

  // 4. automations_received > 4 in the last 30 days check
  // The automationsReceived array normally stores ISO timestamp strings in a robust implementation.
  // We parse them to enforce the rolling 30-day window limit.
  const automations = user.automationsReceived || [];
  let recentAutomations = 0;
  
  for (const automationStr of automations) {
    const parsedDate = new Date(automationStr);
    if (!Number.isNaN(parsedDate.getTime())) {
      const daysSince = (now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 30) {
        recentAutomations++;
      }
    } else {
      // Fallback: if they are unparseable strings, we just count them 
      // to ensure we still enforce the hard limit of 4.
      recentAutomations++;
    }
  }

  if (recentAutomations > 4) {
    return false;
  }

  return true;
}
