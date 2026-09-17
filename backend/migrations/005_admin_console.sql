begin;

alter table public.profiles add column if not exists last_active_at timestamptz;
alter table public.profiles add column if not exists account_status text not null default 'active' check (account_status in ('active','suspended'));
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists acquisition_source text;

create table if not exists public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('super_admin','content_moderator','operations')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  result text not null check (result in ('success','failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text not null,
  event_type text not null check (event_type in ('active','page_view')),
  source text,
  country text,
  city text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_user_created_idx on public.analytics_events(user_id,created_at desc);
create index if not exists admin_audit_created_idx on public.admin_audit_log(created_at desc);
create index if not exists profiles_last_active_idx on public.profiles(last_active_at desc);
alter table public.analytics_events add column if not exists source text;

alter table public.admin_users enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.analytics_events enable row level security;
revoke all on public.admin_users, public.admin_audit_log, public.analytics_events from anon, authenticated;
grant all on public.admin_users, public.admin_audit_log, public.analytics_events to service_role;
notify pgrst,'reload schema';
commit;
