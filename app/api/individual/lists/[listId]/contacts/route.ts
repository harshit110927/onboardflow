// NEW FILE — created for tier selection feature
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "next/dist/compiled/zod";

import { db } from "@/db";
import { individualContacts, individualLists, tenants } from "@/db/schema";
import { validateContactAddition } from "@/lib/rate-limit/individual";
import { createClient } from "@/utils/supabase/server";

const createContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

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

export async function GET(
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

  const list = await db
    .select({ id: individualLists.id })
    .from(individualLists)
    .where(
      and(
        eq(individualLists.id, parsedListId),
        eq(individualLists.userId, verification.tenant.id),
      ),
    )
    .limit(1);

  if (!list.length) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const contacts = await db
    .select()
    .from(individualContacts)
    .where(eq(individualContacts.listId, parsedListId))
    .orderBy(asc(individualContacts.createdAt));

  return NextResponse.json({ contacts });
}

export async function POST(
  request: Request,
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

  const parsedBody = createContactSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const rateLimit = await validateContactAddition(
    parsedListId,
    verification.tenant.id,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.reason }, { status: 403 });
  }

  const duplicate = await db
    .select({ id: individualContacts.id })
    .from(individualContacts)
    .where(
      and(
        eq(individualContacts.listId, parsedListId),
        eq(individualContacts.email, parsedBody.data.email),
      ),
    )
    .limit(1);

  if (duplicate.length) {
    return NextResponse.json(
      { error: "Email already in list" },
      { status: 409 },
    );
  }

  const inserted = await db
    .insert(individualContacts)
    .values({
      listId: parsedListId,
      name: parsedBody.data.name,
      email: parsedBody.data.email,
    })
    .returning();

  return NextResponse.json({ contact: inserted[0] }, { status: 201 });
}
