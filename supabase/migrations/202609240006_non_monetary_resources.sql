-- Non-monetary resource ledger: campaign needs, contributor offers and atomic claims.
-- Estimated value is kept separate from financial transactions/campaign cashflow.

create table public.resource_needs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  resource_type text not null check (resource_type in ('item', 'skill', 'transport')),
  name text not null check (length(trim(name)) between 2 and 180),
  description text not null default '' check (length(description) <= 2000),
  category text,
  quantity_needed numeric(14, 2) not null check (quantity_needed > 0),
  unit text not null check (length(trim(unit)) between 1 and 40),
  province text,
  urgency text not null default 'normal' check (urgency in ('normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'fulfilled', 'closed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resource_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null check (resource_type in ('item', 'skill', 'transport')),
  title text not null check (length(trim(title)) between 2 and 180),
  description text not null default '' check (length(description) <= 2000),
  quantity numeric(14, 2) not null check (quantity > 0),
  unit text not null check (length(trim(unit)) between 1 and 40),
  estimated_value_vnd numeric(18, 2) check (estimated_value_vnd is null or estimated_value_vnd >= 0),
  province text,
  available_from date,
  radius_km integer check (radius_km is null or radius_km between 1 and 2000),
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  contact_email text not null check (length(trim(contact_email)) between 3 and 254),
  contact_phone text check (contact_phone is null or length(trim(contact_phone)) between 8 and 30),
  preferred_campaign_id uuid references public.campaigns(id) on delete set null,
  matched_need_id uuid references public.resource_needs(id) on delete set null,
  status text not null default 'available' check (status in ('available', 'matched', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resource_claims (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.resource_needs(id) on delete restrict,
  offer_id uuid unique references public.resource_offers(id) on delete set null,
  contributor_id uuid not null references public.profiles(id) on delete restrict,
  quantity numeric(14, 2) not null check (quantity > 0),
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  contact_email text not null check (length(trim(contact_email)) between 3 and 254),
  contact_phone text check (contact_phone is null or length(trim(contact_phone)) between 8 and 30),
  status text not null default 'reserved' check (status in ('reserved', 'confirmed', 'delivered', 'cancelled', 'expired', 'failed')),
  expires_at timestamptz,
  coordination_note text check (coordination_note is null or length(coordination_note) <= 1000),
  actual_value_vnd numeric(18, 2) check (actual_value_vnd is null or actual_value_vnd >= 0),
  confirmed_at timestamptz,
  delivered_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resource_needs_public_idx on public.resource_needs (status, resource_type, province, created_at desc);
create index resource_needs_campaign_idx on public.resource_needs (campaign_id, created_at desc);
create index resource_offers_public_idx on public.resource_offers (status, resource_type, province, created_at desc);
create index resource_offers_user_idx on public.resource_offers (user_id, created_at desc);
create index resource_claims_need_idx on public.resource_claims (need_id, status, expires_at);
create index resource_claims_contributor_idx on public.resource_claims (contributor_id, created_at desc);

create trigger resource_needs_set_updated_at before update on public.resource_needs
for each row execute function public.set_updated_at();
create trigger resource_offers_set_updated_at before update on public.resource_offers
for each row execute function public.set_updated_at();
create trigger resource_claims_set_updated_at before update on public.resource_claims
for each row execute function public.set_updated_at();

alter table public.resource_needs enable row level security;
alter table public.resource_offers enable row level security;
alter table public.resource_claims enable row level security;

create policy "resource_needs_public_read" on public.resource_needs
for select using (
  (status in ('open', 'fulfilled') and public.is_public_campaign(campaign_id))
  or public.is_campaign_owner(campaign_id)
  or public.is_admin()
);

create policy "resource_needs_owner_insert" on public.resource_needs
for insert to authenticated
with check (
  created_by = auth.uid()
  and (public.is_campaign_owner(campaign_id) or public.is_admin())
  and exists (select 1 from public.campaigns where id = campaign_id and status in ('approved', 'active'))
);

create policy "resource_needs_owner_update" on public.resource_needs
for update to authenticated
using (public.is_campaign_owner(campaign_id) or public.is_admin())
with check (public.is_campaign_owner(campaign_id) or public.is_admin());

create policy "resource_needs_owner_delete" on public.resource_needs
for delete to authenticated
using (public.is_campaign_owner(campaign_id) or public.is_admin());

-- Offer contact details are private. Public cards are exposed only through get_public_resource_offers().
create policy "resource_offers_private_read" on public.resource_offers
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or (matched_need_id is not null and public.is_campaign_owner((select campaign_id from public.resource_needs where id = matched_need_id)))
);

create policy "resource_offers_owner_insert" on public.resource_offers
for insert to authenticated with check (user_id = auth.uid());

create policy "resource_offers_owner_update" on public.resource_offers
for update to authenticated using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "resource_claims_private_read" on public.resource_claims
for select to authenticated
using (
  contributor_id = auth.uid()
  or public.is_admin()
  or public.is_campaign_owner((select campaign_id from public.resource_needs where id = need_id))
);

create policy "resource_claims_coordinator_update" on public.resource_claims
for update to authenticated
using (
  contributor_id = auth.uid()
  or public.is_admin()
  or public.is_campaign_owner((select campaign_id from public.resource_needs where id = need_id))
)
with check (
  contributor_id = auth.uid()
  or public.is_admin()
  or public.is_campaign_owner((select campaign_id from public.resource_needs where id = need_id))
);

create or replace function public.guard_resource_need_update()
returns trigger language plpgsql as $$
declare
  active_quantity numeric;
  delivered_quantity numeric;
begin
  if new.campaign_id is distinct from old.campaign_id or new.created_by is distinct from old.created_by then
    raise exception 'RESOURCE_NEED_IMMUTABLE_OWNER';
  end if;

  select coalesce(sum(quantity), 0) into active_quantity
  from public.resource_claims
  where need_id = old.id
    and (status in ('confirmed', 'delivered') or (status = 'reserved' and expires_at > now()));
  if new.quantity_needed < active_quantity then
    raise exception 'RESOURCE_NEED_BELOW_ACTIVE_CLAIMS';
  end if;

  if new.status = 'fulfilled' and old.status <> 'fulfilled' then
    select coalesce(sum(quantity), 0) into delivered_quantity
    from public.resource_claims where need_id = old.id and status = 'delivered';
    if delivered_quantity < new.quantity_needed then raise exception 'RESOURCE_NEED_NOT_FULFILLED'; end if;
  end if;
  return new;
end;
$$;

create trigger resource_needs_guard_update before update on public.resource_needs
for each row execute function public.guard_resource_need_update();

create or replace function public.guard_resource_offer_update()
returns trigger language plpgsql as $$
declare
  synchronized_claim boolean;
begin
  if new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at then
    raise exception 'RESOURCE_OFFER_IMMUTABLE_OWNER';
  end if;

  select exists (
    select 1
    from public.resource_claims claim
    where claim.offer_id = old.id
      and (
        (claim.status in ('reserved', 'confirmed') and new.status = 'matched' and new.matched_need_id = claim.need_id)
        or (claim.status = 'delivered' and new.status = 'delivered' and new.matched_need_id = claim.need_id)
        or (claim.status in ('cancelled', 'expired', 'failed') and new.status = 'available' and new.matched_need_id is null)
      )
  ) into synchronized_claim;

  if synchronized_claim then return new; end if;

  if not public.is_admin() and auth.uid() = old.user_id then
    if old.status <> 'available' or new.status not in ('available', 'cancelled') or new.matched_need_id is distinct from old.matched_need_id then
      raise exception 'RESOURCE_OFFER_ALREADY_MATCHED';
    end if;
  end if;
  return new;
end;
$$;

create trigger resource_offers_guard_update before update on public.resource_offers
for each row execute function public.guard_resource_offer_update();

create or replace function public.guard_resource_claim_update()
returns trigger language plpgsql as $$
declare
  coordinator boolean;
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

  if old.status = 'reserved' and old.expires_at <= now() and new.status = 'expired' then
    return new;
  end if;

  coordinator := public.is_admin() or public.is_campaign_owner((select campaign_id from public.resource_needs where id = old.need_id));
  if auth.uid() = old.contributor_id and not coordinator then
    if new.status <> 'cancelled' or old.status not in ('reserved', 'confirmed') then
      raise exception 'CONTRIBUTOR_CAN_ONLY_CANCEL_ACTIVE_CLAIM';
    end if;
    new.coordination_note := old.coordination_note;
    new.actual_value_vnd := old.actual_value_vnd;
    new.confirmed_at := old.confirmed_at;
    new.delivered_at := old.delivered_at;
    new.processed_by := old.processed_by;
  elsif coordinator then
    if (old.status = 'reserved' and new.status not in ('reserved', 'confirmed', 'cancelled', 'failed'))
      or (old.status = 'confirmed' and new.status not in ('confirmed', 'delivered', 'cancelled', 'failed'))
      or (old.status in ('delivered', 'cancelled', 'expired', 'failed') and new.status <> old.status) then
      raise exception 'INVALID_RESOURCE_CLAIM_TRANSITION';
    end if;
  else
    raise exception 'RESOURCE_CLAIM_FORBIDDEN';
  end if;
  return new;
end;
$$;

create trigger resource_claims_guard_update before update on public.resource_claims
for each row execute function public.guard_resource_claim_update();

create or replace function public.sync_resource_offer_from_claim()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.offer_id is null then return new; end if;
  update public.resource_offers
  set status = case
      when new.status = 'delivered' then 'delivered'
      when new.status in ('cancelled', 'expired', 'failed') then 'available'
      else 'matched'
    end,
    matched_need_id = case when new.status in ('cancelled', 'expired', 'failed') then null else new.need_id end
  where id = new.offer_id;
  return new;
end;
$$;

create trigger resource_claims_sync_offer after insert or update of status on public.resource_claims
for each row execute function public.sync_resource_offer_from_claim();

create or replace function public.sync_resource_need_from_claim()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  delivered_quantity numeric;
begin
  select coalesce(sum(quantity), 0) into delivered_quantity
  from public.resource_claims
  where need_id = new.need_id and status = 'delivered';

  update public.resource_needs
  set status = case
      when delivered_quantity >= quantity_needed then 'fulfilled'
      when status = 'fulfilled' then 'open'
      else status
    end
  where id = new.need_id and status <> 'closed';
  return new;
end;
$$;

create trigger resource_claims_sync_need after insert or update of status on public.resource_claims
for each row execute function public.sync_resource_need_from_claim();

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
  if not found or selected_need.status <> 'open' or not public.is_public_campaign(selected_need.campaign_id) then
    raise exception 'RESOURCE_NEED_NOT_AVAILABLE';
  end if;

  update public.resource_claims
  set status = 'expired'
  where need_id = p_need_id and status = 'reserved' and expires_at <= now();

  select coalesce(sum(quantity), 0) into active_quantity
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
    p_need_id, p_offer_id, auth.uid(), p_quantity, trim(p_contact_name), lower(trim(p_contact_email)), nullif(trim(coalesce(p_contact_phone, '')), ''), 'reserved', now() + interval '48 hours'
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
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_QUANTITY'; end if;

  select * into selected_need from public.resource_needs where id = p_need_id for update;
  if not found or selected_need.status <> 'open' or not (public.is_admin() or public.is_campaign_owner(selected_need.campaign_id)) then
    raise exception 'RESOURCE_MATCH_FORBIDDEN';
  end if;

  select * into selected_offer from public.resource_offers where id = p_offer_id for update;
  if not found or selected_offer.status <> 'available' or selected_offer.resource_type <> selected_need.resource_type
    or selected_offer.quantity < p_quantity then
    raise exception 'RESOURCE_OFFER_NOT_AVAILABLE';
  end if;

  update public.resource_claims set status = 'expired'
  where need_id = p_need_id and status = 'reserved' and expires_at <= now();
  select coalesce(sum(quantity), 0) into active_quantity from public.resource_claims
  where need_id = p_need_id and status in ('reserved', 'confirmed', 'delivered');
  if active_quantity + p_quantity > selected_need.quantity_needed then raise exception 'RESOURCE_QUANTITY_EXCEEDED'; end if;

  insert into public.resource_claims (
    need_id, offer_id, contributor_id, quantity, contact_name, contact_email, contact_phone, status, confirmed_at, processed_by
  ) values (
    p_need_id, p_offer_id, selected_offer.user_id, p_quantity, selected_offer.contact_name, selected_offer.contact_email,
    selected_offer.contact_phone, 'confirmed', now(), auth.uid()
  ) returning id into claim_id;
  return claim_id;
end;
$$;

create or replace function public.get_public_resource_offers()
returns table (
  id uuid, resource_type text, title text, description text, quantity numeric, unit text,
  estimated_value_vnd numeric, province text, available_from date, radius_km integer, created_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select offer.id, offer.resource_type, offer.title, offer.description, offer.quantity, offer.unit,
    offer.estimated_value_vnd, offer.province, offer.available_from, offer.radius_km, offer.created_at
  from public.resource_offers offer
  where offer.status = 'available'
  order by offer.created_at desc;
$$;

create or replace function public.get_public_resource_needs()
returns table (
  id uuid, campaign_id uuid, resource_type text, name text, description text, category text,
  quantity_needed numeric, unit text, province text, urgency text, status text, created_at timestamptz,
  campaign_title text, campaign_slug text, campaign_province text, claimed_quantity numeric
) language sql stable security definer set search_path = '' as $$
  select need.id, need.campaign_id, need.resource_type, need.name, need.description, need.category,
    need.quantity_needed, need.unit, need.province, need.urgency, need.status, need.created_at,
    campaign.title, campaign.slug, campaign.province,
    coalesce((
      select sum(claim.quantity)
      from public.resource_claims claim
      where claim.need_id = need.id
        and (
          claim.status in ('confirmed', 'delivered')
          or (claim.status = 'reserved' and claim.expires_at > now())
        )
    ), 0) as claimed_quantity
  from public.resource_needs need
  join public.campaigns campaign on campaign.id = need.campaign_id
  where need.status in ('open', 'fulfilled') and public.is_public_campaign(need.campaign_id)
  order by case need.urgency when 'urgent' then 0 else 1 end, need.created_at desc;
$$;

revoke all on function public.claim_resource_need(uuid, numeric, text, text, text, uuid) from public;
revoke all on function public.match_resource_offer(uuid, uuid, numeric) from public;
revoke all on function public.get_public_resource_offers() from public;
revoke all on function public.get_public_resource_needs() from public;
grant execute on function public.claim_resource_need(uuid, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.match_resource_offer(uuid, uuid, numeric) to authenticated;
grant execute on function public.get_public_resource_offers() to anon, authenticated;
grant execute on function public.get_public_resource_needs() to anon, authenticated;

comment on table public.resource_needs is 'Public campaign wishlist for items, skills and transport.';
comment on table public.resource_offers is 'Private-contact contributor offers; public exposure only through safe RPC.';
comment on table public.resource_claims is 'Reservation and delivery lifecycle separate from financial transactions.';
