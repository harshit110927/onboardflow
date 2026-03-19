// NEW FILE — created for tier selection feature
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

import { TierSelectionClient } from "./_components/TierSelectionClient";

export default async function TierSelectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  const rows = await db
    .select({ tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tier = rows[0]?.tier ?? null;

  if (tier) {
    redirect(`/dashboard/${tier}`);
  }

  return <TierSelectionClient />;
}
