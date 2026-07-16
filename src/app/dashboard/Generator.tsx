"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DocumentPreview, { type PreviewSectionState } from "@/components/DocumentPreview";
import FormSection from "@/components/FormSection";
import WorkflowStepper from "@/components/WorkflowStepper";
import { createClient } from "@/lib/supabase/client";
import { SECTION_KEYS, SECTIONS, type PropertyInput, type SectionKey } from "@/lib/types";

const emptyForm: PropertyInput = {
  address: "",
  size_sqm: null,
  rooms: null,
  year_built: null,
  condition: "",
  notes: "",
};

const demoForm: PropertyInput = {
  address: "Kirchengasse 18/7, 1070 Wien",
  size_sqm: 68,
  rooms: 3,
  year_built: 1904,
  condition: "gepflegt",
  notes: "Ruhige Innenhoflage, Fischgrätparkett, Flügeltüren, separate Küche, U3-Nähe, kleiner Balkon zum Innenhof",
};

const CONDITION_OPTIONS = ["neuwertig", "renoviert", "gepflegt", "teilsaniert", "renovierungsbedürftig"] as const;
const STREAM_ERROR_MARKER = "\n\u0000EXPOSE_GENERATION_ERROR\u0000";

const emptySections = (): Record<SectionKey, PreviewSectionState> =>
  Object.fromEntries(SECTION_KEYS.map((key) => [key, { text: "", status: "empty" }])) as Record<SectionKey, PreviewSectionState>;

