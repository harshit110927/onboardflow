import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { individualCampaigns, individualLists, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

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

export default async function ListCampaignsPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    // FIX — select only tenant fields required by list campaigns page
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const { listId: listIdParam } = await params;
  const listId = Number(listIdParam);
  if (isNaN(listId)) redirect("/dashboard/individual/lists");

  const [listRows, campaigns] = await Promise.all([
    db
      .select()
      .from(individualLists)
      .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenant.id)))
      .limit(1),

    db
      .select()
      .from(individualCampaigns)
      .where(eq(individualCampaigns.listId, listId))
      .orderBy(individualCampaigns.createdAt),
  ]);

  const list = listRows[0];
  if (!list) redirect("/dashboard/individual/lists");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/dashboard/individual/lists" className="hover:text-foreground transition-colors">
            Lists
          </Link>
          <span>/</span>
          <Link href={`/dashboard/individual/lists/${listId}`} className="hover:text-foreground transition-colors">
            {list.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Campaigns</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Campaigns for {list.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {campaigns.length > 0
                ? "Manage drafts, scheduled, and sent campaigns for this list."
                : "No campaigns yet for this list."}
            </p>
          </div>
          <Link
            href={`/dashboard/individual/campaigns/create?listId=${listId}`}
            className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
          >
            + Create Campaign
          </Link>
        </div>

        {/* Empty state */}
        {campaigns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed border-border">
            <svg className="h-10 w-10 text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            <p className="font-semibold text-foreground">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a campaign to start emailing this list.
            </p>
            <Link
              href={`/dashboard/individual/campaigns/create?listId=${listId}`}
              className="mt-4 text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Create Campaign
            </Link>
          </div>
        )}

        {/* Campaign cards */}
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
                      <h3 className="font-semibold text-foreground truncate">
                        {c.subject}
                      </h3>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.status === "sent"
                        ? `Sent ${date}`
                        : c.status === "scheduled"
                        ? `Scheduled for ${date}`
                        : `Created ${date}`}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/individual/campaigns/${c.id}`}
                    className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors shrink-0"
                  >
                    View
                  </Link>
                </div>
              );
            })}

            <div className="rounded-md bg-secondary/50 border border-border px-4 py-3 text-sm text-muted-foreground">
              Need a higher monthly send cap?{" "}
              <Link href="/dashboard/individual/billing" className="text-primary hover:underline">
                Upgrade your plan
              </Link>
              .
            </div>
          </div>
        )}

        {/* Back */}
        <div>
          <Link
            href={`/dashboard/individual/lists/${listId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to {list.name}
          </Link>
        </div>

      </div>
    </div>
  );
}
