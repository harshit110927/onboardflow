import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditAction = "api_key.created" | "api_key.deleted" | "data_export.requested" | "data_deletion.requested";

export async function logAuditEvent(input: { tenantId?: string | null; action: AuditAction; actorEmail?: string | null; metadata?: Record<string, unknown> }) {
  await db.insert(auditLogs).values({
    tenantId: input.tenantId ?? null,
    action: input.action,
    actorEmail: input.actorEmail ?? null,
    metadata: input.metadata ?? {},
    createdAt: new Date(),
  });
}
