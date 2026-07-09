import { createBrowserClient } from "@supabase/ssr";

// Browser-Client: läuft im Client Component-Kontext, nutzt ausschließlich
// den öffentlichen anon-Key. Datenschutz kommt aus RLS, nicht aus dem Key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
