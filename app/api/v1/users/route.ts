import { db } from "@/db";
import { endUsers, tenants, riskSnapshots } from "@/db/schema";
import { apiError } from "@/lib/api/errors";
import { apiUserStatuses, formatApiUser, type ApiUserStatus } from "@/lib/api/users";
import { checkApiRateLimit } from "@/lib/rate-limit/api";
import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStatus(value: string | null): ApiUserStatus | null | undefined {
  if (!value) return undefined;
  return apiUserStatuses.includes(value as ApiUserStatus) ? (value as ApiUserStatus) : null;
}

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const status = parseStatus(url.searchParams.get("status"));
    if (status === null) {
      return apiError(
        "MISSING_REQUIRED_FIELD",
        "status must be one of: stalled, activated, at_risk, churned",
        400,
      );
    }

    const page = parsePositiveInteger(url.searchParams.get("page"), DEFAULT_PAGE);
    const requestedLimit = parsePositiveInteger(url.searchParams.get("limit"), DEFAULT_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);

    const allUsers = await db.query.endUsers.findMany({
      where: eq(endUsers.tenantId, tenant.id),
      orderBy: [desc(endUsers.createdAt)],
    });

    const offset = (page - 1) * limit;
    
    // We need to compute status first to filter properly if a status query exists
    let filteredUsers = allUsers;
    if (status) {
      filteredUsers = allUsers.filter((user) => {
        // computeApiUserStatus logic is inside formatApiUser, but for now we format temporarily to check status
        const temp = formatApiUser(user, tenant.activationStep);
        return temp.status === status;
      });
    }

    const slicedUsers = filteredUsers.slice(offset, offset + limit);
    const slicedIds = slicedUsers.map((u) => u.id);

    // Fetch the latest snapshots for just this page's users
    const snapshotMap = new Map<string, { primaryRiskLabel: string; riskScore: number }>();
    if (slicedIds.length > 0) {
      const snapshots = await db.query.riskSnapshots.findMany({
        where: inArray(riskSnapshots.endUserId, slicedIds),
        orderBy: [desc(riskSnapshots.capturedAt)],
      });

      for (const snap of snapshots) {
        if (!snapshotMap.has(snap.endUserId)) {
          snapshotMap.set(snap.endUserId, {
            primaryRiskLabel: snap.primaryRiskLabel,
            riskScore: snap.riskScore,
          });
        }
      }
    }

    const formattedSlicedUsers = slicedUsers.map((user) => 
      formatApiUser(user, tenant.activationStep, snapshotMap.get(user.id))
    );

    return NextResponse.json({
      success: true,
      users: formattedSlicedUsers,
      total: filteredUsers.length,
      page,
      limit,
    });
  } catch (error) {
    console.error("Users list error:", error);
    return apiError("INTERNAL_ERROR", "Server Error", 500);
  }
}
