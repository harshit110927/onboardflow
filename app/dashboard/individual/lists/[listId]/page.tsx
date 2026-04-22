import { and, count, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import {
  contactTagAssignments,
  contactTags,
  campaignEvents,
  individualCampaigns,
  individualContacts,
  individualLists,
} from "@/db/schema";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { getIndividualLimits } from "@/lib/plans/limits";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { ContactsManager } from "./_components/ContactsManager";

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ error?: string; imported?: string; skipped?: string; import_error?: string }>;
}) {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const { listId: listIdParam } = await params;
  const sp = await searchParams;
  const listId = Number(listIdParam);
  if (isNaN(listId)) redirect("/dashboard/individual/lists");

  const { plan } = await getTenantPlan(tenant.id);
  const limits = getIndividualLimits(plan ?? "free");
  const MAX_CONTACTS = limits.maxContactsPerList;

  const [listRows, contacts, campaignCount] = await Promise.all([
    db
      .select()
      .from(individualLists)
      .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenant.id)))
      .limit(1),
    db.select().from(individualContacts).where(eq(individualContacts.listId, listId)).orderBy(individualContacts.createdAt),
    db.select({ total: count() }).from(individualCampaigns).where(eq(individualCampaigns.listId, listId)),
  ]);

  const contactIds = contacts.map((contact) => contact.id);
  const assignments = contactIds.length
    ? await db
        .select({ contactId: contactTagAssignments.contactId, id: contactTags.id, name: contactTags.name, color: contactTags.color })
        .from(contactTagAssignments)
        .innerJoin(contactTags, eq(contactTagAssignments.tagId, contactTags.id))
        .where(inArray(contactTagAssignments.contactId, contactIds))
    : [];
  const tagsMap = new Map<number, { id: number; name: string; color: string }[]>();
  for (const assignment of assignments) {
    const current = tagsMap.get(assignment.contactId) ?? [];
    current.push({ id: assignment.id, name: assignment.name, color: assignment.color ?? "#6366f1" });
    tagsMap.set(assignment.contactId, current);
  }

  const list = listRows[0];
  if (!list) redirect("/dashboard/individual/lists");

  const contactEmails = contacts.map((contact) => contact.email);
  const engagementRows = contactEmails.length
    ? await db
        .select({ email: campaignEvents.contactEmail, eventType: campaignEvents.eventType })
        .from(campaignEvents)
        .where(inArray(campaignEvents.contactEmail, contactEmails))
        .orderBy(desc(campaignEvents.occurredAt))
    : [];
  const engagementMap = new Map<string, "opened" | "sent" | null>();
  for (const row of engagementRows) {
    if (engagementMap.has(row.email)) continue;
    if (row.eventType === "opened" || row.eventType === "open" || row.eventType === "clicked" || row.eventType === "click") {
      engagementMap.set(row.email, "opened");
      continue;
    }
    if (row.eventType === "sent") {
      engagementMap.set(row.email, "sent");
      continue;
    }
    engagementMap.set(row.email, null);
  }

  const atLimit = contacts.length >= MAX_CONTACTS;
  const campaigns = campaignCount[0]?.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/individual/lists" className="hover:text-foreground transition-colors">Lists</Link>
          <span>/</span>
          <span className="text-foreground">{list.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{list.name}</h1>
            {list.description && (
              <p className="text-sm text-muted-foreground mt-1">{list.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className={atLimit ? "text-destructive font-medium" : ""}>
                {contacts.length} / {MAX_CONTACTS} contacts
              </span>
              <span>{campaigns} {campaigns === 1 ? "campaign" : "campaigns"}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/dashboard/individual/lists/${list.id}/sequences/new`} className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors">Sequences</Link>
            <Link href={`/dashboard/individual/campaigns/create?listId=${list.id}`} className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity">Send Campaign</Link>
          </div>
        </div>

        {sp.error === "contact_limit" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">You&apos;ve reached this list&apos;s contact limit on your current plan. Remove contacts or upgrade limits to add more.</div>
        )}

        <ContactsManager
          listId={listId}
          initialContacts={contacts.map((contact) => ({ ...contact, createdAt: contact.createdAt?.toISOString(), tags: tagsMap.get(contact.id) ?? [] }))}
          initialEngagement={Object.fromEntries(engagementMap)}
          whatsappTemplate={tenant.whatsappTemplate ?? "Hi {name}, "}
        />

        <div>
          <Link href="/dashboard/individual/lists" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Lists
          </Link>
        </div>

      </div>
    </div>
  );
}
