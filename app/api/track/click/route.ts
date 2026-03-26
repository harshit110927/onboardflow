import { NextResponse } from "next/server";
import { db } from "@/db";
import { campaignEvents } from "@/db/schema";
import { verifyTrackingToken } from "@/lib/tracking/hmac";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cid = Number(searchParams.get("cid"));
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const url = searchParams.get("url") ?? "";

  // Always redirect — never break the click
  const fallback = url || process.env.NEXT_PUBLIC_BASE_URL || "/";

  if (!cid || !email || !token || !url) {
    return NextResponse.redirect(fallback);
  }

  try {
    if (verifyTrackingToken(cid, email, token)) {
      await db.insert(campaignEvents).values({
        campaignId: cid,
        contactEmail: email,
        eventType: "click",
        eventData: url,
      });
    }
  } catch {
    // Silently fail
  }

  return NextResponse.redirect(url);
}