create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'story' check (type in ('photo','video','story','guide','route')),
  title text not null default '',
  content text not null default '',
  location_name text,
  country text,
  city text,
  latitude double precision,
  longitude double precision,
  route_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  media_type text not null check (media_type in ('image','video')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  destination text not null default '',
  days jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts drop constraint if exists posts_route_id_fkey;
alter table public.posts add constraint posts_route_id_fkey foreign key (route_id) references public.routes(id) on delete set null;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  destination text not null default '',
  start_date date,
  end_date date,
  description text not null default '',
  status text not null default 'open' check (status in ('open','closed','cancelled','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.buddy_applications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, applicant_id)
);

create table if not exists public.buddy_relations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_id)
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  message text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

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


create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid references public.routes(id) on delete set null,
  title text not null default '',
  status text not null default 'active' check (status in ('active','archived')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null default '',
  structured_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  destination text,
  start_date date,
  end_date date,
  days integer check (days is null or days between 1 and 60),
  travelers integer check (travelers is null or travelers between 1 and 50),
  budget numeric check (budget is null or budget >= 0),
  currency text not null default 'CNY',
  interests text[] not null default '{}',
  dislikes text[] not null default '{}',
  pace text,
  transport_preferences text[] not null default '{}',
  dietary_preferences text[] not null default '{}',
  accommodation_preferences jsonb not null default '{}'::jsonb,
  extra_requirements text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  title text not null default '',
  date date,
  summary text not null default '',
  estimated_cost numeric not null default 0 check (estimated_cost >= 0),
  currency text not null default 'CNY',
  sort_order integer not null default 0,
  unique (route_id, day_number)
);

create table if not exists public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days(id) on delete cascade,
  external_place_id text,
  provider text,
  name text not null,
  address text,
  category text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  start_time time,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  transport text,
  transport_minutes integer check (transport_minutes is null or transport_minutes >= 0),
  estimated_cost numeric not null default 0 check (estimated_cost >= 0),
  currency text not null default 'CNY',
  reason text,
  verification_status text not null default 'unverified' check (verification_status in ('verified','provider','unverified')),
  source_url text,
  sort_order integer not null default 0
);

create table if not exists public.ai_daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.live_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  country text not null default '',
  city text not null default '',
  sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists live_locations_visible_idx on public.live_locations (sharing_enabled, updated_at desc, country);

create or replace function public.consume_ai_quota(p_user_id uuid, p_daily_limit integer default 5)
returns integer language plpgsql security definer set search_path = public as $$
declare next_count integer;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  insert into public.ai_daily_usage (user_id, usage_date, request_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_daily_usage.request_count + 1, updated_at = now()
    where public.ai_daily_usage.request_count < p_daily_limit
  returning request_count into next_count;
  if next_count is null then return -1; end if;
  return next_count;
end;
$$;

create or replace function public.respond_buddy_application(p_application_id uuid, p_owner_id uuid, p_status text)
returns uuid language plpgsql security definer set search_path = public as $$
declare application_row public.buddy_applications%rowtype;
declare trip_row public.trips%rowtype;
declare chat_id uuid;
begin
  if p_status not in ('accepted', 'rejected') then raise exception 'invalid status'; end if;
  select * into application_row from public.buddy_applications where id = p_application_id for update;
  if not found then raise exception 'application not found'; end if;
  select * into trip_row from public.trips where id = application_row.trip_id;
  if trip_row.owner_id <> p_owner_id then raise exception 'forbidden'; end if;
  update public.buddy_applications set status = p_status, updated_at = now() where id = p_application_id;
  if p_status = 'accepted' then
    insert into public.buddy_relations (trip_id, user_id) values (trip_row.id, trip_row.owner_id), (trip_row.id, application_row.applicant_id) on conflict do nothing;
    insert into public.chats (trip_id) values (trip_row.id) on conflict (trip_id) do update set trip_id = excluded.trip_id returning id into chat_id;
    insert into public.chat_members (chat_id, user_id) values (chat_id, trip_row.owner_id), (chat_id, application_row.applicant_id) on conflict do nothing;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, trip_id, message)
  values (application_row.applicant_id, trip_row.owner_id, 'buddy_application_' || p_status, trip_row.id, case when p_status = 'accepted' then '你的同行申请已通过' else '你的同行申请未通过' end);
  return chat_id;
end;
$$;

