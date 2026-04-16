import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, count } from "drizzle-orm";
import { db } from "@/db";
import { individualLists } from "@/db/schema";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";


// ── Server action: create list ───────────────────────────────────────────────
async function createList(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name || name.length > 100) return;

  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  // Check limit
  const { plan } = await getTenantPlan(tenant.id);
  const maxLists = INDIVIDUAL_LIMITS[plan as PlanTier].maxLists;

  const countResult = await db
    .select({ total: count() })
    .from(individualLists)
    .where(eq(individualLists.userId, tenant.id));

  if ((countResult[0]?.total ?? 0) >= maxLists) {
    redirect("/dashboard/individual/lists?error=limit");
  }

  await db.insert(individualLists).values({
    userId: tenant.id,
    name,
    description,
  });

  redirect("/dashboard/individual/lists");
}

// ── Page ────────────────────────────────────────────────────────────────────
export default async function NewListPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (tenant?.tier !== "individual") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/individual/lists" className="hover:text-foreground transition-colors">Lists</Link>
          <span>/</span>
          <span className="text-foreground">New List</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-8">
          <h1 className="text-xl font-bold text-foreground mb-1">Create Email List</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Give your list a name so you can find it later.
          </p>

          <form action={createList} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                List Name <span className="text-destructive">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Newsletter Subscribers"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium text-foreground">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                maxLength={300}
                placeholder="What is this list for?"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Create List
              </button>
              <Link
                href="/dashboard/individual/lists"
                className="flex-1 text-center rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
