import { createTrackingToken } from "./hmac";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL as string;

export function injectTracking(
  body: string,
  campaignId: number,
  contactEmail: string
): string {
  const token = createTrackingToken(campaignId, contactEmail);
  const encodedEmail = encodeURIComponent(contactEmail);

  // Wrap URLs
  const tracked = body.replace(
    /https?:\/\/[^\s"'<>)]+/g,
    (url) => {
      const encodedUrl = encodeURIComponent(url);
      return `${BASE_URL}/api/track/click?cid=${campaignId}&email=${encodedEmail}&url=${encodedUrl}&token=${token}`;
    }
  );

  // Append tracking pixel
  const pixel = `\n\n![](${BASE_URL}/api/track/open?cid=${campaignId}&email=${encodedEmail}&token=${token})`;

  return tracked + pixel;
}