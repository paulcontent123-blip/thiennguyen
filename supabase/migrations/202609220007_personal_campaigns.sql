-- Personal campaign ownership and a separate donor verification workflow.
-- Personal verification documents are stored in a private Supabase Storage bucket.
-- Do not expose this bucket publicly: identity documents are sensitive data.

do $$
begin
  create type public.campaign_owner_type as enum ('organization', 'individual');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.personal_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  legal_name text not null,
  phone text,
  verification_status public.review_status not null default 'pending',
  verification_document_path text,
  verification_note text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(legal_name)) between 2 and 160),
  check (phone is null or length(trim(phone)) between 8 and 30)
);

create index if not exists personal_profiles_status_idx
  on public.personal_profiles (verification_status, updated_at desc);

drop trigger if exists personal_profiles_set_updated_at on public.personal_profiles;
create trigger personal_profiles_set_updated_at
before update on public.personal_profiles
for each row execute function public.set_updated_at();

create or replace function public.guard_personal_profile_review_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if new.verified_at is distinct from old.verified_at
      or new.verified_by is distinct from old.verified_by then
      raise exception 'Only Admin may update personal verification identity';
    end if;

    if new.verification_status is distinct from old.verification_status then
      if not (
        new.verification_status = 'pending'
        and old.verification_status in ('needs_revision', 'rejected', 'approved')
        and new.verification_document_path is distinct from old.verification_document_path
        and new.verified_at is null
        and new.verified_by is null
      ) then
        raise exception 'Invalid personal verification status transition';
      end if;
    end if;

    if (new.legal_name is distinct from old.legal_name
      or new.phone is distinct from old.phone)
      and old.verification_status <> 'pending'
      and new.verification_status <> 'pending' then
      raise exception 'Personal profile changes require a new verification submission';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists personal_profiles_guard_review_fields on public.personal_profiles;
create trigger personal_profiles_guard_review_fields
before update on public.personal_profiles
for each row execute function public.guard_personal_profile_review_fields();

alter table public.personal_profiles enable row level security;

drop policy if exists "personal_profiles_owner_or_admin_read" on public.personal_profiles;
create policy "personal_profiles_owner_or_admin_read" on public.personal_profiles
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "personal_profiles_owner_insert" on public.personal_profiles;
create policy "personal_profiles_owner_insert" on public.personal_profiles
for insert to authenticated
with check (
  user_id = auth.uid()
  and verification_status = 'pending'
  and verified_at is null
  and verified_by is null
);

drop policy if exists "personal_profiles_owner_update" on public.personal_profiles;
create policy "personal_profiles_owner_update" on public.personal_profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "personal_profiles_admin_all" on public.personal_profiles;
create policy "personal_profiles_admin_all" on public.personal_profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('personal-verification', 'personal-verification', false)
on conflict (id) do update set public = false;

drop policy if exists "personal_verification_owner_upload" on storage.objects;
create policy "personal_verification_owner_upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'personal-verification'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "personal_verification_owner_or_admin_read" on storage.objects;
create policy "personal_verification_owner_or_admin_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'personal-verification'
  and (owner_id = (select auth.uid()::text) or public.is_admin())
);

drop policy if exists "personal_verification_owner_or_admin_update" on storage.objects;
create policy "personal_verification_owner_or_admin_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'personal-verification'
  and (owner_id = (select auth.uid()::text) or public.is_admin())
)
with check (
  bucket_id = 'personal-verification'
  and (owner_id = (select auth.uid()::text) or public.is_admin())
);

drop policy if exists "personal_verification_owner_or_admin_delete" on storage.objects;
create policy "personal_verification_owner_or_admin_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'personal-verification'
  and (owner_id = (select auth.uid()::text) or public.is_admin())
);

grant select, insert, update on public.personal_profiles to authenticated;

alter table public.campaigns
  add column if not exists owner_type public.campaign_owner_type not null default 'organization',
  add column if not exists owner_user_id uuid references public.profiles(id) on delete restrict;

