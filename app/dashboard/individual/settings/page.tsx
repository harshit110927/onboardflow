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

  const now = new Date();
  const plan = (tenant.planExpiresAt === null || tenant.planExpiresAt > now) ? tenant.plan : "free";
  const renewalDate = tenant.planRenewalDate?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your sending account and preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-1">Gmail SMTP</h2>
              <p className="text-sm text-muted-foreground mb-5">Connect your Gmail account to send campaigns from your own address.</p>
              <GmailSettingsForm
                currentEmail={tenant.smtpEmail ?? null}
                isVerified={tenant.smtpVerified}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">Account</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Display name</span>
                  <span className="text-foreground font-medium">{tenant.name || user.email.split("@")[0]}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email address</span>
                  <span className="text-foreground font-medium">{user.email}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="text-foreground font-medium lowercase">{plan}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-3">Renewal & billing</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current plan</span>
                  <span className="text-foreground font-medium capitalize">{plan}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Renewal</span>
                  <span className="text-foreground font-medium">{renewalDate ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subscription ID</span>
                  <span className="text-foreground font-mono text-xs">{tenant.razorpaySubscriptionId ?? "Not subscribed"}</span>
                </div>
              </div>
              <Link
                href="/dashboard/individual/billing"
                className="inline-flex mt-4 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90"
              >
                Manage billing
              </Link>
            </div>

            <div className="rounded-xl border border-red-200 bg-card p-6">
              <h2 className="text-base font-semibold text-red-700 mb-2">Danger zone</h2>
              <p className="text-sm text-muted-foreground mb-4">These actions are permanent and cannot be undone.</p>
              <div className="flex gap-2 flex-wrap">
                <button disabled className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 opacity-60 cursor-not-allowed">Delete all lists</button>
                <button disabled className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 opacity-60 cursor-not-allowed">Delete account</button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-1">Session</h2>
              <p className="text-sm text-muted-foreground mb-4">Sign out of your Dripmetric account on this device.</p>
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
