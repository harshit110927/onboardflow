import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, individualLists } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { SequenceBuilder } from "./_components/SequenceBuilder";

export default async function NewSequencePage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const tenantRows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const { plan } = await getTenantPlan(tenant.id);

  if (!["growth", "pro"].includes(plan)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground">Sequences</span>
          </div>
          <div className="rounded-lg border border-border bg-card p-8 text-center flex flex-col gap-4">
            <p className="text-2xl">🔒</p>
            <h1 className="text-xl font-bold text-foreground">Sequences are a Growth/Pro feature</h1>
            <p className="text-sm text-muted-foreground">
              Upgrade to Growth to create multi-step email sequences that send automatically.
            </p>
            <Link
              href="/dashboard/individual/billing"
              className="self-center text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Upgrade to Growth
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { listId: listIdParam } = await params;
  const listId = Number(listIdParam);
  if (isNaN(listId)) redirect("/dashboard/individual/lists");

  const listRows = await db
    .select({ id: individualLists.id, name: individualLists.name })
    .from(individualLists)
    .where(eq(individualLists.id, listId))
    .limit(1);

  const list = listRows[0];
  if (!list) redirect("/dashboard/individual/lists");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href={`/dashboard/individual/lists/${listId}`} className="hover:text-foreground transition-colors">{list.name}</Link>
          <span>/</span>
          <span className="text-foreground">New Sequence</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Email Sequence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Up to 5 emails sent automatically with delays between each step.
          </p>
        </div>

        <SequenceBuilder listId={listId} listName={list.name} tenantId={tenant.id} />
      </div>
    </div>
  );
}