alter table public.campaigns
  alter column organization_id drop not null;

alter table public.campaigns
  drop constraint if exists campaigns_owner_shape_check;

alter table public.campaigns
  add constraint campaigns_owner_shape_check check (
    (owner_type = 'organization' and organization_id is not null and owner_user_id is null)
    or (owner_type = 'individual' and organization_id is null and owner_user_id is not null)
  );

create index if not exists campaigns_owner_type_status_idx
  on public.campaigns (owner_type, status, created_at desc);
create index if not exists campaigns_owner_user_idx
  on public.campaigns (owner_user_id, created_at desc)
  where owner_user_id is not null;

create or replace function public.is_campaign_owner(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaigns c
    left join public.organizations o on o.id = c.organization_id
    where c.id = p_campaign_id
      and (
        (c.owner_type = 'organization' and o.user_id = auth.uid())
        or (c.owner_type = 'individual' and c.owner_user_id = auth.uid())
      )
  );
$$;

create or replace function public.is_public_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaigns c
    left join public.organizations o on o.id = c.organization_id
    left join public.personal_profiles pp on pp.user_id = c.owner_user_id
    where c.id = p_campaign_id
      and c.status in ('approved', 'active', 'closed')
      and (
        (c.owner_type = 'organization' and o.license_status = 'approved')
        or (c.owner_type = 'individual' and pp.verification_status = 'approved')
      )
  );
$$;

grant execute on function public.is_campaign_owner(uuid) to anon, authenticated;
grant execute on function public.is_public_campaign(uuid) to anon, authenticated;

drop policy if exists "campaigns_public_or_owner_or_admin_read" on public.campaigns;
create policy "campaigns_public_or_owner_or_admin_read" on public.campaigns
for select to anon, authenticated
using (public.is_public_campaign(id) or public.is_campaign_owner(id) or public.is_admin());

drop policy if exists "campaigns_owner_insert" on public.campaigns;
create policy "campaigns_owner_insert" on public.campaigns
for insert to authenticated
with check (
  status = 'draft'
  and (
    (
      owner_type = 'organization'
      and owner_user_id is null
      and exists (
        select 1 from public.organizations o
        where o.id = organization_id
          and o.user_id = auth.uid()
          and o.license_status = 'approved'
      )
    )
    or (
      owner_type = 'individual'
      and organization_id is null
      and owner_user_id = auth.uid()
      and exists (
        select 1 from public.personal_profiles pp
        where pp.user_id = auth.uid()
          and pp.verification_status = 'approved'
      )
    )
  )
);

drop policy if exists "campaigns_owner_update" on public.campaigns;
create policy "campaigns_owner_update" on public.campaigns
for update to authenticated
using (public.is_campaign_owner(id))
with check (public.is_campaign_owner(id));

drop policy if exists "campaigns_admin_all" on public.campaigns;
create policy "campaigns_admin_all" on public.campaigns
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.guard_campaign_review_fields()
returns trigger
language plpgsql
as $$
declare
  content_changed boolean;
  actor_is_admin boolean;
  actor_is_owner boolean;
