import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  contactTagAssignments,
  contactTags,
  individualContacts,
  individualLists,
  tenants,
} from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

async function verifyContactOwnership(contactId: number, tenantId: string) {
  const rows = await db
    .select({ id: individualContacts.id })
    .from(individualContacts)
    .innerJoin(individualLists, eq(individualContacts.listId, individualLists.id))
    .where(and(eq(individualContacts.id, contactId), eq(individualLists.userId, tenantId)))
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

    const { id } = await params;
    const contactId = Number.parseInt(id, 10);
    if (Number.isNaN(contactId)) {
      return NextResponse.json({ error: "Invalid contact id" }, { status: 400 });
    }

    const owned = await verifyContactOwnership(contactId, tenant.id);
    if (!owned) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
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
      .insert(contactTagAssignments)
      .values({ contactId, tagId: parsedTagId })
      .onConflictDoNothing({ target: [contactTagAssignments.contactId, contactTagAssignments.tagId] });

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

    const { id } = await params;
    const contactId = Number.parseInt(id, 10);
    if (Number.isNaN(contactId)) {
      return NextResponse.json({ error: "Invalid contact id" }, { status: 400 });
    }

    const owned = await verifyContactOwnership(contactId, tenant.id);
    if (!owned) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const { tagId } = await req.json();
    const parsedTagId = Number.parseInt(String(tagId), 10);
    if (Number.isNaN(parsedTagId)) {
      return NextResponse.json({ error: "Invalid tagId" }, { status: 400 });
    }

    await db
      .delete(contactTagAssignments)
      .where(and(eq(contactTagAssignments.contactId, contactId), eq(contactTagAssignments.tagId, parsedTagId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
