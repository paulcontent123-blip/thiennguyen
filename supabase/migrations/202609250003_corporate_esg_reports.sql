-- Corporate ESG reporting scope. Admin links one inquiry/company to one or more
-- campaigns; annual reports are calculated from verified platform data.

create table if not exists public.corporate_esg_campaigns (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.corporate_inquiries(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  committed_amount_vnd numeric(18, 2)
    check (committed_amount_vnd is null or committed_amount_vnd >= 0),
  partnership_note text check (partnership_note is null or length(partnership_note) <= 1000),
  linked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inquiry_id, campaign_id)
);

create index if not exists corporate_esg_campaigns_inquiry_idx
  on public.corporate_esg_campaigns (inquiry_id, created_at desc);
create index if not exists corporate_esg_campaigns_campaign_idx
  on public.corporate_esg_campaigns (campaign_id);

drop trigger if exists corporate_esg_campaigns_set_updated_at on public.corporate_esg_campaigns;
create trigger corporate_esg_campaigns_set_updated_at
before update on public.corporate_esg_campaigns
for each row execute function public.set_updated_at();

alter table public.corporate_esg_campaigns enable row level security;

drop policy if exists "corporate_esg_campaigns_admin_all" on public.corporate_esg_campaigns;
create policy "corporate_esg_campaigns_admin_all"
on public.corporate_esg_campaigns
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.corporate_esg_campaigns to authenticated;

-- Preserve the campaign selected by a company in the public inquiry form as
-- the first reporting link. The trigger does not expose report data publicly.
create or replace function public.sync_corporate_inquiry_esg_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.campaign_id is not null then
    insert into public.corporate_esg_campaigns (inquiry_id, campaign_id, partnership_note)
    values (new.id, new.campaign_id, 'Chiến dịch được doanh nghiệp chọn khi gửi yêu cầu')
    on conflict (inquiry_id, campaign_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists corporate_inquiry_sync_esg_campaign on public.corporate_inquiries;
create trigger corporate_inquiry_sync_esg_campaign
after insert on public.corporate_inquiries
for each row execute function public.sync_corporate_inquiry_esg_campaign();

insert into public.corporate_esg_campaigns (inquiry_id, campaign_id, partnership_note)
select inquiry.id, inquiry.campaign_id, 'Chiến dịch được doanh nghiệp chọn khi gửi yêu cầu'
from public.corporate_inquiries inquiry
where inquiry.campaign_id is not null
on conflict (inquiry_id, campaign_id) do nothing;

comment on table public.corporate_esg_campaigns is
'Admin-managed reporting scope linking a corporate inquiry to campaigns included in its automatically calculated ESG impact report.';
