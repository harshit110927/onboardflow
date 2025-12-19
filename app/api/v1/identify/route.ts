import { db } from "@/db";
import { tenants, endUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("--------------- HIT IDENTIFY ENDPOINT ---------------");

    // 1. Check Headers
    const apiKey = req.headers.get("x-api-key");
    console.log("🔑 API Key Received:", apiKey ? "Yes (Hidden)" : "NULL");

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 401 });
    }

    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.apiKey, apiKey)
    });
    
    if (!tenant) {
        console.log("❌ Tenant not found for this key");
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }
    console.log("✅ Tenant Found:", tenant.email);

    // 2. Parse Body (The suspected problem area)
    // We will read it as TEXT first to see exactly what the browser sent
    const rawBody = await req.text();
    console.log("📦 Raw Request Body:", rawBody);

    if (!rawBody) {
         console.log("❌ Body is empty!");
         return NextResponse.json({ error: "Empty Body" }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    console.log("🧩 Parsed JSON:", body);

    const { email, event } = body;
    console.log("📧 Extracted Email:", email);

    if (!email) {
        console.log("❌ Validation Failed: Email is missing");
        return NextResponse.json({ error: "Email required", received: body }, { status: 400 });
    }

    // 3. Find/Create User
    let user = await db.query.endUsers.findFirst({
        where: and(eq(endUsers.tenantId, tenant.id), eq(endUsers.email, email))
    });

    if (!user) {
        console.log("✨ Creating new user...");
        [user] = await db.insert(endUsers).values({
            tenantId: tenant.id,
            email: email,
            externalId: email,
            completedSteps: [],
            createdAt: new Date(),
            lastSeenAt: new Date()
        }).returning();
    } else {
        console.log("👤 Existing user found");
    }

    // 4. Update Steps
    if (event) {
        console.log("⚡ Processing Event:", event);
        const currentSteps = user.completedSteps as string[] || [];
        if (!currentSteps.includes(event)) {
            await db.update(endUsers)
                .set({ 
                    completedSteps: [...currentSteps, event],
                    lastSeenAt: new Date() 
                })
                .where(eq(endUsers.id, user.id));
        }
    }

    console.log("--------------- DONE ---------------");
    return NextResponse.json({ success: true });

  } catch (error) {
      console.error("🔥 SERVER CRASH:", error);
      return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}