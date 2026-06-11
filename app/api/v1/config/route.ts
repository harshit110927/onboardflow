import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return apiError("INVALID_API_KEY", "Missing API Key", 401);

  const body = await req.json();
  const { activationStep } = body; 

  if (!activationStep) return apiError("MISSING_REQUIRED_FIELD", "activationStep is required", 400);

  // Save the setting
  await db.update(tenants)
    .set({ activationStep: activationStep })
    .where(eq(tenants.apiKey, apiKey));

  return NextResponse.json({ success: true, message: `Stall detection set to: ${activationStep}` });
}