import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";

// Server-Client: für Server Components, Route Handler und Server Actions.
// In Next.js 16 ist cookies() async — daher await.
export async function createClient() {
  const cookieStore = await cookies();
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // In Server Components ist Schreiben nicht erlaubt — das
            // Session-Refresh übernimmt die Middleware. Hier bewusst ignorieren.
          }
        },
      },
    },
  );
}
