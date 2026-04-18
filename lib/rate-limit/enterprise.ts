import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ENTERPRISE_LIMITS, type EnterprisePlanTier } from "@/lib/plans/limits";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string; isOverage?: boolean };

export async function checkEmailRateLimit(tenantId: string): Promise<RateLimitResult> {
  try {
    const { plan } = await getTenantPlan(tenantId);
    const tier = (plan === "basic" || plan === "advanced" || plan === "free") ? plan : "free";
    const limits = ENTERPRISE_LIMITS[tier as EnterprisePlanTier];

    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    await db.execute(sql`
      INSERT INTO email_usage (tenant_id, date, month, daily_count, monthly_count)
      VALUES (${tenantId}, ${today}, ${month}, 0, 0)
      ON CONFLICT (tenant_id, date) DO NOTHING
    `);

    const rows = await db.execute(sql`
      SELECT (
          SELECT COALESCE(SUM(daily_count), 0)
          FROM email_usage
          WHERE tenant_id = ${tenantId}
          AND month = ${month}
        ) AS monthly_count
      FROM email_usage
      WHERE tenant_id = ${tenantId}
      AND date = ${today}
    `);

    const row = rows[0] as { monthly_count: number };
    if (!row) return { allowed: true };

    if (Number(row.monthly_count) >= limits.maxEmailsPerMonth) {
      return {
        allowed: false,
        reason: `Monthly email limit reached (${limits.maxEmailsPerMonth}/month on ${tier} plan).`,
        isOverage: false,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("checkEmailRateLimit error:", err);
    return { allowed: true }; // fail open — never block emails on infra errors
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
  currentCount: number,
): Promise<RateLimitResult> {
  try {
    const { plan } = await getTenantPlan(tenantId);
    const tier = (plan === "basic" || plan === "advanced" || plan === "free") ? plan : "free";
    const limits = ENTERPRISE_LIMITS[tier as EnterprisePlanTier];

    if (currentCount >= limits.maxTrackedUsers) {
      return {
        allowed: false,
        reason: `End user tracking limit reached (${limits.maxTrackedUsers} users on ${tier} plan).`,
      };
    }
    return { allowed: true };
  } catch (err) {
    console.error("checkEndUserLimit error:", err);
    return { allowed: true }; // fail open — never block tracking on infra errors
  }
}