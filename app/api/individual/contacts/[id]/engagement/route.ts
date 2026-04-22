import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  campaignEvents,
  individualCampaigns,
  individualContacts,
  individualLists,
  tenants,
} from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

type EngagementItem = {
  campaignId: number;
  subject: string;
  sentAt: Date;
  opened: boolean;
  clicked: boolean;
  lastActivity: Date;
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

    const events = await db
      .select({
        campaignId: campaignEvents.campaignId,
        eventType: campaignEvents.eventType,
        occurredAt: campaignEvents.occurredAt,
        subject: individualCampaigns.subject,
        createdAt: individualCampaigns.createdAt,
        sentAt: individualCampaigns.sentAt,
      })
      .from(campaignEvents)
      .innerJoin(individualCampaigns, eq(campaignEvents.campaignId, individualCampaigns.id))
      .where(eq(campaignEvents.contactEmail, contact.email))
      .orderBy(desc(campaignEvents.occurredAt));

    const grouped = new Map<number, EngagementItem>();

    for (const event of events) {
      const occurredAt = event.occurredAt ?? event.sentAt ?? event.createdAt ?? new Date();
      const existing = grouped.get(event.campaignId) ?? {
        campaignId: event.campaignId,
        subject: event.subject,
        sentAt: event.sentAt ?? event.createdAt ?? occurredAt,
        opened: false,
        clicked: false,
        lastActivity: occurredAt,
      };

      if (event.eventType === "sent") {
        existing.sentAt = event.occurredAt ?? existing.sentAt;
      }
      if (event.eventType === "opened" || event.eventType === "open") {
        existing.opened = true;
      }
      if (event.eventType === "clicked" || event.eventType === "click") {
        existing.clicked = true;
      }

      if (occurredAt.getTime() > existing.lastActivity.getTime()) {
        existing.lastActivity = occurredAt;
      }

      grouped.set(event.campaignId, existing);
    }

    const engagement = Array.from(grouped.values()).sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
    );

    return NextResponse.json(engagement);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
