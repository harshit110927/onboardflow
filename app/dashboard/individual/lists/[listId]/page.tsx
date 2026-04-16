import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { individualContacts, individualLists, individualCampaigns } from "@/db/schema";
import { DeleteContactButton } from "./_components/DeleteContactButton";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";

async function addContact(formData: FormData) {
  "use server";
  const listId = Number(formData.get("listId"));
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!listId || !name || !email) return;

  const { user } = await getSession();
  if (!user?.email) return;

  const tenant = await getTenant(user.email);
  if (!tenant) return;

  const { plan } = await getTenantPlan(tenant.id);
  const maxContacts = INDIVIDUAL_LIMITS[plan as PlanTier].maxContactsPerList;

  const countResult = await db.select({ total: count() }).from(individualContacts).where(eq(individualContacts.listId, listId));
  // FIX — redirect with explicit error when contact limit is reached so UI can show feedback
  if ((countResult[0]?.total ?? 0) >= maxContacts) {
    redirect(`/dashboard/individual/lists/${listId}?error=contact_limit`);
  }

  try {
    await db.insert(individualContacts).values({ listId, name, email });
  } catch {
    // duplicate email — ignore
  }

  revalidatePath(`/dashboard/individual/lists/${listId}`);
}

async function deleteContact(formData: FormData) {
  "use server";
  const contactId = Number(formData.get("contactId"));
  const listId = Number(formData.get("listId"));
  if (!contactId || !listId) return;

  const { user } = await getSession();
  if (!user?.email) return;

  await db.delete(individualContacts).where(eq(individualContacts.id, contactId));
  revalidatePath(`/dashboard/individual/lists/${listId}`);
}

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ error?: string; imported?: string; skipped?: string; import_error?: string }>;
}) {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const { listId: listIdParam } = await params;
  const sp = await searchParams;
  const listId = Number(listIdParam);
  if (isNaN(listId)) redirect("/dashboard/individual/lists");

  const { plan } = await getTenantPlan(tenant.id);
  const limits = INDIVIDUAL_LIMITS[plan as PlanTier];
  const MAX_CONTACTS = limits.maxContactsPerList;

  const [listRows, contacts, campaignCount] = await Promise.all([
    db
      .select()
      .from(individualLists)
      .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenant.id)))
      .limit(1),
    db.select().from(individualContacts).where(eq(individualContacts.listId, listId)).orderBy(individualContacts.createdAt),
    db.select({ total: count() }).from(individualCampaigns).where(eq(individualCampaigns.listId, listId)),
  ]);

  const list = listRows[0];
  if (!list) redirect("/dashboard/individual/lists");

  const atLimit = contacts.length >= MAX_CONTACTS;
  const campaigns = campaignCount[0]?.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/individual/lists" className="hover:text-foreground transition-colors">Lists</Link>
          <span>/</span>
          <span className="text-foreground">{list.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{list.name}</h1>
            {list.description && (
              <p className="text-sm text-muted-foreground mt-1">{list.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className={atLimit ? "text-destructive font-medium" : ""}>
                {contacts.length} / {MAX_CONTACTS} contacts
              </span>
              <span>{campaigns} {campaigns === 1 ? "campaign" : "campaigns"}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {limits.csvImportEnabled && (
              <form action={`/api/individual/lists/${list.id}/import-csv`} method="post" encType="multipart/form-data" className="flex items-center gap-2">
                <input name="file" type="file" accept=".csv" required className="text-xs" />
                <button type="submit" className="text-sm rounded-md border border-border px-3 py-2 hover:bg-secondary transition-colors">Import CSV</button>
              </form>
            )}
            <Link
              href={`/dashboard/individual/lists/${list.id}/sequences/new`}
              className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
            >
              Sequences
            </Link>
            <Link
              href={`/dashboard/individual/campaigns/create?listId=${list.id}`}
              className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Send Campaign
            </Link>
          </div>
        </div>

        {sp.error === "contact_limit" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            You&apos;ve reached this list&apos;s contact limit on your current plan. Remove contacts or upgrade limits to add more.
          </div>
        )}
        {sp.import_error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            CSV import failed: {sp.import_error}
          </div>
        )}
        {sp.imported && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            CSV import complete. Imported {sp.imported} contact{sp.imported === "1" ? "" : "s"}
            {sp.skipped ? `, skipped ${sp.skipped}.` : "."}
          </div>
        )}

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${atLimit ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${Math.min((contacts.length / MAX_CONTACTS) * 100, 100)}%` }}
            />
          </div>
          {atLimit && (
            <p className="text-xs text-destructive">List is full. Remove a contact to add a new one.</p>
          )}
        </div>

        {/* Add contact form */}
        {!atLimit && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Add Contact</h2>
            <form action={addContact} className="flex flex-col sm:flex-row gap-3">
              <input type="hidden" name="listId" value={list.id} />
              <input
                name="name"
                type="text"
                required
                maxLength={100}
                placeholder="Full name"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                name="email"
                type="email"
                required
                maxLength={255}
                placeholder="Email address"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
              >
                Add
              </button>
            </form>
          </div>
        )}

        {/* Contacts table */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Contacts ({contacts.length})</h2>
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border">
              <p className="font-medium text-foreground">No contacts yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first contact using the form above.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Added</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{contact.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{contact.email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {contact.createdAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteContactButton
                          contactId={contact.id}
                          listId={list.id}
                          contactName={contact.name}
                          deleteAction={deleteContact}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <Link href="/dashboard/individual/lists" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Lists
          </Link>
        </div>

      </div>
    </div>
  );
}
