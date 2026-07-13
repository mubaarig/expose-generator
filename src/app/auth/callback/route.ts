import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ziel des Magic-Link-Klicks. Supabase (PKCE-Flow) hängt einen ?code an;
// wir tauschen ihn gegen eine Session und leiten weiter.
function loginWithError(
  origin: string,
  code: string,
  description?: string | null,
): string {
  const params = new URLSearchParams({ error_code: code });
  if (description) params.set("error_description", description);
  return `${origin}/login?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Supabase kann den Fehler auch direkt an den Callback hängen (statt an /).
  const passthroughError = searchParams.get("error_code") ?? searchParams.get("error");
  if (passthroughError) {
    return NextResponse.redirect(
      loginWithError(origin, passthroughError, searchParams.get("error_description")),
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(loginWithError(origin, "exchange_failed", error.message));
  }

  return NextResponse.redirect(loginWithError(origin, "missing_code"));
}
