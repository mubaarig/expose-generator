// Shared domain types.

export type Property = {
  id: string;
  user_id: string;
  address: string;
  size_sqm: number | null;
  rooms: number | null;
  year_built: number | null;
  condition: string | null;
  notes: string | null;
  created_at: string;
};

// Input for generation (there may not be an id yet before saving).
export type PropertyInput = {
  address: string;
  size_sqm: number | null;
  rooms: number | null;
  year_built: number | null;
  condition: string | null;
  notes: string | null;
};

export const SECTION_KEYS = [
  "lage",
  "ausstattung",
  "zustand",
  "fazit",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export type ExposeContent = Partial<Record<SectionKey, string>>;

export type ExposeDocument = {
  id: string;
  property_id: string;
  user_id: string;
  content: ExposeContent;
  model: string | null;
  prompt_version: string | null;
  created_at: string;
};

// Display metadata per section (order = display order).
export const SECTIONS: { key: SectionKey; title: string; hint: string }[] = [
  { key: "lage", title: "Lage", hint: "Umgebung, Anbindung, Wohngefühl" },
  {
    key: "ausstattung",
    title: "Ausstattung",
    hint: "Grundriss, Materialien, Besonderheiten",
  },
  { key: "zustand", title: "Zustand", hint: "Bauzustand, Modernisierungen" },
  { key: "fazit", title: "Fazit", hint: "Zusammenfassende Einordnung" },
];
