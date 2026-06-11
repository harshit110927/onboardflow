import type { endUsers } from "@/db/schema";

type EndUser = typeof endUsers.$inferSelect;

type UserProperties = {
  customerType?: unknown;
  planValue?: unknown;
  [key: string]: unknown;
};

export type ApiUserStatus = "activated" | "stalled" | "at_risk" | "churned";

export type ApiUser = {
  userId: string;
  email: string;
  properties: Record<string, unknown> | null;
  completedSteps: string[];
  lastSeenAt: string | null;
  lastEmailedAt: string | null;
  automationsReceived: string[];
  createdAt: string;
  status: ApiUserStatus;
};

export const apiUserStatuses: ApiUserStatus[] = ["stalled", "activated", "at_risk", "churned"];

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isMoreThanDaysAgo(date: Date | null, days: number) {
  if (!date) return false;
  return date.getTime() < Date.now() - days * 24 * 60 * 60 * 1000;
}

export function computeApiUserStatus(user: EndUser, activationStep?: string | null): ApiUserStatus {
  const properties = isPlainObject(user.properties) ? (user.properties as UserProperties) : null;
  const completedSteps = toStringArray(user.completedSteps);
  const automationsReceived = toStringArray(user.automationsReceived);

  if (properties?.customerType === "churned") {
    return "churned";
  }

  const isPaying = properties?.customerType === "paying" ||
    (typeof properties?.planValue === "number" && properties.planValue > 0);

  if (automationsReceived.length > 0 && isMoreThanDaysAgo(user.lastSeenAt, 14) && isPaying) {
    return "at_risk";
  }

  if (activationStep) {
    return completedSteps.includes(activationStep) ? "activated" : "stalled";
  }

  return completedSteps.length > 0 ? "activated" : "stalled";
}

export function formatApiUser(user: EndUser, activationStep?: string | null): ApiUser {
  return {
    userId: user.externalId,
    email: user.email ?? "",
    properties: isPlainObject(user.properties) ? user.properties : null,
    completedSteps: toStringArray(user.completedSteps),
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    lastEmailedAt: user.lastEmailedAt ? user.lastEmailedAt.toISOString() : null,
    automationsReceived: toStringArray(user.automationsReceived),
    createdAt: user.createdAt ? user.createdAt.toISOString() : "",
    status: computeApiUserStatus(user, activationStep),
  };
}
