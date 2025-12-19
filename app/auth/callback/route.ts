import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // 1. Get the URL info
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // If there is a 'next' param (like /dashboard), use it. Otherwise go to /dashboard.
  const next = requestUrl.searchParams.get("next") || "/dashboard"; 
  const origin = requestUrl.origin;

  // 2. Exchange the Code for a Session
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Forward the user to the Dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  //Error or No Code? Send them back t
  console.error("Auth Error: Invalid code or session exchange failed");
  return NextResponse.redirect(`${origin}/`);
}