import { and, eq, inArray, max } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  campaignEvents,
  contactTagAssignments,
  contactTags,
  individualContacts,
  individualLists,
  tenants,
} from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

const STAGES = ["new", "contacted", "replied", "closed"] as const;
type Stage = (typeof STAGES)[number];

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const url = new URL(req.url);
    const listIdParam = url.searchParams.get("listId");
    let parsedListId: number | null = null;

    if (listIdParam !== null) {
      parsedListId = Number.parseInt(listIdParam, 10);
      if (Number.isNaN(parsedListId)) {
        return NextResponse.json({ error: "Invalid listId" }, { status: 400 });
      }

      const list = await db
        .select({ id: individualLists.id })
        .from(individualLists)
        .where(and(eq(individualLists.id, parsedListId), eq(individualLists.userId, tenant.id)))
        .limit(1);

      if (!list[0]) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
    }

    const contacts = await db
      .select({
        id: individualContacts.id,
        name: individualContacts.name,
        email: individualContacts.email,
        phone: individualContacts.phone,
        customFields: individualContacts.customFields,
        pipelineStage: individualContacts.pipelineStage,
        followUpAt: individualContacts.followUpAt,
        followUpSent: individualContacts.followUpSent,
      })
      .from(individualContacts)
      .innerJoin(individualLists, eq(individualContacts.listId, individualLists.id))
      .where(
        parsedListId
          ? and(eq(individualLists.userId, tenant.id), eq(individualLists.id, parsedListId))
          : eq(individualLists.userId, tenant.id),
      );

    const contactIds = contacts.map((contact) => contact.id);
    const emails = contacts.map((contact) => contact.email);

    const [tags, activityRows, lists] = await Promise.all([
      contactIds.length
        ? db
            .select({
              contactId: contactTagAssignments.contactId,
              id: contactTags.id,
              name: contactTags.name,
              color: contactTags.color,
            })
            .from(contactTagAssignments)
            .innerJoin(contactTags, eq(contactTagAssignments.tagId, contactTags.id))
            .where(inArray(contactTagAssignments.contactId, contactIds))
        : Promise.resolve([]),
      emails.length
        ? db
            .select({
              email: campaignEvents.contactEmail,
              lastActivity: max(campaignEvents.occurredAt),
            })
            .from(campaignEvents)
            .where(inArray(campaignEvents.contactEmail, emails))
            .groupBy(campaignEvents.contactEmail)
        : Promise.resolve([]),
      db
        .select({ id: individualLists.id, name: individualLists.name })
        .from(individualLists)
        .where(eq(individualLists.userId, tenant.id)),
    ]);

    const tagsMap = new Map<number, { id: number; name: string; color: string }[]>();
    for (const row of tags) {
      const current = tagsMap.get(row.contactId) ?? [];
      current.push({ id: row.id, name: row.name, color: row.color ?? "#6366f1" });
      tagsMap.set(row.contactId, current);
    }

    const activityMap = new Map<string, Date | null>();
    for (const row of activityRows) {
      activityMap.set(row.email, row.lastActivity);
    }

    const grouped: Record<Stage, any[]> = {
      new: [],
      contacted: [],
      replied: [],
      closed: [],
    };

    for (const contact of contacts) {
      const rawStage = String(contact.pipelineStage ?? "new") as Stage;
      const stage: Stage = STAGES.includes(rawStage) ? rawStage : "new";
      grouped[stage].push({
        ...contact,
        customFields: (contact.customFields ?? {}) as Record<string, string>,
        followUpSent: Boolean(contact.followUpSent),
        tags: tagsMap.get(contact.id) ?? [],
        lastActivity: activityMap.get(contact.email) ?? null,
      });
    }

    return NextResponse.json({
      new: grouped.new,
      contacted: grouped.contacted,
      replied: grouped.replied,
      closed: grouped.closed,
      lists,
    });
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

    const { contactId: rawId, stage } = await req.json();
    const contactId = Number.parseInt(String(rawId), 10);
    if (Number.isNaN(contactId)) {
      return NextResponse.json({ error: "Invalid contactId" }, { status: 400 });
    }

    if (!STAGES.includes(stage)) {
      return NextResponse.json(
        { error: "Invalid stage. Must be one of: new, contacted, replied, closed" },
        { status: 400 },
      );
    }

    const contact = await db
      .select({ id: individualContacts.id })
      .from(individualContacts)
      .innerJoin(individualLists, eq(individualContacts.listId, individualLists.id))
      .where(and(eq(individualLists.userId, tenant.id), eq(individualContacts.id, contactId)))
      .limit(1);

    if (!contact[0]) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    await db
      .update(individualContacts)
      .set({ pipelineStage: stage })
      .where(eq(individualContacts.id, contactId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
