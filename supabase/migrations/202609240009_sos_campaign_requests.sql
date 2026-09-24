-- Anyone may request fundraising while filing a new SOS, but only an Admin can
-- create a draft campaign under an approved organization. No guest can publish.
create table public.sos_campaign_requests (
  id uuid primary key default gen_random_uuid(),
  sos_report_id uuid not null unique references public.sos_reports(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  title text not null check (length(trim(title)) between 8 and 180),
  target_amount numeric(18, 2) not null check (target_amount between 100000 and 100000000000),
  contact_phone text not null,
  contact_email text,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  campaign_id uuid unique references public.campaigns(id) on delete set null,
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index sos_campaign_requests_status_created_idx on public.sos_campaign_requests (status, created_at desc);

alter table public.sos_campaign_requests enable row level security;
revoke all on public.sos_campaign_requests from public, anon, authenticated;
grant insert on public.sos_campaign_requests to anon, authenticated;
grant select, update on public.sos_campaign_requests to authenticated;

create policy "sos_campaign_requests_submit" on public.sos_campaign_requests
for insert to anon, authenticated
with check (
  requested_by is not distinct from auth.uid()
  and status = 'pending_review' and campaign_id is null
  and reviewed_by is null and reviewed_at is null and review_note is null
);

create policy "sos_campaign_requests_read_own_or_admin" on public.sos_campaign_requests
for select to authenticated
using (public.is_admin() or requested_by = auth.uid());

create policy "sos_campaign_requests_admin_update" on public.sos_campaign_requests
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create function public.validate_sos_campaign_request()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare source_report record;
begin
  select reported_by, contact_phone, status into source_report
  from public.sos_reports where id = new.sos_report_id;
  if not found then raise exception 'SOS report not found'; end if;
  if source_report.contact_phone is distinct from new.contact_phone
    or source_report.reported_by is distinct from auth.uid()
    or (auth.uid() is null and source_report.status <> 'pending_review')
    or (auth.uid() is not null and source_report.status not in ('urgent', 'needs_support')) then
    raise exception 'SOS campaign request does not match a newly submitted report';
  end if;
  return new;
end;
$$;

create trigger sos_campaign_requests_validate_insert
before insert on public.sos_campaign_requests
for each row execute function public.validate_sos_campaign_request();

create table public.sos_campaign_links (
  sos_report_id uuid primary key references public.sos_reports(id) on delete restrict,
  campaign_id uuid not null unique references public.campaigns(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.sos_campaign_links enable row level security;
revoke all on public.sos_campaign_links from public, anon, authenticated;
grant select on public.sos_campaign_links to authenticated;

create policy "sos_campaign_links_admin_read" on public.sos_campaign_links
for select to authenticated using (public.is_admin());

create function public.create_sos_emergency_campaign(
  p_sos_report_id uuid, p_organization_id uuid, p_title text, p_target_amount numeric
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare source_report record;
declare new_campaign_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  if length(trim(coalesce(p_title, ''))) not between 8 and 180
    or p_target_amount is null or p_target_amount < 100000 or p_target_amount > 100000000000 then
    raise exception 'Invalid campaign title or target';
  end if;

  select id, location_text, description, status into source_report
  from public.sos_reports where id = p_sos_report_id for update;
  if not found then raise exception 'SOS report not found'; end if;
  if source_report.status not in ('urgent', 'needs_support') then
    raise exception 'SOS report must be verified and active';
  end if;
  if exists (select 1 from public.sos_campaign_links where sos_report_id = p_sos_report_id) then
    raise exception 'This SOS already has an emergency campaign';
  end if;
  if not exists (
    select 1 from public.organizations
    where id = p_organization_id and license_status = 'approved'
  ) then
    raise exception 'An approved organization is required';
  end if;

  insert into public.campaigns (
    organization_id, owner_type, title, slug, summary, description,
    target_amount, campaign_type, category, status
  ) values (
    p_organization_id, 'organization', trim(p_title),
    'sos-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    'Cứu trợ khẩn cấp tại ' || source_report.location_text,
    coalesce(nullif(trim(source_report.description), ''), source_report.location_text),
    p_target_amount, 'direct', 'Cứu trợ khẩn cấp', 'draft'
  ) returning id into new_campaign_id;

  insert into public.sos_campaign_links (sos_report_id, campaign_id, created_by)
  values (p_sos_report_id, new_campaign_id, auth.uid());

  update public.sos_campaign_requests
  set status = 'approved', campaign_id = new_campaign_id, reviewed_by = auth.uid(), reviewed_at = now()
  where sos_report_id = p_sos_report_id and status = 'pending_review';

  return new_campaign_id;
end;
$$;

revoke all on function public.create_sos_emergency_campaign(uuid, uuid, text, numeric) from public;
grant execute on function public.create_sos_emergency_campaign(uuid, uuid, text, numeric) to authenticated;
