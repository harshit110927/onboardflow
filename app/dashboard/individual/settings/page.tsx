import { redirect } from "next/navigation";
import Link from "next/link";
import { GmailSettingsForm } from "./_components/GmailSettingsForm";
import { LogoutButton } from "./_components/LogoutButton";
import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";

export default async function IndividualSettingsPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant || tenant.tier !== "individual") redirect("/dashboard");
  // FIX — derive effective plan inline in settings instead of extra plan query
  const now = new Date();
  const planInfo = {
    plan: (tenant.planExpiresAt === null || tenant.planExpiresAt > now) ? tenant.plan : "free",
  } as const;

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

        {/* FIX — add account section for identity/plan/credits snapshot */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Account</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium text-foreground">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="text-sm font-medium text-foreground capitalize">{planInfo.plan}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="text-sm font-medium text-foreground">{tenant.credits?.toLocaleString() ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Member since</span>
              <span className="text-sm font-medium text-foreground">
                {tenant.createdAt?.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        {/* FIX — add billing shortcut card in settings */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Renewal & Billing</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your plan and subscription status.
              </p>
            </div>
            <Link
              href="/dashboard/individual/billing"
              className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Go to Billing
            </Link>
          </div>
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

        {/* FIX — add explicit session sign-out control for current device */}
        <div className="rounded-lg border border-destructive/20 bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">Session</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Sign out of your OnboardFlow account on this device.
          </p>
          <LogoutButton />
        </div>

      </div>
    </div>
  );
}
