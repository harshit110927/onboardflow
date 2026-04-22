import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { contactTags, endUserTagAssignments, endUsers, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

async function verifyEndUserOwnership(endUserId: string, tenantId: string) {
  const rows = await db
    .select({ id: endUsers.id })
    .from(endUsers)
    .where(and(eq(endUsers.id, endUserId), eq(endUsers.tenantId, tenantId)))
    .limit(1);

  return rows[0];
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { id: endUserId } = await params;
    if (!endUserId || !isUuid(endUserId)) {
      return NextResponse.json({ error: "Invalid end user id" }, { status: 400 });
    }

    const owned = await verifyEndUserOwnership(endUserId, tenant.id);
    if (!owned) {
      return NextResponse.json({ error: "End user not found" }, { status: 404 });
    }

    const { tagId } = await req.json();
    const parsedTagId = Number.parseInt(String(tagId), 10);
    if (Number.isNaN(parsedTagId)) {
      return NextResponse.json({ error: "Invalid tagId" }, { status: 400 });
    }

    const tag = await db
      .select({ id: contactTags.id })
      .from(contactTags)
      .where(and(eq(contactTags.id, parsedTagId), eq(contactTags.tenantId, tenant.id)))
      .limit(1);

    if (!tag[0]) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    await db
      .insert(endUserTagAssignments)
      .values({ endUserId, tagId: parsedTagId })
      .onConflictDoNothing({ target: [endUserTagAssignments.endUserId, endUserTagAssignments.tagId] });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { id: endUserId } = await params;
    if (!endUserId || !isUuid(endUserId)) {
      return NextResponse.json({ error: "Invalid end user id" }, { status: 400 });
    }

    const owned = await verifyEndUserOwnership(endUserId, tenant.id);
    if (!owned) {
      return NextResponse.json({ error: "End user not found" }, { status: 404 });
    }

    const { tagId } = await req.json();
    const parsedTagId = Number.parseInt(String(tagId), 10);
    if (Number.isNaN(parsedTagId)) {
      return NextResponse.json({ error: "Invalid tagId" }, { status: 400 });
    }

    await db
      .delete(endUserTagAssignments)
      .where(and(eq(endUserTagAssignments.endUserId, endUserId), eq(endUserTagAssignments.tagId, parsedTagId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
