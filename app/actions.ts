"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers"; 

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  
  // 1. Get the current website URL (works for Localhost AND Vercel)
  const origin = (await headers()).get("origin");

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