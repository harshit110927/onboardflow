import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.email, user.email!),
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Use PostgreSQL unnest to get unique completed steps
    const result = await db.execute(sql`
      SELECT DISTINCT unnest(completed_steps) as step
      FROM ${endUsers}
      WHERE tenant_id = ${tenant.id}
    `);

    // Standard SaaS templates for cold start
    const defaultTemplates = [
      "account_created",
      "created_first_project",
      "invited_team_member",
      "connected_repository",
      "published_first_post"
    ];

    const discoveredEvents = result.map((row: any) => row.step as string);
    const combined = Array.from(new Set([...discoveredEvents, ...defaultTemplates]));

    return NextResponse.json({
      events: discoveredEvents,
      templates: defaultTemplates,
      all: combined
    });
  } catch (error) {
    console.error("Events GET Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
