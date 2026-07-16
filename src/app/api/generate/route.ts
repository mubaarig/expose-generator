import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, buildSectionPrompt, MODEL } from "@/lib/anthropic";
import { SECTION_KEYS, type PropertyInput, type SectionKey } from "@/lib/types";

// Generates ONE exposé section and streams the text back token by token.
// The client calls the route for each section (in parallel) — the same route
// covers both first generation and "regenerate section".
//
// The Anthropic API key is used exclusively here on the server and never
// reaches the browser.
export async function POST(request: NextRequest) {
  // 1) Enforce auth — only logged-in users may generate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  // 2) Validate inputs.
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

  // 3) Stream the response. text/plain so the client can show tokens directly.
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
        console.error("Generation failed:", err);
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
