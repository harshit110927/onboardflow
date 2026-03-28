import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { tenants, dripSteps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantRows = await db
      .select({ id: tenants.id, tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.email, user.email))
      .limit(1);

    const tenant = tenantRows[0];
    if (!tenant || tenant.tier !== "enterprise") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const steps = await db
      .select()
      .from(dripSteps)
      .where(eq(dripSteps.tenantId, tenant.id))
      .orderBy(dripSteps.position);

    return NextResponse.json({ steps });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantRows = await db
      .select({ id: tenants.id, tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.email, user.email))
      .limit(1);

    const tenant = tenantRows[0];
    if (!tenant || tenant.tier !== "enterprise") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await getTenantPlan(tenant.id);
    if (plan !== "premium") {
      return NextResponse.json({ error: "Unlimited drip steps require Premium." }, { status: 403 });
    }

    const { steps } = await req.json() as {
      steps: { position: number; eventTrigger: string; emailSubject: string; emailBody: string; delayHours: number }[]
    };

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: "Invalid steps data." }, { status: 400 });
    }

    // Replace all steps for this tenant
    await db.delete(dripSteps).where(eq(dripSteps.tenantId, tenant.id));

    await db.insert(dripSteps).values(
      steps.map((s) => ({
        tenantId: tenant.id,
        position: s.position,
        eventTrigger: s.eventTrigger.trim(),
        emailSubject: s.emailSubject.trim(),
        emailBody: s.emailBody.trim(),
        delayHours: s.delayHours,
      }))
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}