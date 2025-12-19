import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { format, subDays, isSameDay } from "date-fns";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Get Tenant Settings
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.email, user.email!)
  });
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  // 2. Fetch ALL Users 
  const allUsers = await db.query.endUsers.findMany({
      where: eq(endUsers.tenantId, tenant.id),
      orderBy: [desc(endUsers.createdAt)], // Newest first
      limit: 100 // Limit for the table view
  });

  // --- METRIC 1: TOTALS ---
  const totalUsers = allUsers.length;
  // Use settings or defaults
  const step1Name = tenant.activationStep || "connect_repo";
  const step2Name = tenant.step2;
  const step3Name = tenant.step3;

  // --- METRIC 2: FUNNEL COUNTS ---
  const step1Count = allUsers.filter(u => (u.completedSteps as string[]).includes(step1Name)).length;
  const step2Count = step2Name ? allUsers.filter(u => (u.completedSteps as string[]).includes(step2Name)).length : 0;
  const step3Count = step3Name ? allUsers.filter(u => (u.completedSteps as string[]).includes(step3Name)).length : 0;

  // Calculate Percentages relative to Total Users
  const step1Pct = totalUsers > 0 ? Math.round((step1Count / totalUsers) * 100) : 0;
  const step2Pct = totalUsers > 0 ? Math.round((step2Count / totalUsers) * 100) : 0;
  const step3Pct = totalUsers > 0 ? Math.round((step3Count / totalUsers) * 100) : 0;

  const funnelData = [
      { step: "Signup", count: totalUsers, fill: "#94a3b8", percent: 100 },
      { step: "Step 1", count: step1Count, fill: "#3b82f6", percent: step1Pct },
      ...(step2Name ? [{ step: "Step 2", count: step2Count, fill: "#8b5cf6", percent: step2Pct }] : []),
      ...(step3Name ? [{ step: "Step 3", count: step3Count, fill: "#16a34a", percent: step3Pct }] : []),
  ];

  // --- METRIC 3: TRENDS (Last 30 Days) ---
  const trendData = [];
  for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, "MMM dd");
      const daySignups = allUsers.filter(u => 
        u.createdAt && isSameDay(u.createdAt, date)
    ).length;
  
    const dayActivations = allUsers.filter(u => 
      u.createdAt && // 👈 Add this safety check
      isSameDay(u.createdAt, date) && 
      (u.completedSteps as string[]).includes(step1Name)
    ).length;
      trendData.push({ date: dateStr, signups: daySignups, activations: dayActivations });
  }

  // --- METRIC 4: RECOVERY ---
  const recoveredCount = allUsers.filter(u => {
      const steps = u.completedSteps as string[] || [];
      return steps.includes(step1Name) && !!u.lastEmailedAt;
  }).length;

  // --- METRIC 5: USER PROGRESS MATRIX (Checkbox Data) ---
  const userMatrix = allUsers.slice(0, 20).map(u => {
      const steps = u.completedSteps as string[] || [];
      return {
          email: u.email,
          step1: steps.includes(step1Name),
          step2: step2Name ? steps.includes(step2Name) : null,
          step3: step3Name ? steps.includes(step3Name) : null,
          lastSeen: u.lastSeenAt
      };
  });

  return NextResponse.json({
      totalUsers,
      activeUsers: step1Count, // "Active" usually means they did Step 1
      funnelData,
      trendData,
      recoveryData: { recovered: recoveredCount, organic: step1Count - recoveredCount },
      userMatrix // 👈 Sending the table data
  });
}