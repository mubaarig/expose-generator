import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!getSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
