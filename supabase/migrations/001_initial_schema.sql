create extension if not exists pgcrypto;

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text default '',
  company text default '',
  interest text default '',
  source text default 'mvp-web',
  created_at timestamptz not null default now()
);

create table if not exists public.demo_traces (
  id uuid primary key default gen_random_uuid(),
  trace_id text unique not null,
  trace jsonb not null,
  created_at timestamptz not null default now(),
  constraint demo_traces_metadata_only check (
    coalesce((trace->>'rawPromptStored')::boolean, false) = false
    and coalesce((trace->>'customerDataStored')::boolean, false) = false
  )
);

alter table public.waitlist_signups enable row level security;
alter table public.demo_traces enable row level security;

create policy if not exists "service role manages waitlist" on public.waitlist_signups for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy if not exists "service role manages demo traces" on public.demo_traces for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
