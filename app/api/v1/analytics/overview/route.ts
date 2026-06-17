import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.email, user.email!)
  });
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  // 1. Fetch all users for in-memory Activation & Rescue rate calculations (safest & matches existing pattern)
  const allUsers = await db.query.endUsers.findMany({
    where: eq(tenants.id, tenant.id)
  });

  const activationStep = tenant.activationStep || "connect_repo";
  const totalUsers = allUsers.length;
  const activatedUsers = allUsers.filter(u => ((u.completedSteps as string[]) || []).includes(activationStep)).length;
  const activationRate = totalUsers > 0 ? Math.round((activatedUsers / totalUsers) * 100) : 0;

  const emailedUsers = allUsers.filter(u => u.lastEmailedAt);
  const now = new Date();
  const rescuedUsers = emailedUsers.filter(u => {
    if (!u.lastSeenAt || !u.lastEmailedAt) return false;
    const emailedAgo = now.getTime() - u.lastEmailedAt.getTime();
    const hoursAgo = emailedAgo / (1000 * 60 * 60);
    // User returned after email, and email was sent within last 72 hours
    return u.lastSeenAt > u.lastEmailedAt && hoursAgo <= 72;
  }).length;
  const rescueRate = emailedUsers.length > 0 ? Math.round((rescuedUsers / emailedUsers.length) * 100) : 0;

  // 2. Revenue at Risk (Using SQL CASE statement per requirements)
  const riskRevRes: any = await db.execute(sql`
    WITH LatestRisk AS (
      SELECT end_user_id, primary_risk_label,
             ROW_NUMBER() OVER(PARTITION BY end_user_id ORDER BY captured_at DESC) as rn
      FROM risk_snapshots
      WHERE tenant_id = ${tenant.id}
    )
    SELECT SUM(
      CASE 
        WHEN eu.properties->>'plan' = 'pro' THEN 199
        WHEN eu.properties->>'plan' = 'growth' THEN 79
        WHEN eu.properties->>'plan' = 'starter' THEN 29
        WHEN eu.properties->>'plan' = 'free' THEN 0
        ELSE 0
      END
    ) as total_risk
    FROM end_users eu
    JOIN LatestRisk lr ON eu.id = lr.end_user_id AND lr.rn = 1
    WHERE eu.tenant_id = ${tenant.id}
      AND lr.primary_risk_label IN ('GONE_DARK', 'PRE_ACTIVATION_STALL')
  `);
  
  const revenueAtRisk = Number((riskRevRes.rows ? riskRevRes.rows[0] : riskRevRes[0])?.total_risk || 0);

  // 3. Trend Graph: Risk Distribution Over Time
  const trendRes: any = await db.execute(sql`
    SELECT 
      DATE(captured_at) as date,
      primary_risk_label,
      COUNT(*) as count
    FROM risk_snapshots
    WHERE tenant_id = ${tenant.id}
      AND captured_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(captured_at), primary_risk_label
    ORDER BY date ASC
  `);

  const trendMap = new Map<string, any>();
  for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      trendMap.set(dateStr, { date: formattedDate, GONE_DARK: 0, COOLING: 0, PRE_ACTIVATION_STALL: 0, POST_ACTIVATION_STALL: 0, EMAIL_NON_RESPONSIVE: 0, NEVER_STARTED: 0 });
  }

  const trendRows = trendRes.rows ? trendRes.rows : trendRes;
  for (const row of trendRows) {
    const d = new Date(row.date as string);
    const dateStr = d.toISOString().split('T')[0];
    const label = row.primary_risk_label as string;
    const count = Number(row.count || 0);
    
    if (trendMap.has(dateStr)) {
      trendMap.get(dateStr)[label] = count;
    }
  }

  const riskTrendData = Array.from(trendMap.values());

  return NextResponse.json({
    activationRate,
    revenueAtRisk,
    rescueRate,
    riskTrendData
  });
}
