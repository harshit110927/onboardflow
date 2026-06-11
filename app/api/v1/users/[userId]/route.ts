import { db } from "@/db";
import { endUsers, tenants } from "@/db/schema";
import { apiError } from "@/lib/api/errors";
import { formatApiUser } from "@/lib/api/users";
import { checkApiRateLimit } from "@/lib/rate-limit/api";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimit = checkApiRateLimit(ip);
    if (!rateLimit.allowed) {
      return apiError("RATE_LIMIT_EXCEEDED", "Too many requests", 429);
    }

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return apiError("INVALID_API_KEY", "Missing API Key", 401);
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.apiKey, apiKey),
    });

    if (!tenant) {
      return apiError("INVALID_API_KEY", "Invalid API Key", 401);
    }

    const { userId } = await context.params;
    if (!userId) {
      return apiError("MISSING_REQUIRED_FIELD", "userId is required", 400);
    }

    const user = await db.query.endUsers.findFirst({
      where: and(eq(endUsers.tenantId, tenant.id), eq(endUsers.externalId, decodeURIComponent(userId))),
    });

    if (!user) {
      return apiError("USER_NOT_FOUND", "User not found", 404);
    }

    return NextResponse.json({
      success: true,
      user: formatApiUser(user, tenant.activationStep),
    });
  } catch (error) {
    console.error("User detail error:", error);
    return apiError("INTERNAL_ERROR", "Server Error", 500);
  }
}
