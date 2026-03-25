// NEW FILE — phase 1 premium foundation

export type PlanTier = "free" | "premium";
export type AccountTier = "individual" | "enterprise";

export type IndividualLimits = {
  maxLists: number;
  maxContactsPerList: number;
  maxCampaignsPerList: number;
  maxEmailsPerMonth: number;
  maxAiGenerationsPerMonth: number;
  sequencesEnabled: boolean;
  trackingEnabled: boolean;
};

export type EnterpriseLimits = {
  maxTrackedUsers: number;
  maxEmailsPerDay: number;
  maxEmailsPerMonth: number;
  maxDripSteps: number;
  maxApiCallsPerMonth: number;
  webhooksEnabled: boolean;
  advancedAnalyticsEnabled: boolean;
};

export const INDIVIDUAL_LIMITS: Record<PlanTier, IndividualLimits> = {
  free: {
    maxLists: 3,
    maxContactsPerList: 10,
    maxCampaignsPerList: 1,
    maxEmailsPerMonth: 30,
    maxAiGenerationsPerMonth: 0,
    sequencesEnabled: false,
    trackingEnabled: false,
  },
  premium: {
    maxLists: 25,
    maxContactsPerList: 500,
    maxCampaignsPerList: 10,
    maxEmailsPerMonth: 5000,
    maxAiGenerationsPerMonth: 20,
    sequencesEnabled: true,
    trackingEnabled: true,
  },
};

export const ENTERPRISE_LIMITS: Record<PlanTier, EnterpriseLimits> = {
  free: {
    maxTrackedUsers: 50,
    maxEmailsPerDay: 20,
    maxEmailsPerMonth: 300,
    maxDripSteps: 3,
    maxApiCallsPerMonth: 1000,
    webhooksEnabled: false,
    advancedAnalyticsEnabled: false,
  },
  premium: {
    maxTrackedUsers: 2000,
    maxEmailsPerDay: 500,
    maxEmailsPerMonth: 10000,
    maxDripSteps: Infinity,
    maxApiCallsPerMonth: 50000,
    webhooksEnabled: true,
    advancedAnalyticsEnabled: true,
  },
};

// Credit costs per resource unit
export const CREDIT_COSTS = {
  individual: {
    emailSend: 2,        // per email over monthly limit
    aiGeneration: 50,    // per AI write over monthly limit
    extraContacts: 200,  // per 100 contacts over limit
    extraCampaign: 100,  // per extra campaign slot
  },
  enterprise: {
    emailSend: 3,        // per automated email over monthly limit
    extraTrackedUsers: 500, // per 100 users over limit
    extraApiCalls: 100,  // per 1000 API calls over limit
  },
} as const;

// Credit pack definitions
export const CREDIT_PACKS = [
  { id: "credits_10", price: 10, credits: 10000, bonus: 0 },
  { id: "credits_25", price: 25, credits: 27500, bonus: 10 },
  { id: "credits_50", price: 50, credits: 60000, bonus: 20 },
  { id: "credits_100", price: 100, credits: 130000, bonus: 30 },
] as const;