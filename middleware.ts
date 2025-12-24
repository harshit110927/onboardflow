import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware"; // 👈 This imports the file you just showed me

export async function middleware(request: NextRequest) {
  //  1. IGNORE AUTH for Stripe Webhooks
  // This lets the "robot" pass through without logging in.
  if (request.nextUrl.pathname.startsWith("/api/webhook")) {
    return NextResponse.next();
  }

  // 2. For everything else, check Supabase Auth
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};