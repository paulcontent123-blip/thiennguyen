-- Standalone editorial/news content managed by Admin.
-- Campaign updates remain in campaign_updates and are not mixed with news posts.

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (length(trim(title)) between 3 and 180),
  excerpt text not null default '' check (length(excerpt) <= 500),
  content text not null check (length(trim(content)) >= 1),
  category text not null default 'Tin tức' check (length(trim(category)) between 1 and 80),
  tags text[] not null default '{}'::text[],
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author_id uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_posts_public_idx
  on public.news_posts (status, published_at desc);
create index if not exists news_posts_category_idx
  on public.news_posts (category, created_at desc);

drop trigger if exists news_posts_set_updated_at on public.news_posts;
create trigger news_posts_set_updated_at
before update on public.news_posts
for each row execute function public.set_updated_at();

alter table public.news_posts enable row level security;

drop policy if exists "news_posts_public_read" on public.news_posts;
create policy "news_posts_public_read"
on public.news_posts
for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "news_posts_admin_all" on public.news_posts;
create policy "news_posts_admin_all"
on public.news_posts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.news_posts to anon, authenticated;
grant insert, update, delete on public.news_posts to authenticated;

comment on table public.news_posts is
'Standalone Admin-managed news/editorial posts. Campaign field updates use campaign_updates.';
