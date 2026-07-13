"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AUTH_TIMEOUT_MS = 12_000;

// Übersetzt die kryptischen Supabase-Fehlercodes in verständliche Hinweise.
function describeAuthError(code: string, description: string | null): string {
  if (code === "otp_expired") {
    return "Der E-Mail-Link war abgelaufen oder wurde schon geöffnet. Manche Postfächer (z. B. Outlook) klicken Links beim Scannen automatisch an und verbrauchen den Einmal-Link. Fordere einen neuen an oder nutze den Passwort-Login unten.";
  }
  if (code === "exchange_failed" || code === "missing_code") {
    return "Die Anmeldung über den Link hat nicht geklappt. Fordere einen neuen Link an oder nutze den Passwort-Login unten.";
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
  const [showPasswordLogin, setShowPasswordLogin] = useState(
    linkError !== null,
  );
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    linkError ? "error" : "idle",
  );
  const [error, setError] = useState<string | null>(linkError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        "Supabase antwortet gerade zu langsam. Nutze den Passwort-Login unten oder versuche es später erneut.",
      );

      if (error) {
        const isRateLimit = error.message.toLowerCase().includes("rate limit");
        if (isRateLimit) setShowPasswordLogin(true);
        setError(
          isRateLimit
            ? "Supabase hat gerade zu viele Magic-Link-E-Mails blockiert. Nutze den Passwort-Login unten oder warte kurz."
            : error.message,
        );
        setStatus("error");
      } else {
        setStatus("sent");
      }
    } catch (err) {
      setShowPasswordLogin(true);
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
        Wir schicken dir einen Magic Link per E-Mail — kein Passwort nötig.
      </p>

      {status === "sent" ? (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {showPasswordLogin
            ? "Account angelegt. Falls Supabase E-Mail-Bestätigung verlangt, bestätige die Adresse und melde dich danach per Passwort an."
            : "Link ist unterwegs. Schau in dein Postfach für "}
          {!showPasswordLogin && <span className="font-medium">{email}</span>}
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.de"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {status === "sending" ? "Wird gesendet…" : "Magic Link senden"}
            </button>
          </form>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setError(null);
                setShowPasswordLogin((v) => !v);
              }}
              className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {showPasswordLogin
                ? "Passwort-Login ausblenden"
                : "Passwort-Login als Fallback"}
            </button>

            {showPasswordLogin && (
              <form
                onSubmit={handlePasswordSubmit}
                className="mt-4 flex flex-col gap-3"
              >
                <p className="text-xs leading-relaxed text-zinc-500">
                  Wenn Supabase E-Mail-Bestätigung verlangt, lege Demo-User im
                  Supabase-Dashboard an und bestätige sie dort direkt.
                </p>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Einloggen
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
