-- Public campaign content, payment configuration and sharing metadata.
-- Files are stored by Cloudinary; this migration stores their URLs and public IDs.

create table public.campaign_updates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  update_type text not null default 'general'
    check (update_type in ('general', 'start', 'mid', 'handover')),
  title text not null,
  body text not null,
  location_text text,
  event_at timestamptz not null default now(),
  is_public boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_updates_campaign_event_idx
  on public.campaign_updates (campaign_id, event_at desc);

create table public.campaign_media (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  update_id uuid references public.campaign_updates(id) on delete set null,
  media_type text not null
    check (media_type in ('cover', 'video', 'photo', 'poster')),
  slot text
    check (slot is null or slot in ('start', 'mid', 'handover')),
  provider text not null default 'cloudinary'
    check (provider in ('cloudinary', 'youtube', 'facebook', 'tiktok', 'external')),
  title text not null default '',
  alt_text text not null default '',
  url text not null,
  public_id text,
  thumbnail_url text,
  sort_order integer not null default 0,
  is_public boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_type <> 'video' or slot is not null)
);

create index campaign_media_campaign_order_idx
  on public.campaign_media (campaign_id, sort_order, created_at);
create unique index campaign_media_one_cover_idx
  on public.campaign_media (campaign_id) where media_type = 'cover';
create unique index campaign_media_one_poster_idx
  on public.campaign_media (campaign_id) where media_type = 'poster';
create unique index campaign_media_one_video_slot_idx
  on public.campaign_media (campaign_id, slot)
  where media_type = 'video' and slot is not null;

create table public.campaign_payment_configs (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  provider text not null default 'vietqr' check (provider = 'vietqr'),
  bank_id text not null,
  account_no text not null,
  account_name text not null,
  description_template text not null default 'TN-{campaign_slug}',
  is_active boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(bank_id)) between 2 and 40),
  check (length(trim(account_no)) between 4 and 40),
  check (length(trim(account_name)) between 2 and 160)
);

create table public.campaign_seo (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  meta_title text,
  meta_description text,
  canonical_url text,
  schema_type text not null default 'LiveBlogPosting',
  schema_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(schema_json) = 'object'),
  is_public boolean not null default true,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_share_settings (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  zalo_enabled boolean not null default true,
  facebook_enabled boolean not null default true,
  copy_enabled boolean not null default true,
  share_title text,
  share_description text,
  share_image_url text,
  is_public boolean not null default true,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger campaign_updates_set_updated_at before update on public.campaign_updates
for each row execute function public.set_updated_at();
create trigger campaign_media_set_updated_at before update on public.campaign_media
for each row execute function public.set_updated_at();
create trigger campaign_payment_configs_set_updated_at before update on public.campaign_payment_configs
for each row execute function public.set_updated_at();
create trigger campaign_seo_set_updated_at before update on public.campaign_seo
for each row execute function public.set_updated_at();
create trigger campaign_share_settings_set_updated_at before update on public.campaign_share_settings
for each row execute function public.set_updated_at();

alter table public.campaign_updates enable row level security;
alter table public.campaign_media enable row level security;
alter table public.campaign_payment_configs enable row level security;
alter table public.campaign_seo enable row level security;
alter table public.campaign_share_settings enable row level security;

-- Public users can only see content attached to a public campaign owned by a verified organization.
create policy "campaign_updates_public_read" on public.campaign_updates
for select using (
  is_public and exists (
    select 1
    from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id
      and c.status in ('approved', 'active', 'closed')
      and o.license_status = 'approved'
  )
);
create policy "campaign_updates_owner_or_admin_all" on public.campaign_updates
for all using (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
) with check (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
);

create policy "campaign_media_public_read" on public.campaign_media
for select using (
  is_public and exists (
    select 1
    from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id
      and c.status in ('approved', 'active', 'closed')
      and o.license_status = 'approved'
  )
);
create policy "campaign_media_owner_or_admin_all" on public.campaign_media
for all using (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
) with check (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
);

create policy "campaign_payment_configs_public_read" on public.campaign_payment_configs
for select using (
  is_active and exists (
    select 1
    from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id
      and c.status in ('approved', 'active', 'closed')
      and o.license_status = 'approved'
  )
);
create policy "campaign_payment_configs_owner_or_admin_all" on public.campaign_payment_configs
for all using (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
) with check (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
);

create policy "campaign_seo_public_read" on public.campaign_seo
for select using (
  is_public and exists (
    select 1
    from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id
      and c.status in ('approved', 'active', 'closed')
      and o.license_status = 'approved'
  )
);
create policy "campaign_seo_owner_or_admin_all" on public.campaign_seo
for all using (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
) with check (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
);

create policy "campaign_share_settings_public_read" on public.campaign_share_settings
for select using (
  is_public and exists (
    select 1
    from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id
      and c.status in ('approved', 'active', 'closed')
      and o.license_status = 'approved'
  )
);
create policy "campaign_share_settings_owner_or_admin_all" on public.campaign_share_settings
for all using (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
) with check (
  public.is_admin() or exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
);

grant select on public.campaign_updates, public.campaign_media, public.campaign_payment_configs, public.campaign_seo, public.campaign_share_settings to anon, authenticated;
grant insert, update, delete on public.campaign_updates, public.campaign_media, public.campaign_payment_configs, public.campaign_seo, public.campaign_share_settings to authenticated;

comment on table public.campaign_media is 'Campaign cover, poster, photo and external video assets. Cloudinary stores binary files; this table stores metadata.';
comment on table public.campaign_payment_configs is 'Public VietQR account configuration. Dynamic amount and transfer reference are generated at request time.';
comment on table public.campaign_share_settings is 'Controls public share channels and Open Graph metadata. Share URLs are generated from the campaign URL.';