begin
  actor_is_admin := public.is_admin();
  actor_is_owner := public.is_campaign_owner(old.id);

  if new.organization_id is distinct from old.organization_id
    or new.owner_type is distinct from old.owner_type
    or new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Campaign owner cannot be changed';
  end if;

  content_changed :=
    new.title is distinct from old.title
    or new.slug is distinct from old.slug
    or new.summary is distinct from old.summary
    or new.description is distinct from old.description
    or new.target_amount is distinct from old.target_amount
    or new.campaign_type is distinct from old.campaign_type
    or new.category is distinct from old.category
    or new.deadline is distinct from old.deadline;

  if content_changed and not actor_is_admin and old.status not in ('draft', 'needs_revision') then
    raise exception 'Campaign content is locked after submission';
  end if;

  if not actor_is_admin then
    if new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.published_at is distinct from old.published_at then
      raise exception 'Only Admin may update campaign review fields';
    end if;

    if new.review_note is distinct from old.review_note and not (
      actor_is_owner
      and old.status = 'needs_revision'
      and new.status = 'pending_review'
      and new.review_note is null
    ) then
      raise exception 'Only the campaign owner may clear a review note';
    end if;
  end if;

  if new.status is distinct from old.status then
    if actor_is_owner and (
      (old.status = 'draft' and new.status = 'pending_review')
      or (old.status = 'needs_revision' and new.status = 'pending_review')
    ) then
      if new.submitted_at is null then
        raise exception 'submitted_at is required when submitting a campaign';
      end if;
    elsif actor_is_admin and (
      (old.status = 'pending_review' and new.status in ('approved', 'needs_revision', 'rejected'))
      or (old.status = 'approved' and new.status = 'active')
      or (old.status = 'active' and new.status = 'closed')
    ) then
      if old.status = 'pending_review' and (new.reviewed_at is null or new.reviewed_by is distinct from auth.uid()) then
        raise exception 'Admin review identity and timestamp are required';
      end if;
    else
      raise exception 'Invalid campaign status transition: % -> %', old.status, new.status;
    end if;

    if new.status in ('needs_revision', 'rejected') and coalesce(trim(new.review_note), '') = '' then
      raise exception 'A review note is required for this status';
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "campaign_history_owner_or_admin_read" on public.campaign_status_history;
create policy "campaign_history_owner_or_admin_read" on public.campaign_status_history
for select to authenticated
using (public.is_admin() or public.is_campaign_owner(campaign_id));

grant select on public.campaign_status_history to authenticated;

-- Existing campaign content tables can now belong to an approved personal campaign.
drop policy if exists "campaign_updates_public_read" on public.campaign_updates;
create policy "campaign_updates_public_read" on public.campaign_updates
for select to anon, authenticated
using (is_public and public.is_public_campaign(campaign_id));
drop policy if exists "campaign_updates_owner_or_admin_all" on public.campaign_updates;
create policy "campaign_updates_owner_or_admin_all" on public.campaign_updates
for all to authenticated
using (public.is_admin() or public.is_campaign_owner(campaign_id))
with check (public.is_admin() or public.is_campaign_owner(campaign_id));

drop policy if exists "campaign_media_public_read" on public.campaign_media;
create policy "campaign_media_public_read" on public.campaign_media
for select to anon, authenticated
using (is_public and public.is_public_campaign(campaign_id));
drop policy if exists "campaign_media_owner_or_admin_all" on public.campaign_media;
create policy "campaign_media_owner_or_admin_all" on public.campaign_media
for all to authenticated
using (public.is_admin() or public.is_campaign_owner(campaign_id))
with check (public.is_admin() or public.is_campaign_owner(campaign_id));

drop policy if exists "campaign_payment_configs_public_read" on public.campaign_payment_configs;
create policy "campaign_payment_configs_public_read" on public.campaign_payment_configs
for select to anon, authenticated
using (is_active and public.is_public_campaign(campaign_id));
drop policy if exists "campaign_payment_configs_owner_or_admin_all" on public.campaign_payment_configs;
create policy "campaign_payment_configs_owner_or_admin_all" on public.campaign_payment_configs
for all to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and c.owner_type = 'organization'
      and public.is_campaign_owner(c.id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and c.owner_type = 'organization'
      and public.is_campaign_owner(c.id)
  )
);

drop policy if exists "campaign_seo_public_read" on public.campaign_seo;
create policy "campaign_seo_public_read" on public.campaign_seo
for select to anon, authenticated
using (is_public and public.is_public_campaign(campaign_id));
drop policy if exists "campaign_seo_owner_or_admin_all" on public.campaign_seo;
create policy "campaign_seo_owner_or_admin_all" on public.campaign_seo
for all to authenticated
using (public.is_admin() or public.is_campaign_owner(campaign_id))
with check (public.is_admin() or public.is_campaign_owner(campaign_id));

