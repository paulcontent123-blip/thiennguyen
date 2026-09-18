create extension if not exists "pgcrypto";

create type public.app_role as enum ('donor', 'org', 'rescue_team', 'admin');
create type public.review_status as enum ('pending', 'needs_revision', 'approved', 'rejected');
create type public.campaign_status as enum ('draft', 'pending_review', 'needs_revision', 'approved', 'active', 'closed', 'rejected');
create type public.rescue_team_status as enum ('available', 'en_route', 'busy', 'inactive');
create type public.disbursement_status as enum ('draft', 'submitted', 'representative_approved', 'recorded', 'published');
create type public.post_audit_status as enum ('not_reviewed', 'valid', 'needs_explanation', 'violation');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'donor',
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  name text not null,
  legal_representative_name text not null,
  legal_representative_email text,
  legal_representative_phone text,
  license_status public.review_status not null default 'pending',
  license_file_path text,
  license_number text,
  license_note text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  title text not null,
  slug text not null unique,
  summary text not null default '',
  description text not null default '',
  target_amount numeric(18, 2) not null check (target_amount > 0),
  status public.campaign_status not null default 'draft',
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rescue_applications (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id) on delete set null,
  contact_email text not null,
  contact_name text not null,
  contact_phone text,
  team_name text,
  affiliated_organization text,
  resource_types text[] not null default '{}',
  province text,
  radius_km integer check (radius_km is null or radius_km > 0),
  evidence_paths text[] not null default '{}',
  status public.review_status not null default 'pending',
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rescue_invitations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.rescue_applications(id) on delete set null,
  email text not null,
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index rescue_invitations_one_pending_per_email
  on public.rescue_invitations (lower(email))
  where status = 'pending';

create table public.rescue_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  application_id uuid unique references public.rescue_applications(id) on delete set null,
  name text not null,
  resource_types text[] not null default '{}',
  province text,
  radius_km integer check (radius_km is null or radius_km > 0),
  latitude double precision,
  longitude double precision,
  status public.rescue_team_status not null default 'inactive',
  activated_at timestamptz not null default now(),
  activated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.disbursements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  amount numeric(18, 2) not null check (amount > 0),
  description text not null,
  status public.disbursement_status not null default 'draft',
  evidence_paths text[] not null default '{}',
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  representative_approved_at timestamptz,
  signature_method text,
  signature_reference text,
  post_audit_status public.post_audit_status not null default 'not_reviewed',
  post_audited_by uuid references public.profiles(id) on delete set null,
  post_audited_at timestamptz,
  post_audit_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();
create trigger rescue_applications_set_updated_at before update on public.rescue_applications
for each row execute function public.set_updated_at();
create trigger rescue_teams_set_updated_at before update on public.rescue_teams
for each row execute function public.set_updated_at();
create trigger disbursements_set_updated_at before update on public.disbursements
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_role public.app_role;
  display_name text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'org' then 'org'::public.app_role
    else 'donor'::public.app_role
  end;
  display_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');

  insert into public.profiles (id, role, full_name)
  values (new.id, requested_role, display_name);

  if requested_role = 'org' then
    insert into public.organizations (user_id, name, legal_representative_name, legal_representative_email)
    values (new.id, display_name, display_name, new.email);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.guard_organization_review_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and (
    new.license_status is distinct from old.license_status
    or new.license_note is distinct from old.license_note
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
  ) then
    raise exception 'Only Admin may update organization review fields';
  end if;
  return new;
end;
$$;

create trigger organizations_guard_review_fields
before update on public.organizations
for each row execute function public.guard_organization_review_fields();

create or replace function public.guard_campaign_review_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if new.review_note is distinct from old.review_note
      or new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.published_at is distinct from old.published_at then
      raise exception 'Only Admin may update campaign review fields';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'draft' and new.status = 'pending_review')
      or (old.status = 'needs_revision' and new.status = 'pending_review')
    ) then
      raise exception 'Organization cannot perform this campaign status transition';
    end if;
  end if;
  return new;
end;
$$;

create trigger campaigns_guard_review_fields
before update on public.campaigns
for each row execute function public.guard_campaign_review_fields();

create or replace function public.guard_rescue_team_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and (
    new.user_id is distinct from old.user_id
    or new.application_id is distinct from old.application_id
    or new.name is distinct from old.name
    or new.resource_types is distinct from old.resource_types
    or new.province is distinct from old.province
    or new.radius_km is distinct from old.radius_km
    or new.activated_at is distinct from old.activated_at
    or new.activated_by is distinct from old.activated_by
  ) then
    raise exception 'Rescue team may only update operational status and location';
  end if;
  return new;
