import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

// Browser client: runs in the Client Component context and uses only the
// public anon key. Data isolation comes from RLS, not from the key.
export function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error(
      "Invalid Supabase configuration. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
    );
  }

  return createBrowserClient(env.url, env.anonKey);
}
