import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { individualCampaigns, individualLists, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

const MAX_CAMPAIGNS_PER_LIST = 1;

async function createCampaign(formData: FormData) {
  "use server";
  const listId = Number(formData.get("listId"));
  const subject = (formData.get("subject") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const scheduleType = formData.get("scheduleType") as string;
  const scheduledAt = formData.get("scheduledAt") as string;

  if (!listId || !subject || !body) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  // Verify list ownership
  const listRows = await db
    .select({ id: individualLists.id })
    .from(individualLists)
    .where(eq(individualLists.id, listId))
    .limit(1);
  if (!listRows[0]) return;

  // Enforce 1 campaign per list
  const existing = await db
    .select({ total: count() })
    .from(individualCampaigns)
    .where(eq(individualCampaigns.listId, listId));

  if ((existing[0]?.total ?? 0) >= MAX_CAMPAIGNS_PER_LIST) {
    redirect(`/dashboard/individual/campaigns/create?error=limit&listId=${listId}`);
  }

  await db.insert(individualCampaigns).values({
    listId,
    subject,
    body,
    status: scheduleType === "later" && scheduledAt ? "scheduled" : "draft",
    scheduledAt: scheduleType === "later" && scheduledAt ? new Date(scheduledAt) : null,
  });

  redirect("/dashboard/individual/campaigns");
}

export default async function CreateCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; listId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const params = await searchParams;

  // Get all lists with their campaign counts
  const lists = await db
    .select({
      id: individualLists.id,
      name: individualLists.name,
    })
    .from(individualLists)
    .where(eq(individualLists.userId, tenant.id));

  const campaignCounts = await db
    .select({ listId: individualCampaigns.listId, total: count() })
    .from(individualCampaigns)
    .groupBy(individualCampaigns.listId);

  const campaignMap = Object.fromEntries(
    campaignCounts.map((r) => [r.listId, r.total])
  );

  // Lists that still have room for a campaign
  const availableLists = lists.filter(
    (l) => (campaignMap[l.id] ?? 0) < MAX_CAMPAIGNS_PER_LIST
  );

  const limitError = params.error === "limit";

  if (lists.length === 0) {
    redirect("/dashboard/individual/lists/new");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/individual/campaigns" className="hover:text-foreground transition-colors">Campaigns</Link>
          <span>/</span>
          <span className="text-foreground">New Campaign</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-8 flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Create Campaign</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Write your email and choose when to send it.
            </p>
          </div>

          {limitError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              That list already has a campaign. Each list supports 1 campaign on the free plan.
            </div>
          )}

          {availableLists.length === 0 ? (
            <div className="text-center py-6">
              <p className="font-medium text-foreground">All lists have a campaign</p>
              <p className="text-sm text-muted-foreground mt-1">
                Each list supports 1 campaign on the free plan.
              </p>
              <Link
                href="/dashboard/individual/campaigns"
                className="mt-4 inline-block text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
              >
                View Existing Campaigns
              </Link>
            </div>
          ) : (
            <form action={createCampaign} className="flex flex-col gap-5">

              {/* List selector */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="listId" className="text-sm font-medium text-foreground">
                  Send to List <span className="text-destructive">*</span>
                </label>
                <select
                  id="listId"
                  name="listId"
                  required
                  defaultValue={params.listId ?? ""}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>Select a list...</option>
                  {availableLists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="subject" className="text-sm font-medium text-foreground">
                  Subject Line <span className="text-destructive">*</span>
                </label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  required
                  maxLength={255}
                  placeholder="e.g. Welcome to our community!"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="body" className="text-sm font-medium text-foreground">
                  Email Body <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="body"
                  name="body"
                  required
                  rows={10}
                  placeholder="Write your email here..."
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Plain text only for now. HTML support coming soon.
                </p>
              </div>

              {/* Schedule */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-foreground">When to Send</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleType"
                      value="draft"
                      defaultChecked
                      className="accent-primary"
                    />
                    <span className="text-foreground">Save as draft</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleType"
                      value="later"
                      className="accent-primary"
                    />
                    <span className="text-foreground">Schedule for later</span>
                  </label>
                </div>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground -mt-1">
                  Only used if you selected "Schedule for later" above.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Save Campaign
                </button>
                <Link
                  href="/dashboard/individual/campaigns"
                  className="flex-1 text-center rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}