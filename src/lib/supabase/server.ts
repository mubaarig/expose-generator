import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-Client: für Server Components, Route Handler und Server Actions.
// In Next.js 16 ist cookies() async — daher await.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
