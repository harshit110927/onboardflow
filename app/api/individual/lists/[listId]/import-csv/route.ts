import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { individualContacts, individualLists, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { getTenantPlan } from "@/lib/plans/get-tenant-plan";
import { INDIVIDUAL_LIMITS, type PlanTier } from "@/lib/plans/limits";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantRows = await db
    .select({ id: tenants.id, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = tenantRows[0];
  if (!tenant || tenant.tier !== "individual") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId: listIdRaw } = await params;
  const listId = Number(listIdRaw);
  if (Number.isNaN(listId)) return NextResponse.json({ error: "Invalid list id" }, { status: 400 });

  const listRows = await db
    .select({ id: individualLists.id })
    .from(individualLists)
    .where(and(eq(individualLists.id, listId), eq(individualLists.userId, tenant.id)))
    .limit(1);

  if (!listRows[0]) return NextResponse.json({ error: "List not found" }, { status: 404 });

  const { plan } = await getTenantPlan(tenant.id);
  const limits = INDIVIDUAL_LIMITS[plan as PlanTier];
  if (!limits.csvImportEnabled) {
    return NextResponse.json({ error: "CSV import is available on Growth and Pro." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return NextResponse.json({ imported: 0, skipped: 0, errors: ["No rows found"] });

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  if (nameIdx < 0 || emailIdx < 0) {
    return NextResponse.json({ error: "CSV must include name and email columns" }, { status: 400 });
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
    return NextResponse.json(
      { error: `Import exceeds limit of ${limits.maxContactsPerList} contacts for your plan.` },
      { status: 400 },
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

  return NextResponse.json({ imported, skipped: validRows.length - imported, errors });
}
