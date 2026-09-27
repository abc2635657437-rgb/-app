create table if not exists public.oauth_identities (
  provider text not null check (provider = 'qq'),
  provider_user_hash text not null check (provider_user_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, provider_user_hash),
  unique (provider, user_id)
);

alter table public.oauth_identities enable row level security;
revoke all on public.oauth_identities from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), ''),
    nullif(new.raw_user_meta_data->>'username',''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
