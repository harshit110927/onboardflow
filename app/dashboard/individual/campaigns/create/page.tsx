import { redirect } from "next/navigation";

export default async function CreateCampaignPage() {
  redirect("/dashboard/individual/campaigns");
}
