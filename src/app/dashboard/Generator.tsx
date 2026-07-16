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

const demoForm: PropertyInput = {
  address: "Marzstraße 109/8, 1150 Wien",
  size_sqm: 43,
  rooms: 1,
  year_built: 1918,
  condition: "renoviert",
  notes: "Süd-Balkon, EBK 2021, U3-Nähe, ruhige Seitenstraße",
};

const CONDITION_OPTIONS = [
  "neuwertig",
  "renoviert",
  "gepflegt",
  "teilsaniert",
  "renovierungsbedürftig",
] as const;

const emptySections = (): Record<SectionKey, SectionState> =>
  Object.fromEntries(
    SECTION_KEYS.map((k) => [k, { text: "", status: "empty" }]),
  ) as Record<SectionKey, SectionState>;

export default function Generator() {
  const router = useRouter();
  // Prefilled example: visitors see filled-in fields right away and can click
  // "Exposé generieren" immediately.
  const [form, setForm] = useState<PropertyInput>(demoForm);
  const [sections, setSections] =
    useState<Record<SectionKey, SectionState>>(emptySections);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function num(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Streams a section token by token into its card.
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

  // Generate all four sections in parallel.
  async function generateAll() {
    if (!form.address.trim()) return;
    setBusy(true);
    setSaveMsg(null);
    await Promise.all(SECTION_KEYS.map(generateSection));
    setBusy(false);
  }

  const hasContent = SECTION_KEYS.some((k) => sections[k].status === "done");

  function resetForm() {
    setForm(emptyForm);
    setSections(emptySections());
    setSaveMsg(null);
  }

  // Finished sections as cleanly formatted text.
  function exposeText(): string {
    const body = SECTIONS.filter((s) => sections[s.key].status === "done")
      .map((s) => `${s.title.toUpperCase()}\n${sections[s.key].text}`)
      .join("\n\n");
    return `EXPOSÉ – ${form.address}\n\n${body}`;
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(exposeText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setSaveMsg("Fehler: Kopieren nicht möglich.");
    }
  }

  // Print view in a new window → browser "Save as PDF".
  function exportPdf() {
    const win = window.open("", "_blank", "width=800,height=1000");
    if (!win) return;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const blocks = SECTIONS.filter((s) => sections[s.key].status === "done")
      .map(
        (s) =>
          `<h2>${esc(s.title)}</h2><p>${esc(sections[s.key].text).replace(/\n/g, "<br>")}</p>`,
      )
      .join("");
    win.document.write(
      `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Exposé – ${esc(
        form.address,
      )}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:48px auto;padding:0 24px;color:#18181b;line-height:1.6}h1{font-size:22px;margin:0 0 4px}.meta{color:#71717a;font-size:13px;margin:0 0 28px}h2{font-size:15px;margin:24px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:#3f3f46}p{margin:0}</style></head><body><h1>Exposé</h1><p class="meta">${esc(
        form.address,
      )}</p>${blocks}</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }

  // Save property + document to Supabase (RLS enforces ownership).
  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveMsg(null);

    try {
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
        prompt_version: "expose-v2",
      });

      if (dErr) {
        setSaveMsg(`Fehler beim Speichern: ${dErr.message}`);
        return;
      }

      setSaveMsg("Exposé wurde gespeichert.");
      router.refresh();
    } catch (err) {
      setSaveMsg(
        err instanceof Error ? `Fehler beim Speichern: ${err.message}` : "Fehler beim Speichern.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      {/* Input form */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Eckdaten
          </h2>
          <button
            type="button"
            onClick={resetForm}
            disabled={busy || saving}
            className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Felder leeren
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Adresse *">
            <input
              className={inputCls}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Marzstraße 109/8, 1150 Wien"
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
              <select
                className={inputCls}
                value={form.condition ?? ""}
                onChange={(e) =>
                  setForm({ ...form, condition: e.target.value })
                }
              >
                <option value="">Bitte wählen</option>
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notizen">
            <textarea
              className={`${inputCls} min-h-20 resize-y`}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Süd-Balkon, EBK 2021, U3-Nähe, ruhige Seitenstraße…"
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
              disabled={busy || saving}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {saving ? "Speichere…" : "Exposé speichern"}
            </button>
          )}
          {saveMsg && (
            <p
              className={`text-sm ${
                saveMsg.startsWith("Fehler") || saveMsg === "Nicht eingeloggt."
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              {saveMsg}
            </p>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-4">
        {hasContent && (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={copyAll}
              disabled={busy}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {copied ? "Kopiert ✓" : "Text kopieren"}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={busy}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Als PDF
            </button>
          </div>
        )}
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
