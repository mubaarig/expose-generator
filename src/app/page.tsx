import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

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

  if (!getSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
