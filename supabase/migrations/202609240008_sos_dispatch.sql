-- Dispatch only verified SOS reports with GPS to active responders inside their radius.
alter table public.rescue_teams
  add column member_kind text not null default 'team'
  check (member_kind in ('team', 'volunteer'));

update public.rescue_teams team
set member_kind = 'volunteer'
from public.rescue_applications application
where team.application_id = application.id
  and nullif(trim(application.team_name), '') is null;

create function public.guard_rescue_member_kind()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and new.member_kind is distinct from old.member_kind then
    raise exception 'Only Admin may classify a responder as a volunteer';
  end if;
  return new;
end;
$$;

create trigger rescue_teams_guard_member_kind
before update on public.rescue_teams
for each row execute function public.guard_rescue_member_kind();

alter table public.resource_offers
  add column latitude double precision,
  add column longitude double precision,
  add constraint resource_offers_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  );

alter table public.sos_reports
  add constraint sos_reports_coordinate_bounds_check check (
    (latitude is null or latitude between -90 and 90)
    and (longitude is null or longitude between -180 and 180)
  ) not valid;
alter table public.rescue_teams
  add constraint rescue_teams_coordinate_bounds_check check (
    (latitude is null or latitude between -90 and 90)
    and (longitude is null or longitude between -180 and 180)
  ) not valid;

create index rescue_teams_available_geo_idx on public.rescue_teams (status)
where latitude is not null and longitude is not null;
create index sos_reports_active_geo_idx on public.sos_reports (status, created_at desc)
where latitude is not null and longitude is not null;

create function public.sos_distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable strict
set search_path = ''
as $$
  select 6371.0 * acos(least(1.0, greatest(-1.0,
    sin(radians(lat1)) * sin(radians(lat2))
    + cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2 - lng1))
  )));
$$;

create table public.sos_team_alerts (
  id uuid primary key default gen_random_uuid(),
  sos_report_id uuid not null references public.sos_reports(id) on delete cascade,
  rescue_team_id uuid not null references public.rescue_teams(id) on delete cascade,
  distance_km double precision not null check (distance_km >= 0),
  source text not null check (source in ('radius', 'admin')),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sos_report_id, rescue_team_id)
);

create index sos_team_alerts_team_created_idx on public.sos_team_alerts (rescue_team_id, created_at desc);
create index sos_team_alerts_report_idx on public.sos_team_alerts (sos_report_id);

alter table public.sos_team_alerts enable row level security;
revoke all on public.sos_team_alerts from public, anon, authenticated;
grant select, insert on public.sos_team_alerts to authenticated;

create policy "sos_team_alerts_own_or_admin_read" on public.sos_team_alerts
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.rescue_teams team
    where team.id = rescue_team_id and team.user_id = auth.uid()
  )
);

create policy "sos_team_alerts_admin_insert" on public.sos_team_alerts
for insert to authenticated with check (public.is_admin());

-- RLS is row-based, not column-based: the old public policies exposed precise
-- rescue GPS and SOS contact numbers via direct PostgREST queries.
drop policy if exists "rescue_teams_public_active_read" on public.rescue_teams;
drop policy if exists "sos_reports_public_read_active" on public.sos_reports;

create policy "sos_reports_alerted_rescue_read" on public.sos_reports
for select to authenticated
using (
  exists (
    select 1 from public.sos_team_alerts alert
    join public.rescue_teams team on team.id = alert.rescue_team_id
    where alert.sos_report_id = sos_reports.id and team.user_id = auth.uid()
  )
);

create function public.get_public_rescue_teams()
returns table (
  id uuid, name text, resource_types text[], province text,
  radius_km integer, status public.rescue_team_status
)
language sql stable security definer
set search_path = ''
as $$
  select team.id, team.name, team.resource_types, team.province, team.radius_km, team.status
  from public.rescue_teams team
  where team.status <> 'inactive'
  order by team.updated_at desc limit 10;
$$;

