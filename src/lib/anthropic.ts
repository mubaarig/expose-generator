import Anthropic from "@anthropic-ai/sdk";
import type { PropertyInput, SectionKey } from "./types";
import { SECTIONS } from "./types";

// Model is server-side configurable; default = most capable Opus.
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

// Versioned so stored documents stay traceable as we evolve the prompt
// (recorded in documents.prompt_version).
export const PROMPT_VERSION = "expose-v2";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompt: defines role + hard output rules. This is the core of the
// "reliable output" story — the contract is defined centrally in one place
// and reused for every section.
const SYSTEM_PROMPT = `Du bist ein erfahrener Immobilienmakler und textest professionelle Wohnungs-Exposés auf Deutsch.

Regeln:
- Schreibe sachlich-ansprechend, in vollständigen Sätzen, ohne Übertreibungen oder Superlative-Gewitter.
- Erfinde keine Fakten. Nutze nur die gegebenen Eckdaten; wo Informationen fehlen, benenne das knapp oder formuliere allgemein statt zu spekulieren.
- Bewahre Eigennamen, Adressen und Straßennamen exakt wie eingegeben.
- Keine Anrede, keine Überschrift, keine Aufzählungszeichen — nur der Fließtext des angefragten Abschnitts.
- 2 bis 4 Sätze pro Abschnitt.
- Gib ausschließlich den Abschnittstext aus, ohne Vor- oder Nachspann.`;

function formatFacts(p: PropertyInput): string {
  const facts: string[] = [`Adresse: ${p.address}`];
  if (p.size_sqm != null) facts.push(`Wohnfläche: ${p.size_sqm} m²`);
  if (p.rooms != null) facts.push(`Zimmer: ${p.rooms}`);
  if (p.year_built != null) facts.push(`Baujahr: ${p.year_built}`);
  if (p.condition) facts.push(`Zustand: ${p.condition}`);
  if (p.notes) facts.push(`Notizen: ${p.notes}`);
  return facts.join("\n");
}

export function buildSectionPrompt(
  property: PropertyInput,
  section: SectionKey,
): { system: string; user: string } {
  const meta = SECTIONS.find((s) => s.key === section)!;
  const user = `Eckdaten der Immobilie:
${formatFacts(property)}

Schreibe den Exposé-Abschnitt "${meta.title}" (${meta.hint}).`;

  return { system: SYSTEM_PROMPT, user };
}
