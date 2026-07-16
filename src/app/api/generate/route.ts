import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, buildSectionPrompt, MODEL } from "@/lib/anthropic";
import { SECTION_KEYS, type PropertyInput, type SectionKey } from "@/lib/types";

// Hard bounds on inputs. address/notes go into the prompt unchanged; without
// caps the input itself becomes a cost vector (× 4 parallel section calls).
const MAX_ADDRESS = 200;
const MAX_NOTES = 1000;
const MAX_CONDITION = 50;

// numeric: null allowed, otherwise a finite number in a sane range.
function numInRange(v: unknown, min: number, max: number): boolean {
  return (
    v == null ||
    (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max)
  );
}

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

  // 2) Validate inputs with hard bounds.
  let body: { property?: PropertyInput; section?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const section = body.section as SectionKey | undefined;
  if (!section || !SECTION_KEYS.includes(section)) {
    return NextResponse.json({ error: "Unbekannter Abschnitt" }, { status: 400 });
  }

  const property = body.property;
  const badRequest = (msg: string) =>
    NextResponse.json({ error: msg }, { status: 400 });

  if (!property?.address?.trim()) {
    return badRequest("Adresse ist erforderlich");
  }
  if (property.address.length > MAX_ADDRESS) {
    return badRequest(`Adresse ist zu lang (max. ${MAX_ADDRESS} Zeichen).`);
  }
  if (typeof property.notes === "string" && property.notes.length > MAX_NOTES) {
    return badRequest(`Notizen sind zu lang (max. ${MAX_NOTES} Zeichen).`);
  }
  if (
    typeof property.condition === "string" &&
    property.condition.length > MAX_CONDITION
  ) {
    return badRequest("Zustand ist ungültig.");
  }
  if (!numInRange(property.size_sqm, 0, 100_000)) {
    return badRequest("Wohnfläche ist ungültig.");
  }
  if (!numInRange(property.rooms, 0, 1_000)) {
    return badRequest("Zimmeranzahl ist ungültig.");
  }
  if (!numInRange(property.year_built, 1000, new Date().getFullYear() + 5)) {
    return badRequest("Baujahr ist ungültig.");
  }

  // 3) Check the quota BEFORE the (paid) API call. Fail CLOSED: on an RPC error
  //    or a denial we never call Anthropic. The per-user daily limit (stricter
  //    for anonymous demo users) and the org-wide daily token ceiling live in
  //    check_generation_allowed(); both read identity from the JWT, so they
  //    cannot be spoofed by a direct RPC call.
  const { data: gate, error: gateErr } = await supabase.rpc(
    "check_generation_allowed",
  );
  if (gateErr) {
    console.error("Quota check failed (failing closed):", gateErr);
    return NextResponse.json(
      { error: "Kontingent konnte nicht geprüft werden. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }
  if (gate && (gate as { allowed?: boolean }).allowed === false) {
    const g = gate as { reason?: string };
    return NextResponse.json(
      { error: g.reason ?? "Limit erreicht" },
      { status: 429 },
    );
  }

  const { system, user: userPrompt } = buildSectionPrompt(property, section);

  // 4) Stream the response. text/plain so the client can show tokens directly.
  const encoder = new TextEncoder();

  // If the client disconnects (tab closed, navigation, cancelled fetch), abort
  // the Anthropic stream instead of paying for tokens nobody is reading.
  let modelStream: ReturnType<typeof anthropic.messages.stream> | null = null;
  request.signal.addEventListener("abort", () => modelStream?.abort());

  const stream = new ReadableStream({
    async start(controller) {
      try {
        modelStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 400,
          temperature: 0.5,
          system,
          messages: [{ role: "user", content: userPrompt }],
        });

        modelStream.on("text", (delta: string) => {
          controller.enqueue(encoder.encode(delta));
        });

        const finalMsg = await modelStream.finalMessage();

        // Record usage with the real token counts. Fail OPEN: a logging error
        // must not fail a generation the user has already received.
        const { error: usageErr } = await supabase
          .from("generation_usage")
          .insert({
            user_id: user.id,
            section,
            model: MODEL,
            input_tokens: finalMsg.usage?.input_tokens ?? 0,
            output_tokens: finalMsg.usage?.output_tokens ?? 0,
          });
        if (usageErr) {
          console.error("Usage logging failed:", usageErr);
        }

        controller.close();
      } catch (err) {
        // A client abort is not an error — close the stream quietly.
        if (request.signal.aborted) {
          try {
            controller.close();
          } catch {
            // already closed — ignore.
          }
          return;
        }
        console.error("Generation failed:", err);
        controller.error(err);
      }
    },
    cancel() {
      modelStream?.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
