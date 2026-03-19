// NEW FILE — created for tier selection feature
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "next/dist/compiled/zod";

import { db } from "@/db";
import { individualLists, tenants } from "@/db/schema";
import { validateListCreation } from "@/lib/rate-limit/individual";
import { createClient } from "@/utils/supabase/server";

const createListSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
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

export async function GET() {
  const verification = await getVerifiedIndividualTenant();
  if ("errorResponse" in verification) {
    return verification.errorResponse;
  }

  const lists = await db
    .select()
    .from(individualLists)
    .where(eq(individualLists.userId, verification.tenant.id))
    .orderBy(desc(individualLists.createdAt));

  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const verification = await getVerifiedIndividualTenant();
  if ("errorResponse" in verification) {
    return verification.errorResponse;
  }

  const body = await request.json();
  const parsed = createListSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const rateLimit = await validateListCreation(verification.tenant.id);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.reason }, { status: 403 });
  }

  const inserted = await db
    .insert(individualLists)
    .values({
      userId: verification.tenant.id,
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .returning();

  return NextResponse.json({ list: inserted[0] }, { status: 201 });
}
