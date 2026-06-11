import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/get-session";
import { getTenant } from "@/lib/auth/get-tenant";
import { EnterpriseUsersClient } from "./_components/EnterpriseUsersClient";

export default async function EnterpriseUsersPage() {
  const { user } = await getSession();
  if (!user?.email) redirect("/login");

  const tenant = await getTenant(user.email);
  if (!tenant) redirect("/tier-selection");
  if (tenant.tier !== "enterprise") redirect("/dashboard/individual");

  return <EnterpriseUsersClient apiKey={tenant.apiKey ?? ""} />;
}
