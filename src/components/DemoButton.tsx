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
      ? "bg-zinc-900 text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
      : "border border-zinc-300 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={startDemo}
        disabled={loading}
        className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50 ${styles}`}
      >
        {loading ? "Starte Demo…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
