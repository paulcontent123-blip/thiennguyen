alter table public.news_posts
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists focus_keyword text,
  add column if not exists canonical_url text;

create table if not exists public.news_media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  public_id text not null unique,
  original_name text not null default '',
  alt_text text not null default '',
  width integer,
  height integer,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists news_media_created_idx on public.news_media (created_at desc);
alter table public.news_media enable row level security;

drop policy if exists "news_media_admin_all" on public.news_media;
create policy "news_media_admin_all" on public.news_media
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.news_media to authenticated;

comment on table public.news_media is
'Admin news editor media library metadata; binary images are stored in Cloudinary.';
