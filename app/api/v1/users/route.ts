import { db } from "@/db";
import { endUsers, tenants } from "@/db/schema";
import { apiError } from "@/lib/api/errors";
import { serializeEndUser, type EndUserStatus } from "@/lib/api/end-users";
import { checkApiRateLimit } from "@/lib/rate-limit/api";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const VALID_STATUSES = new Set<EndUserStatus>([
  "stalled",
  "activated",
  "at_risk",
  "churned",
]);

function getPositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimit = checkApiRateLimit(ip);
    if (!rateLimit.allowed) {
      return apiError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded", 429);
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

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as EndUserStatus | null;
    if (status && !VALID_STATUSES.has(status)) {
      return apiError(
        "MISSING_REQUIRED_FIELD",
        "status must be one of stalled, activated, at_risk, or churned",
        400,
      );
    }

    const page = getPositiveInteger(url.searchParams.get("page"), 1);
    const requestedLimit = getPositiveInteger(url.searchParams.get("limit"), 50);
    const limit = Math.min(requestedLimit, 200);

    const users = await db.query.endUsers.findMany({
      where: eq(endUsers.tenantId, tenant.id),
      orderBy: [desc(endUsers.createdAt)],
    });

    const serializedUsers = users.map((user) => serializeEndUser(user, tenant));
    const filteredUsers = status
      ? serializedUsers.filter((user) => user.status === status)
      : serializedUsers;
    const offset = (page - 1) * limit;

    return NextResponse.json({
      success: true,
      users: filteredUsers.slice(offset, offset + limit),
      total: filteredUsers.length,
      page,
      limit,
    });
  } catch (error) {
    console.error("Users API error:", error);
    return apiError("INTERNAL_ERROR", "Server Error", 500);
  }
}
