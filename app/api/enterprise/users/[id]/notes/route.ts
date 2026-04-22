import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { endUserNotes, endUsers, tenants } from "@/db/schema";
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const notes = await db
      .select()
      .from(endUserNotes)
      .where(eq(endUserNotes.endUserId, endUserId))
      .orderBy(desc(endUserNotes.createdAt));

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

    const { id: endUserId } = await params;
    if (!endUserId || !isUuid(endUserId)) {
      return NextResponse.json({ error: "Invalid end user id" }, { status: 400 });
    }

    const owned = await verifyEndUserOwnership(endUserId, tenant.id);
    if (!owned) {
      return NextResponse.json({ error: "End user not found" }, { status: 404 });
    }

    const { body } = await req.json();
    const trimmedBody = String(body ?? "").trim();
    if (!trimmedBody) {
      return NextResponse.json({ error: "Note body cannot be empty" }, { status: 400 });
    }

    const inserted = await db
      .insert(endUserNotes)
      .values({ endUserId, tenantId: tenant.id, body: trimmedBody })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { noteId, body } = await req.json();
    const parsedNoteId = Number.parseInt(String(noteId), 10);
    if (Number.isNaN(parsedNoteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
    }

    const noteRows = await db
      .select()
      .from(endUserNotes)
      .where(and(eq(endUserNotes.id, parsedNoteId), eq(endUserNotes.tenantId, tenant.id)))
      .limit(1);

    if (!noteRows[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const trimmedBody = String(body ?? "").trim();
    if (!trimmedBody) {
      return NextResponse.json({ error: "Note body cannot be empty" }, { status: 400 });
    }

    const updated = await db
      .update(endUserNotes)
      .set({ body: trimmedBody, updatedAt: new Date() })
      .where(eq(endUserNotes.id, parsedNoteId))
      .returning();

    return NextResponse.json(updated[0]);
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

    const { noteId } = await req.json();
    const parsedNoteId = Number.parseInt(String(noteId), 10);
    if (Number.isNaN(parsedNoteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
    }

    const noteRows = await db
      .select({ id: endUserNotes.id })
      .from(endUserNotes)
      .where(and(eq(endUserNotes.id, parsedNoteId), eq(endUserNotes.tenantId, tenant.id)))
      .limit(1);

    if (!noteRows[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await db.delete(endUserNotes).where(eq(endUserNotes.id, parsedNoteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
