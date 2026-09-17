begin;
alter table public.chat_members add column if not exists last_read_at timestamptz not null default now();

-- Private text conversations use the existing profiles/auth system.
create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  seq bigint not null default 0,
  read_a bigint not null default 0,
  read_b bigint not null default 0,
  clear_a bigint not null default 0,
  clear_b bigint not null default 0,
  hidden_a boolean not null default false,
  hidden_b boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_a,user_b), check(user_a < user_b)
);
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.dm_conversations(id) on delete cascade,
  seq bigint not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  content text not null check(length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now(),
  unique(chat_id,seq), unique(chat_id,sender_id,client_id)
);
alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;
revoke all on public.dm_conversations, public.dm_messages from anon, authenticated;
grant all on public.dm_conversations, public.dm_messages to service_role;

-- Import existing text-only private conversations; existing trip chats stay intact.
insert into public.dm_conversations(user_a,user_b)
select min(m.user_id::text)::uuid,max(m.user_id::text)::uuid
from public.chats c join public.trips t on t.id=c.trip_id join public.chat_members m on m.chat_id=c.id
where t.description in ('Travel World 私聊会话','地图在线用户私聊')
group by c.id having count(*)=2
on conflict(user_a,user_b) do nothing;
with old_chats as (
  select c.id,min(m.user_id::text)::uuid a,max(m.user_id::text)::uuid b
  from public.chats c join public.trips t on t.id=c.trip_id join public.chat_members m on m.chat_id=c.id
  where t.description in ('Travel World 私聊会话','地图在线用户私聊')
  group by c.id having count(*)=2
), imported as (
  select m.*,d.id dm_id,row_number() over(partition by d.id order by m.created_at,m.id) n
  from old_chats o join public.dm_conversations d on d.user_a=o.a and d.user_b=o.b
  join public.chat_messages m on m.chat_id=o.id where length(btrim(m.content)) between 1 and 4000
)
insert into public.dm_messages(id,chat_id,seq,sender_id,client_id,content,created_at)
select id,dm_id,n,sender_id,id,content,created_at from imported
on conflict do nothing;
update public.dm_conversations d set seq=greatest(d.seq,coalesce((select max(m.seq) from public.dm_messages m where m.chat_id=d.id),0));

-- Row locks serialize send/read/delete. Client IDs make retries idempotent.
create or replace function public.tw_dm_action(
  p_actor uuid, p_action text, p_peer uuid default null, p_chat uuid default null,
  p_content text default null, p_client uuid default null, p_through bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.dm_conversations; m public.dm_messages; result jsonb;
begin
  if p_action='open' then
    if p_peer=p_actor or p_peer is null then raise exception '不能和自己私聊'; end if;
    if not exists(select 1 from public.profiles where id=p_peer) then raise exception '用户不存在'; end if;
    if exists(select 1 from public.blocked_users where (blocker_id=p_actor and blocked_id=p_peer) or (blocker_id=p_peer and blocked_id=p_actor)) then raise exception '无法与该用户私聊'; end if;
    insert into public.dm_conversations(user_a,user_b) values(least(p_actor,p_peer),greatest(p_actor,p_peer))
    on conflict(user_a,user_b) do update set user_a=excluded.user_a returning * into c;
    update public.dm_conversations set hidden_a=case when user_a=p_actor then false else hidden_a end,hidden_b=case when user_b=p_actor then false else hidden_b end where id=c.id;
    return jsonb_build_object('chatId',c.id);
  end if;
  if p_action='list' then
    select coalesce(jsonb_agg(x.payload order by x.sort_time desc),'[]'::jsonb) into result from (
      select jsonb_build_object('id',d.id,'user',jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'avatar_url',p.avatar_url),
        'last_message',(select to_jsonb(l) from (select id,content,created_at,seq,sender_id from public.dm_messages where chat_id=d.id and seq>case when d.user_a=p_actor then d.clear_a else d.clear_b end order by seq desc limit 1) l),
        'unread_count',(select count(*) from public.dm_messages where chat_id=d.id and sender_id<>p_actor and seq>case when d.user_a=p_actor then greatest(d.read_a,d.clear_a) else greatest(d.read_b,d.clear_b) end)) payload,
        coalesce((select max(created_at) from public.dm_messages where chat_id=d.id),d.created_at) sort_time
      from public.dm_conversations d join public.profiles p on p.id=case when d.user_a=p_actor then d.user_b else d.user_a end
      where (d.user_a=p_actor and not d.hidden_a) or (d.user_b=p_actor and not d.hidden_b)
    ) x;
    return result;
  end if;
  select * into c from public.dm_conversations where id=p_chat and (user_a=p_actor or user_b=p_actor) for update;
  if not found then raise exception '你不是该会话成员' using errcode='42501'; end if;
  if p_action='send' then
    if exists(select 1 from public.blocked_users where (blocker_id=c.user_a and blocked_id=c.user_b) or (blocker_id=c.user_b and blocked_id=c.user_a)) then raise exception '无法与该用户私聊'; end if;
    if p_client is null or p_content is null or length(btrim(p_content)) not between 1 and 4000 then raise exception '消息需为 1 至 4000 字'; end if;
    select * into m from public.dm_messages where chat_id=c.id and sender_id=p_actor and client_id=p_client;
    if found then return to_jsonb(m); end if;
    insert into public.dm_messages(chat_id,seq,sender_id,client_id,content) values(c.id,c.seq+1,p_actor,p_client,btrim(p_content)) returning * into m;
    update public.dm_conversations set seq=c.seq+1,hidden_a=false,hidden_b=false where id=c.id;
    return to_jsonb(m);
  elsif p_action='read' then
    if p_through is null or p_through<0 or p_through>c.seq then raise exception '无效的已读位置'; end if;
    update public.dm_conversations set read_a=case when user_a=p_actor then greatest(read_a,p_through) else read_a end,read_b=case when user_b=p_actor then greatest(read_b,p_through) else read_b end where id=c.id;
    return '{"read":true}'::jsonb;
  elsif p_action='delete' then
    update public.dm_conversations set
      hidden_a=case when user_a=p_actor then true else hidden_a end, hidden_b=case when user_b=p_actor then true else hidden_b end,
      clear_a=case when user_a=p_actor then seq else clear_a end,clear_b=case when user_b=p_actor then seq else clear_b end,
      read_a=case when user_a=p_actor then seq else read_a end,read_b=case when user_b=p_actor then seq else read_b end where id=c.id;
    return '{"deleted":true}'::jsonb;
  end if;
  raise exception '未知聊天操作';
end $$;
revoke all on function public.tw_dm_action(uuid,text,uuid,uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.tw_dm_action(uuid,text,uuid,uuid,text,uuid,bigint) to service_role;
notify pgrst,'reload schema';
commit;
