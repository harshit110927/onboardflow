"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function generateApiKey() {
  const supabase = await createClient();
  
  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // 2. Generate a random key (sk_live_...)
  const key = "sk_live_" + crypto.randomBytes(16).toString("hex");

  // 3. Save to Database
  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    key: key,
    label: "Default Key"
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  return key;
}