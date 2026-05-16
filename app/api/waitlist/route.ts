import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { waitlistEntries } from "@/db/schema";

const waitlistSchema = z.object({
  email: z.string().trim().email().max(255),
});

function getClientUserAgent(request: Request) {
  const userAgent = request.headers.get("user-agent")?.trim();
  return userAgent ? userAgent.slice(0, 1000) : null;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();

  try {
    await db.insert(waitlistEntries).values({
      email,
      source: "v2_landing",
      userAgent: getClientUserAgent(request),
    });

    return NextResponse.json({ message: "You are on the waitlist." }, { status: 201 });
  } catch (error) {
    const maybePgError = error as { code?: string; message?: string };

    // Treat duplicate signup attempts as a safe success so we do not leak list membership
    // or annoy people who submit the same email twice.
    if (maybePgError.code === "23505" || maybePgError.message?.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ message: "You are already on the waitlist." }, { status: 200 });
    }

    console.error("Waitlist insert failed", error);
    return NextResponse.json({ error: "Unable to join the waitlist right now" }, { status: 500 });
  }
}