export default function Generator({ model }: { model: string }) {
  const router = useRouter();
  const [form, setForm] = useState<PropertyInput>(emptyForm);
  const [sections, setSections] = useState<Record<SectionKey, PreviewSectionState>>(emptySections);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PropertyInput, string>>>({});

  const hasContent = SECTION_KEYS.some((key) => sections[key].status === "done");
  const hasStarted = SECTION_KEYS.some((key) => sections[key].status !== "empty");
  const completedCount = SECTION_KEYS.filter((key) => sections[key].status === "done").length;
  const activeStep = busy ? 2 : hasContent ? 3 : form.notes || form.condition ? 1 : 0;

  function num(value: string): number | null {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clearFieldError(field: keyof PropertyInput) {
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof PropertyInput, string>> = {};
    if (!form.address.trim()) errors.address = "Bitte geben Sie eine Objektadresse ein.";
    if (form.size_sqm == null) errors.size_sqm = "Bitte geben Sie die Wohnfläche ein.";
    if (form.rooms == null) errors.rooms = "Bitte geben Sie die Zimmeranzahl ein.";
    if (form.year_built == null) errors.year_built = "Bitte geben Sie das Baujahr ein.";
    if (!form.condition?.trim()) errors.condition = "Bitte wählen Sie den Zustand.";
    if (!form.notes?.trim()) errors.notes = "Bitte ergänzen Sie die Objektnotizen.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function generateSection(section: SectionKey) {
    setSections((current) => ({ ...current, [section]: { text: "", status: "streaming" } }));
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property: form, section }),
      });

      if (!response.ok || !response.body) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Generierung fehlgeschlagen (${response.status})`);
        }
        throw new Error("Der Generierungsdienst ist gerade nicht erreichbar. Bitte erneut versuchen.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const errorAt = text.indexOf(STREAM_ERROR_MARKER);
        if (errorAt >= 0) {
          const message = text.slice(errorAt + STREAM_ERROR_MARKER.length).trim();
          throw new Error(message || "Der Abschnitt konnte gerade nicht erstellt werden.");
        }
        setSections((current) => ({ ...current, [section]: { text, status: "streaming" } }));
      }
      setSections((current) => ({ ...current, [section]: { text, status: "done" } }));
    } catch (error) {
      setSections((current) => ({
        ...current,
        [section]: { text: error instanceof Error ? error.message : "Der Abschnitt konnte nicht erstellt werden.", status: "error" },
      }));
    }
  }

  async function generateAll() {
    if (!validateForm()) return;
    setBusy(true);
    setSaveMsg(null);
    await Promise.all(SECTION_KEYS.map(generateSection));
    setBusy(false);
  }

  function resetForm() {
    if (busy || saving) return;
    setForm(emptyForm);
    setSections(emptySections());
    setSaveMsg(null);
    setFormErrors({});
  }

  function useDemoData() {
    if (busy || saving) return;
    setForm(demoForm);
    setSections(emptySections());
    setSaveMsg(null);
    setFormErrors({});
  }

  function exposeText(): string {
    const body = SECTIONS.filter((section) => sections[section.key].status === "done")
      .map((section) => `${section.title.toUpperCase()}\n${sections[section.key].text}`)
      .join("\n\n");
    return `EXPOSÉ – ${form.address}\n\n${body}`;
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(exposeText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setSaveMsg("Fehler: Der Text konnte nicht kopiert werden.");
    }
  }

  function exportPdf() {
    const win = window.open("", "_blank", "width=800,height=1000");
    if (!win) {
      setSaveMsg("Fehler: Das Druckfenster wurde vom Browser blockiert.");
      return;
    }
    const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const blocks = SECTIONS.filter((section) => sections[section.key].status === "done")
      .map((section, index) => `<section><div class="eyebrow">${String(index + 1).padStart(2, "0")} · ${esc(section.title)}</div><p>${esc(sections[section.key].text).replace(/\n/g, "<br>")}</p></section>`)
      .join("");
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Exposé – ${esc(form.address)}</title><style>@page{margin:20mm}body{font-family:Arial,sans-serif;max-width:680px;margin:40px auto;color:#1d211d;line-height:1.7}header{border-bottom:1px solid #1d211d;padding-bottom:24px;margin-bottom:34px}h1{font-family:Georgia,serif;font-size:34px;line-height:1.1;margin:10px 0}.kicker,.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#a84f2c;font-weight:700}.meta{color:#777;font-size:12px}section{margin:0 0 28px}p{font-size:14px;margin:8px 0 0}footer{border-top:1px solid #ddd;margin-top:40px;padding-top:12px;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#888}</style></head><body><header><div class="kicker">Immobilienexposé</div><h1>${esc(form.address)}</h1><div class="meta">${form.size_sqm ?? "—"} m² · ${form.rooms ?? "—"} Zimmer · Baujahr ${form.year_built ?? "—"}</div></header>${blocks}<footer>KI-Entwurf · fachlich zu prüfen</footer></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaveMsg("Fehler: Sie sind nicht eingeloggt."); return; }

      const { data: property, error: propertyError } = await supabase
        .from("properties").insert({ ...form, user_id: user.id }).select().single();
      if (propertyError || !property) { setSaveMsg(`Fehler beim Speichern: ${propertyError?.message}`); return; }

      const content = Object.fromEntries(SECTION_KEYS.filter((key) => sections[key].status === "done").map((key) => [key, sections[key].text]));
      const { error: documentError } = await supabase.from("documents").insert({
        property_id: property.id,
        user_id: user.id,
        content,
        model,
        prompt_version: "expose-v2",
      });
      if (documentError) { setSaveMsg(`Fehler beim Speichern: ${documentError.message}`); return; }
      setSaveMsg("Exposé gespeichert. Der Entwurf wurde dem Archiv hinzugefügt.");
      router.refresh();
    } catch (error) {
      setSaveMsg(error instanceof Error ? `Fehler beim Speichern: ${error.message}` : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <WorkflowStepper active={activeStep} />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(340px,0.78fr)_minmax(520px,1.22fr)] xl:gap-9">
        <section className="border border-line bg-surface" aria-labelledby="object-form-title">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Objektdaten</p>
              <h2 id="object-form-title" className="mt-1 text-base font-semibold">Grundlage für den Entwurf</h2>
            </div>
            <button type="button" onClick={useDemoData} disabled={busy || saving} className="text-xs font-semibold text-accent transition-colors hover:text-accent-dark disabled:opacity-50">
              Beispieldaten verwenden
            </button>
          </header>

          <div className="px-5 py-6 sm:px-6">
            <FormSection number="01" title="Objektidentität" description="Adresse und zentrale Eckdaten des Objekts.">
              <div className="grid gap-4">
                <Field label="Objektadresse" required error={formErrors.address}>
                  <input required className={inputCls} autoComplete="street-address" value={form.address} onChange={(event) => { setForm({ ...form, address: event.target.value }); clearFieldError("address"); }} placeholder="Straße, Hausnummer, PLZ, Ort" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Wohnfläche" required error={formErrors.size_sqm} suffix="m²"><input required className={`${inputCls} pr-10 tabular-nums`} inputMode="decimal" value={form.size_sqm ?? ""} onChange={(event) => { setForm({ ...form, size_sqm: num(event.target.value) }); clearFieldError("size_sqm"); }} /></Field>
                  <Field label="Zimmer" required error={formErrors.rooms}><input required className={`${inputCls} tabular-nums`} inputMode="decimal" value={form.rooms ?? ""} onChange={(event) => { setForm({ ...form, rooms: num(event.target.value) }); clearFieldError("rooms"); }} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Baujahr" required error={formErrors.year_built}><input required className={`${inputCls} tabular-nums`} inputMode="numeric" value={form.year_built ?? ""} onChange={(event) => { setForm({ ...form, year_built: num(event.target.value) }); clearFieldError("year_built"); }} /></Field>
                  <Field label="Zustand" required error={formErrors.condition}><select required className={inputCls} value={form.condition ?? ""} onChange={(event) => { setForm({ ...form, condition: event.target.value }); clearFieldError("condition"); }}><option value="">Bitte wählen</option>{CONDITION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                </div>
              </div>
            </FormSection>

            <FormSection number="02" title="Angaben & Besonderheiten" description="Nur belegbare Merkmale angeben; fehlende Fakten werden nicht ergänzt.">
              <Field label="Objektnotizen" required error={formErrors.notes} hint={`${form.notes?.length ?? 0}/1.000 Zeichen`}>
                <textarea required className={`${inputCls} min-h-24 resize-y py-2.5`} maxLength={1000} value={form.notes ?? ""} onChange={(event) => { setForm({ ...form, notes: event.target.value }); clearFieldError("notes"); }} placeholder="Grundriss, Ausstattung, Lage, Modernisierungen und besondere Merkmale …" />
              </Field>
            </FormSection>

            <div className="border-t border-line pt-6">
              <button type="button" onClick={generateAll} disabled={busy} className="flex min-h-12 w-full items-center justify-between bg-ink px-4 text-sm font-semibold text-surface transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-45">
                <span>{busy ? "Exposé wird erstellt …" : hasStarted ? "Gesamten Entwurf neu erstellen" : "Exposé-Entwurf generieren"}</span>
                <span aria-hidden>{busy ? `${completedCount}/4` : "→"}</span>
              </button>

              {busy && (
                <div className="mt-4" aria-live="polite">
                  <div className="h-1 overflow-hidden bg-surface-muted"><span className="block h-full bg-accent transition-all duration-200" style={{ width: `${Math.max(8, completedCount * 25)}%` }} /></div>
                  <p className="mt-2 text-xs text-ink-soft">Abschnitte werden parallel formuliert und erscheinen direkt in der Vorschau.</p>
                </div>
              )}

              {hasContent && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button type="button" onClick={save} disabled={busy || saving} className="border border-line-strong px-2 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-muted disabled:opacity-50">{saving ? "Speichert …" : "Speichern"}</button>
                  <button type="button" onClick={copyAll} disabled={busy} className="border border-line-strong px-2 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-muted disabled:opacity-50">{copied ? "Kopiert ✓" : "Kopieren"}</button>
                  <button type="button" onClick={exportPdf} disabled={busy} className="border border-line-strong px-2 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-muted disabled:opacity-50">Als PDF</button>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-[11px] leading-5 text-ink-faint">KI-Entwurf · fachliche Prüfung erforderlich</p>
                <button type="button" onClick={resetForm} disabled={busy || saving} className="shrink-0 text-[11px] font-semibold text-ink-faint underline decoration-line-strong underline-offset-4 hover:text-ink disabled:opacity-40">Felder leeren</button>
              </div>

              {saveMsg && <p role="status" className={`mt-4 border px-3 py-3 text-xs leading-5 ${saveMsg.startsWith("Fehler") ? "border-error/20 bg-error-soft text-error" : "border-success/20 bg-success-soft text-success"}`}>{saveMsg}</p>}
            </div>
          </div>
        </section>

        <DocumentPreview property={form} sections={sections} busy={busy} onRegenerate={generateSection} />
      </div>
    </div>
  );
}

const inputCls = "h-11 w-full border border-line-strong bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-accent";

function Field({ label, required, error, suffix, hint, children }: { label: string; required?: boolean; error?: string | null; suffix?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-soft">
        <span>{label}{required && <span className="ml-1 text-accent" aria-hidden>*</span>}</span>
        {hint && <span className="font-normal tabular-nums text-ink-faint">{hint}</span>}
      </span>
      <span className="relative block">{children}{suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-faint">{suffix}</span>}</span>
      {error && <span className="text-xs text-error" role="alert">{error}</span>}
    </label>
  );
}
