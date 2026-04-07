// MODIFIED — razorpay credits migration — updated individual campaign overage deductions to credits-only cost constants
import { eq, and, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Resend } from "resend";
import { db } from "@/db";
import { individualCampaigns, individualContacts, individualLists, campaignEvents, unsubscribedContacts } from "@/db/schema";
import { SendCampaignButton } from "./_components/SendCampaignButton";
import { decryptPassword, createGmailTransporter } from "@/lib/email/smtp";
import { injectTracking } from "@/lib/tracking/inject";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { deductCredits } from "@/lib/credits/deduct";
import { CREDIT_COSTS, INDIVIDUAL_LIMITS } from "@/lib/plans/limits";
import { buildEmailHtml, createUnsubscribeToken } from "@/lib/email/templates";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getMonthlyEmailUsage, incrementEmailUsage } from "@/lib/rate-limit/email-usage";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendCampaign(formData: FormData) {
  "use server";
  const campaignId = Number(formData.get("campaignId"));
  if (!campaignId) return;

  const { user } = await getSession();
  if (!user?.email) return;

  const tenant = await getTenant(user.email);
  if (!tenant) return;

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
    // FIX — enforce tenant ownership while loading campaign for send
    .where(and(eq(individualCampaigns.id, campaignId), eq(individualLists.userId, tenant.id)))
    .limit(1);

  const campaign = campaignRows[0];
  if (!campaign) return;
  if (campaign.status === "sent") return;

  const contacts = await db
    .select({ name: individualContacts.name, email: individualContacts.email })
    .from(individualContacts)
    .where(eq(individualContacts.listId, campaign.listId));

  if (contacts.length === 0) {
    // FIX — return explicit UI feedback instead of silent no-op when a campaign has no contacts
    redirect(`/dashboard/individual/campaigns/${campaignId}?error=no_contacts`);
  }

  // Filter out unsubscribed contacts
  const unsubscribed = await db
    .select({ email: unsubscribedContacts.email })
    .from(unsubscribedContacts);

  const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email.toLowerCase()));
  const activeContacts = contacts.filter(
    (c) => !unsubscribedEmails.has(c.email.toLowerCase())
  );

  if (activeContacts.length === 0) {
    // FIX — return explicit UI feedback when every contact is unsubscribed
    redirect(`/dashboard/individual/campaigns/${campaignId}?error=no_active_contacts`);
  }

  // ── Monthly email limit + credit check ────────────────────────────
  const { plan: currentPlan } = await getTenantPlan(tenant.id);
  // FIX — use plan-specific monthly cap (free: 50, premium: 5000)
  const monthlyLimit = INDIVIDUAL_LIMITS[currentPlan].maxEmailsPerMonth;
  const monthlyUsed = await getMonthlyEmailUsage(tenant.id);
  const emailsToSend = activeContacts.length;

  // FIX — hard-block free tier at 50 monthly emails before any overage credit logic
  if (currentPlan === "free" && (monthlyUsed >= 50 || monthlyUsed + emailsToSend > monthlyLimit)) {
    redirect(`/dashboard/individual/campaigns/${campaignId}?error=monthly_limit`);
  }

  if (monthlyUsed + emailsToSend > monthlyLimit) {
    const overage = monthlyUsed + emailsToSend - monthlyLimit;
    const creditCost = overage * CREDIT_COSTS.individual.emailSend;
    const deduction = await deductCredits(
      tenant.id,
      creditCost,
      "usage_email",
      `Email campaign overage — ${overage} extra email${overage !== 1 ? "s" : ""}`
    );
    if (!deduction.success) {
      redirect(`/dashboard/individual/campaigns/${campaignId}?error=credits&need=${deduction.creditsNeeded}&have=${deduction.creditsHave}`);
    }
  }

  // ── Send emails ───────────────────────────────────────────────────
  const smtp = tenant;
  const useGmail = smtp?.smtpVerified && smtp.smtpEmail && smtp.smtpPassword;
  const trackingEnabled = currentPlan === "premium";

  if (useGmail) {
    const decrypted = decryptPassword(smtp.smtpPassword!);
    const transporter = createGmailTransporter(smtp.smtpEmail!, decrypted);
    for (const contact of activeContacts) {
      const rawBody = campaign.body.replace(/\{contact_name\}/g, contact.name);
      const trackedBody = trackingEnabled
        ? injectTracking(rawBody, campaign.id, contact.email)
        : rawBody;
      const unsubToken = createUnsubscribeToken(contact.email);
      const htmlBody = buildEmailHtml({
        body: trackedBody,
        campaignId: campaign.id,
        contactEmail: contact.email,
        unsubscribeToken: unsubToken,
        senderEmail: smtp.smtpEmail!,
      });
      await transporter.sendMail({
        from: smtp.smtpEmail!,
        to: contact.email,
        subject: campaign.subject,
        html: htmlBody,
      });
    }
  } else {
    for (const contact of activeContacts) {
      const rawBody = campaign.body.replace(/\{contact_name\}/g, contact.name);
      const trackedBody = trackingEnabled
        ? injectTracking(rawBody, campaign.id, contact.email)
        : rawBody;
      const unsubToken = createUnsubscribeToken(contact.email);
      const htmlBody = buildEmailHtml({
        body: trackedBody,
        campaignId: campaign.id,
        contactEmail: contact.email,
        unsubscribeToken: unsubToken,
        senderEmail: "onboarding@resend.dev",
      });
      await resend.emails.send({
        from: "OnboardFlow <onboarding@resend.dev>",
        to: contact.email,
        subject: campaign.subject,
        html: htmlBody,
      });
    }
  }

  await db
    .update(individualCampaigns)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(individualCampaigns.id, campaignId));

  await incrementEmailUsage(tenant.id, emailsToSend);

  revalidatePath(`/dashboard/individual/campaigns/${campaignId}`);
  // FIX — redirect after send so user sees a definitive success state and refreshed data
  redirect(`/dashboard/individual/campaigns/${campaignId}?success=sent`);
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
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ error?: string; need?: string; have?: string; success?: string }>;
}) {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  const sendingFrom = tenant.smtpVerified && tenant.smtpEmail
    ? tenant.smtpEmail
    : "onboarding@resend.dev";

  const { campaignId } = await params;
  const id = Number(campaignId);
  if (isNaN(id)) redirect("/dashboard/individual/campaigns");

  const sp = await searchParams;

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

  const contacts = await db
    .select({ name: individualContacts.name, email: individualContacts.email })
    .from(individualContacts)
    .where(eq(individualContacts.listId, campaign.listId));

  const { plan } = await getTenantPlan(tenant.id);

  let openCount = 0;
  let clickCount = 0;

  if (plan === "premium" && campaign.status === "sent") {
    const [opens, clicks] = await Promise.all([
      db.select({ total: count() }).from(campaignEvents)
        .where(and(eq(campaignEvents.campaignId, campaign.id), eq(campaignEvents.eventType, "open"))),
      db.select({ total: count() }).from(campaignEvents)
        .where(and(eq(campaignEvents.campaignId, campaign.id), eq(campaignEvents.eventType, "click"))),
    ]);
    openCount = opens[0]?.total ?? 0;
    clickCount = clicks[0]?.total ?? 0;
  }

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

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/individual/campaigns" className="hover:text-foreground transition-colors">Campaigns</Link>
          <span>/</span>
          <span className="text-foreground truncate">{campaign.subject}</span>
        </div>

        {sp.error === "credits" && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            Not enough credits to send. You need {sp.need} credits but have {sp.have}.{" "}
            <Link href="/dashboard/individual/billing" className="underline font-medium">
              Purchase credits →
            </Link>
          </div>
        )}
        {sp.error === "no_contacts" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            This campaign&apos;s list has no contacts yet. Add contacts before sending.
          </div>
        )}
        {sp.error === "no_active_contacts" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            All contacts in this list are unsubscribed. Add new active contacts before sending.
          </div>
        )}
        {sp.error === "monthly_limit" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            You&apos;ve used all 50 free emails this month.
            <Link href="/dashboard/individual/billing" className="underline font-medium ml-1">
              Purchase credits to send more →
            </Link>
          </div>
        )}
        {sp.success === "sent" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            Campaign sent successfully.
          </div>
        )}

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

        {campaign.status !== "sent" && (
          <div className="rounded-lg border border-border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Ready to send?</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                This will email {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in {campaign.listName}.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sending from: <span className="font-mono">{sendingFrom}</span>
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

        {campaign.status === "sent" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-medium text-emerald-700">
              ✓ Campaign sent to {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {campaign.status === "sent" && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Campaign Analytics</h2>
            {plan === "premium" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-secondary/40 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {contacts.length > 0 ? Math.round((openCount / contacts.length) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Open Rate</p>
                  <p className="text-xs text-muted-foreground">{openCount} of {contacts.length}</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {contacts.length > 0 ? Math.round((clickCount / contacts.length) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Click Rate</p>
                  <p className="text-xs text-muted-foreground">{clickCount} of {contacts.length}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Upgrade to Premium to see open and click rates.</p>
                <Link href="/dashboard/individual/billing" className="mt-2 inline-block text-sm text-primary underline">
                  Upgrade now
                </Link>
              </div>
            )}
          </div>
        )}

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
