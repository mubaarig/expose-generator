import Brand from "@/components/Brand";
import StatusBadge from "@/components/StatusBadge";
import { MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { SECTIONS, type ExposeContent } from "@/lib/types";
import Generator from "./Generator";

type DocRow = {
  id: string;
  created_at: string;
  content: ExposeContent;
  properties: { address: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("documents")
    .select("id, created_at, content, properties(address)")
    .order("created_at", { ascending: false })
    .limit(10);

  const documents = (data ?? []) as unknown as DocRow[];

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand href="/dashboard" />
          <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex" aria-label="Hauptnavigation">
            <a href="#workspace" className="font-semibold text-ink">Neues Exposé</a>
            <a href="#archive" className="transition-colors hover:text-ink">Gespeicherte Exposés</a>
          </nav>
          <div className="flex items-center gap-3">
            {user?.is_anonymous ? (
              <StatusBadge tone="warning">Demo-Modus</StatusBadge>
            ) : (
              <span className="hidden max-w-44 truncate text-xs text-ink-faint sm:inline">{user?.email}</span>
            )}
            <form action="/auth/signout" method="post">
              <button className="border-l border-line py-1 pl-3 text-xs font-semibold text-ink-soft transition-colors hover:text-ink sm:pl-4">
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1500px] px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pt-12">
          <div className="mb-8 flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Arbeitsbereich</p>
              <h1 className="font-editorial mt-3 text-4xl tracking-[-0.035em] sm:text-5xl">Neues Exposé erstellen</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
                Objektdaten erfassen, den KI-Entwurf live verfolgen und jeden Abschnitt vor dem Export fachlich prüfen.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <span className="size-2 rounded-full bg-success" /> Sitzung aktiv
            </div>
          </div>
          <div id="workspace" className="scroll-mt-24">
            <Generator model={MODEL} />
          </div>
        </section>

        <section id="archive" className="scroll-mt-24 border-t border-line bg-surface-muted/45">
          <div className="mx-auto max-w-[1500px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Archiv</p>
                <h2 className="font-editorial mt-2 text-3xl tracking-[-0.03em]">Gespeicherte Exposés</h2>
              </div>
              <p className="text-xs text-ink-faint">{documents.length} zuletzt gespeicherte Dokumente</p>
            </div>

            {documents.length > 0 ? (
              <div className="mt-7 overflow-hidden border border-line bg-surface">
                {documents.map((doc, index) => (
                  <details key={doc.id} className="group border-b border-line last:border-b-0">
                    <summary className="grid cursor-pointer list-none gap-3 px-5 py-5 transition-colors hover:bg-surface-muted/40 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6">
                      <div>
                        <p className="font-semibold text-ink">{doc.properties?.address ?? "Unbenanntes Objekt"}</p>
                        <p className="mt-1 text-xs text-ink-faint">Exposé #{String(documents.length - index).padStart(3, "0")}</p>
                      </div>
                      <StatusBadge tone="success">Gespeichert</StatusBadge>
                      <span className="tabular-nums text-xs text-ink-faint">
                        {new Date(doc.created_at).toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" })}
                        <span className="ml-4 inline-block transition-transform group-open:rotate-45" aria-hidden>+</span>
                      </span>
                    </summary>
                    <div className="border-t border-line bg-canvas/55 px-5 py-7 sm:px-8">
                      <div className="mx-auto max-w-3xl space-y-7 bg-surface p-6 paper-shadow sm:p-10">
                        {SECTIONS.filter((section) => doc.content?.[section.key]).map((section, sectionIndex) => (
                          <section key={section.key}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                              {String(sectionIndex + 1).padStart(2, "0")} · {section.title}
                            </p>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink-soft">{doc.content[section.key]}</p>
                          </section>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="mt-7 border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
                <p className="font-editorial text-2xl">Noch kein Exposé gespeichert.</p>
                <p className="mt-2 text-sm text-ink-soft">Ihr erster geprüfter Entwurf erscheint nach dem Speichern hier.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
