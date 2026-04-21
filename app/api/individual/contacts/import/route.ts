import Papa from "papaparse";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { individualContacts, individualLists, tenants } from "@/db/schema";
import { getIndividualLimits } from "@/lib/plans/limits";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.email, user.email!) });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const formData = await req.formData();
    const listIdRaw = String(formData.get("listId") ?? "");
    const parsedListId = Number.parseInt(listIdRaw, 10);

    if (Number.isNaN(parsedListId)) {
      return NextResponse.json({ error: "Invalid listId" }, { status: 400 });
    }

    const list = await db
      .select({ id: individualLists.id })
      .from(individualLists)
      .where(
        and(
          eq(individualLists.id, parsedListId),
          eq(individualLists.userId, tenant.id),
        ),
      )
      .limit(1);

    if (!list[0]) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const csvText = Buffer.from(arrayBuffer).toString("utf-8");

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = (parsed.data ?? []).filter((row) => row && Object.keys(row).length > 0);
    const firstRow = rows[0] ?? {};
    const firstRowKeys = Object.keys(firstRow);

    if (!firstRowKeys.includes("name") || !firstRowKeys.includes("email")) {
      return NextResponse.json(
        { error: "CSV must contain 'name' and 'email' columns" },
        { status: 400 },
      );
    }

    const limits = getIndividualLimits(tenant.plan);

    const countResult = await db
      .select({ total: count() })
      .from(individualContacts)
      .where(eq(individualContacts.listId, parsedListId));

    const currentCount = countResult[0]?.total ?? 0;
    const remainingSlots = limits.maxContactsPerList - currentCount;

    if (remainingSlots <= 0) {
      return NextResponse.json(
        { error: "Contact limit reached for this list" },
        { status: 400 },
      );
    }

    const toProcess = rows.slice(0, remainingSlots);
    const limitSkipped = Math.max(rows.length - toProcess.length, 0);

    const errors: Array<{ row: number; reason: string }> = [];
    let imported = 0;
    let updated = 0;

    const inserts: Array<{ listId: number; name: string; email: string; customFields: Record<string, string> }> = [];

    for (const [index, row] of toProcess.entries()) {
      const name = String(row.name ?? "").trim();
      const email = String(row.email ?? "").trim().toLowerCase();

      if (!name || !email) {
        errors.push({ row: index + 2, reason: "Missing name or email" });
        continue;
      }

      const customFields = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
        if (key === "name" || key === "email") return acc;
        const trimmedValue = String(value ?? "").trim();
        if (trimmedValue) {
          acc[key] = trimmedValue;
        }
        return acc;
      }, {});

      const existingRows = await db
        .select()
        .from(individualContacts)
        .where(
          and(
            eq(individualContacts.listId, parsedListId),
            eq(individualContacts.email, email),
          ),
        )
        .limit(1);

      const existing = existingRows[0];
      if (existing) {
        await db
          .update(individualContacts)
          .set({
            name,
            customFields: {
              ...((existing.customFields as Record<string, string> | null) ?? {}),
              ...customFields,
            },
          })
          .where(eq(individualContacts.id, existing.id));
        updated += 1;
      } else {
        inserts.push({ listId: parsedListId, name, email, customFields });
      }
    }

    for (let i = 0; i < inserts.length; i += 50) {
      const batch = inserts.slice(i, i + 50);
      if (!batch.length) continue;
      const inserted = await Promise.all(
        batch.map((entry) =>
          db
            .insert(individualContacts)
            .values(entry)
            .onConflictDoNothing({ target: [individualContacts.listId, individualContacts.email] })
            .returning({ id: individualContacts.id }),
        ),
      );
      imported += inserted.filter((rowsInResult) => rowsInResult.length > 0).length;
    }

    return NextResponse.json({
      imported,
      updated,
      skipped: errors.length,
      limitSkipped,
      errors,
    });
  } catch (error) {
    console.error("Failed to import contacts", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
