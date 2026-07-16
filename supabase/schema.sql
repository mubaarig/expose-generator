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

-- ---------------------------------------------------------------------------
-- generation_usage: metering + quota basis (cost governance)
-- ---------------------------------------------------------------------------
-- One row per Anthropic call (= one exposé section). Basis for:
--   * a per-user daily limit (bounds abuse / runaway usage)
--   * an org-wide daily token ceiling (global kill switch)
-- Users may read and insert only their own rows (RLS); the generate route
-- inserts a row after each successful generation. One "generate" click =
-- 4 section calls — the limits below already account for that.
create table if not exists public.generation_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  section       text,
  model         text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists generation_usage_user_created_idx
  on public.generation_usage (user_id, created_at);

alter table public.generation_usage enable row level security;

drop policy if exists "generation_usage_select_own" on public.generation_usage;
create policy "generation_usage_select_own" on public.generation_usage
  for select using (auth.uid() = user_id);

drop policy if exists "generation_usage_insert_own" on public.generation_usage;
create policy "generation_usage_insert_own" on public.generation_usage
  for insert with check (auth.uid() = user_id);

grant select, insert on public.generation_usage to authenticated;

-- Quota check BEFORE the (paid) API call. Runs as a SECURITY DEFINER so it can
-- sum across ALL rows (org-wide) despite RLS. Identity and anonymous status
-- come from the JWT (auth.uid(), auth.jwt()), never from a parameter — so a
-- direct RPC call with the anon key cannot claim to be a verified user and
-- bypass the stricter demo limit.
--
-- Anonymous (demo) users are the real cost lever: the one-click demo button
-- can mint unlimited anonymous sessions, so they get a much stricter daily
-- limit, and the org-wide token ceiling is the hard backstop.
--
-- Limits are constants here (env-free); edit and re-run this file to change
-- them. Reason strings are user-facing UI text, hence German.
--
-- Drop any older parameterized signatures from earlier iterations first, so the
-- no-arg overload below is the only one and PostgREST can resolve the RPC call
-- unambiguously.
drop function if exists public.check_generation_allowed(int, bigint);
drop function if exists public.check_generation_allowed(int, int, bigint);
create or replace function public.check_generation_allowed()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_user_daily_limit constant int    := 40;       -- verified: 40 calls/day = 10 exposés
  c_anon_daily_limit constant int    := 8;        -- demo: 8 calls/day = 2 exposés
  c_org_daily_tokens constant bigint := 2000000;  -- org-wide kill switch: 2M tokens/day
  v_user       uuid    := auth.uid();
  v_is_anon    boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_limit      int;
  v_day        timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_user_today int;
  v_org_tokens bigint;
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'code', 'unauthenticated',
      'reason', 'Nicht eingeloggt');
  end if;

  -- Org-wide kill switch first.
  select coalesce(sum(input_tokens + output_tokens), 0)
    into v_org_tokens
    from public.generation_usage
   where created_at >= v_day;

  if v_org_tokens >= c_org_daily_tokens then
    return jsonb_build_object('allowed', false, 'code', 'org_budget',
      'reason', 'Tageskapazität erreicht. Bitte später erneut versuchen.');
  end if;

  -- Anonymous demo users get a much stricter daily limit.
  v_limit := case when v_is_anon then c_anon_daily_limit else c_user_daily_limit end;

  select count(*)
    into v_user_today
    from public.generation_usage
   where user_id = v_user
     and created_at >= v_day;

  if v_user_today >= v_limit then
    return jsonb_build_object('allowed', false, 'code', 'user_limit',
      'reason', case when v_is_anon
        then 'Demo-Limit erreicht. Bitte registrieren, um weitere Exposés zu erstellen.'
        else 'Tageslimit erreicht. Morgen stehen wieder Generierungen zur Verfügung.'
      end);
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

grant execute on function public.check_generation_allowed() to authenticated;
