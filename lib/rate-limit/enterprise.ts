// NEW FILE — enterprise email rate limiting
import { db } from "@/db";
import { sql } from "drizzle-orm";

const DAILY_LIMIT = 20;
const MONTHLY_LIMIT = 300;
const END_USER_LIMIT = 50;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export async function checkEmailRateLimit(
  tenantId: string
): Promise<RateLimitResult> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    // Upsert the row for today
    await db.execute(sql`
      INSERT INTO email_usage (tenant_id, date, month, daily_count, monthly_count)
      VALUES (${tenantId}, ${today}, ${month}, 0, 0)
      ON CONFLICT (tenant_id, date) DO NOTHING
    `);

    // Read current counts separately
    const rows = await db.execute(sql`
      SELECT
        daily_count,
        (
          SELECT COALESCE(SUM(daily_count), 0)
          FROM email_usage
          WHERE tenant_id = ${tenantId}
          AND month = ${month}
        ) AS monthly_count
      FROM email_usage
      WHERE tenant_id = ${tenantId}
      AND date = ${today}
    `);

    const row = rows[0] as {
      daily_count: number;
      monthly_count: number;
    };

    if (!row) return { allowed: true };

    if (Number(row.daily_count) >= DAILY_LIMIT) {
      return {
        allowed: false,
        reason: `Daily email limit reached (${DAILY_LIMIT}/day). OnboardFlow currently offers up to ${DAILY_LIMIT} automated emails per day and ${MONTHLY_LIMIT} per month per account. Once we hit 500 users we'll roll out a paid plan with higher limits — you'll be the first to know.`,
      };
    }

    if (Number(row.monthly_count) >= MONTHLY_LIMIT) {
      return {
        allowed: false,
        reason: `Monthly email limit reached (${MONTHLY_LIMIT}/month). OnboardFlow currently offers up to ${MONTHLY_LIMIT} automated emails per month per account. Once we hit 500 users we'll roll out a paid plan with higher limits — you'll be the first to know.`,
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Server error checking rate limit." };
  }
}

export async function incrementEmailCount(tenantId: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    await db.execute(sql`
      INSERT INTO email_usage (tenant_id, date, month, daily_count, monthly_count)
      VALUES (${tenantId}, ${today}, ${month}, 1, 1)
      ON CONFLICT (tenant_id, date)
      DO UPDATE SET
        daily_count = email_usage.daily_count + 1,
        monthly_count = (
          SELECT COALESCE(SUM(daily_count), 0) + 1
          FROM email_usage
          WHERE tenant_id = ${tenantId}
          AND month = ${month}
          AND date != ${today}
        ) + 1
    `);
  } catch (err) {
    console.error("Failed to increment email count", err);
  }
}

export async function checkEndUserLimit(
  tenantId: string,
  currentCount: number
): Promise<RateLimitResult> {
  if (currentCount >= END_USER_LIMIT) {
    return {
      allowed: false,
      reason: `End user tracking limit reached (${END_USER_LIMIT} users). OnboardFlow currently tracks up to ${END_USER_LIMIT} users per account for free. Once we hit 500 users we'll roll out a paid plan with higher limits — you'll be the first to know.`,
    };
  }
  return { allowed: true };
}