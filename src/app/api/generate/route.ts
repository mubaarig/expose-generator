import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, buildSectionPrompt, MODEL } from "@/lib/anthropic";
import { SECTION_KEYS, type PropertyInput, type SectionKey } from "@/lib/types";

// Generiert EINEN Exposé-Abschnitt und streamt den Text tokenweise zurück.
// Der Client ruft die Route für jeden Abschnitt (parallel) auf — dieselbe
// Route deckt Erst-Generierung und "Abschnitt neu generieren" ab.
//
// Der Anthropic-API-Key wird ausschließlich hier serverseitig verwendet und
// erreicht den Browser nie.
export async function POST(request: NextRequest) {
  // 1) Auth erzwingen — nur eingeloggte Nutzer dürfen generieren.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  // 2) Eingaben validieren.
  let body: { property?: PropertyInput; section?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const section = body.section as SectionKey | undefined;
  if (!section || !SECTION_KEYS.includes(section)) {
    return NextResponse.json(
      { error: "Unbekannter Abschnitt" },
      { status: 400 },
    );
  }
  if (!body.property?.address?.trim()) {
    return NextResponse.json(
      { error: "Adresse ist erforderlich" },
      { status: 400 },
    );
  }

  const { system, user: userPrompt } = buildSectionPrompt(
    body.property,
    section,
  );

  // 3) Antwort streamen. text/plain, damit der Client Tokens direkt anzeigt.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const modelStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system,
          messages: [{ role: "user", content: userPrompt }],
        });

        modelStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await modelStream.finalMessage();
        controller.close();
      } catch (err) {
        console.error("Generierung fehlgeschlagen:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
