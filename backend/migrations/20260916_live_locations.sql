create table if not exists public.live_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  country text not null default '',
  city text not null default '',
  sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists live_locations_visible_idx
  on public.live_locations (sharing_enabled, updated_at desc, country);

alter table public.live_locations enable row level security;
drop policy if exists live_locations_owner on public.live_locations;
create policy live_locations_owner on public.live_locations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.live_locations to authenticated, service_role;
