import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 401 });

  const body = await req.json();
  const { activationStep } = body; 

  if (!activationStep) return NextResponse.json({ error: "Missing step name" }, { status: 400 });

  // Save the setting
  await db.update(tenants)
    .set({ activationStep: activationStep })
    .where(eq(tenants.apiKey, apiKey));

  return NextResponse.json({ success: true, message: `Stall detection set to: ${activationStep}` });
}