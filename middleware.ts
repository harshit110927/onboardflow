import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // 🔍 LOG EVERYTHING
  console.log(`[Middleware] Processing: ${request.nextUrl.pathname}`);

  // If this logs for "/api/webhook/stripe", the Matcher is BROKEN.
  
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    // We expect the middleware to NOT run for anything else
  ],
};