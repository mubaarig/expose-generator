import Link from "next/link";
import { redirect } from "next/navigation";
import Brand from "@/components/Brand";
import DemoButton from "@/components/DemoButton";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const WORKFLOW = [
  ["01", "Objekt erfassen", "Die relevanten Eckdaten und Besonderheiten strukturiert eingeben."],
  ["02", "Entwurf generieren", "Vier professionelle Textabschnitte entstehen sichtbar und abschnittsweise."],
  ["03", "Fachlich prüfen", "Formulierungen kontrollieren, einzelne Abschnitte neu erstellen und freigeben."],
  ["04", "Sichern & exportieren", "Den geprüften Stand speichern, kopieren oder als PDF ausgeben."],
] as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const errorCode = params.error_code ?? params.error;
  if (typeof errorCode === "string") {
    const forward = new URLSearchParams({ error_code: errorCode });
    if (typeof params.error_description === "string") {
      forward.set("error_description", params.error_description);
    }
    redirect(`/login?${forward.toString()}`);
  }

  if (getSupabaseEnv()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line/80 bg-canvas/95">
        <div className="mx-auto flex h-20 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Brand />
          <Link href="/login" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">
            Anmelden <span aria-hidden className="ml-1">→</span>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1180px] items-center gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.92fr_1.08fr] lg:py-28">
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent">KI-gestützte Exposé-Erstellung</p>
            <h1 className="font-editorial max-w-[720px] text-balance text-[clamp(3.1rem,6vw,5.7rem)] leading-[0.95] tracking-[-0.045em] text-ink">
              Professionelle Immobilien­exposés in Minuten.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-ink-soft">
              Objektdaten strukturiert erfassen, hochwertige Texte generieren und den Entwurf direkt fachlich prüfen.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <DemoButton label="Beispiel-Exposé erstellen" />
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center border border-line-strong bg-transparent px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface">
                Mit E-Mail anmelden
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-faint">
              <span>✓ Bearbeitbarer KI-Entwurf</span>
              <span>✓ Keine erfundenen Angaben</span>
              <span>✓ Fachliche Prüfung bleibt bei Ihnen</span>
            </div>
          </div>

          <ProductPreview />
        </section>

        <section className="border-y border-line bg-surface-muted/55">
          <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Der Arbeitsablauf</p>
                <h2 className="font-editorial mt-4 max-w-md text-4xl leading-[1.05] tracking-[-0.035em] sm:text-5xl">
                  Vom Objekt zum prüfbaren Entwurf.
                </h2>
              </div>
              <ol className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
                {WORKFLOW.map(([number, title, body]) => (
                  <li key={number} className="bg-surface p-6 sm:p-8">
                    <span className="tabular-nums text-xs font-semibold text-accent">{number}</span>
                    <h3 className="mt-8 text-base font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-8 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Exposé Werkstatt · Wien</span>
        <span>Strukturierte Objektdaten. Nachvollziehbarer Entwurf.</span>
      </footer>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[590px] lg:ml-auto">
      <div className="absolute -inset-5 border border-line/70" aria-hidden />
      <div className="paper-shadow relative bg-surface p-5 sm:p-7">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center bg-ink text-[9px] font-bold text-surface">EW</span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">Exposé-Entwurf</p>
              <p className="text-xs font-semibold">Neubaugasse 47, 1070 Wien</p>
            </div>
          </div>
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-[10px] font-semibold text-success">Zur Prüfung</span>
        </div>
        <div className="grid gap-6 py-7 sm:grid-cols-[1fr_1.45fr]">
          <div className="bg-surface-muted p-4">
            <p className="text-[9px] uppercase tracking-[0.17em] text-ink-faint">Objektdaten</p>
            <dl className="mt-5 space-y-4 text-xs">
              <div><dt className="text-ink-faint">Wohnfläche</dt><dd className="mt-1 font-semibold tabular-nums">68 m²</dd></div>
              <div><dt className="text-ink-faint">Zimmer</dt><dd className="mt-1 font-semibold tabular-nums">3</dd></div>
              <div><dt className="text-ink-faint">Baujahr</dt><dd className="mt-1 font-semibold tabular-nums">1904</dd></div>
              <div><dt className="text-ink-faint">Zustand</dt><dd className="mt-1 font-semibold">gepflegt</dd></div>
            </dl>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-accent">01 · Lage</p>
            <h3 className="font-editorial mt-3 text-2xl leading-tight">Urbanes Wohnen mit gewachsener Infrastruktur</h3>
            <p className="mt-4 text-xs leading-5 text-ink-soft">
              Die Wohnung befindet sich in zentraler Lage des 7. Wiener Gemeindebezirks. Nahversorgung und öffentliche Anbindung sind im direkten Umfeld gegeben.
            </p>
            <div className="mt-6 h-px bg-line" />
            <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.17em] text-accent">02 · Ausstattung</p>
            <div className="mt-3 space-y-2"><span className="block h-2 w-full bg-surface-muted" /><span className="block h-2 w-5/6 bg-surface-muted" /><span className="block h-2 w-2/3 bg-surface-muted" /></div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4 text-[9px] uppercase tracking-[0.13em] text-ink-faint">
          <span>KI-Entwurf · fachlich zu prüfen</span><span>Seite 1</span>
        </div>
      </div>
    </div>
  );
}
