-- A donor's saved campaigns are private. Only aggregate counts are public.
create table public.campaign_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, campaign_id)
);

create index campaign_follows_campaign_id_idx on public.campaign_follows (campaign_id);

alter table public.campaign_follows enable row level security;

revoke all on public.campaign_follows from public, anon, authenticated;
grant select, insert, delete on public.campaign_follows to authenticated;

create policy "campaign_follows_read_own" on public.campaign_follows
for select to authenticated
using (user_id = auth.uid());

create policy "campaign_follows_insert_donor" on public.campaign_follows
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.role = 'donor'
  )
  and public.is_public_campaign(campaign_id)
);

create policy "campaign_follows_delete_own" on public.campaign_follows
for delete to authenticated
using (user_id = auth.uid());

create function public.get_public_campaign_follow_counts(p_campaign_ids uuid[])
returns table (campaign_id uuid, follower_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_campaign_ids), 0) > 100 then
    raise exception 'Too many campaigns requested';
  end if;

  return query
  select requested.id, count(followers.user_id)::bigint
  from (select distinct unnest(p_campaign_ids) as id) requested
  left join public.campaign_follows followers on followers.campaign_id = requested.id
  where public.is_public_campaign(requested.id)
  group by requested.id;
end;
$$;

revoke all on function public.get_public_campaign_follow_counts(uuid[]) from public;
grant execute on function public.get_public_campaign_follow_counts(uuid[]) to anon, authenticated;
