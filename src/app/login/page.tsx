"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AUTH_TIMEOUT_MS = 12_000;

// Übersetzt die kryptischen Supabase-Fehlercodes in verständliche Hinweise.
function describeAuthError(code: string, description: string | null): string {
  if (code === "otp_expired") {
    return "Der E-Mail-Link war abgelaufen oder wurde schon geöffnet. Manche Postfächer (z. B. Outlook) klicken Links beim Scannen automatisch an und verbrauchen den Einmal-Link. Melde dich einfach oben mit E-Mail und Passwort an.";
  }
  if (code === "exchange_failed" || code === "missing_code") {
    return "Die Anmeldung über den Link hat nicht geklappt. Melde dich oben mit E-Mail und Passwort an.";
  }
  return description ?? "Anmeldung über den Link fehlgeschlagen.";
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS);
    }),
  ]);
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Fehler von fehlgeschlagenen Magic-/Bestätigungs-Links anzeigen. Unsere
  // Redirects (Root + Callback) hängen die Details als ?error_code= an — hier
  // konsistent für Server- und Client-Render, daher als Startwert der States.
  const linkErrorCode = searchParams.get("error_code");
  const linkError = linkErrorCode
    ? describeAuthError(linkErrorCode, searchParams.get("error_description"))
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    linkError ? "error" : "idle",
  );
  const [error, setError] = useState<string | null>(linkError);

  async function sendMagicLink() {
    if (!email) {
      setError("Bitte gib zuerst deine E-Mail-Adresse ein.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        }),
        "Supabase antwortet gerade zu langsam. Nutze oben den Passwort-Login oder versuche es später erneut.",
      );

      if (error) {
        const isRateLimit = error.message.toLowerCase().includes("rate limit");
        setError(
          isRateLimit
            ? "Supabase hat gerade zu viele Magic-Link-E-Mails blockiert. Nutze oben den Passwort-Login oder warte kurz."
            : error.message,
        );
        setStatus("error");
      } else {
        setStatus("sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth-Anfrage fehlgeschlagen.");
      setStatus("error");
    }
  }

  async function submitPassword(mode: "login" | "signup") {
    setStatus("sending");
    setError(null);

    let result;
    try {
      const supabase = createClient();
      result = await withTimeout(
        mode === "login"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
              },
            }),
        "Supabase antwortet gerade zu langsam. Bitte in ein paar Sekunden erneut versuchen.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth-Anfrage fehlgeschlagen.");
      setStatus("error");
      return;
    }

    const { data, error } = result;

    if (error) {
      const isRateLimit = error.message.toLowerCase().includes("rate limit");
      setError(
        isRateLimit
          ? "Supabase blockiert gerade auch Account-Erstellungs-Mails. Lege den User im Supabase-Dashboard an und markiere ihn dort als bestätigt."
          : error.message,
      );
      setStatus("error");
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setStatus("sent");
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitPassword("login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Melde dich mit E-Mail und Passwort an — oder lege in einem Schritt einen
        Account an.
      </p>

      {status === "sent" ? (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          Link ist unterwegs. Schau in dein Postfach für{" "}
          <span className="font-medium">{email}</span>.
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-5">
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.de"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort (mind. 6 Zeichen)"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-16 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {showPassword ? "Verbergen" : "Anzeigen"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {status === "sending" ? "…" : "Einloggen"}
              </button>
              <button
                type="button"
                disabled={status === "sending"}
                onClick={() => submitPassword("signup")}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Account anlegen
              </button>
            </div>
          </form>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setError(null);
                setShowMagicLink((v) => !v);
              }}
              className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {showMagicLink
                ? "Magic Link ausblenden"
                : "Lieber per Magic Link (E-Mail) anmelden"}
            </button>

            {showMagicLink && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs leading-relaxed text-zinc-500">
                  Wir senden einen Anmeldelink an die oben eingegebene Adresse.
                  Hinweis: Manche Postfächer (z. B. Outlook) verbrauchen den
                  Einmal-Link beim Scannen — der Passwort-Login oben ist
                  zuverlässiger.
                </p>
                <button
                  type="button"
                  disabled={status === "sending"}
                  onClick={sendMagicLink}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {status === "sending" ? "Wird gesendet…" : "Magic Link senden"}
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm leading-relaxed text-red-600">{error}</p>
          )}
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
