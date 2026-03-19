// NEW FILE — created for tier selection feature
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { individualLists, tenants } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

async function getVerifiedIndividualTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.email, user.email))
    .limit(1);

  const tenant = rows[0];

  if (!tenant) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (tenant.tier !== "individual") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { tenant };
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const verification = await getVerifiedIndividualTenant();
  if ("errorResponse" in verification) {
    return verification.errorResponse;
  }

  const { listId } = await context.params;
  const parsedListId = Number.parseInt(listId, 10);

  if (Number.isNaN(parsedListId)) {
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });
  }

  const existing = await db
    .select({ id: individualLists.id })
    .from(individualLists)
    .where(
      and(
        eq(individualLists.id, parsedListId),
        eq(individualLists.userId, verification.tenant.id),
      ),
    )
    .limit(1);

  if (!existing.length) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  await db.delete(individualLists).where(eq(individualLists.id, parsedListId));

  return NextResponse.json({ success: true });
}
