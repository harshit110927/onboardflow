import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { individualContacts, individualLists, tenants } from "@/db/schema";
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

    const { followUpAt, followUpNote } = await req.json();
    const parsedDate = new Date(followUpAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    if (parsedDate <= new Date()) {
      return NextResponse.json({ error: "Follow-up date must be in the future" }, { status: 400 });
    }

    const updated = await db
      .update(individualContacts)
      .set({
        followUpAt: parsedDate,
        followUpNote: String(followUpNote ?? "").trim() || null,
        followUpSent: false,
      })
      .where(eq(individualContacts.id, contactId))
      .returning({
        id: individualContacts.id,
        followUpAt: individualContacts.followUpAt,
        followUpNote: individualContacts.followUpNote,
        followUpSent: individualContacts.followUpSent,
      });

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    await db
      .update(individualContacts)
      .set({ followUpAt: null, followUpNote: null, followUpSent: false })
      .where(eq(individualContacts.id, contactId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
