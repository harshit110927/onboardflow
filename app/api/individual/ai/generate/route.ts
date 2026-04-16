import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { tenants, aiUsage } from "@/db/schema";
import { eq, count, and, gte } from "drizzle-orm";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";
import { generateCampaign } from "@/lib/ai/generate-campaign";
import type { CampaignTone, CampaignType } from "@/lib/ai/generate-campaign";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantRows = await db
      .select({ id: tenants.id, tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.email, user.email))
      .limit(1);

    const tenant = tenantRows[0];
    if (!tenant || tenant.tier !== "individual") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const planInfo = await getTenantPlan(tenant.id);
    const limits = INDIVIDUAL_LIMITS[planInfo.plan as PlanTier];

    if (!limits.aiEnabled) {
      return NextResponse.json(
        { error: "AI writing is available on Growth and Pro plans." },
        { status: 403 },
      );
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageRows = await db
      .select({ total: count() })
      .from(aiUsage)
      .where(and(eq(aiUsage.tenantId, tenant.id), gte(aiUsage.generatedAt, startOfMonth)));

    const monthlyUsed = usageRows[0]?.total ?? 0;
    const monthlyLimit = planInfo.plan === "pro" ? 120 : 40;

    if (monthlyUsed >= monthlyLimit) {
      return NextResponse.json(
        { error: `You've used all ${monthlyLimit} AI generations this month.` },
        { status: 429 },
      );
    }

    const { businessDescription, tone, campaignType } = (await req.json()) as {
      businessDescription: string;
      tone: CampaignTone;
      campaignType: CampaignType;
    };

    if (!businessDescription?.trim()) {
      return NextResponse.json({ error: "Business description is required." }, { status: 400 });
    }

    const result = await generateCampaign(businessDescription, tone, campaignType);

    await db.insert(aiUsage).values({
      tenantId: tenant.id,
      tokensUsed: result.tokensUsed,
    });

    return NextResponse.json({ subject: result.subject, body: result.body });
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
