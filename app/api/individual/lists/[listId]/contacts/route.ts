import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import {
  contactTagAssignments,
  contactTags,
  individualContacts,
  individualLists,
  tenants,
} from "@/db/schema";
import { validateContactAddition } from "@/lib/rate-limit/individual";
import { createClient } from "@/utils/supabase/server";

const createContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional().nullable(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { listId } = await context.params;
    const parsedListId = Number.parseInt(listId, 10);

    if (Number.isNaN(parsedListId)) {
      return NextResponse.json({ error: "Invalid list id" }, { status: 400 });
    }

    const list = await db
      .select({ id: individualLists.id })
      .from(individualLists)
      .where(
        and(
          eq(individualLists.id, parsedListId),
          eq(individualLists.userId, tenant.id),
        ),
      )
      .limit(1);

    if (!list.length) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const contacts = await db
      .select()
      .from(individualContacts)
      .where(eq(individualContacts.listId, parsedListId))
      .orderBy(asc(individualContacts.createdAt));

    const contactIds = contacts.map((contact) => contact.id);
    const assignments = contactIds.length
      ? await db
          .select({
            contactId: contactTagAssignments.contactId,
            tagId: contactTags.id,
            name: contactTags.name,
            color: contactTags.color,
          })
          .from(contactTagAssignments)
          .innerJoin(contactTags, eq(contactTagAssignments.tagId, contactTags.id))
          .where(inArray(contactTagAssignments.contactId, contactIds))
      : [];

    const tagsByContact = new Map<number, { id: number; name: string; color: string }[]>();
    for (const assignment of assignments) {
      const existing = tagsByContact.get(assignment.contactId) ?? [];
      existing.push({ id: assignment.tagId, name: assignment.name, color: assignment.color });
      tagsByContact.set(assignment.contactId, existing);
    }

    return NextResponse.json({
      contacts: contacts.map((contact) => ({
        ...contact,
        tags: tagsByContact.get(contact.id) ?? [],
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { listId } = await context.params;
    const parsedListId = Number.parseInt(listId, 10);

    if (Number.isNaN(parsedListId)) {
      return NextResponse.json({ error: "Invalid list id" }, { status: 400 });
    }

    const list = await db
      .select({ id: individualLists.id })
      .from(individualLists)
      .where(and(eq(individualLists.id, parsedListId), eq(individualLists.userId, tenant.id)))
      .limit(1);

    if (!list.length) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const parsedBody = createContactSchema.safeParse(await request.json());

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 },
      );
    }

    const rateLimit = await validateContactAddition(parsedListId, tenant.id);

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.reason }, { status: 403 });
    }

    const duplicate = await db
      .select({ id: individualContacts.id })
      .from(individualContacts)
      .where(
        and(
          eq(individualContacts.listId, parsedListId),
          eq(individualContacts.email, parsedBody.data.email),
        ),
      )
      .limit(1);

    if (duplicate.length) {
      return NextResponse.json({ error: "Email already in list" }, { status: 409 });
    }

    const inserted = await db
      .insert(individualContacts)
      .values({
        listId: parsedListId,
        name: parsedBody.data.name,
        email: parsedBody.data.email,
        phone: parsedBody.data.phone?.trim() || null,
      })
      .returning();

    return NextResponse.json({ contact: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
