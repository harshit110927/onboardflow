import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { tenants, webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import crypto from "crypto";

async function getEnterpriseTenant(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const rows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = rows[0];
  if (!tenant || tenant.tier !== "enterprise") return null;
  return tenant;
}

export async function GET() {
  try {
    const tenant = await getEnterpriseTenant(new Request("http://localhost"));
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { plan } = await getTenantPlan(tenant.id);
    if (plan !== "advanced") return NextResponse.json({ error: "Webhooks require Advanced plan." }, { status: 403 });

    const rows = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.tenantId, tenant.id));

    return NextResponse.json({ webhooks: rows });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getEnterpriseTenant(req);
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { plan } = await getTenantPlan(tenant.id);
    if (plan !== "advanced") return NextResponse.json({ error: "Webhooks require Advanced plan." }, { status: 403 });

    const existing = await db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(eq(webhooks.tenantId, tenant.id));

    if (existing.length >= 5) {
      return NextResponse.json({ error: "Maximum 5 webhooks allowed." }, { status: 400 });
    }

    const { url, events } = await req.json() as { url: string; events: string[] };

    if (!url || !url.startsWith("https://")) {
      return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "Select at least one event." }, { status: 400 });
    }

    const secret = crypto.randomBytes(32).toString("hex");

    const rows = await db
      .insert(webhooks)
      .values({ tenantId: tenant.id, url, events, secret })
      .returning();

    return NextResponse.json({ webhook: rows[0] });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getEnterpriseTenant(req);
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json() as { id: number };
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await db
      .delete(webhooks)
      .where(eq(webhooks.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}