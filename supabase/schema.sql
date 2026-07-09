-- Bericht-Assistent / Exposé-Generator — Schema + Row Level Security
-- Im Supabase SQL Editor ausführen (einmalig).
--
-- Datenmodell:
--   profiles   1─┐
--   properties ─┴─< documents   (ein Property kann mehrere Dokument-Versionen haben)
--
-- Kernidee der Absicherung: RLS auf ALLEN Tabellen, jede Policy prüft
-- `user_id = auth.uid()`. So sieht jede:r Nutzer:in ausschließlich die
-- eigenen Zeilen — auch bei direktem Zugriff über den anon-Key vom Client.

-- ---------------------------------------------------------------------------
-- profiles: 1:1 zu auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Profil automatisch anlegen, sobald ein User registriert wird.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- properties: Eckdaten einer Immobilie
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  address    text not null,
  size_sqm   numeric,
  rooms      numeric,
  year_built integer,
  condition  text,          -- z.B. "neuwertig", "renovierungsbedürftig"
  notes      text,          -- Freitext-Notizen fürs Prompt
  created_at timestamptz not null default now()
);

create index if not exists properties_user_id_idx on public.properties (user_id);

alter table public.properties enable row level security;

drop policy if exists "properties_all_own" on public.properties;
create policy "properties_all_own" on public.properties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- documents: generierte Exposé-Texte (versioniert)
-- ---------------------------------------------------------------------------
-- content ist JSONB mit definierten Abschnitten:
--   { "lage": "...", "ausstattung": "...", "zustand": "...", "fazit": "..." }
-- Strukturierte Abschnitte statt Textblob = einzelne Regeneration möglich
-- und verlässlich weiterverarbeitbar.
create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  content        jsonb not null default '{}'::jsonb,
  model          text,
  prompt_version text,
  created_at     timestamptz not null default now()
);

create index if not exists documents_property_id_idx on public.documents (property_id);
create index if not exists documents_user_id_idx on public.documents (user_id);

alter table public.documents enable row level security;

drop policy if exists "documents_all_own" on public.documents;
create policy "documents_all_own" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
