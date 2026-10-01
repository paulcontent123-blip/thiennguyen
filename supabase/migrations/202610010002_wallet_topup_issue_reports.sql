-- Simple user-to-admin contact channel for problems with manual wallet transfers.
create table public.wallet_topup_issue_reports (
  id uuid primary key default gen_random_uuid(),
  topup_id uuid not null references public.wallet_topups(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  contact_phone text not null check (length(trim(contact_phone)) between 8 and 30),
  description text not null check (length(trim(description)) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  admin_note text,
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'open' and handled_at is null) or (status = 'resolved' and handled_at is not null))
);

create index wallet_topup_issue_reports_status_created_idx
  on public.wallet_topup_issue_reports(status, created_at desc);
create index wallet_topup_issue_reports_topup_idx
  on public.wallet_topup_issue_reports(topup_id, created_at desc);

alter table public.wallet_topup_issue_reports enable row level security;

create policy "wallet_topup_issue_reports_owner_read"
  on public.wallet_topup_issue_reports for select to authenticated
  using (user_id = auth.uid());
create policy "wallet_topup_issue_reports_admin_read"
  on public.wallet_topup_issue_reports for select to authenticated
  using (public.is_admin());
create policy "wallet_topup_issue_reports_admin_update"
  on public.wallet_topup_issue_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger wallet_topup_issue_reports_set_updated_at
  before update on public.wallet_topup_issue_reports
  for each row execute function public.set_updated_at();

create or replace function public.submit_wallet_topup_issue(
  p_topup_id uuid,
  p_contact_phone text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_report_id uuid;
  clean_phone text := trim(coalesce(p_contact_phone, ''));
  clean_description text := trim(coalesce(p_description, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if length(clean_phone) < 8 or length(clean_phone) > 30 then
    raise exception 'WALLET_TOPUP_ISSUE_PHONE_INVALID';
  end if;
  if length(clean_description) < 5 or length(clean_description) > 1000 then
    raise exception 'WALLET_TOPUP_ISSUE_DESCRIPTION_INVALID';
  end if;
  if not exists (
    select 1 from public.wallet_topups t
    where t.id = p_topup_id
      and t.user_id = auth.uid()
      and t.payment_provider = 'bank_transfer'
  ) then
    raise exception 'WALLET_TOPUP_ISSUE_TOPUP_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.wallet_topup_issue_reports r
    where r.topup_id = p_topup_id and r.status = 'open'
  ) then
    raise exception 'WALLET_TOPUP_ISSUE_ALREADY_OPEN';
  end if;

  insert into public.wallet_topup_issue_reports(topup_id, user_id, contact_phone, description)
  values (p_topup_id, auth.uid(), clean_phone, clean_description)
  returning id into new_report_id;
  return new_report_id;
end;
$$;

revoke all on function public.submit_wallet_topup_issue(uuid, text, text) from public;
grant execute on function public.submit_wallet_topup_issue(uuid, text, text) to authenticated;

comment on table public.wallet_topup_issue_reports is
'Simple support inbox for user-reported manual wallet transfer problems. Admin contacts the user outside the automated top-up flow.';
