import { NextResponse } from "next/server";

import { db } from "@/db";
import { campaignEvents } from "@/db/schema";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  const email = url.searchParams.get("email");
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const decodedUrl = decodeURIComponent(targetUrl);
  if (!decodedUrl.startsWith("http://") && !decodedUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (campaignId && email) {
    try {
      const parsedCampaignId = Number.parseInt(campaignId, 10);
      if (!Number.isNaN(parsedCampaignId)) {
        await db
          .insert(campaignEvents)
          .values({
            campaignId: parsedCampaignId,
            contactEmail: email,
            eventType: "clicked",
            occurredAt: new Date(),
          })
          .onConflictDoNothing();
      }
    } catch (err) {
      console.error("Click tracking insert failed:", err);
    }
  }

  return NextResponse.redirect(decodedUrl, { status: 302 });
}
