export type UserData = {
  createdAt: Date | null;
  lastSeenAt: Date | null;
  lastEmailedAt: Date | null;
  completedSteps: string[] | null;
};

export type TenantConfig = {
  activationStep?: string | null;
};

export type RiskRule = {
  label: string;
  score: number;
};

export function classifyDropOffRisk(
  user: UserData,
  tenantConfig: TenantConfig
): { primaryLabel: string | null; primaryScore: number; matchedReasons: string[] } {
  const matchedRules: RiskRule[] = [];
  const now = new Date();

  const createdAt = user.createdAt || now;
  const lastSeenAt = user.lastSeenAt || createdAt;
  const lastEmailedAt = user.lastEmailedAt;
  const completedSteps = user.completedSteps || [];
  
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const daysSilent = (now.getTime() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);

  // 1. NEVER_STARTED (Score 40): 0 completed_steps, silent > 3 days since created_at
  if (completedSteps.length === 0 && daysSinceCreated > 3 && daysSilent > 3) {
    matchedRules.push({ label: 'NEVER_STARTED', score: 40 });
  }

  // 2. COOLING (Score 50): silent > 5 days.
  if (daysSilent > 5) {
    matchedRules.push({ label: 'COOLING', score: 50 });
  }

  // 3. PRE_ACTIVATION_STALL (Score 60): Has started steps but missing tenant.activation_step, silent > 3 days.
  if (
    completedSteps.length > 0 &&
    tenantConfig.activationStep &&
    !completedSteps.includes(tenantConfig.activationStep) &&
    daysSilent > 3
  ) {
    matchedRules.push({ label: 'PRE_ACTIVATION_STALL', score: 60 });
  }

  // 4. POST_ACTIVATION_STALL (Score 30): Has activation_step, silent > 7 days.
  if (
    tenantConfig.activationStep &&
    completedSteps.includes(tenantConfig.activationStep) &&
    daysSilent > 7
  ) {
    matchedRules.push({ label: 'POST_ACTIVATION_STALL', score: 30 });
  }

  // 5. EMAIL_NON_RESPONSIVE (Score 70): last_emailed_at is within 14 days, but last_seen_at is older than last_emailed_at.
  if (lastEmailedAt) {
    const daysSinceEmail = (now.getTime() - lastEmailedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEmail <= 14 && lastSeenAt.getTime() < lastEmailedAt.getTime()) {
      matchedRules.push({ label: 'EMAIL_NON_RESPONSIVE', score: 70 });
    }
  }

  // 6. GONE_DARK (Score 90): Silent > 14 days (or > 28 days if they have completed 3+ steps).
  if (completedSteps.length >= 3) {
    if (daysSilent > 28) {
      matchedRules.push({ label: 'GONE_DARK', score: 90 });
    }
  } else {
    if (daysSilent > 14) {
      matchedRules.push({ label: 'GONE_DARK', score: 90 });
    }
  }

  if (matchedRules.length === 0) {
    return { primaryLabel: null, primaryScore: 0, matchedReasons: [] };
  }

  // Sort by score descending to find the primary
  matchedRules.sort((a, b) => b.score - a.score);
  
  const primary = matchedRules[0];
  return {
    primaryLabel: primary.label,
    primaryScore: primary.score,
    matchedReasons: matchedRules.map(r => r.label)
  };
}
