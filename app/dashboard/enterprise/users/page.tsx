import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { UsersClient } from "./UsersClient";

export default async function EnterpriseUsersPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant) redirect("/tier-selection");
  if (tenant.tier !== "enterprise") redirect("/dashboard/individual");

  // Users CRM is available to every Enterprise plan for now; advancedAnalyticsEnabled
  // only gates the dedicated analytics feature in the plan model.
  await getTenantPlan(tenant.id);

  return <UsersClient apiKey={tenant.apiKey} />;
}
