import { db } from "@/db";
import { dataRequests } from "@/db/schema";
import { logAuditEvent } from "@/lib/compliance/audit";

async function requestDeletion(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const details = String(formData.get("details") ?? "").trim();
  if (!email) return;
  await db.insert(dataRequests).values({ email, details, requestType: "deletion" });
  await logAuditEvent({ action: "data_deletion.requested", actorEmail: email, metadata: { source: "data-deletion-page" } });
}

export default function DataDeletionPage() {
  return <main className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-3xl font-bold">Data Deletion Request</h1><p className="mt-4 text-slate-600">Submit your email and we will review the deletion request through the founder-operated compliance process.</p><form action={requestDeletion} className="mt-8 space-y-4"><input name="email" type="email" required placeholder="you@example.com" className="w-full rounded border px-3 py-2"/><textarea name="details" placeholder="Optional details" className="w-full rounded border px-3 py-2"/><button className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white">Request deletion</button></form></main>;
}
