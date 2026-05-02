create extension if not exists pgcrypto;

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text default '',
  company text default '',
  use_case text default '',
  source text default 'landing_page',
  created_at timestamptz not null default now()
);

create index if not exists waitlist_signups_created_at_idx on public.waitlist_signups(created_at desc);
create unique index if not exists waitlist_signups_email_idx on public.waitlist_signups(lower(email));

create table if not exists public.agent_traces (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null,
  agent_name text not null,
  environment text not null,
  data_mode text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_traces_trace_id_idx on public.agent_traces(trace_id);
create index if not exists agent_traces_created_at_idx on public.agent_traces(created_at desc);

alter table public.waitlist_signups enable row level security;
alter table public.agent_traces enable row level security;

-- Server-side service role writes are used by the Next.js API routes.
-- Public anon access is intentionally not granted in this MVP.
