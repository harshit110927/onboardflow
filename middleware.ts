// MODIFIED — tier selection
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/utils/supabase/middleware";

// MODIFIED — tier selection
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          return;
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname === "/tier-selection" && !user?.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user?.email) {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("tier")
      .eq("email", user.email)
      .limit(1)
      .maybeSingle<{ tier: "enterprise" | "individual" | null }>();

    const tier = tenantRow?.tier ?? null;

    if (pathname.startsWith("/dashboard")) {
      if (!tier && pathname !== "/tier-selection") {
        return NextResponse.redirect(new URL("/tier-selection", request.url));
      }
    }

    if (pathname === "/tier-selection" && tier) {
      return NextResponse.redirect(new URL(`/dashboard/${tier}`, request.url));
    }
  }

  return updateSession(request);
}

// MODIFIED — tier selection
export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*", "/tier-selection"],
};
