// NEW FILE — created for tier selection feature

export type Tier = "enterprise" | "individual";

export type TierLimits = {
  maxLists: number;
  maxContactsPerList: number;
  maxCampaignsPerList: number;
};

export const TIER_LIMITS: Record<"individual", TierLimits> = {
  individual: {
    maxLists: 3,
    maxContactsPerList: 10,
    maxCampaignsPerList: 1,
  },
};
