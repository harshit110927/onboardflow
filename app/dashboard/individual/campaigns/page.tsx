import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { campaignEvents, individualCampaigns, individualContacts, individualLists } from "@/db/schema";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { DeleteCampaignButton } from "./_components/DeleteCampaignButton";
import { CampaignComposer } from "./_components/CampaignComposer";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";

async function deleteCampaign(formData: FormData) {
  "use server";
  const campaignId = Number(formData.get("campaignId"));
  if (!campaignId) return;

  const { user } = await getSession();
  if (!user?.email) return;

  const tenant = await getTenant(user.email);
  if (!tenant) return;

  const owned = await db
    .select({ id: individualCampaigns.id })
    .from(individualCampaigns)
    .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
    .where(and(eq(individualCampaigns.id, campaignId), eq(individualLists.userId, tenant.id)))
    .limit(1);
  if (!owned[0]) return;

  await db.delete(individualCampaigns).where(eq(individualCampaigns.id, campaignId));
  revalidatePath("/dashboard/individual/campaigns");
}

async function createCampaign(formData: FormData) {
  "use server";

  const listId = Number(formData.get("listId"));
  const subject = (formData.get("subject") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const scheduledAtRaw = (formData.get("scheduledAt") as string)?.trim();
  const intent = (formData.get("intent") as string) ?? "draft";

  if (!listId || !subject || !body) return;

  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const ownedList = await db
    .select({ id: individualLists.id })
    .from(individualLists)
    .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenant.id)))
    .limit(1);

  if (!ownedList[0]) return;

  const shouldSchedule = intent === "schedule" && !!scheduledAtRaw;

  const inserted = await db
    .insert(individualCampaigns)
    .values({
      listId,
      subject,
      body,
      status: shouldSchedule ? "scheduled" : "draft",
      scheduledAt: shouldSchedule ? new Date(scheduledAtRaw) : null,
    })
    .returning({ id: individualCampaigns.id });

  const createdId = inserted[0]?.id;
  revalidatePath("/dashboard/individual/campaigns");

  if (intent === "send_now" && createdId) {
    redirect(`/dashboard/individual/campaigns/${createdId}`);
  }

  redirect("/dashboard/individual/campaigns");
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-secondary text-muted-foreground",
    scheduled: "bg-blue-100 text-blue-700",
    sent: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default async function CampaignsPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const { plan } = await getTenantPlan(tenant.id);
  const trackingEnabled = INDIVIDUAL_LIMITS[plan as PlanTier].trackingEnabled;

  const [campaigns, lists, listContacts] = await Promise.all([
    db
      .select({
        id: individualCampaigns.id,
        subject: individualCampaigns.subject,
        status: individualCampaigns.status,
        createdAt: individualCampaigns.createdAt,
        sentAt: individualCampaigns.sentAt,
        listId: individualCampaigns.listId,
        listName: individualLists.name,
      })
      .from(individualCampaigns)
      .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
      .where(eq(individualLists.userId, tenant.id))
      .orderBy(desc(individualCampaigns.createdAt)),

    db
      .select({ id: individualLists.id, name: individualLists.name })
      .from(individualLists)
      .where(eq(individualLists.userId, tenant.id)),

    db
      .select({
        listId: individualContacts.listId,
        name: individualContacts.name,
        email: individualContacts.email,
      })
      .from(individualContacts)
      .innerJoin(individualLists, eq(individualContacts.listId, individualLists.id))
      .where(eq(individualLists.userId, tenant.id)),
  ]);

  const listContactsMap = new Map<number, Array<{ name: string; email: string }>>();
  for (const c of listContacts) {
    if (!listContactsMap.has(c.listId)) listContactsMap.set(c.listId, []);
    listContactsMap.get(c.listId)!.push({ name: c.name, email: c.email });
  }

  const composerLists = lists.map((list) => {
    const contacts = listContactsMap.get(list.id) ?? [];
    return {
      id: list.id,
      name: list.name,
      totalContacts: contacts.length,
      previewContacts: contacts.slice(0, 3),
    };
  });

  const campaignIds = campaigns.map((c) => c.id);
  const analyticsRows = trackingEnabled && campaignIds.length > 0
    ? await db
      .select({
        campaignId: campaignEvents.campaignId,
        total: sql<number>`count(distinct ${campaignEvents.contactEmail})`,
      })
      .from(campaignEvents)
      .where(
        and(
          inArray(campaignEvents.campaignId, campaignIds),
          eq(campaignEvents.eventType, "open"),
        ),
      )
      .groupBy(campaignEvents.campaignId)
    : [];

  const analyticsMap = new Map<number, { opens: number }>();
  for (const row of analyticsRows) {
    analyticsMap.set(row.campaignId, { opens: Number(row.total) });
  }

  const contactCountByList = new Map<number, number>();
  for (const [listId, entries] of listContactsMap.entries()) {
    contactCountByList.set(listId, entries.length);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-1">Write, schedule and track your email campaigns.</p>
          </div>
        </div>

        {lists.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="font-semibold text-foreground">No email lists yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              You need at least one list before creating a campaign.
            </p>
            <Link
              href="/dashboard/individual/lists/new"
              className="mt-4 inline-block text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Create a List First
            </Link>
          </div>
        ) : (
          <CampaignComposer lists={composerLists} aiEnabled={INDIVIDUAL_LIMITS[plan as PlanTier].aiEnabled} createAction={createCampaign} />
        )}

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">All campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No campaigns yet.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/70 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase tracking-wide text-xs">Subject</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase tracking-wide text-xs">List</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase tracking-wide text-xs">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase tracking-wide text-xs">Opens</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase tracking-wide text-xs">Date</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase tracking-wide text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const date = (c.sentAt ?? c.createdAt)?.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const contactsInList = contactCountByList.get(c.listId) ?? 0;
                    const metrics = analyticsMap.get(c.id) ?? { opens: 0 };
                    const openPct = contactsInList > 0
                      ? Math.min(100, Math.round((metrics.opens / contactsInList) * 100))
                      : 0;

                    return (
                      <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                        <td className="px-4 py-3 text-foreground font-medium">{c.subject}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.listName}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-foreground">
                          {c.status === "sent" && trackingEnabled ? `${openPct}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{date}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/individual/campaigns/${c.id}`}
                              className="text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-secondary transition-colors"
                            >
                              View
                            </Link>
                            {c.status === "draft" && (
                              <DeleteCampaignButton
                                campaignId={c.id}
                                campaignSubject={c.subject}
                                deleteAction={deleteCampaign}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
