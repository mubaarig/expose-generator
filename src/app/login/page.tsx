"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DemoButton from "@/components/DemoButton";
import Brand from "@/components/Brand";

const AUTH_TIMEOUT_MS = 12_000;

// Translates the cryptic Supabase error codes into readable hints.
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

  // Show errors from failed magic/confirmation links. Our redirects (root +
  // callback) append the details as ?error_code= — kept consistent between
  // server and client render, hence used as the initial state values.
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
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[0.92fr_1.08fr]">
      <section className="hidden border-r border-line bg-surface-muted/60 p-12 lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Professionelle Textarbeit</p>
          <h1 className="font-editorial mt-5 text-6xl leading-[0.98] tracking-[-0.045em]">
            Aus Angaben wird ein prüfbarer Entwurf.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-ink-soft">
            Ein fokussierter Arbeitsbereich für strukturierte Immobilienexposés — vom Objekt bis zum exportierbaren Text.
          </p>
        </div>
        <p className="text-xs leading-5 text-ink-faint">
          KI unterstützt bei der Formulierung.<br />Die fachliche Freigabe bleibt bei Ihnen.
        </p>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-14 lg:hidden"><Brand /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Zugang</p>
          <h2 className="font-editorial mt-3 text-4xl tracking-[-0.03em]">Willkommen zurück.</h2>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            Mit E-Mail und Passwort anmelden oder den geschützten Demo-Zugang verwenden.
          </p>

      {status === "sent" ? (
        <div className="mt-8 border border-success/20 bg-success-soft p-5 text-sm leading-6 text-success">
          Link ist unterwegs. Schau in dein Postfach für{" "}
          <span className="font-medium">{email}</span>.
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <DemoButton
              className="[&>button]:w-full"
              label="Demo ansehen — ohne Anmeldung"
            />
            <div className="flex items-center gap-3 text-xs text-ink-faint">
              <span className="h-px flex-1 bg-line" />
              oder
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <label className="grid gap-1.5 text-xs font-semibold text-ink-soft">
              E-Mail-Adresse
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@unternehmen.at"
              className="h-11 border border-line-strong bg-surface px-3 text-sm text-ink transition-colors focus:border-accent"
            />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-ink-soft">
              Passwort
              <span className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className="h-11 w-full border border-line-strong bg-surface px-3 pr-20 text-sm font-normal text-ink transition-colors focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-ink-faint hover:text-ink"
              >
                {showPassword ? "Verbergen" : "Anzeigen"}
              </button>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="submit"
                disabled={status === "sending"}
                className="h-11 bg-ink px-3 text-sm font-semibold text-surface transition-colors hover:bg-accent-dark disabled:opacity-50"
              >
                {status === "sending" ? "…" : "Einloggen"}
              </button>
              <button
                type="button"
                disabled={status === "sending"}
                onClick={() => submitPassword("signup")}
                className="h-11 border border-line-strong px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50"
              >
                Account anlegen
              </button>
            </div>
          </form>

          <div className="border-t border-line pt-5">
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setError(null);
                setShowMagicLink((v) => !v);
              }}
              className="text-sm font-semibold text-ink-soft hover:text-ink"
            >
              {showMagicLink
                ? "Magic Link ausblenden"
                : "Lieber per Magic Link (E-Mail) anmelden"}
            </button>

            {showMagicLink && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs leading-relaxed text-ink-faint">
                  Wir senden einen Anmeldelink an die oben eingegebene Adresse.
                  Hinweis: Manche Postfächer (z. B. Outlook) verbrauchen den
                  Einmal-Link beim Scannen — der Passwort-Login oben ist
                  zuverlässiger.
                </p>
                <button
                  type="button"
                  disabled={status === "sending"}
                  onClick={sendMagicLink}
                  className="h-11 border border-line-strong px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50"
                >
                  {status === "sending" ? "Wird gesendet…" : "Magic Link senden"}
                </button>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="border border-error/20 bg-error-soft p-4 text-sm leading-6 text-error">{error}</p>
          )}
        </div>
          )}
        </div>
      </section>
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
