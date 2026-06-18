import { db } from "@/db";
import { endUsers, tenants } from "@/db/schema";
import { apiError } from "@/lib/api/errors";
import { checkApiRateLimit } from "@/lib/rate-limit/api";
import { deliverWebhookEvent } from "@/lib/webhooks/deliver";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { getEnterpriseLimits } from "@/lib/plans/limits";

export type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function getTenant(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkApiRateLimit(ip);
  if (!rateLimit.allowed) return { error: apiError("RATE_LIMIT_EXCEEDED", "Too many requests", 429) };

  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!apiKey) return { error: apiError("INVALID_API_KEY", "Missing API Key", 401) };

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.apiKey, apiKey) });
  if (!tenant) return { error: apiError("INVALID_API_KEY", "Invalid API Key", 401) };
  return { tenant };
}

async function readJson(req: Request) {
  try {
    const body = await req.json();
    if (!isObject(body)) return { error: apiError("MISSING_REQUIRED_FIELD", "JSON body must be an object", 400) };
    return { body };
  } catch {
    return { error: apiError("MISSING_REQUIRED_FIELD", "Valid JSON body is required", 400) };
  }
}

export async function identify(req: Request) {
  try {
    const auth = await getTenant(req);
    if (auth.error) return auth.error;
    const parsed = await readJson(req);
    if (parsed.error) return parsed.error;
    const { body } = parsed;

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const metadata = body.metadata ?? body.properties ?? undefined;

    if (!userId) return apiError("MISSING_REQUIRED_FIELD", "userId is required", 400);
    if (!email) return apiError("MISSING_REQUIRED_FIELD", "email is required", 400);
    if (!isEmail(email)) return apiError("MISSING_REQUIRED_FIELD", "email must be valid", 400);
    if (metadata !== undefined && !isObject(metadata)) return apiError("MISSING_REQUIRED_FIELD", "metadata must be an object", 400);

    let user = await db.query.endUsers.findFirst({
      where: and(eq(endUsers.tenantId, auth.tenant.id), eq(endUsers.externalId, userId)),
    });
    const alreadyExisted = Boolean(user);

    if (!user) {
      const planInfo = await getTenantPlan(auth.tenant.id);
      const limits = getEnterpriseLimits(planInfo.plan);
      
      const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(endUsers)
        .where(eq(endUsers.tenantId, auth.tenant.id));
        
      const currentUsers = Number(countRes[0].count);
      
      if (currentUsers >= limits.maxTrackedUsers) {
        return apiError("PLAN_LIMIT_REACHED", `Plan limit reached. Your current plan allows ${limits.maxTrackedUsers} tracked users. Please upgrade to track more users.`, 402);
      }

      const inserted = await db.insert(endUsers).values({
        tenantId: auth.tenant.id,
        externalId: userId,
        email,
        properties: metadata ?? null,
        completedSteps: [],
        createdAt: new Date(),
        lastSeenAt: new Date(),
      }).returning();
      user = inserted[0];
      deliverWebhookEvent(auth.tenant.id, "user.identified", { userId, email }).catch((err) => console.error("Webhook delivery error:", err));
    } else {
      const existingProperties = isObject(user.properties) ? user.properties : {};
      await db.update(endUsers).set({
        externalId: user.externalId || userId,
        email,
        properties: metadata ? { ...existingProperties, ...metadata } : user.properties,
        lastSeenAt: new Date(),
      }).where(eq(endUsers.id, user.id));
    }

    return NextResponse.json({ success: true, userId, idempotent: alreadyExisted });
  } catch (error) {
    console.error("Public identify error:", error);
    return apiError("INTERNAL_ERROR", "Server Error", 500);
  }
}

export async function track(req: Request) {
  try {
    const auth = await getTenant(req);
    if (auth.error) return auth.error;
    const parsed = await readJson(req);
    if (parsed.error) return parsed.error;
    const { body } = parsed;

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const eventName = typeof body.eventName === "string" ? body.eventName.trim() : typeof body.stepId === "string" ? body.stepId.trim() : "";
    const properties = body.properties ?? undefined;
    const timestamp = typeof body.timestamp === "string" ? new Date(body.timestamp) : new Date();

    if (!userId) return apiError("MISSING_REQUIRED_FIELD", "userId is required", 400);
    if (!eventName) return apiError("MISSING_REQUIRED_FIELD", "eventName is required", 400);
    if (properties !== undefined && !isObject(properties)) return apiError("MISSING_REQUIRED_FIELD", "properties must be an object", 400);
    if (Number.isNaN(timestamp.getTime())) return apiError("MISSING_REQUIRED_FIELD", "timestamp must be an ISO date string", 400);

    const user = await db.query.endUsers.findFirst({
      where: and(eq(endUsers.tenantId, auth.tenant.id), eq(endUsers.externalId, userId)),
    });
    if (!user) return apiError("USER_NOT_FOUND", "User not found. Call /identify first.", 404);

    const currentSteps = (user.completedSteps as string[]) || [];
    const duplicate = currentSteps.includes(eventName);
    
    const timeSinceLastSeenMs = timestamp.getTime() - (user.lastSeenAt?.getTime() ?? 0);
    const needsPresenceUpdate = timeSinceLastSeenMs > 5 * 60 * 1000;
    
    const updatePayload: { completedSteps?: string[]; lastSeenAt?: Date } = {};
    let newSteps = currentSteps;

    if (!duplicate) {
      newSteps = [...currentSteps, eventName];
      updatePayload.completedSteps = newSteps;
    }

    if (needsPresenceUpdate) {
      updatePayload.lastSeenAt = timestamp;
    }

    if (Object.keys(updatePayload).length > 0) {
      await db.update(endUsers).set(updatePayload).where(eq(endUsers.id, user.id));
    }

    if (!duplicate) {
      deliverWebhookEvent(auth.tenant.id, "user.activated", { userId, eventName, properties, timestamp: timestamp.toISOString(), completedSteps: newSteps }).catch((err) => console.error("Webhook delivery error:", err));
    }

    return NextResponse.json({ success: true, eventName, duplicate });
  } catch (error) {
    console.error("Public track error:", error);
    return apiError("INTERNAL_ERROR", "Server Error", 500);
  }
}
