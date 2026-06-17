import { db } from "@/db";
import { tenants, endUsers, riskSnapshots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { classifyDropOffRisk, UserData, TenantConfig } from "./drop-off-classifier";
import { shouldSendAutomation } from "./automation-guard";

const BATCH_SIZE = 500;

export async function runDailyDropOffCron() {
  console.log("🚀 Starting Daily Drop-Off Orchestration Cron...");
  const startTime = Date.now();

  try {
    // 1. Fetch all active tenants
    const allTenants = await db.query.tenants.findMany({
      where: eq(tenants.hasAccess, true)
    });

    console.log(`Found ${allTenants.length} active tenants to process.`);

    for (const tenant of allTenants) {
      try {
        console.log(`Processing tenant: ${tenant.id} (${tenant.email})`);
        
        const tenantConfig: TenantConfig = {
          activationStep: tenant.activationStep
        };

        // We use offset-based pagination to fetch users in batches to prevent memory exhaustion
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const usersBatch = await db.query.endUsers.findMany({
            where: eq(endUsers.tenantId, tenant.id),
            limit: BATCH_SIZE,
            offset: offset,
          });

          if (usersBatch.length === 0) {
            hasMore = false;
            break;
          }

          console.log(`  -> Processing batch of ${usersBatch.length} users (Offset: ${offset})`);

          for (const user of usersBatch) {
            // 2. EVALUATION
            const userData: UserData = {
              createdAt: user.createdAt,
              lastSeenAt: user.lastSeenAt,
              lastEmailedAt: user.lastEmailedAt,
              completedSteps: user.completedSteps as string[] | null,
            };

            const riskResult = classifyDropOffRisk(userData, tenantConfig);

            // 2. SNAPSHOTTING
            if (riskResult.primaryLabel) {
              await db.insert(riskSnapshots).values({
                tenantId: tenant.id,
                endUserId: user.id,
                primaryRiskLabel: riskResult.primaryLabel,
                riskScore: riskResult.primaryScore,
                matchedReasons: riskResult.matchedReasons,
                capturedAt: new Date(),
              });
            }

            // 3. AUTOMATION GATE
            if (riskResult.primaryLabel && riskResult.primaryScore > 40) {
              const guardUser = {
                email: user.email,
                lastEmailedAt: user.lastEmailedAt,
                automationsReceived: user.automationsReceived as string[] | null,
              };

              const canSend = await shouldSendAutomation(guardUser, riskResult.primaryLabel);

              // 4. EXECUTION HAND-OFF
              if (canSend) {
                const isPremium = tenant.plan === "pro" || tenant.plan === "growth" || tenant.plan === "advanced";
                const isBasic = tenant.plan === "free" || tenant.plan === "starter" || tenant.plan === "basic";

                if (isBasic) {
                  // TODO: Append automation task to an email queue or trigger the email sending function
                  console.log(`     ✉️  [QUEUE EMAIL] User ${user.id} matched ${riskResult.primaryLabel}`);
                }

                if (isPremium && riskResult.primaryScore > 70) {
                  // TODO: Flag for manual_outreach (e.g., notify founder, update pipeline stage)
                  console.log(`     🚨 [MANUAL OUTREACH] User ${user.id} high-risk drop-off (${riskResult.primaryScore})`);
                }

                // Append automation ID/timestamp to their automations_received array
                const automationTimestamp = new Date().toISOString();
                const newAutomations = [...(user.automationsReceived || []), automationTimestamp];

                await db.update(endUsers).set({
                  lastEmailedAt: new Date(),
                  automationsReceived: newAutomations
                }).where(eq(endUsers.id, user.id));
              }
            }
          }

          offset += BATCH_SIZE;
        }

      } catch (tenantError) {
        // 5. ERROR HANDLING
        console.error(`❌ Error processing tenant ${tenant.id}:`, tenantError);
        // We log the error but CONTINUE to the next tenant
      }
    }

  } catch (globalError) {
    console.error("❌ Fatal error in daily drop-off cron:", globalError);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Daily Drop-Off Orchestration completed in ${durationSec}s.`);
}
