alter table public.chat_members
  add column if not exists last_read_at timestamptz not null default now();
