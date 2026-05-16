import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  campaignEvents,
  contactNotes,
  contactTagAssignments,
  contactTags,
  individualCampaigns,
  individualContacts,
  individualLists,
  tenants,
} from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

type TimelineItem = {
  type: string;
  description: string;
  occurredAt: Date;
  metadata?: Record<string, string>;
};

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

    const ownedContact = await db
      .select({ id: individualContacts.id, email: individualContacts.email })
      .from(individualContacts)
      .innerJoin(individualLists, eq(individualContacts.listId, individualLists.id))
      .where(and(eq(individualContacts.id, contactId), eq(individualLists.userId, tenant.id)))
      .limit(1);

    const contact = ownedContact[0];
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const [events, notes, assignments] = await Promise.all([
      db
        .select({
          eventType: campaignEvents.eventType,
          occurredAt: campaignEvents.occurredAt,
          subject: individualCampaigns.subject,
        })
        .from(campaignEvents)
        .innerJoin(individualCampaigns, eq(campaignEvents.campaignId, individualCampaigns.id))
        .where(eq(campaignEvents.contactEmail, contact.email))
        .orderBy(desc(campaignEvents.occurredAt)),
      db
        .select({ body: contactNotes.body, createdAt: contactNotes.createdAt })
        .from(contactNotes)
        .where(eq(contactNotes.contactId, contactId))
        .orderBy(desc(contactNotes.createdAt)),
      db
        .select({ assignedAt: contactTagAssignments.assignedAt, name: contactTags.name })
        .from(contactTagAssignments)
        .innerJoin(contactTags, eq(contactTagAssignments.tagId, contactTags.id))
        .where(eq(contactTagAssignments.contactId, contactId)),
    ]);

    const mappedEvents: TimelineItem[] = events
      .map((event) => {
        if (!event.occurredAt) return null;
        if (event.eventType === "sent") {
          return {
            type: "email_sent",
            description: `Email sent: "${event.subject}"`,
            occurredAt: event.occurredAt,
          };
        }
        if (event.eventType === "opened" || event.eventType === "open") {
          return {
            type: "email_opened",
            description: `Email opened: "${event.subject}"`,
            occurredAt: event.occurredAt,
          };
        }
        if (event.eventType === "clicked" || event.eventType === "click") {
          return {
            type: "email_clicked",
            description: `Clicked link in "${event.subject}"`,
            occurredAt: event.occurredAt,
          };
        }
        return null;
      })
      .filter((item): item is TimelineItem => Boolean(item));

    const mappedNotes: TimelineItem[] = notes
      .filter((note) => Boolean(note.createdAt))
      .map((note) => ({
        type: "note_added",
        description: `Note: "${note.body.slice(0, 60)}${note.body.length > 60 ? "..." : ""}"`,
        occurredAt: note.createdAt!,
      }));

    const mappedAssignments: TimelineItem[] = assignments
      .filter((assignment) => Boolean(assignment.assignedAt))
      .map((assignment) => ({
        type: "tag_assigned",
        description: `Tagged: ${assignment.name}`,
        occurredAt: assignment.assignedAt!,
      }));

    const timeline = [...mappedEvents, ...mappedNotes, ...mappedAssignments].sort(
      (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
    );

    return NextResponse.json(timeline);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
