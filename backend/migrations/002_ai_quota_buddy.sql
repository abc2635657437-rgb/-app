create table if not exists public.ai_daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create or replace function public.consume_ai_quota(p_user_id uuid, p_daily_limit integer default 5)
returns integer language plpgsql security definer set search_path = public as $$
declare next_count integer;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  insert into public.ai_daily_usage (user_id, usage_date, request_count) values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date) do update set request_count = public.ai_daily_usage.request_count + 1, updated_at = now()
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
  insert into public.notifications (recipient_id, actor_id, type, trip_id, message) values (application_row.applicant_id, trip_row.owner_id, 'buddy_application_' || p_status, trip_row.id, case when p_status = 'accepted' then '你的同行申请已通过' else '你的同行申请未通过' end);
  return chat_id;
end;
$$;

alter table public.ai_daily_usage enable row level security;
drop policy if exists ai_daily_usage_owner_read on public.ai_daily_usage;
create policy ai_daily_usage_owner_read on public.ai_daily_usage for select using (auth.uid() = user_id);
grant select on public.ai_daily_usage to authenticated, service_role;
grant execute on function public.consume_ai_quota(uuid, integer) to authenticated, service_role;
grant execute on function public.respond_buddy_application(uuid, uuid, text) to service_role;