create index if not exists ai_conversations_user_updated_idx on public.ai_conversations(user_id, updated_at desc);
create index if not exists ai_messages_conversation_created_idx on public.ai_messages(conversation_id, created_at);
create index if not exists trip_preferences_user_updated_idx on public.trip_preferences(user_id, updated_at desc);
create index if not exists trip_days_route_order_idx on public.trip_days(route_id, sort_order);
create index if not exists trip_places_day_order_idx on public.trip_places(trip_day_id, sort_order);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'username', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.favorites enable row level security;
alter table public.routes enable row level security;
alter table public.trips enable row level security;
alter table public.buddy_applications enable row level security;
alter table public.buddy_relations enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.trip_preferences enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_places enable row level security;
alter table public.ai_daily_usage enable row level security;
alter table public.live_locations enable row level security;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_self on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy posts_read on public.posts for select using (true);
create policy posts_insert_self on public.posts for insert with check (auth.uid() = author_id);
create policy posts_update_self on public.posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy posts_delete_self on public.posts for delete using (auth.uid() = author_id);
create policy media_read on public.post_media for select using (true);
create policy media_insert_author on public.post_media for insert with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy likes_read on public.post_likes for select using (true);
create policy likes_insert_self on public.post_likes for insert with check (auth.uid() = user_id);
create policy likes_delete_self on public.post_likes for delete using (auth.uid() = user_id);
create policy comments_read on public.comments for select using (true);
create policy comments_insert_self on public.comments for insert with check (auth.uid() = author_id);
create policy comments_delete_self on public.comments for delete using (auth.uid() = author_id);
create policy follows_read on public.follows for select using (true);
create policy follows_insert_self on public.follows for insert with check (auth.uid() = follower_id);
create policy follows_delete_self on public.follows for delete using (auth.uid() = follower_id);
create policy favorites_self on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy routes_read_public on public.routes for select using (is_public or auth.uid() = owner_id);
create policy routes_owner_write on public.routes for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy trips_read on public.trips for select using (true);
create policy trips_owner_write on public.trips for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy applications_participants on public.buddy_applications for select using (auth.uid() = applicant_id or exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy applications_insert_self on public.buddy_applications for insert with check (auth.uid() = applicant_id);
create policy applications_update_owner on public.buddy_applications for update using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy relations_members on public.buddy_relations for select using (auth.uid() = user_id or exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy chats_members on public.chats for select using (exists (select 1 from public.chat_members m where m.chat_id = id and m.user_id = auth.uid()));
create policy chat_members_self on public.chat_members for select using (user_id = auth.uid());
create policy messages_members on public.chat_messages for select using (exists (select 1 from public.chat_members m where m.chat_id = chat_id and m.user_id = auth.uid()));
create policy messages_insert_members on public.chat_messages for insert with check (auth.uid() = sender_id and exists (select 1 from public.chat_members m where m.chat_id = chat_id and m.user_id = auth.uid()));
create policy notifications_self on public.notifications for all using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
create policy ai_conversations_owner on public.ai_conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ai_messages_owner on public.ai_messages for all using (auth.uid() = user_id and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())) with check (auth.uid() = user_id and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy trip_preferences_owner on public.trip_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy trip_days_route_access on public.trip_days for select using (exists (select 1 from public.routes r where r.id = route_id and (r.is_public or r.owner_id = auth.uid())));
create policy trip_days_route_owner_write on public.trip_days for all using (exists (select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()));
create policy trip_places_route_access on public.trip_places for select using (exists (select 1 from public.trip_days d join public.routes r on r.id = d.route_id where d.id = trip_day_id and (r.is_public or r.owner_id = auth.uid())));
create policy trip_places_route_owner_write on public.trip_places for all using (exists (select 1 from public.trip_days d join public.routes r on r.id = d.route_id where d.id = trip_day_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.trip_days d join public.routes r on r.id = d.route_id where d.id = trip_day_id and r.owner_id = auth.uid()));
create policy ai_daily_usage_owner_read on public.ai_daily_usage for select using (auth.uid() = user_id);
create policy live_locations_owner on public.live_locations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant execute on function public.consume_ai_quota(uuid, integer) to authenticated, service_role;
grant execute on function public.respond_buddy_application(uuid, uuid, text) to service_role;

insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
create policy media_objects_read on storage.objects for select using (bucket_id = 'media');
create policy media_objects_insert on storage.objects for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');
create policy media_objects_delete on storage.objects for delete using (bucket_id = 'media' and owner_id = auth.uid()::text);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
