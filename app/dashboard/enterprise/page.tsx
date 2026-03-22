import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createCheckoutSession } from "@/app/dashboard/actions";
import Link from "next/link";
import { ArrowRight, Users, CheckCircle, BookOpen, Settings } from "lucide-react";
import { ApiKeyCard } from "@/app/dashboard/ApiKeyCard";

export default async function EnterpriseDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Tier guard
  const tierCheck = await db
    .select({ tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email!))
    .limit(1);

  const tier = tierCheck[0]?.tier ?? null;
  if (!tier) redirect("/tier-selection");
  if (tier !== "enterprise") redirect("/dashboard/individual");

  // Get Tenant Identity
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.email, user.email!)
  });

  if (!tenant) {
    try {
      [tenant] = await db.insert(tenants).values({
        email: user.email!,
        name: "Founder",
      }).returning();
    } catch (err) { console.error(err); }
  }

  if (!tenant) return <div>Error loading account. Please refresh.</div>;

  // Fetch analytics
  let totalUsers = 0;
  let completionRate = 0;

  if (tenant.hasAccess) {
    const allUsers = await db.query.endUsers.findMany({
      where: eq(endUsers.tenantId, tenant.id)
    });

    totalUsers = allUsers.length;

    const activationStep = tenant.activationStep || "connect_repo";
    const activatedCount = allUsers.filter(u => {
      const steps = u.completedSteps as string[] || [];
      return steps.includes(activationStep);
    }).length;

    completionRate = totalUsers > 0
      ? Math.round((activatedCount / totalUsers) * 100)
      : 0;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {tenant.name}</h1>
            <p className="text-muted-foreground">Executive Overview</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/settings">
              <Button variant="outline" size="icon" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" className="gap-2">
                <BookOpen className="h-4 w-4" /> Docs
              </Button>
            </Link>
            {tenant.hasAccess && (
              <Badge className="bg-green-600 px-3 py-1 text-sm">System Active</Badge>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className={!tenant.hasAccess ? "opacity-60 grayscale" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Onboarding Health</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-3xl font-bold">{tenant.hasAccess ? totalUsers : "--"}</div>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{tenant.hasAccess ? `${completionRate}%` : "--"}</div>
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t">
                <Link href="/dashboard/analytics">
                  <Button variant="outline" className="w-full gap-2" disabled={!tenant.hasAccess}>
                    View Detailed Dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
              <CheckCircle className={`h-4 w-4 ${tenant.hasAccess ? "text-green-500" : "text-gray-300"}`} />
            </CardHeader>
            <CardContent>
              {tenant.hasAccess ? (
                <div className="flex flex-col h-full justify-between">
                  <div className="text-2xl font-bold text-green-700">Active License</div>
                  <p className="text-xs text-muted-foreground mb-4">Your plan is valid forever.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-2xl font-bold">$49 <span className="text-sm font-normal text-muted-foreground">/ lifetime</span></div>
                  <form action={createCheckoutSession}>
                    <Button className="w-full" type="submit">Buy License</Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* API Key */}
        {tenant.hasAccess && (
          <ApiKeyCard apiKey={tenant.apiKey} />
        )}

      </div>
    </div>
  );
}