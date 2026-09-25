-- Real reporting aggregates and campaign closure timestamp.
-- Public RPCs expose aggregates only; no donor identity or transaction row is returned.

alter table public.campaigns
  add column if not exists closed_at timestamptz;

update public.campaigns campaign
set closed_at = coalesce(
  campaign.closed_at,
  (
    select max(history.created_at)
    from public.campaign_status_history history
    where history.campaign_id = campaign.id
      and history.to_status = 'closed'
  ),
  campaign.updated_at
)
where campaign.status = 'closed'
  and campaign.closed_at is null;

create or replace function public.set_campaign_closed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    new.closed_at := coalesce(new.closed_at, now());
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists campaigns_set_closed_at on public.campaigns;
create trigger campaigns_set_closed_at
before update of status on public.campaigns
for each row execute function public.set_campaign_closed_at();

create or replace function public.get_public_period_reports(p_year integer)
returns table (
  period_key text,
  period_type text,
  period_number integer,
  period_start date,
  period_end date,
  is_complete boolean,
  total_received_vnd numeric,
  completed_donation_count bigint,
  campaign_count bigint,
  total_disbursed_vnd numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with periods as (
    select
      'quarter'::text as period_type,
      number as period_number,
      make_date(p_year, ((number - 1) * 3) + 1, 1) as period_start,
      (make_date(p_year, ((number - 1) * 3) + 1, 1) + interval '3 months - 1 day')::date as period_end
    from generate_series(1, 4) number
    union all
    select
      'half'::text,
      number,
      make_date(p_year, ((number - 1) * 6) + 1, 1),
      (make_date(p_year, ((number - 1) * 6) + 1, 1) + interval '6 months - 1 day')::date
    from generate_series(1, 2) number
  )
  select
    case when period.period_type = 'quarter' then 'Q' else 'H' end || period.period_number || '-' || p_year,
    period.period_type,
    period.period_number,
    period.period_start,
    period.period_end,
    current_date > period.period_end,
    coalesce(donation.total_received_vnd, 0)::numeric,
    coalesce(donation.completed_donation_count, 0)::bigint,
    coalesce(donation.campaign_count, 0)::bigint,
    coalesce(disbursement.total_disbursed_vnd, 0)::numeric
  from periods period
  left join lateral (
    select
      sum(coalesce(transaction_record.received_amount, transaction_record.amount_vnd)) as total_received_vnd,
      count(*) as completed_donation_count,
      count(distinct transaction_record.campaign_id) as campaign_count
    from public.transactions transaction_record
    where transaction_record.status = 'completed'
      and public.is_public_campaign(transaction_record.campaign_id)
      and coalesce(transaction_record.completed_at, transaction_record.created_at) >= period.period_start::timestamptz
      and coalesce(transaction_record.completed_at, transaction_record.created_at) < (period.period_end + 1)::timestamptz
  ) donation on true
  left join lateral (
    select sum(disbursement_record.amount) as total_disbursed_vnd
    from public.disbursements disbursement_record
    where disbursement_record.status in ('representative_approved', 'recorded', 'published')
      and disbursement_record.post_audit_status = 'valid'
      and public.is_public_campaign(disbursement_record.campaign_id)
      and coalesce(disbursement_record.post_audited_at, disbursement_record.representative_approved_at, disbursement_record.created_at) >= period.period_start::timestamptz
      and coalesce(disbursement_record.post_audited_at, disbursement_record.representative_approved_at, disbursement_record.created_at) < (period.period_end + 1)::timestamptz
  ) disbursement on true
  order by period.period_type desc, period.period_number;
$$;

create or replace function public.get_public_closed_campaign_reports(p_limit integer default 100)
returns table (
  campaign_id uuid,
  slug text,
  title text,
  owner_name text,
  category text,
  province text,
  closed_at timestamptz,
  total_received_vnd numeric,
  total_disbursed_vnd numeric,
  completed_donation_count bigint,
  valid_disbursement_count bigint,
  evidence_file_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    campaign.id,
    campaign.slug,
    campaign.title,
    case
      when campaign.owner_type = 'organization' then coalesce(organization.name, 'Tổ chức thiện nguyện')
      else 'Chủ chiến dịch cá nhân'
    end,
    campaign.category,
    campaign.province,
    campaign.closed_at,
    coalesce(donation.total_received_vnd, 0)::numeric,
    coalesce(disbursement.total_disbursed_vnd, 0)::numeric,
    coalesce(donation.completed_donation_count, 0)::bigint,
    coalesce(disbursement.valid_disbursement_count, 0)::bigint,
    coalesce(disbursement.evidence_file_count, 0)::bigint
  from public.campaigns campaign
  left join public.organizations organization on organization.id = campaign.organization_id
  left join lateral (
    select
      sum(coalesce(transaction_record.received_amount, transaction_record.amount_vnd)) as total_received_vnd,
      count(*) as completed_donation_count
    from public.transactions transaction_record
    where transaction_record.campaign_id = campaign.id
      and transaction_record.status = 'completed'
  ) donation on true
  left join lateral (
    select
      sum(disbursement_record.amount) as total_disbursed_vnd,
      count(*) as valid_disbursement_count,
      coalesce(sum(cardinality(disbursement_record.evidence_paths)), 0)::bigint as evidence_file_count
    from public.disbursements disbursement_record
    where disbursement_record.campaign_id = campaign.id
      and disbursement_record.status in ('representative_approved', 'recorded', 'published')
      and disbursement_record.post_audit_status = 'valid'
  ) disbursement on true
  where campaign.status = 'closed'
    and public.is_public_campaign(campaign.id)
  order by campaign.closed_at desc nulls last, campaign.updated_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

create or replace function public.get_campaign_closure_summary(p_campaign_id uuid)
returns table (
  total_received_vnd numeric,
  completed_donation_count bigint,
  donor_count bigint,
  total_disbursed_vnd numeric,
  valid_disbursement_count bigint,
  evidence_file_count bigint,
  pending_disbursement_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_public_campaign(p_campaign_id)
    or public.is_campaign_owner(p_campaign_id)
    or public.is_admin()
  ) then
    raise exception 'CAMPAIGN_REPORT_FORBIDDEN';
  end if;

  return query
  select
    coalesce(donation.total_received_vnd, 0)::numeric,
    coalesce(donation.completed_donation_count, 0)::bigint,
    coalesce(donation.donor_count, 0)::bigint,
    coalesce(disbursement.total_disbursed_vnd, 0)::numeric,
    coalesce(disbursement.valid_disbursement_count, 0)::bigint,
    coalesce(disbursement.evidence_file_count, 0)::bigint,
    coalesce(disbursement.pending_disbursement_count, 0)::bigint
  from (
    select
      sum(coalesce(transaction_record.received_amount, transaction_record.amount_vnd)) as total_received_vnd,
      count(*) as completed_donation_count,
      count(distinct coalesce(transaction_record.user_id::text, lower(transaction_record.receipt_email))) as donor_count
    from public.transactions transaction_record
    where transaction_record.campaign_id = p_campaign_id
      and transaction_record.status = 'completed'
  ) donation
  cross join (
    select
      sum(disbursement_record.amount) filter (
        where disbursement_record.status in ('representative_approved', 'recorded', 'published')
          and disbursement_record.post_audit_status = 'valid'
      ) as total_disbursed_vnd,
      count(*) filter (where disbursement_record.post_audit_status = 'valid') as valid_disbursement_count,
      coalesce(sum(cardinality(disbursement_record.evidence_paths)) filter (where disbursement_record.post_audit_status = 'valid'), 0) as evidence_file_count,
      count(*) filter (
        where disbursement_record.status in ('submitted', 'representative_approved')
          and disbursement_record.post_audit_status = 'not_reviewed'
      ) as pending_disbursement_count
    from public.disbursements disbursement_record
    where disbursement_record.campaign_id = p_campaign_id
  ) disbursement;
end;
$$;

create or replace function public.get_public_campaign_disbursements(p_campaign_id uuid)
returns table (
  id uuid,
  amount numeric,
  description text,
  evidence_file_count integer,
  representative_approved_at timestamptz,
  post_audited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    disbursement.id,
    disbursement.amount,
    disbursement.description,
    cardinality(disbursement.evidence_paths),
    disbursement.representative_approved_at,
    disbursement.post_audited_at
  from public.disbursements disbursement
  join public.campaigns campaign on campaign.id = disbursement.campaign_id
  where disbursement.campaign_id = p_campaign_id
    and campaign.status = 'closed'
    and public.is_public_campaign(campaign.id)
    and disbursement.status in ('representative_approved', 'recorded', 'published')
    and disbursement.post_audit_status = 'valid'
  order by coalesce(disbursement.post_audited_at, disbursement.representative_approved_at, disbursement.created_at);
$$;

revoke all on function public.get_public_period_reports(integer) from public;
revoke all on function public.get_public_closed_campaign_reports(integer) from public;
revoke all on function public.get_campaign_closure_summary(uuid) from public;
revoke all on function public.get_public_campaign_disbursements(uuid) from public;
grant execute on function public.get_public_period_reports(integer) to anon, authenticated;
grant execute on function public.get_public_closed_campaign_reports(integer) to anon, authenticated;
grant execute on function public.get_campaign_closure_summary(uuid) to anon, authenticated;
grant execute on function public.get_public_campaign_disbursements(uuid) to anon, authenticated;

comment on function public.get_public_period_reports(integer) is
'Returns public aggregate reporting figures only. Disbursement totals include Admin post-audited valid records.';
comment on function public.get_public_closed_campaign_reports(integer) is
'Returns aggregate closure summaries for public closed campaigns without donor identity.';
