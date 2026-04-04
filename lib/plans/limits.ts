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

export const CREDIT_COSTS = {
  individual: {
    emailSend: 10,
    aiCampaignSend: 25,
  },
  enterprise: {
    emailSend: 10,
  },
} as const;

const createIndividualPack = (pack: Omit<CreditPack, "highlights">): CreditPack => ({
  ...pack,
  highlights: [
    `${Math.floor(pack.credits / CREDIT_COSTS.individual.emailSend).toLocaleString()} emails`,
    `${Math.floor(pack.credits / CREDIT_COSTS.individual.aiCampaignSend).toLocaleString()} AI campaigns`,
  ],
});

const createEnterprisePack = (pack: Omit<CreditPack, "highlights">): CreditPack => ({
  ...pack,
  highlights: [
    `${Math.floor(pack.credits / CREDIT_COSTS.enterprise.emailSend).toLocaleString()} drip emails`,
  ],
});

export const INDIVIDUAL_CREDIT_PACKS: CreditPack[] = [
  createIndividualPack({ id: "credits_starter", label: "Starter", priceInr: 420, priceUsd: 5, amountInPaise: 42000, credits: 5000, bonus: 0 }),
  createIndividualPack({ id: "credits_basic", label: "Basic", priceInr: 840, priceUsd: 10, amountInPaise: 84000, credits: 11000, bonus: 10 }),
  createIndividualPack({ id: "credits_pro", label: "Pro", priceInr: 2100, priceUsd: 25, amountInPaise: 210000, credits: 30000, bonus: 20 }),
  createIndividualPack({ id: "credits_growth", label: "Growth", priceInr: 4200, priceUsd: 50, amountInPaise: 420000, credits: 65000, bonus: 30 }),
  createIndividualPack({ id: "credits_scale", label: "Scale", priceInr: 8400, priceUsd: 100, amountInPaise: 840000, credits: 140000, bonus: 40 }),
];

export const ENTERPRISE_CREDIT_PACKS: CreditPack[] = [
  createEnterprisePack({ id: "credits_pro", label: "Pro", priceInr: 2100, priceUsd: 25, amountInPaise: 210000, credits: 30000, bonus: 0 }),
  createEnterprisePack({ id: "credits_growth", label: "Growth", priceInr: 4200, priceUsd: 50, amountInPaise: 420000, credits: 65000, bonus: 0 }),
  createEnterprisePack({ id: "credits_scale", label: "Scale", priceInr: 8400, priceUsd: 100, amountInPaise: 840000, credits: 140000, bonus: 0 }),
];
