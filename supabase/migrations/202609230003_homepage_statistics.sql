-- Public, aggregated homepage statistics.
-- Do not expose personal_profiles or transaction rows to anonymous visitors.

create or replace function public.get_homepage_stats()
returns table (
  verified_organization_count bigint,
  verified_personal_profile_count bigint,
  public_campaign_count bigint,
  member_count bigint,
  completed_donation_count bigint,
  total_received_vnd numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      select count(*)::bigint
      from public.organizations organization
      where organization.license_status = 'approved'
    ),
    (
      select count(*)::bigint
      from public.personal_profiles profile
      where profile.verification_status = 'approved'
    ),
    (
      select count(*)::bigint
      from public.campaigns campaign
      where public.is_public_campaign(campaign.id)
    ),
    (
      select count(*)::bigint
      from public.profiles profile
      where profile.role in ('donor', 'org', 'rescue_team')
    ),
    (
      select count(*)::bigint
      from public.transactions transaction_record
      where transaction_record.status = 'completed'
        and public.is_public_campaign(transaction_record.campaign_id)
    ),
    coalesce(
      (
        select sum(coalesce(transaction_record.received_amount, transaction_record.amount_vnd))::numeric
        from public.transactions transaction_record
        where transaction_record.status = 'completed'
          and public.is_public_campaign(transaction_record.campaign_id)
      ),
      0::numeric
    );
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
    coalesce(sum(coalesce(transaction_record.received_amount, transaction_record.amount_vnd)), 0)::numeric,
    count(*)::bigint,
    max(transaction_record.completed_at)
  from public.transactions transaction_record
  where transaction_record.campaign_id = p_campaign_id
    and transaction_record.status = 'completed'
    and public.is_public_campaign(p_campaign_id);
$$;

revoke all on function public.get_homepage_stats() from public;
grant execute on function public.get_homepage_stats() to anon, authenticated;
grant execute on function public.get_campaign_donation_summary(uuid) to anon, authenticated;

comment on function public.get_homepage_stats() is
'Returns only aggregated, public homepage metrics. It never exposes personal profile or transaction rows.';
