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
