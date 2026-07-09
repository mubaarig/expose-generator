export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".supabase.co")) {
      return null;
    }
  } catch {
    return null;
  }

  if (/[\r\n]/.test(anonKey)) {
    return null;
  }

  return { url, anonKey };
}
