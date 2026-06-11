import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";

export async function GET(req: Request) {
  // 1. Get the API Key from the headers
  // The standard is usually "Authorization: Bearer <key>" or "x-api-key"
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey) {
    return apiError("INVALID_API_KEY", "Missing API Key", 401);
  }

  // 2. Check if this key exists in our DB
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.apiKey, apiKey)
  });

  if (!tenant) {
    return apiError("INVALID_API_KEY", "Invalid API Key", 401);
  }

  // 3. Return the tenant info (This is what the CLI needs to configure itself)
  return NextResponse.json({
    success: true,
    tenantId: tenant.id,
    name: tenant.name,
    hasAccess: tenant.hasAccess
  });
}