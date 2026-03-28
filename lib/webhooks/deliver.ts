import crypto from "crypto";
import { db } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function deliverWebhookEvent(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const activeWebhooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.tenantId, tenantId), eq(webhooks.active, true)));

  for (const webhook of activeWebhooks) {
    if (!webhook.events.includes(eventType) && !webhook.events.includes("*")) continue;

    const body = JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() });

    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex");

    let responseStatus = 0;
    let success = false;

    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OnboardFlow-Signature": `sha256=${signature}`,
          "X-OnboardFlow-Event": eventType,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      responseStatus = res.status;
      success = res.ok;
    } catch {
      responseStatus = 0;
      success = false;
    }

    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      eventType,
      payload: body,
      responseStatus,
      success,
    });
  }
}