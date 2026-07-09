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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("documents")
    .select("id, created_at, content, properties(address)")
    .order("created_at", { ascending: false })
    .limit(10);

  const documents = (data ?? []) as unknown as DocRow[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Exposé-Assistent
          </h1>
          <p className="text-sm text-zinc-500">
            Eckdaten rein, professioneller Beschreibungstext raus.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-zinc-500 sm:inline">
            {user?.email}
          </span>
          <form action="/auth/signout" method="post">
            <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Abmelden
            </button>
          </form>
        </div>
      </header>

      <div className="mt-8">
        <Generator />
      </div>

      {documents.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Gespeicherte Exposés
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            {documents.map((doc) => (
              <details
                key={doc.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <summary className="cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {doc.properties?.address ?? "Unbenannt"}
                  <span className="ml-2 font-normal text-zinc-400">
                    {new Date(doc.created_at).toLocaleString("de-DE")}
                  </span>
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  {SECTIONS.filter((s) => doc.content?.[s.key]).map((s) => (
                    <div key={s.key}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        {s.title}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {doc.content[s.key]}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
