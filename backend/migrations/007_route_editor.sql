-- Incremental route editor storage. Existing routes remain valid.
alter table public.routes add column if not exists transport_mode text not null default 'driving';
alter table public.routes add column if not exists geometry jsonb;
alter table public.routes add column if not exists distance_meters integer;
alter table public.routes add column if not exists duration_seconds integer;

alter table public.routes drop constraint if exists routes_transport_mode_check;
alter table public.routes add constraint routes_transport_mode_check
  check (transport_mode in ('walking','cycling','driving','transit'));
alter table public.routes drop constraint if exists routes_distance_meters_check;
alter table public.routes add constraint routes_distance_meters_check
  check (distance_meters is null or distance_meters >= 0);
alter table public.routes drop constraint if exists routes_duration_seconds_check;
alter table public.routes add constraint routes_duration_seconds_check
  check (duration_seconds is null or duration_seconds >= 0);

create index if not exists routes_owner_updated_idx on public.routes (owner_id, updated_at desc);
create index if not exists routes_public_updated_idx on public.routes (is_public, updated_at desc);
