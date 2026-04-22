import { db } from "@/db";
import { campaignEvents } from "@/db/schema";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  const email = url.searchParams.get("email");

  if (campaignId && email) {
    const parsedCampaignId = Number.parseInt(campaignId, 10);
    if (!Number.isNaN(parsedCampaignId)) {
      try {
        await db
          .insert(campaignEvents)
          .values({
            campaignId: parsedCampaignId,
            contactEmail: email,
            eventType: "opened",
            occurredAt: new Date(),
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Pixel tracking insert failed:", err);
      }
    }
  }

  const gif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  return new Response(gif, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
