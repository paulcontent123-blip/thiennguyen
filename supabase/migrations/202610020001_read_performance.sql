-- Read-path indexes and bounded resource read models.

create extension if not exists pg_trgm with schema extensions;

create index if not exists campaigns_public_published_idx
  on public.campaigns (status, published_at desc, created_at desc);
create index if not exists campaigns_organization_created_idx
  on public.campaigns (organization_id, created_at desc);
create index if not exists campaigns_title_trgm_idx
  on public.campaigns using gin (title extensions.gin_trgm_ops);
create index if not exists resource_needs_review_status_created_idx
  on public.resource_needs (moderation_status, status, created_at desc);
create index if not exists disbursements_campaign_audit_created_idx
  on public.disbursements (campaign_id, post_audit_status, created_at desc);

create or replace function public.get_public_resource_needs_page(
  p_limit integer default 100,
  p_offset integer default 0,
  p_campaign_id uuid default null
)
returns table (
  id uuid, campaign_id uuid, resource_type text, name text, description text, category text,
  quantity_needed numeric, unit text, province text, urgency text, status text, created_at timestamptz,
  campaign_title text, campaign_slug text, campaign_province text, claimed_quantity numeric, committed_quantity numeric
)
language sql stable security definer set search_path = '' as $$
  select need.id, need.campaign_id, need.resource_type, need.name, need.description, need.category,
    need.quantity_needed, need.unit, need.province, need.urgency, need.status, need.created_at,
    campaign.title, campaign.slug, campaign.province,
    coalesce((
      select sum(claim.delivered_quantity)
      from public.resource_claims claim
      where claim.need_id = need.id and claim.status = 'delivered'
    ), 0) as claimed_quantity,
    coalesce((
      select sum(case when claim.status = 'delivered' then coalesce(claim.delivered_quantity, claim.quantity) else claim.quantity end)
      from public.resource_claims claim
      where claim.need_id = need.id and claim.status in ('reserved', 'confirmed', 'delivered')
    ), 0) as committed_quantity
  from public.resource_needs need
  join public.campaigns campaign on campaign.id = need.campaign_id
  where need.status in ('open', 'fulfilled')
    and need.moderation_status = 'approved'
    and (p_campaign_id is null or need.campaign_id = p_campaign_id)
    and public.is_public_campaign(need.campaign_id)
  order by case need.urgency when 'urgent' then 0 else 1 end, need.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_public_resource_offers_page(
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid, resource_type text, title text, description text, quantity numeric, unit text,
  estimated_value_vnd numeric, province text, available_from date, radius_km integer, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select offer.id, offer.resource_type, offer.title, offer.description, offer.quantity, offer.unit,
    offer.estimated_value_vnd, offer.province, offer.available_from, offer.radius_km, offer.created_at
  from public.resource_offers offer
  where offer.status = 'available'
  order by offer.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_managed_resource_need_progress(p_campaign_ids uuid[])
returns table (need_id uuid, claimed_quantity numeric, committed_quantity numeric)
language sql stable security definer set search_path = '' as $$
  select need.id,
    coalesce(sum(claim.delivered_quantity) filter (where claim.status = 'delivered'), 0) as claimed_quantity,
    coalesce(sum(case
      when claim.status = 'delivered' then coalesce(claim.delivered_quantity, claim.quantity)
      when claim.status in ('reserved', 'confirmed') then claim.quantity
      else 0
    end), 0) as committed_quantity
  from public.resource_needs need
  left join public.resource_claims claim on claim.need_id = need.id
  where need.campaign_id = any(coalesce(p_campaign_ids, array[]::uuid[]))
    and (public.is_admin() or public.is_campaign_owner(need.campaign_id))
  group by need.id;
$$;

revoke all on function public.get_public_resource_needs_page(integer, integer, uuid) from public;
revoke all on function public.get_public_resource_offers_page(integer, integer) from public;
revoke all on function public.get_managed_resource_need_progress(uuid[]) from public;
grant execute on function public.get_public_resource_needs_page(integer, integer, uuid) to anon, authenticated;
grant execute on function public.get_public_resource_offers_page(integer, integer) to anon, authenticated;
grant execute on function public.get_managed_resource_need_progress(uuid[]) to authenticated;

comment on function public.get_public_resource_needs_page(integer, integer, uuid) is
'Bounded public resource needs query, optionally scoped to one campaign.';
comment on function public.get_public_resource_offers_page(integer, integer) is
'Bounded public resource offers query.';
comment on function public.get_managed_resource_need_progress(uuid[]) is
'Resource delivery progress restricted to campaign owners and admins.';

create or replace function public.get_my_notification_feed(p_limit integer default 30)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(recent_notification) order by recent_notification.created_at desc)
      from (
        select notification.id, notification.category, notification.title, notification.body,
          notification.link, notification.read_at, notification.created_at
        from public.notifications notification
        where notification.user_id = auth.uid()
        order by notification.created_at desc
        limit least(greatest(coalesce(p_limit, 30), 1), 50)
      ) recent_notification
    ), '[]'::jsonb),
    'unread_count', (
      select count(*) from public.notifications notification
      where notification.user_id = auth.uid() and notification.read_at is null
    )
  );
$$;

revoke all on function public.get_my_notification_feed(integer) from public;
grant execute on function public.get_my_notification_feed(integer) to authenticated;

comment on function public.get_my_notification_feed(integer) is
'Returns the current user notification list and unread count in one database round-trip.';
