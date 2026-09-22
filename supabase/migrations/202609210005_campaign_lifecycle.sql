-- State machine và audit trail bất biến cho vòng đời chiến dịch.

create table public.campaign_status_history (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  from_status public.campaign_status,
  to_status public.campaign_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null default 'Hệ thống',
  actor_role public.app_role,
  note text,
  created_at timestamptz not null default now()
);

create index campaign_status_history_campaign_created_idx
  on public.campaign_status_history (campaign_id, created_at desc);

alter table public.campaign_status_history enable row level security;

create policy "campaign_history_owner_or_admin_read" on public.campaign_status_history
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.campaigns c
    join public.organizations o on o.id = c.organization_id
    where c.id = campaign_id and o.user_id = auth.uid()
  )
);

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
  select exists (
    select 1 from public.organizations o
    where o.id = old.organization_id and o.user_id = auth.uid()
  ) into actor_is_owner;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Campaign organization cannot be changed';
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
      raise exception 'Only Admin may update campaign review notes';
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

create or replace function public.log_campaign_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  profile_role public.app_role;
  previous_status public.campaign_status;
  event_time timestamptz;
begin
  if tg_op = 'INSERT' then
    previous_status := null;
    event_time := new.created_at;
  elsif new.status is distinct from old.status then
    previous_status := old.status;
    event_time := now();
  else
    return new;
  end if;

  select nullif(trim(p.full_name), ''), p.role
  into profile_name, profile_role
  from public.profiles p
  where p.id = auth.uid();

  insert into public.campaign_status_history (
    campaign_id,
    from_status,
    to_status,
    actor_id,
    actor_name,
    actor_role,
    note,
    created_at
  ) values (
    new.id,
    previous_status,
    new.status,
    auth.uid(),
    coalesce(profile_name, 'Hệ thống'),
    profile_role,
    new.review_note,
    event_time
  );

  return new;
end;
$$;

-- Backfill một mốc đại diện cho trạng thái hiện tại của dữ liệu đã tồn tại.
insert into public.campaign_status_history (
  campaign_id, from_status, to_status, actor_id, actor_name, actor_role, note, created_at
)
select
  c.id,
  null,
  c.status,
  coalesce(c.reviewed_by, o.user_id),
  coalesce(nullif(trim(p.full_name), ''), 'Hệ thống'),
  p.role,
  c.review_note,
  coalesce(c.reviewed_at, c.submitted_at, c.created_at)
from public.campaigns c
join public.organizations o on o.id = c.organization_id
left join public.profiles p on p.id = coalesce(c.reviewed_by, o.user_id);

drop trigger if exists campaigns_log_status_history on public.campaigns;
create trigger campaigns_log_status_history
after insert or update of status on public.campaigns
for each row execute function public.log_campaign_status_history();

comment on table public.campaign_status_history is
'Append-only audit trail. No direct insert/update/delete policies are granted to application users.';
