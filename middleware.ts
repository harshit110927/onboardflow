import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // This code will ONLY run for the routes listed in config below.
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 👇 PROTECT ONLY THESE ROUTES
    // The middleware will ONLY wake up for URLs starting with /dashboard or /account
    "/dashboard/:path*",
    "/account/:path*",
    
    // 🛑 NOTICE: We do NOT list "/api/webhook" here.
    // Since it is not in this list, Next.js will skip this file entirely.
  ],
};