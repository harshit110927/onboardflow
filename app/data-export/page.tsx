import { db } from "@/db";
import { dataRequests } from "@/db/schema";
import { logAuditEvent } from "@/lib/compliance/audit";

async function requestExport(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const details = String(formData.get("details") ?? "").trim();
  if (!email) return;
  await db.insert(dataRequests).values({ email, details, requestType: "export" });
  await logAuditEvent({ action: "data_export.requested", actorEmail: email, metadata: { source: "data-export-page" } });
}

export default function DataExportPage() {
  return <main className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-3xl font-bold">Data Export Request</h1><p className="mt-4 text-slate-600">Submit your email and we will review the request through the founder-operated compliance process.</p><form action={requestExport} className="mt-8 space-y-4"><input name="email" type="email" required placeholder="you@example.com" className="w-full rounded border px-3 py-2"/><textarea name="details" placeholder="Optional details" className="w-full rounded border px-3 py-2"/><button className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white">Request export</button></form></main>;
}
