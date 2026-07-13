import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import DemoButton from "@/components/DemoButton";

const FEATURES = [
  {
    title: "Exposé in Sekunden",
    body: "Eckdaten eingeben, vier fertige Abschnitte — Lage, Ausstattung, Zustand, Fazit — werden live tokenweise generiert.",
  },
  {
    title: "Sicher by design",
    body: "Supabase-Auth mit Row-Level-Security; der Anthropic-Key bleibt serverseitig und erreicht den Browser nie.",
  },
  {
    title: "Speichern & wiederfinden",
    body: "Jedes Exposé landet in Postgres — pro Nutzer isoliert, jederzeit abrufbar, als Text oder PDF exportierbar.",
  },
];

const STACK = ["Next.js 16", "React 19", "Supabase", "Claude Opus 4.8", "Vercel"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Supabase hängt bei einem fehlgeschlagenen Magic-/Bestätigungs-Link die
  // Fehlerdetails an die Site-URL (= diese Root-Seite). Statt sie stumm zu
  // verschlucken, reichen wir sie an die Login-Seite weiter.
  const params = await searchParams;
  const errorCode = params.error_code ?? params.error;
  if (typeof errorCode === "string") {
    const forward = new URLSearchParams({ error_code: errorCode });
    if (typeof params.error_description === "string") {
      forward.set("error_description", params.error_description);
    }
    redirect(`/login?${forward.toString()}`);
  }

  // Eingeloggte Nutzer direkt ins Dashboard.
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-tight">
          Exposé-Assistent
        </span>
        <Link
          href="/login"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Anmelden
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            KI-Exposés für Immobilien
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Aus Eckdaten wird ein
            <br />
            fertiges Exposé.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Adresse, Fläche, Zustand rein — professionelle, verkaufsfertige
            Beschreibungstexte raus. Live generiert mit Claude, gespeichert in
            Supabase.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <DemoButton label="Demo ansehen — ohne Anmeldung" />
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Mit E-Mail anmelden
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Gebaut mit</span>
          {STACK.map((tech) => (
            <span
              key={tech}
              className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {tech}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}
