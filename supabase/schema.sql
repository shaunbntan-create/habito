-- Habito database schema
-- Run in the Supabase SQL editor (or via the Management API).
-- Both tables are isolated per user with row-level security.

create table if not exists public.habits (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  color text,
  freq text,
  done jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.habits enable row level security;
drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.moods (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  key text,
  sleep numeric,
  stress text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.moods enable row level security;
drop policy if exists "own moods" on public.moods;
create policy "own moods" on public.moods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
