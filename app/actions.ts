"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;

  // 1. Send the Magic Link via Supabase
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true, // Allows new users to sign up
      // IMPORTANT: This must match your localhost URL
      emailRedirectTo: "http://localhost:3000/auth/callback", 
    },
  });

  if (error) {
    console.error("Login Error:", error);
    // In a real app, you would return this error to display it
    return redirect("/?error=true");
  }

  // 2. Redirect to a generic "Check your email" page
  // (Or just back to home, where you can show a success message)
  redirect("/dashboard"); // Or wherever you want them to land while they wait
}