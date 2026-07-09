"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  SECTIONS,
  SECTION_KEYS,
  type PropertyInput,
  type SectionKey,
} from "@/lib/types";

type SectionState = {
  text: string;
  status: "empty" | "streaming" | "done" | "error";
};

const emptyForm: PropertyInput = {
  address: "",
  size_sqm: null,
  rooms: null,
  year_built: null,
  condition: "",
  notes: "",
};

const emptySections = (): Record<SectionKey, SectionState> =>
  Object.fromEntries(
    SECTION_KEYS.map((k) => [k, { text: "", status: "empty" }]),
  ) as Record<SectionKey, SectionState>;

export default function Generator() {
  const router = useRouter();
  const [form, setForm] = useState<PropertyInput>(emptyForm);
  const [sections, setSections] =
    useState<Record<SectionKey, SectionState>>(emptySections);
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  function num(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Streamt einen Abschnitt tokenweise in seine Karte.
  async function generateSection(section: SectionKey) {
    setSections((s) => ({ ...s, [section]: { text: "", status: "streaming" } }));

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property: form, section }),
      });

      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Fehler ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setSections((s) => ({
          ...s,
          [section]: { text: acc, status: "streaming" },
        }));
      }
      setSections((s) => ({
        ...s,
        [section]: { text: acc, status: "done" },
      }));
    } catch (err) {
      setSections((s) => ({
        ...s,
        [section]: {
          text: err instanceof Error ? err.message : "Fehler",
          status: "error",
        },
      }));
    }
  }

  // Alle vier Abschnitte parallel generieren.
  async function generateAll() {
    if (!form.address.trim()) return;
    setBusy(true);
    setSaveMsg(null);
    await Promise.all(SECTION_KEYS.map(generateSection));
    setBusy(false);
  }

  const hasContent = SECTION_KEYS.some((k) => sections[k].status === "done");

  // Property + Dokument in Supabase speichern (RLS erzwingt Eigentum).
  async function save() {
    setSaveMsg(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveMsg("Nicht eingeloggt.");
      return;
    }

    const { data: property, error: pErr } = await supabase
      .from("properties")
      .insert({ ...form, user_id: user.id })
      .select()
      .single();

    if (pErr || !property) {
      setSaveMsg(`Fehler beim Speichern: ${pErr?.message}`);
      return;
    }

    const content = Object.fromEntries(
      SECTION_KEYS.filter((k) => sections[k].status === "done").map((k) => [
        k,
        sections[k].text,
      ]),
    );

    const { error: dErr } = await supabase.from("documents").insert({
      property_id: property.id,
      user_id: user.id,
      content,
      model: "claude-opus-4-8",
      prompt_version: "expose-v1",
    });

    if (dErr) {
      setSaveMsg(`Fehler beim Speichern: ${dErr.message}`);
      return;
    }

    setSaveMsg("Gespeichert ✓");
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      {/* Eingabeformular */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Eckdaten
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Adresse *">
            <input
              className={inputCls}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Musterstraße 1, 10115 Berlin"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Wohnfläche (m²)">
              <input
                className={inputCls}
                inputMode="decimal"
                value={form.size_sqm ?? ""}
                onChange={(e) =>
                  setForm({ ...form, size_sqm: num(e.target.value) })
                }
              />
            </Field>
            <Field label="Zimmer">
              <input
                className={inputCls}
                inputMode="decimal"
                value={form.rooms ?? ""}
                onChange={(e) =>
                  setForm({ ...form, rooms: num(e.target.value) })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Baujahr">
              <input
                className={inputCls}
                inputMode="numeric"
                value={form.year_built ?? ""}
                onChange={(e) =>
                  setForm({ ...form, year_built: num(e.target.value) })
                }
              />
            </Field>
            <Field label="Zustand">
              <input
                className={inputCls}
                value={form.condition ?? ""}
                onChange={(e) =>
                  setForm({ ...form, condition: e.target.value })
                }
                placeholder="neuwertig"
              />
            </Field>
          </div>
          <Field label="Notizen">
            <textarea
              className={`${inputCls} min-h-20 resize-y`}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Süd-Balkon, EBK 2021, ruhige Seitenstraße…"
            />
          </Field>

          <button
            onClick={generateAll}
            disabled={busy || !form.address.trim()}
            className="mt-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "Generiere…" : "Exposé generieren"}
          </button>

          {hasContent && (
            <button
              onClick={save}
              disabled={busy}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Speichern
            </button>
          )}
          {saveMsg && (
            <p className="text-sm text-zinc-500">{saveMsg}</p>
          )}
        </div>
      </div>

      {/* Abschnitte */}
      <div className="flex flex-col gap-4">
        {SECTIONS.map(({ key, title, hint }) => {
          const st = sections[key];
          return (
            <section
              key={key}
              className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {title}
                  </h3>
                  <p className="text-xs text-zinc-400">{hint}</p>
                </div>
                {st.status !== "empty" && (
                  <button
                    onClick={() => generateSection(key)}
                    disabled={st.status === "streaming"}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-40 dark:hover:text-zinc-100"
                  >
                    {st.status === "streaming" ? "…" : "↻ Neu"}
                  </button>
                )}
              </div>
              <div className="mt-3 min-h-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {st.status === "empty" ? (
                  <span className="text-zinc-400">Noch nicht generiert.</span>
                ) : st.status === "error" ? (
                  <span className="text-red-600">{st.text}</span>
                ) : st.status === "streaming" && !st.text ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                    <span>Generiere…</span>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {st.text}
                    {st.status === "streaming" && (
                      <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-zinc-400 align-middle" />
                    )}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
