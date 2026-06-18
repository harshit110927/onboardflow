/**
 * Dripmetric Dogfooding Tracker
 * Uses native fetch to call our own endpoints with the internal master API key.
 */

const API_KEY = process.env.DRIPMETRIC_INTERNAL_API_KEY;

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "production") return "https://www.dripmetric.com";
  return "http://localhost:3000";
}

const BASE_URL = getBaseUrl();

export async function dogfoodIdentify(userId: string, email: string) {
  if (!API_KEY) {
    console.warn("dogfoodIdentify skipped: DRIPMETRIC_INTERNAL_API_KEY is not set.");
    return;
  }
  try {
    await fetch(`${BASE_URL}/api/public/identify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ userId, email }),
    });
  } catch (error) {
    console.error("Dogfood Identify Error:", error);
  }
}

export async function dogfoodTrack(userId: string, stepId: string) {
  if (!API_KEY) {
    console.warn("dogfoodTrack skipped: DRIPMETRIC_INTERNAL_API_KEY is not set.");
    return;
  }
  try {
    await fetch(`${BASE_URL}/api/public/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        userId,
        stepId,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Dogfood Track Error:", error);
  }
}
