import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { individualContacts, individualLists, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  const accept = req.headers.get("accept") ?? "";
  const referer = req.headers.get("referer");
  const wantsHtml = accept.includes("text/html");

  function respond(payload: { imported?: number; skipped?: number; errors?: string[]; error?: string }, status = 200) {
    if (wantsHtml && referer) {
      const url = new URL(referer);
      if (payload.error) {
        url.searchParams.set("import_error", payload.error);
      } else {
        url.searchParams.set("imported", String(payload.imported ?? 0));
        url.searchParams.set("skipped", String(payload.skipped ?? 0));
      }
      return NextResponse.redirect(url, { status: 303 });
    }
    return NextResponse.json(payload, { status });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return respond({ error: "Unauthorized" }, 401);

  const tenantRows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") {
    return respond({ error: "Unauthorized" }, 401);
  }

  const { listId: listIdRaw } = await params;
  const listId = Number(listIdRaw);
  if (Number.isNaN(listId)) return respond({ error: "Invalid list id" }, 400);

  const listRows = await db
    .select({ id: individualLists.id })
    .from(individualLists)
    .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenant.id)))
    .limit(1);

  if (!listRows[0]) return respond({ error: "List not found" }, 404);

  let plan: PlanTier;
  try {
    const result = await getTenantPlan(tenant.id);
    plan = result.plan as PlanTier;
  } catch {
    return respond({ error: "CSV import is available on Growth and Pro." }, 403);
  }

  const limits = INDIVIDUAL_LIMITS[plan];
  if (!limits?.csvImportEnabled) {
    return respond({ error: "CSV import is available on Growth and Pro." }, 403);
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return respond({ error: "CSV file is required" }, 400);
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return respond({ imported: 0, skipped: 0, errors: ["No rows found"] });

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  if (nameIdx < 0 || emailIdx < 0) {
    return respond({ error: "CSV must include name and email columns" }, 400);
  }

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    return { name: cols[nameIdx] ?? "", email: cols[emailIdx] ?? "" };
  });

  const errors: string[] = [];
  const validRows: { name: string; email: string }[] = [];

  rows.forEach((row, idx) => {
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();
    if (!name || !email) {
      errors.push(`Row ${idx + 2}: name and email are required`);
      return;
    }
    if (!emailRegex.test(email)) {
      errors.push(`Row ${idx + 2}: invalid email ${email}`);
      return;
    }
    validRows.push({ name, email });
  });

  const countRows = await db
    .select({ total: count() })
    .from(individualContacts)
    .where(eq(individualContacts.listId, listId));
  const currentCount = countRows[0]?.total ?? 0;

  if (currentCount + validRows.length > limits.maxContactsPerList) {
    return respond(
      { error: `Import exceeds limit of ${limits.maxContactsPerList} contacts for your plan.` },
      400,
    );
  }

  let imported = 0;
  if (validRows.length) {
    const inserted = await db
      .insert(individualContacts)
      .values(validRows.map((row) => ({ ...row, listId })))
      .onConflictDoNothing({ target: [individualContacts.listId, individualContacts.email] })
      .returning({ id: individualContacts.id });
    imported = inserted.length;
  }

  return respond({ imported, skipped: validRows.length - imported, errors });
}