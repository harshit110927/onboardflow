"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;

  // 1. Get the current website URL (works for Localhost AND Vercel)
  const origin = await getRequestOrigin();

  // 2. Send the Magic Link
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // Dynamic: Sends them to /auth/callback on the CURRENT site
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error("Login Error:", error);
    return redirect("/?error=true");
  }

  // 3. Send them to the waiting room (NOT Dashboard yet)
  return redirect("/check-email");
}

export async function signInWithGoogle() {
  "use server";
  const supabase = await createClient();
  const origin = await getRequestOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) throw error;
  if (data.url) redirect(data.url);
}