end;
$$;

create trigger rescue_teams_guard_fields
before update on public.rescue_teams
for each row execute function public.guard_rescue_team_fields();

create or replace function public.guard_disbursement_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and (
    new.post_audit_status is distinct from old.post_audit_status
    or new.post_audited_by is distinct from old.post_audited_by
    or new.post_audited_at is distinct from old.post_audited_at
    or new.post_audit_note is distinct from old.post_audit_note
  ) then
    raise exception 'Only Admin may update post-audit fields';
  end if;

  if not public.is_admin() and new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status = 'submitted')
    or (old.status = 'submitted' and new.status = 'representative_approved')
  ) then
    raise exception 'Organization cannot perform this disbursement status transition';
  end if;
  return new;
end;
$$;

create trigger disbursements_guard_audit_fields
before update on public.disbursements
for each row execute function public.guard_disbursement_audit_fields();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.campaigns enable row level security;
alter table public.rescue_applications enable row level security;
alter table public.rescue_invitations enable row level security;
alter table public.rescue_teams enable row level security;
alter table public.disbursements enable row level security;

create policy "profiles_read_own_or_admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());

create policy "organizations_public_verified_or_owner_or_admin" on public.organizations
for select using (license_status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "organizations_owner_update" on public.organizations
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "organizations_admin_update" on public.organizations
for update using (public.is_admin()) with check (public.is_admin());

create policy "campaigns_public_or_owner_or_admin_read" on public.campaigns
for select using (
  status in ('approved', 'active', 'closed')
  or exists (select 1 from public.organizations o where o.id = organization_id and o.user_id = auth.uid())
  or public.is_admin()
);
create policy "campaigns_owner_insert" on public.campaigns
for insert with check (
  status = 'draft'
  and exists (select 1 from public.organizations o where o.id = organization_id and o.user_id = auth.uid() and o.license_status = 'approved')
);
create policy "campaigns_owner_update" on public.campaigns
for update using (
  exists (select 1 from public.organizations o where o.id = organization_id and o.user_id = auth.uid())
) with check (
  exists (select 1 from public.organizations o where o.id = organization_id and o.user_id = auth.uid())
);
create policy "campaigns_admin_all" on public.campaigns
for all using (public.is_admin()) with check (public.is_admin());

create policy "rescue_applications_submit" on public.rescue_applications
for insert to authenticated with check (
  submitted_by = auth.uid()
  and status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
);
create policy "rescue_applications_owner_or_admin_read" on public.rescue_applications
for select using (submitted_by = auth.uid() or public.is_admin());
create policy "rescue_applications_admin_update" on public.rescue_applications
for update using (public.is_admin()) with check (public.is_admin());

create policy "rescue_invitations_admin_all" on public.rescue_invitations
for all using (public.is_admin()) with check (public.is_admin());

create policy "rescue_teams_self_or_admin_read" on public.rescue_teams
for select using (user_id = auth.uid() or public.is_admin());
create policy "rescue_teams_self_status_update" on public.rescue_teams
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rescue_teams_admin_all" on public.rescue_teams
for all using (public.is_admin()) with check (public.is_admin());

create policy "disbursements_owner_or_admin_read" on public.disbursements
for select using (
  exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  ) or public.is_admin()
);
create policy "disbursements_org_insert" on public.disbursements
for insert with check (
  submitted_by = auth.uid()
  and status = 'draft'
  and representative_approved_at is null
  and post_audit_status = 'not_reviewed'
  and post_audited_by is null
  and post_audited_at is null
  and exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
);
create policy "disbursements_org_update" on public.disbursements
for update using (
  status in ('draft', 'submitted')
  and exists (
    select 1 from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
) with check (submitted_by = auth.uid());
create policy "disbursements_admin_update" on public.disbursements
for update using (public.is_admin()) with check (public.is_admin());

comment on table public.rescue_invitations is
'Proposal pending Tech Lead confirmation: invitation-only versus invitation after application approval.';
comment on column public.disbursements.signature_method is
'Intentionally open: OTP, legal checkbox, uploaded signature, or digital signature is not decided.';
comment on column public.disbursements.status is
'Publication timing remains configurable until Tech Lead decides before/after post-audit.';
