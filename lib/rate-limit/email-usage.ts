import { sql } from "drizzle-orm";

import { db } from "@/db";

export async function getMonthlyEmailUsage(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  await db.execute(sql`
    INSERT INTO email_usage (tenant_id, date, month, daily_count, monthly_count)
    VALUES (${tenantId}, ${today}, ${month}, 0, 0)
    ON CONFLICT (tenant_id, date) DO NOTHING
  `);

  const usageRows = await db.execute(sql`
    SELECT COALESCE(SUM(daily_count), 0) AS monthly_count
    FROM email_usage
    WHERE tenant_id = ${tenantId} AND month = ${month}
  `);

  const row = Array.isArray(usageRows)
    ? usageRows[0]
    : (usageRows as any)?.rows?.[0];

  return Number((row as any)?.monthly_count ?? 0);
}

export async function incrementEmailUsage(tenantId: string, incrementBy = 1) {
  if (incrementBy <= 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  await db.execute(sql`
    INSERT INTO email_usage (tenant_id, date, month, daily_count, monthly_count)
    VALUES (${tenantId}, ${today}, ${month}, ${incrementBy}, ${incrementBy})
    ON CONFLICT (tenant_id, date)
    DO UPDATE SET
      daily_count = email_usage.daily_count + ${incrementBy},
      monthly_count = email_usage.monthly_count + ${incrementBy}
  `);
}
