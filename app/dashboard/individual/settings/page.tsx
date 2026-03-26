import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { GmailSettingsForm } from "./_components/GmailSettingsForm";

export default async function IndividualSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const rows = await db
    .select({
      id: tenants.id,
      tier: tenants.tier,
      smtpEmail: tenants.smtpEmail,
      smtpVerified: tenants.smtpVerified,
    })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = rows[0];
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/individual" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground">Settings</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your email sending preferences.</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">Email Sending</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Connect your Gmail to send campaigns from your own address instead of{" "}
            <span className="font-mono text-xs">onboarding@resend.dev</span>.
          </p>

          <GmailSettingsForm
            currentEmail={tenant.smtpEmail ?? null}
            isVerified={tenant.smtpVerified}
          />
        </div>

      </div>
    </div>
  );
}