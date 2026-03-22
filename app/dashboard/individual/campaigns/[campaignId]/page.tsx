import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Resend } from "resend";
import { db } from "@/db";
import { individualCampaigns, individualContacts, individualLists, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { SendCampaignButton } from "./_components/SendCampaignButton";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendCampaign(formData: FormData) {
  "use server";
  const campaignId = Number(formData.get("campaignId"));
  if (!campaignId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  const tenantRows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);
  const tenant = tenantRows[0];
  if (!tenant) return;

  // Get campaign + verify it belongs to this tenant
  const campaignRows = await db
    .select({
      id: individualCampaigns.id,
      subject: individualCampaigns.subject,
      body: individualCampaigns.body,
      status: individualCampaigns.status,
      listId: individualCampaigns.listId,
      listName: individualLists.name,
    })
    .from(individualCampaigns)
    .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
    .where(eq(individualCampaigns.id, campaignId))
    .limit(1);

  const campaign = campaignRows[0];
  if (!campaign) return;
  if (campaign.status === "sent") return;

  // Get all contacts for this list
  const contacts = await db
    .select({ name: individualContacts.name, email: individualContacts.email })
    .from(individualContacts)
    .where(eq(individualContacts.listId, campaign.listId));

  if (contacts.length === 0) return;

  // Send one email per contact
  for (const contact of contacts) {
    const personalizedBody = campaign.body.replace(/\{contact_name\}/g, contact.name);

    await resend.emails.send({
      from: "OnboardFlow <onboarding@resend.dev>",
      to: contact.email,
      subject: campaign.subject,
      text: personalizedBody,
    });
  }

  // Mark campaign as sent
  await db
    .update(individualCampaigns)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(individualCampaigns.id, campaignId));

  revalidatePath(`/dashboard/individual/campaigns/${campaignId}`);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-secondary text-muted-foreground",
    scheduled: "bg-blue-100 text-blue-700",
    sent: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`text-sm px-3 py-1 rounded-full font-medium ${styles[status] ?? styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
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

  const { campaignId } = await params;
  const id = Number(campaignId);
  if (isNaN(id)) redirect("/dashboard/individual/campaigns");

  const rows = await db
    .select({
      id: individualCampaigns.id,
      subject: individualCampaigns.subject,
      body: individualCampaigns.body,
      status: individualCampaigns.status,
      scheduledAt: individualCampaigns.scheduledAt,
      sentAt: individualCampaigns.sentAt,
      createdAt: individualCampaigns.createdAt,
      listId: individualCampaigns.listId,
      listName: individualLists.name,
    })
    .from(individualCampaigns)
    .innerJoin(individualLists, eq(individualCampaigns.listId, individualLists.id))
    .where(eq(individualCampaigns.id, id))
    .limit(1);

  const campaign = rows[0];
  if (!campaign) redirect("/dashboard/individual/campaigns");

  // Get contact count for this list
  const contacts = await db
    .select({ name: individualContacts.name, email: individualContacts.email })
    .from(individualContacts)
    .where(eq(individualContacts.listId, campaign.listId));

  const created = campaign.createdAt?.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const scheduled = campaign.scheduledAt?.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const sentDate = campaign.sentAt?.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/individual/campaigns" className="hover:text-foreground transition-colors">Campaigns</Link>
          <span>/</span>
          <span className="text-foreground truncate">{campaign.subject}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{campaign.subject}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <StatusBadge status={campaign.status} />
              <span className="text-sm text-muted-foreground">List: {campaign.listName}</span>
              <span className="text-sm text-muted-foreground">Created {created}</span>
            </div>
            {campaign.status === "scheduled" && campaign.scheduledAt && (
              <p className="text-sm text-blue-600 mt-1">Scheduled for {scheduled}</p>
            )}
            {campaign.status === "sent" && campaign.sentAt && (
              <p className="text-sm text-emerald-600 mt-1">Sent on {sentDate} to {contacts.length} contacts</p>
            )}
          </div>
        </div>

        {/* Send box — only show for draft/scheduled */}
        {campaign.status !== "sent" && (
          <div className="rounded-lg border border-border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Ready to send?</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                This will email {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in {campaign.listName}.
              </p>
              {contacts.length === 0 && (
                <p className="text-sm text-destructive mt-1">
                  No contacts in this list yet.{" "}
                  <Link href={`/dashboard/individual/lists/${campaign.listId}`} className="underline">
                    Add contacts first.
                  </Link>
                </p>
              )}
            </div>
            {contacts.length > 0 && (
              <SendCampaignButton
                campaignId={campaign.id}
                contactCount={contacts.length}
                sendAction={sendCampaign}
              />
            )}
          </div>
        )}

        {/* Sent success box */}
        {campaign.status === "sent" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-medium text-emerald-700">
              ✓ Campaign sent to {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* Email preview */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-secondary/30">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Email Preview</p>
            <p className="text-sm font-medium text-foreground mt-1">{campaign.subject}</p>
          </div>
          <div className="px-6 py-6">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {campaign.body}
            </pre>
          </div>
        </div>

        {/* Recipients */}
        {contacts.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">
              Recipients ({contacts.length})
            </h2>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-foreground">{c.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/individual/campaigns"
            className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
          >
            ← Back to Campaigns
          </Link>
          <Link
            href={`/dashboard/individual/lists/${campaign.listId}`}
            className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
          >
            View List
          </Link>
        </div>

      </div>
    </div>
  );
}