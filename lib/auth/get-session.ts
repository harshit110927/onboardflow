import { cache } from "react";

import { createClient } from "@/utils/supabase/server";

export const getSession = cache(async () => {
  const supabase = await createClient();
  console.time("[AUTH] getUser");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.timeEnd("[AUTH] getUser");

  return { user };
});
