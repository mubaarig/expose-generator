-- Report Assistant / Exposé Generator — Schema + Row Level Security
-- Run once in the Supabase SQL editor.
--
-- Data model:
--   profiles   1─┐
--   properties ─┴─< documents   (a property can have multiple document versions)
--
-- Core security idea: RLS on ALL tables, every policy checks
-- `user_id = auth.uid()`. So each user sees only their own rows — even when
-- accessing directly through the anon key from the client.

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
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

-- Create the profile automatically as soon as a user registers.
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
-- properties: key facts of a property
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  address    text not null,
  size_sqm   numeric,
  rooms      numeric,
  year_built integer,
  condition  text,          -- e.g. "neuwertig", "renovierungsbedürftig"
  notes      text,          -- free-text notes for the prompt
  created_at timestamptz not null default now()
);

create index if not exists properties_user_id_idx on public.properties (user_id);

alter table public.properties enable row level security;

drop policy if exists "properties_all_own" on public.properties;
create policy "properties_all_own" on public.properties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- documents: generated exposé texts (versioned)
-- ---------------------------------------------------------------------------
-- content is JSONB with defined sections:
--   { "lage": "...", "ausstattung": "...", "zustand": "...", "fazit": "..." }
-- Structured sections instead of a text blob = individual regeneration is
-- possible and the result stays reliably processable.
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- RLS controls WHICH rows are visible — the role additionally needs the table
-- grants to be able to access them at all. Logged-in users run under the
-- `authenticated` role; `anon` stays out (RLS + no grant). Supabase normally
-- sets these grants automatically — spelled out here so the schema is
-- reproducible on its own.
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.profiles, public.properties, public.documents
  to authenticated;
