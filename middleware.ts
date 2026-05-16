import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options); // ✅ actually sets cookies
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

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

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*", "/tier-selection"],
};
