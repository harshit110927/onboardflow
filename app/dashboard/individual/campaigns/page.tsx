import { eq, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { individualCampaigns, individualLists, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { DeleteCampaignButton } from "./_components/DeleteCampaignButton";

async function deleteCampaign(formData: FormData) {
  "use server";
  const campaignId = Number(formData.get("campaignId"));
  if (!campaignId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);
  if (!tenantRows[0]) return;

  // Verify ownership via list
  const owned = await db
    .select({ id: individualCampaigns.id })
    .from(individualCampaigns)
    .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
    .where(eq(individualCampaigns.id, campaignId))
    .limit(1);
  if (!owned[0]) return;

  await db.delete(individualCampaigns).where(eq(individualCampaigns.id, campaignId));
  revalidatePath("/dashboard/individual/campaigns");
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    // FIX — select only tenant fields required by campaigns page
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const [campaigns, lists] = await Promise.all([
    db
      .select({
        id: individualCampaigns.id,
        subject: individualCampaigns.subject,
        status: individualCampaigns.status,
        scheduledAt: individualCampaigns.scheduledAt,
        sentAt: individualCampaigns.sentAt,
        createdAt: individualCampaigns.createdAt,
        listId: individualCampaigns.listId,
        listName: individualLists.name,
      })
      .from(individualCampaigns)
      .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
      .where(eq(individualLists.userId, tenant.id))
      .orderBy(individualCampaigns.createdAt),

    db
      .select({ id: individualLists.id, name: individualLists.name })
      .from(individualLists)
      .where(eq(individualLists.userId, tenant.id)),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-foreground">Campaigns</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total
            </p>
          </div>
          {lists.length > 0 && (
            <Link
              href="/dashboard/individual/campaigns/create"
              className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              + New Campaign
            </Link>
          )}
        </div>

        {/* No lists warning */}
        {lists.length === 0 && (
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
        )}

        {/* Campaigns list */}
        {lists.length > 0 && campaigns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed border-border">
            <svg className="h-10 w-10 text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            <p className="font-semibold text-foreground">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first campaign to start emailing your list.
            </p>
            <Link
              href="/dashboard/individual/campaigns/create"
              className="mt-4 text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Create Campaign
            </Link>
          </div>
        )}

        {campaigns.length > 0 && (
          <div className="flex flex-col gap-3">
            {campaigns.map((c) => {
              const date = (c.sentAt ?? c.scheduledAt ?? c.createdAt)?.toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              });
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-border bg-card p-5 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{c.subject}</h3>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>List: {c.listName}</span>
                      <span>
                        {c.status === "sent"
                          ? `Sent ${date}`
                          : c.status === "scheduled"
                          ? `Scheduled ${date}`
                          : `Created ${date}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/individual/campaigns/${c.id}`}
                      className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors"
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
