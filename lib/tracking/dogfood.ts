/**
 * Dripmetric Dogfooding Tracker
 * Uses native fetch to call our own endpoints with the internal master API key.
 */

const API_KEY = process.env.DRIPMETRIC_INTERNAL_API_KEY;
// If deployed, use NEXT_PUBLIC_BASE_URL. If local, use localhost:3000
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function dogfoodIdentify(userId: string, email: string) {
  if (!API_KEY) return;
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
  if (!API_KEY) return;
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
