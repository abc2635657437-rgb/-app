alter table public.posts add column if not exists client_request_id uuid;
create unique index if not exists posts_author_request_unique on public.posts(author_id,client_request_id) where client_request_id is not null;
