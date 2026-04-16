import { createTrackingToken } from "./hmac";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

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
      const trackingUrl = `${BASE_URL}/api/track/click?cid=${campaignId}&email=${encodedEmail}&url=${encodedUrl}&token=${token}`;
      return `<a href="${trackingUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }
  );

  return tracked;
}

export function createOpenTrackingUrl(campaignId: number, contactEmail: string): string {
  const token = createTrackingToken(campaignId, contactEmail);
  const encodedEmail = encodeURIComponent(contactEmail);
  return `${BASE_URL}/api/track/open?cid=${campaignId}&email=${encodedEmail}&token=${token}`;
}
