import { SECTIONS, type PropertyInput, type SectionKey } from "@/lib/types";
import StatusBadge from "./StatusBadge";

export type PreviewSectionState = {
  text: string;
  status: "empty" | "streaming" | "done" | "error";
};

export default function DocumentPreview({
  property,
  sections,
  busy,
  onRegenerate,
}: {
  property: PropertyInput;
  sections: Record<SectionKey, PreviewSectionState>;
  busy: boolean;
  onRegenerate: (section: SectionKey) => void;
}) {
  const completed = SECTIONS.filter((section) => sections[section.key].status === "done").length;
  const hasContent = SECTIONS.some((section) => sections[section.key].status !== "empty");

  return (
    <div className="lg:sticky lg:top-24">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">Dokumentvorschau</p>
          <p className="mt-1 text-xs text-ink-soft">{completed} von 4 Abschnitten erstellt</p>
        </div>
        <StatusBadge tone={busy ? "accent" : completed === 4 ? "success" : "neutral"}>
          {busy ? "Wird erstellt" : completed === 4 ? "Zur Prüfung" : "KI-Entwurf"}
        </StatusBadge>
      </div>

      <article className="paper-shadow min-h-[780px] bg-surface px-6 py-8 sm:px-10 sm:py-11 xl:px-14 xl:py-14" aria-label="Exposé-Dokumentvorschau">
        <header className="border-b border-ink pb-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Immobilienexposé</p>
              <h2 className="font-editorial mt-3 max-w-xl text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">
                {property.address.trim() || "Adresse des Objekts"}
              </h2>
            </div>
            <span className="grid size-10 shrink-0 place-items-center bg-ink text-[10px] font-bold text-surface">EW</span>
          </div>

          <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-4 text-xs sm:grid-cols-4">
            <Meta label="Wohnfläche" value={property.size_sqm != null ? `${property.size_sqm} m²` : "—"} />
            <Meta label="Zimmer" value={property.rooms != null ? String(property.rooms) : "—"} />
            <Meta label="Baujahr" value={property.year_built != null ? String(property.year_built) : "—"} />
            <Meta label="Zustand" value={property.condition || "—"} />
          </dl>
        </header>

        {!hasContent && (
          <div className="grid min-h-[480px] place-items-center py-16 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-12 place-items-center rounded-full border border-line text-lg text-accent" aria-hidden>✱</span>
              <h3 className="font-editorial mt-5 text-2xl">Bereit für Ihren Entwurf.</h3>
              <p className="mt-3 text-sm leading-6 text-ink-soft">
                Erfassen Sie links die Objektdaten. Die generierten Abschnitte erscheinen anschließend hier als zusammenhängendes Dokument.
              </p>
            </div>
          </div>
        )}

        {hasContent && (
          <div className="space-y-9 py-9">
            {SECTIONS.map(({ key, title }, index) => {
              const state = sections[key];
              if (state.status === "empty") return null;
              return (
                <section key={key} className="group">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                      {String(index + 1).padStart(2, "0")} · {title}
                    </p>
                    {state.status !== "streaming" && (
                      <button type="button" onClick={() => onRegenerate(key)} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint opacity-100 transition-colors hover:text-accent lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100">
                        Neu erstellen
                      </button>
                    )}
                  </div>
                  {state.status === "error" ? (
                    <div className="mt-3 border-l-2 border-error bg-error-soft px-4 py-3 text-sm leading-6 text-error">
                      {state.text} <button type="button" onClick={() => onRegenerate(key)} className="ml-1 font-semibold underline underline-offset-2">Erneut versuchen</button>
                    </div>
                  ) : state.status === "streaming" && !state.text ? (
                    <div className="mt-4 space-y-2" aria-label={`${title} wird erstellt`}>
                      <span className="block h-2 w-full animate-pulse bg-surface-muted" />
                      <span className="block h-2 w-5/6 animate-pulse bg-surface-muted" />
                      <span className="block h-2 w-2/3 animate-pulse bg-surface-muted" />
                    </div>
                  ) : (
                    <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-ink-soft">
                      {state.text}
                      {state.status === "streaming" && <span className="ml-1 inline-block h-4 w-px animate-pulse bg-accent align-middle" />}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <footer className="mt-auto flex items-center justify-between border-t border-line pt-5 text-[9px] uppercase tracking-[0.15em] text-ink-faint">
          <span>KI-Entwurf · fachlich zu prüfen</span><span>Exposé Werkstatt</span>
        </footer>
      </article>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">{label}</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{value}</dd></div>;
}