create function public.get_public_sos_reports()
returns table (
  id uuid, location_text text, description text, needs text[], status public.sos_report_status,
  photo_url text, latitude double precision, longitude double precision, created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select report.id, report.location_text, report.description, report.needs, report.status,
    report.photo_url,
    round(report.latitude::numeric, 3)::double precision,
    round(report.longitude::numeric, 3)::double precision,
    report.created_at
  from public.sos_reports report
  where report.status in ('urgent', 'needs_support')
    or (report.status = 'handled' and coalesce(report.handled_at, report.created_at) > now() - interval '7 days')
  order by report.created_at desc
  limit 30;
$$;

revoke all on function public.get_public_rescue_teams() from public;
revoke all on function public.get_public_sos_reports() from public;
grant execute on function public.get_public_rescue_teams() to anon, authenticated;
grant execute on function public.get_public_sos_reports() to anon, authenticated;

create function public.acknowledge_sos_team_alert(p_alert_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare changed uuid;
begin
  update public.sos_team_alerts alert
  set acknowledged_at = coalesce(alert.acknowledged_at, now())
  where alert.id = p_alert_id
    and exists (
      select 1 from public.rescue_teams team
      where team.id = alert.rescue_team_id and team.user_id = auth.uid()
    )
  returning alert.id into changed;
  return changed is not null;
end;
$$;

revoke all on function public.acknowledge_sos_team_alert(uuid) from public;
grant execute on function public.acknowledge_sos_team_alert(uuid) to authenticated;

create function public.dispatch_sos_to_nearby_teams()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status not in ('urgent', 'needs_support')
    or new.latitude is null or new.longitude is null then
    return new;
  end if;

  insert into public.sos_team_alerts (sos_report_id, rescue_team_id, distance_km, source)
  select new.id, nearby.id, nearby.distance_km, 'radius'
  from (
    select team.id, public.sos_distance_km(new.latitude, new.longitude, team.latitude, team.longitude) as distance_km,
           team.radius_km
    from public.rescue_teams team
    where team.status = 'available' and team.member_kind = 'team'
      and team.latitude is not null and team.longitude is not null
      and team.radius_km is not null
  ) nearby
  where nearby.distance_km <= nearby.radius_km
  on conflict (sos_report_id, rescue_team_id) do nothing;
  return new;
end;
$$;

create trigger sos_reports_dispatch_nearby_teams
after insert or update of status, latitude, longitude on public.sos_reports
for each row execute function public.dispatch_sos_to_nearby_teams();

create function public.dispatch_existing_sos_to_updated_team()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status <> 'available' or new.member_kind <> 'team'
    or new.latitude is null or new.longitude is null or new.radius_km is null then
    return new;
  end if;

  insert into public.sos_team_alerts (sos_report_id, rescue_team_id, distance_km, source)
  select candidate.id, new.id, candidate.distance_km, 'radius'
  from (
    select report.id, public.sos_distance_km(report.latitude, report.longitude, new.latitude, new.longitude) as distance_km
    from public.sos_reports report
    where report.status in ('urgent', 'needs_support')
      and report.latitude is not null and report.longitude is not null
      and report.created_at > now() - interval '7 days'
  ) candidate
  where candidate.distance_km <= new.radius_km
  on conflict (sos_report_id, rescue_team_id) do nothing;
  return new;
end;
$$;

create trigger rescue_teams_dispatch_existing_sos
after insert or update of status, latitude, longitude, radius_km on public.rescue_teams
for each row execute function public.dispatch_existing_sos_to_updated_team();

-- Supabase Realtime INSERT events; the dashboard also polls as a reconnect fallback.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sos_team_alerts'
    ) then
    alter publication supabase_realtime add table public.sos_team_alerts;
  end if;
end;
$$;

create table public.sos_transport_dispatches (
  id uuid primary key default gen_random_uuid(),
  sos_report_id uuid not null references public.sos_reports(id) on delete cascade,
  offer_id uuid not null references public.resource_offers(id) on delete restrict,
  coordinated_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'contacted' check (status in ('contacted', 'accepted', 'declined', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sos_report_id, offer_id)
);

create trigger sos_transport_dispatches_set_updated_at before update on public.sos_transport_dispatches
for each row execute function public.set_updated_at();

alter table public.sos_transport_dispatches enable row level security;
revoke all on public.sos_transport_dispatches from public, anon, authenticated;
grant select, update on public.sos_transport_dispatches to authenticated;

create policy "sos_transport_dispatches_admin_read" on public.sos_transport_dispatches
for select to authenticated using (public.is_admin());
create policy "sos_transport_dispatches_admin_update" on public.sos_transport_dispatches
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create function public.get_nearby_sos_transport_offers(p_sos_report_id uuid)
returns table (
  offer_id uuid, title text, province text, distance_km double precision,
  contact_name text, contact_email text, contact_phone text, radius_km integer
)
language plpgsql stable security definer
set search_path = ''
as $$
declare report record;
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  select latitude, longitude, status into report from public.sos_reports where id = p_sos_report_id;
  if not found then return; end if;
  if report.status not in ('urgent', 'needs_support')
    or report.latitude is null or report.longitude is null then return; end if;

  return query
  select offer.id, offer.title, offer.province,
         public.sos_distance_km(report.latitude, report.longitude, offer.latitude, offer.longitude),
         offer.contact_name, offer.contact_email, offer.contact_phone, offer.radius_km
  from public.resource_offers offer
  where offer.resource_type = 'transport' and offer.status = 'available'
    and offer.latitude is not null and offer.longitude is not null and offer.radius_km is not null
    and (offer.available_from is null or offer.available_from <= current_date)
    and public.sos_distance_km(report.latitude, report.longitude, offer.latitude, offer.longitude) <= offer.radius_km
  order by 4 asc
  limit 20;
end;
$$;

revoke all on function public.get_nearby_sos_transport_offers(uuid) from public;
grant execute on function public.get_nearby_sos_transport_offers(uuid) to authenticated;

create function public.coordinate_sos_transport(p_sos_report_id uuid, p_offer_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare selected_offer record;
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
  select * into selected_offer
  from public.get_nearby_sos_transport_offers(p_sos_report_id) candidate
  where candidate.offer_id = p_offer_id;
  if not found then return false; end if;

  insert into public.sos_transport_dispatches (sos_report_id, offer_id, coordinated_by)
  values (p_sos_report_id, p_offer_id, auth.uid())
  on conflict (sos_report_id, offer_id) do nothing;
  return true;
end;
$$;

revoke all on function public.coordinate_sos_transport(uuid, uuid) from public;
grant execute on function public.coordinate_sos_transport(uuid, uuid) to authenticated;
