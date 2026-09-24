-- Resource workflow: Admin approves needs, verifies matches and confirms delivered quantities.
-- Existing and new needs must pass Admin review before being exposed publicly.

alter table public.resource_needs
  add column moderation_status text,
  add column review_note text,
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column reviewed_at timestamptz;

update public.resource_needs set moderation_status = 'pending_review';

alter table public.resource_needs
  alter column moderation_status set default 'pending_review',
  alter column moderation_status set not null,
  add constraint resource_needs_moderation_status_check
    check (moderation_status in ('pending_review', 'approved', 'rejected'));

alter table public.resource_claims
  add column delivered_quantity numeric(14, 2),
  add constraint resource_claims_delivered_quantity_check
    check (delivered_quantity is null or (delivered_quantity > 0 and delivered_quantity <= quantity));

-- One offer may be matched again when an earlier attempt fails or only part is delivered.
alter table public.resource_claims drop constraint if exists resource_claims_offer_id_key;
create index if not exists resource_claims_offer_idx on public.resource_claims (offer_id);

-- The previous prototype imposed a 48-hour reservation. Tech Lead has not approved that rule.
-- Keep existing registrations and their quantities; remove their automatic expiration.
drop trigger if exists resource_claims_guard_update on public.resource_claims;
update public.resource_claims set expires_at = null where status = 'reserved';
update public.resource_claims set delivered_quantity = quantity where status = 'delivered' and delivered_quantity is null;

