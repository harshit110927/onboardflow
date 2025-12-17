import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createCheckoutSession } from "./actions";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Security Check
  if (!user) {
    return redirect("/login");
  }

  // 2. Database Sync (The "Handshake")
  // Check if this user exists in our tenants table
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.email, user.email!)
  });

  // If new user, create them automatically
  if (!tenant) {
    try {
      [tenant] = await db.insert(tenants).values({
        email: user.email!,
        name: "Founder", // Default name
      }).returning();
    } catch (err) {
      console.error("Error creating tenant:", err);
    }
  }

  // Handle case where tenant creation failed
  if (!tenant) return <div>Error loading account. Please refresh.</div>;

  // 3. Render the Dashboard
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {tenant.name}</h1>
            <p className="text-muted-foreground">Manage your OnboardFlow license</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Card A: Analytics (Locked if unpaid) */}
          <Card className={!tenant.hasAccess ? "opacity-60 grayscale cursor-not-allowed" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">
                {!tenant.hasAccess ? "Activate license to view data" : "Active users this week"}
              </p>
            </CardContent>
          </Card>

          {/* Card B: License Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">License Status</CardTitle>
              {tenant.hasAccess ? (
                 <Badge className="bg-green-600">Active</Badge>
              ) : (
                 <Badge variant="destructive">Unpaid</Badge>
              )}
            </CardHeader>
            <CardContent>
              {tenant.hasAccess ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Your API Key:</p>
                  <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                    {tenant.licenseKey}
                  </code>
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
      </div>
    </div>
  );
}