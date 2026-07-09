import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

// Hält die Auth-Session frisch (Token-Refresh) und schützt App-Routen.
// Wird aus src/proxy.ts bei jedem passenden Request aufgerufen.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const env = getSupabaseEnv();

  if (!env) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // WICHTIG: getUser() unmittelbar nach dem Client-Erstellen aufrufen —
  // sonst können User zufällig ausgeloggt werden (Supabase-SSR-Empfehlung).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard");
  const isAuthPage = path === "/login";

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
