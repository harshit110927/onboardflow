export type PlanTier = "free" | "starter" | "growth" | "pro";
export type EnterprisePlanTier = "free" | "basic" | "advanced";
export type AccountTier = "individual" | "enterprise";

export type IndividualLimits = {
  maxLists: number;
  maxContactsPerList: number;
  maxEmailsPerMonth: number;
  csvImportEnabled: boolean;
  trackingEnabled: boolean;
  aiEnabled: boolean;
};

export type EnterpriseLimits = {
  maxTrackedUsers: number;
  maxEmailsPerMonth: number;
  maxDripSteps: number;
  webhooksEnabled: boolean;
  advancedAnalyticsEnabled: boolean;
};

export const INDIVIDUAL_LIMITS: Record<PlanTier, IndividualLimits> = {
  free: {
    maxLists: 1,
    maxContactsPerList: 25,
    maxEmailsPerMonth: 50,
    csvImportEnabled: false,
    trackingEnabled: false,
    aiEnabled: false,
  },
  starter: {
    maxLists: 3,
    maxContactsPerList: 100,
    maxEmailsPerMonth: 500,
    csvImportEnabled: false,
    trackingEnabled: false,
    aiEnabled: false,
  },
  growth: {
    maxLists: 10,
    maxContactsPerList: 200,
    maxEmailsPerMonth: 2000,
    csvImportEnabled: true,
    trackingEnabled: true,
    aiEnabled: true,
  },
  pro: {
    maxLists: 15,
    maxContactsPerList: 500,
    maxEmailsPerMonth: 6000,
    csvImportEnabled: true,
    trackingEnabled: true,
    aiEnabled: true,
  },
};

export const ENTERPRISE_LIMITS: Record<EnterprisePlanTier, EnterpriseLimits> = {
  free: {
    maxTrackedUsers: 50,
    maxEmailsPerMonth: 300,
    maxDripSteps: 3,
    webhooksEnabled: false,
    advancedAnalyticsEnabled: false,
  },
  basic: {
    maxTrackedUsers: 500,
    maxEmailsPerMonth: 3000,
    maxDripSteps: 3,
    webhooksEnabled: false,
    advancedAnalyticsEnabled: false,
  },
  advanced: {
    maxTrackedUsers: 2000,
    maxEmailsPerMonth: 10000,
    maxDripSteps: Infinity,
    webhooksEnabled: true,
    advancedAnalyticsEnabled: true,
  },
};

export const INDIVIDUAL_PLANS = [
  {
    id: "ind_starter",
    label: "Starter",
    priceUsd: 5,
    priceInr: 420,
    amountInPaise: 42000,
    planTier: "starter" as PlanTier,
    highlights: ["500 emails/month", "3 lists", "100 contacts/list"],
  },
  {
    id: "ind_growth",
    label: "Growth",
    priceUsd: 10,
    priceInr: 840,
    amountInPaise: 84000,
    planTier: "growth" as PlanTier,
    highlights: ["2,000 emails/month", "10 lists", "CSV import", "AI writing", "Open/click tracking"],
  },
  {
    id: "ind_pro",
    label: "Pro",
    priceUsd: 25,
    priceInr: 2100,
    amountInPaise: 210000,
    planTier: "pro" as PlanTier,
    highlights: ["6,000 emails/month", "15 lists", "500 contacts/list", "Everything in Growth"],
  },
] as const;

export const ENTERPRISE_PLANS = [
  {
    id: "ent_basic",
    label: "Basic",
    priceUsd: 25,
    priceInr: 2100,
    amountInPaise: 210000,
    planTier: "basic" as EnterprisePlanTier,
    highlights: ["3,000 emails/month", "500 tracked users", "3 drip steps"],
  },
  {
    id: "ent_advanced",
    label: "Advanced",
    priceUsd: 50,
    priceInr: 4200,
    amountInPaise: 420000,
    planTier: "advanced" as EnterprisePlanTier,
    highlights: ["10,000 emails/month", "2,000 tracked users", "Unlimited drip steps", "Webhooks", "Advanced analytics"],
  },
] as const;

export function getIndividualLimits(plan: string): IndividualLimits {
  return INDIVIDUAL_LIMITS[plan as PlanTier] ?? INDIVIDUAL_LIMITS["free"];
}
