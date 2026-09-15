create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  language text not null default 'zh' check (language in ('zh','en')),
  notifications jsonb not null default '{"likes":true,"comments":true,"follows":true,"buddy":true,"chat":true}'::jsonb,
  privacy jsonb not null default '{"publicProfile":true,"showTrips":true,"allowFollow":true}'::jsonb,
  messages jsonb not null default '{"buddyMessages":true,"communityMessages":true}'::jsonb,
  content_preferences jsonb not null default '{"domestic":true,"international":true,"photography":true}'::jsonb,
  general jsonb not null default '{"autoplayVideo":false,"saveData":false}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_settings enable row level security;
alter table public.blocked_users enable row level security;
drop policy if exists user_settings_owner on public.user_settings;
create policy user_settings_owner on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists blocked_users_owner on public.blocked_users;
create policy blocked_users_owner on public.blocked_users for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
