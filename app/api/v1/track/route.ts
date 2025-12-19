import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 1. Auth Check
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 401 });

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.apiKey, apiKey)
  });
  if (!tenant) return NextResponse.json({ error: "Invalid API Key" }, { status: 403 });

  // 2. Parse Data
  const body = await req.json();
  const { userId, event, stepId } = body; 

  if (!userId || !stepId) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  // 3. Find the User
  const user = await db.query.endUsers.findFirst({
    where: and(
      eq(endUsers.tenantId, tenant.id),
      eq(endUsers.externalId, userId)
    )
  });

  if (!user) return NextResponse.json({ error: "User not found. Call /identify first" }, { status: 404 });

  // 4. Update Progress (Add step if unique)
  const currentSteps = (user.completedSteps as string[]) || [];
  
  if (!currentSteps.includes(stepId)) {
    const newSteps = [...currentSteps, stepId];
    
    await db.update(endUsers)
      .set({ 
        completedSteps: newSteps,
        lastSeenAt: new Date()
      })
      .where(eq(endUsers.id, user.id));
  }

  return NextResponse.json({ success: true, step: stepId });
}