// MODIFIED — razorpay credits migration — replaced shared credit packs with tier-specific Razorpay packs and updated credit cost constants

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

export type CreditPack = {
  id: string;
  priceInr: number;
  priceUsd: number;
  amountInPaise: number;
  credits: number;
  bonus: number;
  label: string;
  highlights: string[];
};

export const INDIVIDUAL_LIMITS: Record<PlanTier, IndividualLimits> = {
  free: {
    maxLists: 3,
    maxContactsPerList: 10,
    // FIX — free tier now allows effectively unlimited campaigns; monthly email cap is the hard limiter
    maxCampaignsPerList: 999,
    maxEmailsPerMonth: 50,
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

export const CREDIT_COSTS = {
  individual: {
    emailSend: 10,
    aiCampaignSend: 25,
  },
  enterprise: {
    emailSend: 10,
  },
} as const;

// FIX — align tier-specific credit packs with current pricing model
export const INDIVIDUAL_CREDIT_PACKS = [
  {
    id: "credits_ind_5",
    priceInr: 420,
    priceUsd: 5,
    amountInPaise: 42000,
    credits: 5000,
    bonus: 0,
    label: "Starter",
    highlights: ["500 emails", "200 AI campaigns"],
  },
  {
    id: "credits_ind_10",
    priceInr: 840,
    priceUsd: 10,
    amountInPaise: 84000,
    credits: 11000,
    bonus: 10,
    label: "Basic",
    highlights: ["1,100 emails", "440 AI campaigns"],
  },
  {
    id: "credits_ind_25",
    priceInr: 2100,
    priceUsd: 25,
    amountInPaise: 210000,
    credits: 30000,
    bonus: 20,
    label: "Pro",
    highlights: ["3,000 emails", "1,200 AI campaigns"],
  },
] as const;

// FIX — enterprise packs now include only $50 / $100 / $200 options
export const ENTERPRISE_CREDIT_PACKS = [
  {
    id: "credits_ent_50",
    priceInr: 4200,
    priceUsd: 50,
    amountInPaise: 420000,
    credits: 65000,
    bonus: 30,
    label: "Growth",
    highlights: ["6,500 drip emails", "Full automation"],
  },
  {
    id: "credits_ent_100",
    priceInr: 8400,
    priceUsd: 100,
    amountInPaise: 840000,
    credits: 140000,
    bonus: 40,
    label: "Scale",
    highlights: ["14,000 drip emails", "Full automation"],
  },
  {
    id: "credits_ent_200",
    priceInr: 16800,
    priceUsd: 200,
    amountInPaise: 1680000,
    credits: 300000,
    bonus: 50,
    label: "Enterprise",
    highlights: ["30,000 drip emails", "Full automation"],
  },
] as const;
