import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { individualContacts, individualLists, individualCampaigns, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { DeleteListButton } from "./_components/DeleteListButton";

const MAX_LISTS = 3;
const MAX_CONTACTS = 10;

async function deleteList(formData: FormData) {
  "use server";
  const listId = Number(formData.get("listId"));
  if (!listId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  const tenantRows = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.email, user.email)).limit(1);
  if (!tenantRows[0]) return;

  const owned = await db.select({ id: individualLists.id }).from(individualLists).where(eq(individualLists.id, listId)).limit(1);
  if (!owned[0]) return;

  await db.delete(individualLists).where(eq(individualLists.id, listId));
  revalidatePath("/dashboard/individual/lists");
}

export default async function ListsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  // FIX — select only tenant fields required by lists page
  const tenantRows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);
  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const [lists, contactCounts, campaignCounts] = await Promise.all([
    db.select().from(individualLists).where(eq(individualLists.userId, tenant.id)).orderBy(individualLists.createdAt),
    db.select({ listId: individualContacts.listId, total: count() }).from(individualContacts).groupBy(individualContacts.listId),
    db.select({ listId: individualCampaigns.listId, total: count() }).from(individualCampaigns).groupBy(individualCampaigns.listId),
  ]);

  const contactMap = Object.fromEntries(contactCounts.map((r) => [r.listId, r.total]));
  const campaignMap = Object.fromEntries(campaignCounts.map((r) => [r.listId, r.total]));
  const atLimit = lists.length >= MAX_LISTS;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-foreground">Email Lists</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Email Lists</h1>
            <p className="text-sm text-muted-foreground mt-1">{lists.length} of {MAX_LISTS} lists used</p>
          </div>
          {!atLimit ? (
            <Link href="/dashboard/individual/lists/new" className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity">
              + New List
            </Link>
          ) : (
            <span className="text-xs px-3 py-2 rounded-md border border-border text-muted-foreground">
              List limit reached (3/3)
            </span>
          )}
        </div>

        {/* Lists */}
        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed border-border">
            <svg className="h-10 w-10 text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="font-semibold text-foreground">No lists yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first email list to get started.</p>
            <Link href="/dashboard/individual/lists/new" className="mt-4 text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity">
              Create your first list
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {lists.map((list) => {
              const contacts = contactMap[list.id] ?? 0;
              const campaigns = campaignMap[list.id] ?? 0;
              const full = contacts >= MAX_CONTACTS;
              const created = list.createdAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

              return (
                <div key={list.id} className="rounded-lg border border-border bg-card p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{list.name}</h3>
                      {full && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">List full</span>
                      )}
                    </div>
                    {list.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{list.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{contacts} / {MAX_CONTACTS} contacts</span>
                      <span>{campaigns} {campaigns === 1 ? "campaign" : "campaigns"}</span>
                      <span>Created {created}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${full ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${Math.min((contacts / MAX_CONTACTS) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/dashboard/individual/lists/${list.id}`} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors">
                      Manage Contacts
                    </Link>
                    <Link href={`/dashboard/individual/lists/${list.id}/campaigns`} className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 transition-opacity">
                      Campaigns
                    </Link>
                    <DeleteListButton listId={list.id} listName={list.name} deleteAction={deleteList} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div>
          <Link href="/dashboard/individual" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
