import type { endUsers, tenants } from "@/db/schema";

export type EndUserStatus = "activated" | "stalled" | "at_risk" | "churned";
export type EndUserProperties = {
  customerType?: string | null;
  plan?: string | null;
  planValue?: number | string | null;
  currency?: string | null;
  [key: string]: unknown;
};

export type EndUserRow = typeof endUsers.$inferSelect;
export type TenantRow = typeof tenants.$inferSelect;

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function getEndUserProperties(value: unknown): EndUserProperties | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as EndUserProperties;
}

function getPlanValue(properties: EndUserProperties | null): number {
  if (!properties) return 0;
  const rawPlanValue = properties.planValue;
  if (typeof rawPlanValue === "number") return rawPlanValue;
  if (typeof rawPlanValue === "string") {
    const parsed = Number(rawPlanValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function computeEndUserStatus(user: EndUserRow, tenant: TenantRow): EndUserStatus {
  const properties = getEndUserProperties(user.properties);
  const completedSteps = toStringArray(user.completedSteps);
  const automationsReceived = toStringArray(user.automationsReceived);
  const customerType = properties?.customerType;

  if (customerType === "churned") return "churned";

  const lastSeenAt = user.lastSeenAt ? new Date(user.lastSeenAt) : null;
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const payingOrValuable = customerType === "paying" || getPlanValue(properties) > 0;
  const inactiveForFourteenDays = Boolean(lastSeenAt && lastSeenAt.getTime() < fourteenDaysAgo);

  if (automationsReceived.length > 0 && inactiveForFourteenDays && payingOrValuable) {
    return "at_risk";
  }

  const activationStep = tenant.activationStep;
  if (activationStep) {
    return completedSteps.includes(activationStep) ? "activated" : "stalled";
  }

  return completedSteps.length > 0 ? "activated" : "stalled";
}

export function serializeEndUser(user: EndUserRow, tenant: TenantRow) {
  return {
    userId: user.externalId,
    email: user.email ?? "",
    properties: getEndUserProperties(user.properties),
    completedSteps: toStringArray(user.completedSteps),
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    lastEmailedAt: user.lastEmailedAt ? user.lastEmailedAt.toISOString() : null,
    automationsReceived: toStringArray(user.automationsReceived),
    createdAt: user.createdAt ? user.createdAt.toISOString() : new Date(0).toISOString(),
    status: computeEndUserStatus(user, tenant),
  };
}
