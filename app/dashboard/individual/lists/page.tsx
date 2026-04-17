import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { individualContacts, individualLists, individualCampaigns } from "@/db/schema";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";
import { DeleteListButton } from "./_components/DeleteListButton";

async function deleteList(formData: FormData) {
  "use server";
  const listId = Number(formData.get("listId"));
  if (!listId) return;

  const { user } = await getSession();
  if (!user?.email) return;

  const tenant = await getTenant(user.email);
  if (!tenant) return;

  const owned = await db
    .select({ id: individualLists.id })
    .from(individualLists)
    .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenant.id)))
    .limit(1);
  if (!owned[0]) return;

  await db.delete(individualLists).where(eq(individualLists.id, listId));
  revalidatePath("/dashboard/individual/lists");
}

export default async function ListsPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");
  const { plan } = await getTenantPlan(tenant.id);
  const limits = INDIVIDUAL_LIMITS[plan as PlanTier];
  const MAX_LISTS = limits.maxLists;
  const MAX_CONTACTS = limits.maxContactsPerList;

  const [lists, contactCounts, campaignCounts] = await Promise.all([
    db.select().from(individualLists).where(eq(individualLists.userId, tenant.id)).orderBy(individualLists.createdAt),
    db
      .select({ listId: individualContacts.listId, total: count() })
      .from(individualContacts)
      .innerJoin(individualLists, eq(individualContacts.listId, individualLists.id))
      .where(eq(individualLists.userId, tenant.id))
      .groupBy(individualContacts.listId),
    db
      .select({ listId: individualCampaigns.listId, total: count() })
      .from(individualCampaigns)
      .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
      .where(eq(individualLists.userId, tenant.id))
      .groupBy(individualCampaigns.listId),
  ]);

  const contactMap = Object.fromEntries(contactCounts.map((r) => [r.listId, r.total]));
  const campaignMap = Object.fromEntries(campaignCounts.map((r) => [r.listId, r.total]));
  const atLimit = lists.length >= MAX_LISTS;

  const totalContacts = contactCounts.reduce((sum, row) => sum + row.total, 0);
  const totalCampaigns = campaignCounts.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Email lists</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your contact lists and send targeted campaigns.</p>
          </div>
          {!atLimit ? (
            <Link href="/dashboard/individual/lists/new" className="text-sm rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity">
              + New list
            </Link>
          ) : (
            <span className="text-xs px-3 py-2 rounded-md border border-border text-muted-foreground">
              List limit reached ({MAX_LISTS}/{MAX_LISTS})
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total lists</p>
            <div className="flex items-baseline justify-between mt-2">
              <p className="text-3xl font-semibold text-foreground">{lists.length}</p>
              <p className="text-sm text-muted-foreground">/ {MAX_LISTS} lists</p>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min((lists.length / MAX_LISTS) * 100, 100)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total contacts</p>
            <p className="text-3xl font-semibold text-foreground mt-2">{totalContacts}</p>
            <p className="text-sm text-muted-foreground mt-1">across all lists</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns sent</p>
            <p className="text-3xl font-semibold text-foreground mt-2">{totalCampaigns}</p>
            <p className="text-sm text-muted-foreground mt-1">all time</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lists.map((list) => {
            const contacts = contactMap[list.id] ?? 0;
            const campaigns = campaignMap[list.id] ?? 0;
            const full = contacts >= MAX_CONTACTS;
            const created = list.createdAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <div key={list.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{list.name}</h3>
                    {list.description && <p className="text-sm text-muted-foreground mt-1">{list.description}</p>}
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full ${full ? "bg-secondary text-muted-foreground" : "bg-emerald-100 text-emerald-700"}`}>
                    {full ? "Full" : "Active"}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>Contacts</span>
                    <span>{contacts} / {MAX_CONTACTS}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full ${full ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min((contacts / MAX_CONTACTS) * 100, 100)}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{campaigns} campaigns sent</span>
                  <span>Created {created}</span>
                </div>

                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Link href={`/dashboard/individual/lists/${list.id}`} className="text-center rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary transition-colors">
                    View contacts
                  </Link>
                  <Link href="/dashboard/individual/campaigns" className="text-center rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 transition-opacity">
                    Send campaign
                  </Link>
                  <DeleteListButton listId={list.id} listName={list.name} deleteAction={deleteList} />
                </div>
              </div>
            );
          })}

          {!atLimit && (
            <Link
              href="/dashboard/individual/lists/new"
              className="rounded-xl border-2 border-dashed border-border bg-transparent min-h-[230px] flex flex-col items-center justify-center text-center px-6 hover:bg-secondary/20 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-xl text-primary mb-3">+</div>
              <p className="text-xl font-medium text-foreground">New email list</p>
              <p className="text-sm text-muted-foreground mt-1">{MAX_LISTS - lists.length} of {MAX_LISTS} lists remaining</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
