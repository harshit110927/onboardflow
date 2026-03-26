import { NextResponse } from "next/server";
import { db } from "@/db";
import { campaignEvents } from "@/db/schema";
import { verifyTrackingToken } from "@/lib/tracking/hmac";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cid = Number(searchParams.get("cid"));
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  // Always return the pixel — never let tracking break email rendering
  const pixelResponse = new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });

  if (!cid || !email || !token) return pixelResponse;

  try {
    if (!verifyTrackingToken(cid, email, token)) return pixelResponse;

    await db.insert(campaignEvents).values({
      campaignId: cid,
      contactEmail: email,
      eventType: "open",
    });
  } catch {
    // Silently fail — tracking must never break email
  }

  return pixelResponse;
}