drop policy if exists "campaign_share_settings_public_read" on public.campaign_share_settings;
create policy "campaign_share_settings_public_read" on public.campaign_share_settings
for select to anon, authenticated
using (is_public and public.is_public_campaign(campaign_id));
drop policy if exists "campaign_share_settings_owner_or_admin_all" on public.campaign_share_settings;
create policy "campaign_share_settings_owner_or_admin_all" on public.campaign_share_settings
for all to authenticated
using (public.is_admin() or public.is_campaign_owner(campaign_id))
with check (public.is_admin() or public.is_campaign_owner(campaign_id));

-- Personal campaign owners may view their campaign's transaction records, but
-- disbursement creation remains restricted to organization campaigns for now.
alter table public.transactions
  alter column organization_id drop not null,
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null;

alter table public.transactions
  drop constraint if exists transactions_owner_shape_check;
alter table public.transactions
  add constraint transactions_owner_shape_check check (
    (organization_id is not null and owner_user_id is null)
    or (organization_id is null and owner_user_id is not null)
  );

create index if not exists transactions_owner_user_created_idx
  on public.transactions (owner_user_id, created_at desc)
  where owner_user_id is not null;

drop policy if exists "transactions_organization_or_admin_read" on public.transactions;
create policy "transactions_organization_or_admin_read" on public.transactions
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.organizations organization
    where organization.id = organization_id and organization.user_id = auth.uid()
  )
  or owner_user_id = auth.uid()
);

drop policy if exists "disbursements_owner_or_admin_read" on public.disbursements;
create policy "disbursements_owner_or_admin_read" on public.disbursements
for select to authenticated
using (public.is_admin() or public.is_campaign_owner(campaign_id));

drop policy if exists "disbursements_org_insert" on public.disbursements;
create policy "disbursements_org_insert" on public.disbursements
for insert to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'draft'
  and representative_approved_at is null
  and post_audit_status = 'not_reviewed'
  and post_audited_by is null
  and post_audited_at is null
  and exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and c.owner_type = 'organization'
      and public.is_campaign_owner(c.id)
  )
);

drop policy if exists "disbursements_org_update" on public.disbursements;
create policy "disbursements_org_update" on public.disbursements
for update to authenticated
using (
  status in ('draft', 'submitted')
  and exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and c.owner_type = 'organization'
      and public.is_campaign_owner(c.id)
  )
)
with check (submitted_by = auth.uid());

