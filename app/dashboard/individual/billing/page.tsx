// MODIFIED — razorpay credits migration — individual billing uses Razorpay credit packs
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { creditTransactions } from "@/db/schema";
import { INDIVIDUAL_CREDIT_PACKS } from "@/lib/plans/limits";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { BillingActions } from "./_components/BillingActions";

export default async function IndividualBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; cancelled?: string }>;
}) {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");
  const userEmail = user.email;

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");
  const tenantTier = tenant.tier;

  const recentTransactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.tenantId, tenant.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(10);

  const params = await searchParams;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-foreground">Billing</span>
        </div>

        {params.success === "credits" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            ✓ Payment received. Credits will appear in your account within
            {" "}30 seconds as we process the payment.
          </div>
        )}

        {params.cancelled && (
          <div className="rounded-lg border border-border bg-secondary/40 px-5 py-4 text-sm text-muted-foreground">
            Checkout was cancelled. No changes were made.
          </div>
        )}

        <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
          Subscription plans coming soon. Purchase credits below to unlock all features beyond your free limits.
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Credits</h2>
            <span className="text-2xl font-bold text-primary">
              {(tenant.credits ?? 0).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">1 email send = 10 credits</p>
          <p className="text-sm text-muted-foreground mb-6">1 AI campaign = 25 credits</p>

          {/* FIX — add explicit features unlocked by credits above pack grid */}
          <div className="rounded-lg border border-border bg-secondary/20 p-5 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">What credits unlock</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: "✉️", title: "Email Sending", desc: "10 credits per email beyond your 50/month free limit" },
                { icon: "✦", title: "AI Mail Writing", desc: "25 credits per AI-generated campaign (subject + body)" },
                { icon: "🎨", title: "HTML Mail Personalization", desc: "Full HTML editor to customize every email's design" },
                { icon: "📊", title: "Open & Click Analytics", desc: "See who opened your emails and what they clicked" },
                { icon: "🔁", title: "Multi-step Sequences", desc: "Auto-send follow-up emails on a schedule" },
                { icon: "📬", title: "Gmail Sending", desc: "Send from your own Gmail address for better deliverability" },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-3">
                  <span className="text-base shrink-0">{feature.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{feature.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INDIVIDUAL_CREDIT_PACKS.map((pack) => (
              <BillingActions
                key={pack.id}
                pack={pack}
                userEmail={userEmail}
                tier={tenantTier}
              />
            ))}
          </div>
        </div>

        {recentTransactions.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Recent Transactions</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Credits</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{tx.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tx.createdAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${tx.amount > 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
