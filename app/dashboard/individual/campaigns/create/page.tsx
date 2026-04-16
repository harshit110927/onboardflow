import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { individualCampaigns, individualLists } from "@/db/schema";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";
import { CreateCampaignForm } from "../_components/CreateCampaignForm";

async function createCampaign(formData: FormData) {
  "use server";
  const listId = Number(formData.get("listId"));
  const subject = (formData.get("subject") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const scheduleType = formData.get("scheduleType") as string;
  const scheduledAt = formData.get("scheduledAt") as string;

  if (!listId || !subject || !body) return;

  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const listRows = await db
    .select({ id: individualLists.id })
    .from(individualLists)
    .where(eq(individualLists.id, listId))
    .limit(1);
  if (!listRows[0]) return;

  await getTenantPlan(tenant.id);

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
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const { plan } = await getTenantPlan(tenant.id);
  const limits = INDIVIDUAL_LIMITS[plan as PlanTier];

  const params = await searchParams;

  const lists = await db
    .select({ id: individualLists.id, name: individualLists.name })
    .from(individualLists)
    .where(eq(individualLists.userId, tenant.id));

  if (lists.length === 0) redirect("/dashboard/individual/lists/new");

  const campaignCounts = await db
    .select({ listId: individualCampaigns.listId, total: count() })
    .from(individualCampaigns)
    .groupBy(individualCampaigns.listId);

  const campaignMap = Object.fromEntries(
    campaignCounts.map((r) => [r.listId, r.total])
  );

  const availableLists = lists;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">

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

          {availableLists.length === 0 ? (
            <div className="text-center py-6">
              <p className="font-medium text-foreground">You need at least one list to create campaigns</p>
              <Link
                href="/dashboard/individual/lists/new"
                className="mt-4 inline-block text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
              >
                Create List
              </Link>
            </div>
          ) : (
            <>
              <CreateCampaignForm
                availableLists={availableLists}
                defaultListId={params.listId}
                aiEnabled={limits.aiEnabled}
                createAction={createCampaign}
              />
              <Link
                href="/dashboard/individual/campaigns"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Cancel
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
