import { count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/db";
import {
  individualCampaigns,
  individualContacts,
  individualLists,
} from "@/db/schema";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getMonthlyEmailUsage } from "@/lib/rate-limit/email-usage";

import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS } from "@/lib/plans/limits";

// ── Local components ────────────────────────────────────────────────────────

function QuotaBar({
  used,
  max,
  label,
}: {
  used: number;
  max: number;
  label: string;
}) {
  const pct = Math.min(Math.round((used / max) * 100), 100);
  const full = used >= max;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={full ? "text-destructive font-medium" : "text-foreground"}>
          {used} / {max}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${full ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ListCard({
  list,
  contactCount,
  campaignCount,
  maxContacts,
}: {
  list: { id: number; name: string; description: string | null; createdAt: Date | null };
  contactCount: number;
  campaignCount: number;
  maxContacts: number;
}) {
  const full = contactCount >= maxContacts;
  const created = list.createdAt
    ? list.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{list.name}</h3>
            {full && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium shrink-0">
                List full
              </span>
            )}
          </div>
          {list.description && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {list.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Contacts</span>
          <span>{contactCount} / {maxContacts}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-1.5 rounded-full ${full ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.min((contactCount / maxContacts) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{campaignCount} {campaignCount === 1 ? "campaign" : "campaigns"}</span>
        <span>{created}</span>
      </div>

      <div className="flex gap-2 mt-1">
        <Link
          href={`/dashboard/individual/lists/${list.id}`}
          className="flex-1 text-center text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors"
        >
          View Contacts
        </Link>
        <Link
          href={`/dashboard/individual/lists/${list.id}/campaigns`}
          className="flex-1 text-center text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 transition-opacity"
        >
          Send Campaign
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border">
      <svg
        className="h-10 w-10 text-muted-foreground mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
      <p className="font-semibold text-foreground">No email lists yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        Create your first list to start sending campaigns.
      </p>
      <Link
        href="/dashboard/individual/lists/new"
        className="mt-4 text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
      >
        Create your first list
      </Link>
    </div>
  );
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

// ── Page ────────────────────────────────────────────────────────────────────

export default async function IndividualDashboardPage() {
  // FIX — disable cache for per-user dashboard data to avoid stale cross-user rendering
  noStore();

  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  // All queries in parallel
  // FIX — moved tenant plan lookup into Promise.all to remove a sequential DB round trip
  console.time(`[DB] individual/page tenant:${tenant.id}`);
  const [lists, contactCounts, campaignCounts, recentCampaignsRaw, monthlyEmailsUsed, planInfo] =
    await Promise.all([
      // 1. All lists
      db
        .select()
        .from(individualLists)
        .where(eq(individualLists.userId, tenant.id))
        .orderBy(individualLists.updatedAt),

      // 2. Contact count per list
      db
        .select({
          listId: individualContacts.listId,
          total: count(),
        })
        .from(individualContacts)
        .innerJoin(individualLists, eq(individualContacts.listId, individualLists.id))
        // FIX — scope contact counts to the current tenant's lists only
        .where(eq(individualLists.userId, tenant.id))
        .groupBy(individualContacts.listId),

      // 3. Campaign count per list
      db
        .select({
          listId: individualCampaigns.listId,
          total: count(),
        })
        .from(individualCampaigns)
        .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
        // FIX — scope campaign counts to the current tenant's lists only
        .where(eq(individualLists.userId, tenant.id))
        .groupBy(individualCampaigns.listId),

      // 4. 3 most recent campaigns with list name
      db
        .select({
          id: individualCampaigns.id,
          subject: individualCampaigns.subject,
          status: individualCampaigns.status,
          createdAt: individualCampaigns.createdAt,
          listName: individualLists.name,
        })
        .from(individualCampaigns)
        .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
        .where(eq(individualLists.userId, tenant.id))
        // FIX — show newest campaigns first in recent campaigns table
        .orderBy(desc(individualCampaigns.createdAt))
        .limit(3),
      // FIX — fetch monthly email usage so dashboard and checklist reflect real send usage
      getMonthlyEmailUsage(tenant.id).catch(() => 0),
      getTenantPlan(tenant.id),
    ]);
  console.timeEnd(`[DB] individual/page tenant:${tenant.id}`);

  const limits = INDIVIDUAL_LIMITS[planInfo.plan];
  const MAX_LISTS = limits.maxLists;
  const MAX_CONTACTS = limits.maxContactsPerList;

  // Build lookup maps
  const contactMap = Object.fromEntries(
    contactCounts.map((r) => [r.listId, r.total])
  );
  const campaignMap = Object.fromEntries(
    campaignCounts.map((r) => [r.listId, r.total])
  );

  const largestListContacts =
    lists.length > 0
      ? Math.max(...lists.map((l) => contactMap[l.id] ?? 0))
      : 0;

  const allListsFull =
    lists.length > 0 && lists.every((list) => (contactMap[list.id] ?? 0) >= MAX_CONTACTS);
  // FIX — enforce ordered checklist completion using actual monthly email usage for send completion
  const steps = [
    {
      done: lists.length > 0,
      label: "Create your first list",
      href: "/dashboard/individual/lists/new",
      cta: "Create list",
    },
    {
      done: lists.length > 0 && Object.values(contactMap).some((c) => c > 0),
      label: "Add contacts to a list",
      href: "/dashboard/individual/lists",
      cta: "Add contacts",
    },
    {
      done: lists.length > 0 && monthlyEmailsUsed > 0,
      label: "Send your first campaign",
      href: "/dashboard/individual/campaigns/create",
      cta: "Create campaign",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {/* FIX — prefer tenant name in greeting, fallback to email username */}
              Welcome back, {tenant.name || user.email.split("@")[0]}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here&apos;s what&apos;s happening with your lists.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              planInfo.plan === "premium"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-secondary text-muted-foreground"
            }`}>
              {planInfo.plan === "premium" ? "Premium" : "Free Plan"}
            </span>
            <Link
              href="/dashboard/individual/lists/new"
              className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              + Create List
            </Link>
          </div>
        </div>

        {/* ── Quota ── */}
        <div className="rounded-lg border border-border bg-card p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuotaBar used={lists.length} max={MAX_LISTS} label="Email Lists" />
          <QuotaBar
            used={largestListContacts}
            max={MAX_CONTACTS}
            label="Contacts (largest list)"
          />
          {/* FIX — replace campaigns quota with monthly email usage quota */}
          <QuotaBar
            used={monthlyEmailsUsed}
            max={50}
            label="Emails This Month"
          />
        </div>
        {monthlyEmailsUsed >= 40 && monthlyEmailsUsed < 50 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ You&apos;ve used {monthlyEmailsUsed}/50 free emails this month.{" "}
            <Link href="/dashboard/individual/billing" className="underline">
              Purchase credits
            </Link>{" "}
            to send more when you hit the limit.
          </div>
        )}
        {monthlyEmailsUsed >= 50 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            ✕ Monthly email limit reached. Purchase credits to continue sending.{" "}
            <Link href="/dashboard/individual/billing" className="underline font-medium">
              Buy credits →
            </Link>
          </div>
        )}

        {/* ── Lists ── */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Your Email Lists
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lists.length === 0 ? (
              <EmptyState />
            ) : (
              lists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  contactCount={contactMap[list.id] ?? 0}
                  campaignCount={campaignMap[list.id] ?? 0}
                  maxContacts={MAX_CONTACTS}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Recent Campaigns ── */}
        {recentCampaignsRaw.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Recent Campaigns
            </h2>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">List</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaignsRaw.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-foreground font-medium">{c.subject}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.listName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.createdAt?.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* FIX — make quick actions adapt to account state */}
            <Link
              href="/dashboard/individual/lists/new"
              className="rounded-lg border border-border bg-card p-5 hover:bg-secondary/40 transition-colors group"
            >
              <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                {lists.length === 0 ? "Create Your First List" : "New Email List"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {lists.length === 0 ? "Start by creating an email list" : "Add another list to your account"}
              </p>
            </Link>
            <Link
              href={lists.length > 0 ? "/dashboard/individual/campaigns/create" : "/dashboard/individual/lists/new"}
              className={`rounded-lg border border-border bg-card p-5 hover:bg-secondary/40 transition-colors group ${lists.length === 0 ? "opacity-50 pointer-events-none" : ""}`}
            >
              <p className="font-medium text-foreground group-hover:text-primary transition-colors">New Campaign</p>
              <p className="text-sm text-muted-foreground mt-1">Write and schedule an email</p>
            </Link>
            <Link
              href={allListsFull ? "/dashboard/individual/billing" : "/dashboard/individual/campaigns"}
              className="rounded-lg border border-border bg-card p-5 hover:bg-secondary/40 transition-colors group"
            >
              <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                {allListsFull ? "Upgrade Contact Capacity" : "View All Campaigns"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {allListsFull ? "All lists are full — buy credits to unlock more sends" : "See drafts, scheduled, and sent"}
              </p>
            </Link>
          </div>
        </div>
        {/* ── Onboarding Checklist ── */}
        {/* FIX — keep checklist visible until all onboarding steps are complete */}
        {!steps.every((s) => s.done) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">Get started</h2>
            <p className="text-sm text-muted-foreground mb-4">Complete these steps to send your first campaign.</p>
            <div className="flex flex-col gap-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    step.done ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"
                  }`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className={`flex-1 text-sm ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {step.label}
                  </span>
                  {!step.done && (
                    <Link
                      href={step.href}
                      className="text-xs rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 transition-opacity shrink-0"
                    >
                      {step.cta}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
