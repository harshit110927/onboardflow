import crypto from "crypto";

const SECRET = process.env.TRACKING_HMAC_SECRET as string;

export function createTrackingToken(campaignId: number, contactEmail: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${campaignId}:${contactEmail}`)
    .digest("hex")
    .slice(0, 16);
}

export function verifyTrackingToken(campaignId: number, contactEmail: string, token: string): boolean {
  const expected = createTrackingToken(campaignId, contactEmail);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}