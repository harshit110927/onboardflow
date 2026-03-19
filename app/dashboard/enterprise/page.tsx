// NEW FILE — created for tier selection feature
import Link from "next/link";
import { redirect } from "next/navigation";

import { getUserTier } from "@/lib/auth/get-user-tier";

export default async function EnterpriseDashboardPage() {
  const tier = await getUserTier();

  if (!tier) {
    redirect("/login");
  }

  if (tier !== "enterprise") {
    redirect("/dashboard/individual");
  }

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Enterprise Dashboard</h1>
      <p className="text-muted-foreground mt-2">
        Full dashboard coming in the next task.
      </p>
      <Link className="text-primary underline-offset-4 hover:underline" href="/dashboard/settings">
        Settings
      </Link>
    </main>
  );
}