create table public.resource_need_review_history (
  id bigint generated always as identity primary key,
  need_id uuid not null references public.resource_needs(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.resource_claim_status_history (
  id bigint generated always as identity primary key,
  claim_id uuid not null references public.resource_claims(id) on delete cascade,
  from_status text,
  to_status text not null,
  delivered_quantity numeric(14, 2),
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.resource_need_review_history enable row level security;
alter table public.resource_claim_status_history enable row level security;
revoke all on public.resource_need_review_history, public.resource_claim_status_history from anon, authenticated;
grant select on public.resource_need_review_history, public.resource_claim_status_history to authenticated;

create policy "resource_need_review_history_admin_read" on public.resource_need_review_history
for select to authenticated using (public.is_admin());
create policy "resource_claim_status_history_admin_read" on public.resource_claim_status_history
for select to authenticated using (public.is_admin());

drop policy if exists "resource_needs_public_read" on public.resource_needs;
create policy "resource_needs_public_read" on public.resource_needs
for select using (
  (moderation_status = 'approved' and status in ('open', 'fulfilled') and public.is_public_campaign(campaign_id))
  or public.is_campaign_owner(campaign_id)
  or public.is_admin()
);

-- Admin and the contributor can see contact details; campaign owners see only verified public progress.
drop policy if exists "resource_claims_private_read" on public.resource_claims;
create policy "resource_claims_private_read" on public.resource_claims
for select to authenticated using (contributor_id = auth.uid() or public.is_admin());

drop policy if exists "resource_offers_private_read" on public.resource_offers;
create policy "resource_offers_private_read" on public.resource_offers
for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.guard_resource_need_moderation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() and (
      new.moderation_status <> 'pending_review'
      or new.status <> 'open'
      or new.review_note is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null
    ) then
      raise exception 'RESOURCE_NEED_REQUIRES_ADMIN_REVIEW';
    end if;
    return new;
  end if;

  if public.is_admin() then return new; end if;

  -- Campaign owner may close an approved need, but cannot approve, reject or edit it after review.
  if public.is_campaign_owner(old.campaign_id)
    and old.moderation_status = 'approved'
    and new.status = 'closed'
    and new.campaign_id is not distinct from old.campaign_id
    and new.resource_type is not distinct from old.resource_type
    and new.name is not distinct from old.name
    and new.description is not distinct from old.description
    and new.category is not distinct from old.category
    and new.quantity_needed is not distinct from old.quantity_needed
    and new.unit is not distinct from old.unit
    and new.province is not distinct from old.province
    and new.urgency is not distinct from old.urgency
    and new.created_by is not distinct from old.created_by
    and new.moderation_status is not distinct from old.moderation_status
    and new.review_note is not distinct from old.review_note
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at then
    return new;
  end if;

  raise exception 'RESOURCE_NEED_ADMIN_ONLY_REVIEW';
end;
$$;

create trigger resource_needs_guard_moderation
before insert or update on public.resource_needs
for each row execute function public.guard_resource_need_moderation();

create or replace function public.log_resource_need_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.resource_need_review_history(need_id, from_status, to_status, note, actor_id)
    values (new.id, null, new.moderation_status, new.review_note, auth.uid());
  elsif new.moderation_status is distinct from old.moderation_status then
    insert into public.resource_need_review_history(need_id, from_status, to_status, note, actor_id)
    values (new.id, old.moderation_status, new.moderation_status, new.review_note, auth.uid());
  end if;
  return new;
end;
$$;

create trigger resource_needs_review_history_insert
after insert on public.resource_needs
for each row execute function public.log_resource_need_review();
create trigger resource_needs_review_history_update
after update of moderation_status on public.resource_needs
for each row execute function public.log_resource_need_review();

drop policy if exists "resource_needs_owner_update" on public.resource_needs;
create policy "resource_needs_owner_update" on public.resource_needs
for update to authenticated
using (public.is_campaign_owner(campaign_id) or public.is_admin())
with check (public.is_campaign_owner(campaign_id) or public.is_admin());

drop policy if exists "resource_claims_coordinator_update" on public.resource_claims;
create policy "resource_claims_contributor_or_admin_update" on public.resource_claims
for update to authenticated
using (contributor_id = auth.uid() or public.is_admin())
with check (contributor_id = auth.uid() or public.is_admin());

create or replace function public.guard_resource_claim_update()
returns trigger language plpgsql as $$
begin
  if new.need_id is distinct from old.need_id
    or new.offer_id is distinct from old.offer_id
    or new.contributor_id is distinct from old.contributor_id
    or new.quantity is distinct from old.quantity
    or new.contact_name is distinct from old.contact_name
    or new.contact_email is distinct from old.contact_email
    or new.contact_phone is distinct from old.contact_phone
    or new.created_at is distinct from old.created_at then
    raise exception 'RESOURCE_CLAIM_IMMUTABLE_FIELDS';
  end if;

  if public.is_admin() then
    if (old.status = 'reserved' and new.status not in ('reserved', 'confirmed', 'cancelled', 'failed'))
      or (old.status = 'confirmed' and new.status not in ('confirmed', 'delivered', 'cancelled', 'failed'))
      or (old.status in ('delivered', 'cancelled', 'expired', 'failed') and new.status <> old.status) then
      raise exception 'INVALID_RESOURCE_CLAIM_TRANSITION';
    end if;
    if new.status = 'delivered' and (new.delivered_quantity is null or length(trim(coalesce(new.coordination_note, ''))) < 3) then
      raise exception 'RESOURCE_DELIVERY_REQUIRES_QUANTITY_AND_EVIDENCE';
    end if;
    if new.status <> 'delivered' and new.delivered_quantity is not null then
      raise exception 'DELIVERED_QUANTITY_ONLY_ALLOWED_ON_DELIVERED';
    end if;
    return new;
  end if;

  if auth.uid() = old.contributor_id
    and new.status = 'cancelled'
    and old.status in ('reserved', 'confirmed')
    and new.coordination_note is not distinct from old.coordination_note
    and new.actual_value_vnd is not distinct from old.actual_value_vnd
    and new.confirmed_at is not distinct from old.confirmed_at
    and new.delivered_at is not distinct from old.delivered_at
    and new.delivered_quantity is not distinct from old.delivered_quantity
    and new.processed_by is not distinct from old.processed_by then
    return new;
  end if;

  raise exception 'RESOURCE_CLAIM_ADMIN_ONLY_REVIEW';
end;
$$;

create trigger resource_claims_guard_update
before update on public.resource_claims
for each row execute function public.guard_resource_claim_update();

create or replace function public.sync_resource_offer_from_claim()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.offer_id is null then return new; end if;

  if tg_op = 'INSERT' then
    update public.resource_offers
    set status = 'matched', matched_need_id = new.need_id
    where id = new.offer_id and status = 'available';
    return new;
  end if;

  if new.status in ('cancelled', 'expired', 'failed') then
    update public.resource_offers
    set status = 'available', matched_need_id = null
    where id = new.offer_id and status = 'matched' and matched_need_id = new.need_id;
  elsif new.status = 'delivered' then
    update public.resource_offers
    set quantity = greatest(quantity - coalesce(new.delivered_quantity, new.quantity), 0),
        status = case when quantity - coalesce(new.delivered_quantity, new.quantity) > 0 then 'available' else 'delivered' end,
        matched_need_id = case when quantity - coalesce(new.delivered_quantity, new.quantity) > 0 then null else new.need_id end
    where id = new.offer_id and status = 'matched' and matched_need_id = new.need_id;
  end if;
  return new;
end;
$$;

create or replace function public.log_resource_claim_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.resource_claim_status_history(claim_id, from_status, to_status, delivered_quantity, note, actor_id)
    values (new.id, null, new.status, new.delivered_quantity, new.coordination_note, coalesce(new.processed_by, auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.resource_claim_status_history(claim_id, from_status, to_status, delivered_quantity, note, actor_id)
    values (new.id, old.status, new.status, new.delivered_quantity, new.coordination_note, auth.uid());
  end if;
  return new;
end;
$$;

create trigger resource_claims_status_history_insert
after insert on public.resource_claims
for each row execute function public.log_resource_claim_status();
create trigger resource_claims_status_history_update
after update of status on public.resource_claims
for each row execute function public.log_resource_claim_status();

create or replace function public.sync_resource_need_from_claim()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  received_quantity numeric;
begin
  select coalesce(sum(coalesce(delivered_quantity, quantity)), 0) into received_quantity
  from public.resource_claims
  where need_id = new.need_id and status = 'delivered';

  update public.resource_needs
  set status = case
      when received_quantity >= quantity_needed then 'fulfilled'
      when status = 'fulfilled' then 'open'
      else status
    end
  where id = new.need_id and status <> 'closed';
  return new;
end;
$$;

create or replace function public.claim_resource_need(
  p_need_id uuid,
  p_quantity numeric,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text default null,
  p_offer_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  selected_need public.resource_needs%rowtype;
  selected_offer public.resource_offers%rowtype;
  active_quantity numeric;
  claim_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;
  if length(trim(coalesce(p_contact_name, ''))) < 2 or length(trim(coalesce(p_contact_email, ''))) < 3 then
    raise exception 'INVALID_CONTACT';
  end if;

  select * into selected_need from public.resource_needs where id = p_need_id for update;
  if not found or selected_need.status <> 'open' or selected_need.moderation_status <> 'approved'
    or not public.is_public_campaign(selected_need.campaign_id) then
    raise exception 'RESOURCE_NEED_NOT_AVAILABLE';
  end if;

  select coalesce(sum(case when status = 'delivered' then delivered_quantity else quantity end), 0)
  into active_quantity
  from public.resource_claims
  where need_id = p_need_id and status in ('reserved', 'confirmed', 'delivered');

  if active_quantity + p_quantity > selected_need.quantity_needed then
    raise exception 'RESOURCE_QUANTITY_EXCEEDED';
  end if;

  if p_offer_id is not null then
    select * into selected_offer from public.resource_offers where id = p_offer_id for update;
    if not found or selected_offer.user_id <> auth.uid() or selected_offer.status <> 'available'
      or selected_offer.resource_type <> selected_need.resource_type or selected_offer.quantity < p_quantity then
      raise exception 'RESOURCE_OFFER_NOT_AVAILABLE';
    end if;
  end if;

  insert into public.resource_claims (
    need_id, offer_id, contributor_id, quantity, contact_name, contact_email, contact_phone, status, expires_at
  ) values (
    p_need_id, p_offer_id, auth.uid(), p_quantity, trim(p_contact_name), lower(trim(p_contact_email)),
    nullif(trim(coalesce(p_contact_phone, '')), ''), 'reserved', null
  ) returning id into claim_id;

  return claim_id;
end;
$$;

create or replace function public.match_resource_offer(p_offer_id uuid, p_need_id uuid, p_quantity numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  selected_need public.resource_needs%rowtype;
  selected_offer public.resource_offers%rowtype;
  active_quantity numeric;
  claim_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'RESOURCE_MATCH_ADMIN_ONLY'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;

  select * into selected_need from public.resource_needs where id = p_need_id for update;
  if not found or selected_need.status <> 'open' or selected_need.moderation_status <> 'approved' then
    raise exception 'RESOURCE_NEED_NOT_AVAILABLE';
  end if;

  select * into selected_offer from public.resource_offers where id = p_offer_id for update;
  if not found or selected_offer.status <> 'available' or selected_offer.resource_type <> selected_need.resource_type
    or selected_offer.quantity < p_quantity then
    raise exception 'RESOURCE_OFFER_NOT_AVAILABLE';
  end if;

  select coalesce(sum(case when status = 'delivered' then delivered_quantity else quantity end), 0)
  into active_quantity
  from public.resource_claims
  where need_id = p_need_id and status in ('reserved', 'confirmed', 'delivered');
  if active_quantity + p_quantity > selected_need.quantity_needed then raise exception 'RESOURCE_QUANTITY_EXCEEDED'; end if;

  insert into public.resource_claims (
    need_id, offer_id, contributor_id, quantity, contact_name, contact_email, contact_phone,
    status, confirmed_at, processed_by, coordination_note
  ) values (
    p_need_id, p_offer_id, selected_offer.user_id, p_quantity, selected_offer.contact_name,
    selected_offer.contact_email, selected_offer.contact_phone, 'confirmed', now(), auth.uid(),
    'Admin đã xác minh ghép nguồn lực với nhu cầu.'
  ) returning id into claim_id;
  return claim_id;
end;
$$;

drop function if exists public.get_public_resource_needs();
create function public.get_public_resource_needs()
returns table (
  id uuid, campaign_id uuid, resource_type text, name text, description text, category text,
  quantity_needed numeric, unit text, province text, urgency text, status text, created_at timestamptz,
  campaign_title text, campaign_slug text, campaign_province text, claimed_quantity numeric, committed_quantity numeric
) language sql stable security definer set search_path = '' as $$
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
    and public.is_public_campaign(need.campaign_id)
  order by case need.urgency when 'urgent' then 0 else 1 end, need.created_at desc;
$$;

revoke all on function public.claim_resource_need(uuid, numeric, text, text, text, uuid) from public;
revoke all on function public.match_resource_offer(uuid, uuid, numeric) from public;
revoke all on function public.get_public_resource_needs() from public;
grant execute on function public.claim_resource_need(uuid, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.match_resource_offer(uuid, uuid, numeric) to authenticated;
grant execute on function public.get_public_resource_needs() to anon, authenticated;

comment on column public.resource_needs.moderation_status is 'Admin review state; only approved needs are exposed to public.';
comment on column public.resource_claims.delivered_quantity is 'Quantity physically received and verified by Admin; drives public progress.';
