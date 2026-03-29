import { db } from "@/db";
import { tenants, creditTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export type DeductResult =
  | { success: true; remainingCredits: number }
  | { success: false; error: string; creditsNeeded: number; creditsHave: number };

export async function deductCredits(
  tenantId: string,
  amount: number,
  type: string,
  description: string
): Promise<DeductResult> {
  try {
    // Atomic deduction — update only if sufficient credits exist
    const result = await db
      .update(tenants)
      .set({
        credits: sql`${tenants.credits} - ${amount}`,
        creditsUpdatedAt: new Date(),
      })
      .where(
        sql`${tenants.id} = ${tenantId} AND ${tenants.credits} >= ${amount}`
      )
      .returning({ credits: tenants.credits });

    if (result.length === 0) {
      // Fetch actual balance to give accurate error
      const rows = await db
        .select({ credits: tenants.credits })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const have = rows[0]?.credits ?? 0;

      return {
        success: false,
        error: `Insufficient credits. You need ${amount} credits but have ${have}.`,
        creditsNeeded: amount,
        creditsHave: have,
      };
    }

    // Log the transaction
    await db.insert(creditTransactions).values({
      tenantId,
      amount: -amount,
      type,
      description,
    });

    return { success: true, remainingCredits: result[0].credits };
  } catch {
    return {
      success: false,
      error: "Server error processing credits.",
      creditsNeeded: amount,
      creditsHave: 0,
    };
  }
}