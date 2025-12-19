import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, desc } from "drizzle-orm"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Keeping your existing Payment Action
import { createCheckoutSession } from "./actions";
import Link from "next/link";
// Added 'BookOpen' to the imports for the Docs icon
import { ArrowRight, Users, CheckCircle, Copy, BookOpen, Settings } from "lucide-react";
import { ApiKeyCard } from "./ApiKeyCard";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  // 1. Get Tenant Identity
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.email, user.email!)
  });

  // Auto-create if missing (Safety net)
  if (!tenant) {
    try {
      [tenant] = await db.insert(tenants).values({
        email: user.email!,
        name: "Founder", 
      }).returning();
    } catch (err) { console.error(err); }
  }

  if (!tenant) return <div>Error loading account. Please refresh.</div>;

  // 2. FETCH REAL ANALYTICS (Fixed Logic)
  let totalUsers = 0;
  let completionRate = 0;

  if (tenant.hasAccess) {
    const allUsers = await db.query.endUsers.findMany({
      where: eq(endUsers.tenantId, tenant.id)
    });
    
    totalUsers = allUsers.length;

    // Real Math Fix
    const activationStep = tenant.activationStep || "connect_repo";
    const activatedCount = allUsers.filter(u => {
        const steps = u.completedSteps as string[] || [];
        return steps.includes(activationStep);
    }).length;

    completionRate = totalUsers > 0 
      ? Math.round((activatedCount / totalUsers) * 100) 
      : 0;
  }

  // 3. PREPARE MASKED KEY
  const maskedKey = tenant.apiKey 
    ? `${tenant.apiKey.substring(0, 8)}****************************` 
    : "No API Key Generated";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {tenant.name}</h1>
            <p className="text-muted-foreground">Executive Overview</p>
          </div>
          
          {/* New: Flex container to hold Docs Button + Status Badge */}
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

        {/* TOP ROW: Quick Stats & Analytics Access */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Card A: Quick Stats (REAL DATA) */}
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

              {/* The "View Details" Button */}
              <div className="mt-6 pt-4 border-t">
                <Link href="/dashboard/analytics">
                    <Button variant="outline" className="w-full gap-2" disabled={!tenant.hasAccess}>
                        View Detailed Dashboard <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Card B: License Management */}
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

        {/* API Key Section (MASKED UI) */}
        {/* API Key Section (Replaced with the working Client Component) */}
        {tenant.hasAccess && (
             <ApiKeyCard apiKey={tenant.apiKey} />
        )}

      </div>
    </div>
  );
}