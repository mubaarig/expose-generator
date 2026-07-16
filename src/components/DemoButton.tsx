"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// One-click demo: anonymous Supabase sign-in, no account, no email.
// Requires "Anonymous sign-ins" to be enabled in the Supabase dashboard.
export default function DemoButton({
  variant = "primary",
  label = "Demo ansehen — ohne Anmeldung",
  className = "",
}: {
  variant?: "primary" | "secondary";
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDemo() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setError(
          "Demo-Zugang ist noch nicht aktiviert (in Supabase „Anonymous sign-ins“ einschalten).",
        );
        setLoading(false);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Demo konnte nicht gestartet werden.");
      setLoading(false);
    }
  }

  const styles =
    variant === "primary"
      ? "bg-ink text-surface hover:bg-accent-dark"
      : "border border-line-strong text-ink hover:bg-surface";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={startDemo}
        disabled={loading}
        className={`inline-flex min-h-12 items-center justify-center px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
      >
        {loading ? "Starte Demo…" : label}
      </button>
      {error && <p className="mt-2 max-w-md text-sm leading-6 text-error">{error}</p>}
    </div>
  );
}
