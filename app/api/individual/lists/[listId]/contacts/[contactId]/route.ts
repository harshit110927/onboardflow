// NEW FILE — created for tier selection feature
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { individualContacts, individualLists, tenants } from "@/db/schema";
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
  context: { params: Promise<{ listId: string; contactId: string }> },
) {
  const verification = await getVerifiedIndividualTenant();
  if ("errorResponse" in verification) {
    return verification.errorResponse;
  }

  const { listId, contactId } = await context.params;
  const parsedListId = Number.parseInt(listId, 10);
  const parsedContactId = Number.parseInt(contactId, 10);

  if (Number.isNaN(parsedListId) || Number.isNaN(parsedContactId)) {
    return NextResponse.json(
      { error: "Invalid contact or list id" },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ id: individualContacts.id })
    .from(individualContacts)
    .innerJoin(
      individualLists,
      eq(individualContacts.listId, individualLists.id),
    )
    .where(
      and(
        eq(individualContacts.id, parsedContactId),
        eq(individualContacts.listId, parsedListId),
        eq(individualLists.userId, verification.tenant.id),
      ),
    )
    .limit(1);

  if (!existing.length) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  await db
    .delete(individualContacts)
    .where(eq(individualContacts.id, parsedContactId));

  return NextResponse.json({ success: true });
}