create or replace function public.create_donation_intent(
  p_campaign_id uuid,
  p_amount_vnd numeric,
  p_receipt_email text,
  p_donor_name text default null
)
returns table (
  id uuid,
  tx_ref text,
  amount_vnd numeric,
  status text,
  bank_id text,
  account_no text,
  account_name text,
  transfer_description text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_record record;
  payment_record record;
  normalized_email text;
  normalized_name text;
  generated_ref text;
  generated_description text;
  current_user_id uuid;
begin
  if p_amount_vnd is null
    or p_amount_vnd < 10000
    or p_amount_vnd > 10000000000
    or trunc(p_amount_vnd) <> p_amount_vnd then
    raise exception 'DONATION_AMOUNT_INVALID';
  end if;

  normalized_email := lower(trim(coalesce(p_receipt_email, '')));
  if normalized_email = ''
    or length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'DONATION_EMAIL_INVALID';
  end if;

  normalized_name := nullif(trim(coalesce(p_donor_name, '')), '');
  if normalized_name is not null and length(normalized_name) not between 2 and 120 then
    raise exception 'DONATION_NAME_INVALID';
  end if;

  select
    campaign.id,
    campaign.organization_id,
    campaign.owner_user_id,
    campaign.owner_type,
    campaign.slug,
    campaign.status,
    campaign.deadline
  into campaign_record
  from public.campaigns campaign
  left join public.organizations organization on organization.id = campaign.organization_id
  left join public.personal_profiles personal_profile on personal_profile.user_id = campaign.owner_user_id
  where campaign.id = p_campaign_id
    and campaign.status = 'active'
    and (campaign.deadline is null or campaign.deadline >= current_date)
    and (
      (campaign.owner_type = 'organization' and organization.license_status = 'approved')
      or (campaign.owner_type = 'individual' and personal_profile.verification_status = 'approved')
    );

  if not found then
    raise exception 'CAMPAIGN_NOT_ACCEPTING_DONATIONS';
  end if;

  select
    config.bank_id,
    config.account_no,
    config.account_name,
    config.description_template
  into payment_record
  from public.campaign_payment_configs config
  where config.campaign_id = campaign_record.id
    and config.is_active = true;

  if not found then
    raise exception 'CAMPAIGN_PAYMENT_NOT_CONFIGURED';
  end if;

  generated_ref := 'TN-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  generated_description := coalesce(nullif(trim(payment_record.description_template), ''), 'Ung ho {tx_ref}');
  generated_description := replace(generated_description, '{campaign_slug}', campaign_record.slug);
  generated_description := replace(generated_description, '{campaign_id}', campaign_record.id::text);
  generated_description := replace(generated_description, '{tx_ref}', generated_ref);
  if position(generated_ref in generated_description) = 0 then
    generated_description := left(generated_description, 100) || ' ' || generated_ref;
  end if;

  current_user_id := auth.uid();
  if current_user_id is not null
    and not exists (select 1 from public.profiles profile where profile.id = current_user_id) then
    current_user_id := null;
  end if;

  return query
  insert into public.transactions (
    campaign_id,
    organization_id,
    owner_user_id,
    user_id,
    tx_ref,
    amount_vnd,
    receipt_email,
    donor_name,
    receiving_bank_id,
    receiving_account_no,
    receiving_account_name,
    transfer_description
  ) values (
    campaign_record.id,
    campaign_record.organization_id,
    case when campaign_record.owner_type = 'individual' then campaign_record.owner_user_id else null end,
    current_user_id,
    generated_ref,
    p_amount_vnd,
    normalized_email,
    normalized_name,
    payment_record.bank_id,
    payment_record.account_no,
    payment_record.account_name,
    generated_description
  )
  returning
    transactions.id,
    transactions.tx_ref,
    transactions.amount_vnd,
    transactions.status::text,
    transactions.receiving_bank_id,
    transactions.receiving_account_no,
    transactions.receiving_account_name,
    transactions.transfer_description,
    transactions.expires_at,
    transactions.created_at;
end;
$$;

create or replace function public.get_campaign_donation_summary(p_campaign_id uuid)
returns table (
  total_amount_vnd numeric,
  completed_count bigint,
  last_completed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(tx.amount_vnd), 0)::numeric,
    count(*)::bigint,
    max(tx.completed_at)
  from public.transactions tx
  where tx.campaign_id = p_campaign_id
    and tx.status = 'completed'
    and public.is_public_campaign(p_campaign_id);
$$;

revoke all on function public.create_donation_intent(uuid, numeric, text, text) from public;
revoke all on function public.get_campaign_donation_summary(uuid) from public;
grant execute on function public.create_donation_intent(uuid, numeric, text, text) to anon, authenticated;
grant execute on function public.get_campaign_donation_summary(uuid) to anon, authenticated;

comment on table public.personal_profiles is
'Personal campaign owner verification. A donor must be approved by Admin before creating or submitting a personal campaign.';
comment on column public.campaigns.owner_type is
'Campaign ownership model: organization or individually verified donor.';
comment on column public.campaigns.owner_user_id is
'Personal owner for individual campaigns; null for organization campaigns.';
