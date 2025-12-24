import { NextResponse } from "next/server";
import { db } from "@/db"; 
import { tenants } from "@/db/schema"; 
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    console.log("API Endpoint hit!");

    // 1. Get the Key from the Header
    const authHeader = request.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Missing API Key" }, { status: 401 });
    }

    const apiKey = authHeader.split(" ")[1];
    console.log(`Key received: ${apiKey}`);

    // 2. VALIDATION: Check the 'tenants' table using Drizzle
    // This looks at the SAME table your Dashboard uses.
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.apiKey, apiKey),
      columns: {
        id: true,
        email: true,
        name: true
      }
    });

    if (!tenant) {
      console.warn(`Invalid Key: ${apiKey}`);
      return NextResponse.json({ success: false, error: "Invalid API Key" }, { status: 401 });
    }

    // 3. Success!
    console.log(`Authorized! Tenant: ${tenant.email}`);
    
    // --- YOUR BUSINESS LOGIC ---
    const body = await request.json();
    
    return NextResponse.json({ 
      success: true, 
      message: `User ${body.email} onboarded successfully!`,
      tenantId: tenant.id
    });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}