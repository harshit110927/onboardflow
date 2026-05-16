import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { contactNotes, individualContacts, individualLists, tenants } from "@/db/schema";
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const notes = await db
      .select()
      .from(contactNotes)
      .where(eq(contactNotes.contactId, contactId))
      .orderBy(desc(contactNotes.createdAt));

    return NextResponse.json(notes);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

    const payload = await req.json();
    const trimmedBody = String(payload?.body ?? "").trim();
    if (!trimmedBody) {
      return NextResponse.json({ error: "Note body cannot be empty" }, { status: 400 });
    }

    const inserted = await db
      .insert(contactNotes)
      .values({ contactId, tenantId: tenant.id, body: trimmedBody })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { noteId, body } = await req.json();
    const parsedNoteId = Number.parseInt(String(noteId), 10);
    if (Number.isNaN(parsedNoteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
    }

    const noteRows = await db
      .select()
      .from(contactNotes)
      .where(and(eq(contactNotes.id, parsedNoteId), eq(contactNotes.tenantId, tenant.id)))
      .limit(1);

    const note = noteRows[0];
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const trimmedBody = String(body ?? "").trim();
    if (!trimmedBody) {
      return NextResponse.json({ error: "Note body cannot be empty" }, { status: 400 });
    }

    const updated = await db
      .update(contactNotes)
      .set({ body: trimmedBody, updatedAt: new Date() })
      .where(eq(contactNotes.id, parsedNoteId))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { noteId } = await req.json();
    const parsedNoteId = Number.parseInt(String(noteId), 10);
    if (Number.isNaN(parsedNoteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
    }

    const noteRows = await db
      .select({ id: contactNotes.id })
      .from(contactNotes)
      .where(and(eq(contactNotes.id, parsedNoteId), eq(contactNotes.tenantId, tenant.id)))
      .limit(1);

    if (!noteRows[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await db.delete(contactNotes).where(eq(contactNotes.id, parsedNoteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
