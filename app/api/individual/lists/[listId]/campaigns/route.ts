// NEW FILE — created for tier selection feature
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "next/dist/compiled/zod";

import { db } from "@/db";
import { individualCampaigns, individualLists, tenants } from "@/db/schema";
import { validateCampaignCreation } from "@/lib/rate-limit/individual";
import { createClient } from "@/utils/supabase/server";

const createCampaignSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
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

  const campaigns = await db
    .select()
    .from(individualCampaigns)
    .where(eq(individualCampaigns.listId, parsedListId))
    .orderBy(desc(individualCampaigns.createdAt));

  return NextResponse.json({ campaigns });
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

  const parsedBody = createCampaignSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const rateLimit = await validateCampaignCreation(
    parsedListId,
    verification.tenant.id,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.reason }, { status: 403 });
  }

  const inserted = await db
    .insert(individualCampaigns)
    .values({
      listId: parsedListId,
      subject: parsedBody.data.subject,
      body: parsedBody.data.body,
      status: "draft",
      scheduledAt: parsedBody.data.scheduledAt
        ? new Date(parsedBody.data.scheduledAt)
        : undefined,
    })
    .returning();

  return NextResponse.json({ campaign: inserted[0] }, { status: 201 });
}
