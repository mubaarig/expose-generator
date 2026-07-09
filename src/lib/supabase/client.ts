import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

// Browser-Client: läuft im Client Component-Kontext, nutzt ausschließlich
// den öffentlichen anon-Key. Datenschutz kommt aus RLS, nicht aus dem Key.
export function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error(
      "Supabase-Konfiguration ist ungültig. Prüfe NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
    );
  }

  return createBrowserClient(env.url, env.anonKey);
}
