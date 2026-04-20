import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { contactTags, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tags = await db
      .select()
      .from(contactTags)
      .where(eq(contactTags.tenantId, tenant.id))
      .orderBy(asc(contactTags.name));

    return NextResponse.json(tags);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { name, color } = await req.json();
    const trimmedName = String(name ?? "").trim();
    if (!trimmedName || trimmedName.length > 50) {
      return NextResponse.json({ error: "Tag name must be 1–50 characters" }, { status: 400 });
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(String(color ?? ""))) {
      return NextResponse.json({ error: "Invalid color format" }, { status: 400 });
    }

    try {
      const inserted = await db
        .insert(contactTags)
        .values({ tenantId: tenant.id, name: trimmedName, color })
        .returning();

      return NextResponse.json(inserted[0], { status: 201 });
    } catch (error) {
      const maybePgError = error as { code?: string; message?: string };
      if (maybePgError.code === "23505" || maybePgError.message?.toLowerCase().includes("duplicate")) {
        return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
