-- Yêu cầu tư vấn/đồng hành từ doanh nghiệp (trang /corporate). Người dùng chưa đăng nhập cũng gửi được;
-- chỉ Admin đọc và cập nhật trạng thái xử lý.

create table public.corporate_inquiries (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(trim(company_name)) between 2 and 200),
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  contact_email text not null check (length(trim(contact_email)) between 5 and 254),
  budget_range text not null check (budget_range in ('lt_500m', '500m_2b', '2b_10b', 'gt_10b')),
  focus_area text check (focus_area is null or length(focus_area) <= 300),
  interest text not null default 'other' check (interest in ('co_branded', 'matching_fund', 'in_kind', 'esg_hub', 'field_staff', 'other')),
  campaign_id uuid references public.campaigns(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index corporate_inquiries_status_created_idx on public.corporate_inquiries (status, created_at desc);

alter table public.corporate_inquiries enable row level security;

create policy "corporate_inquiries_public_insert" on public.corporate_inquiries
for insert to anon, authenticated
with check (status = 'new' and handled_by is null and handled_at is null);

create policy "corporate_inquiries_admin_all" on public.corporate_inquiries
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.guard_corporate_inquiry_update()
returns trigger
language plpgsql
as $$
begin
  if new.company_name is distinct from old.company_name
    or new.contact_name is distinct from old.contact_name
    or new.contact_email is distinct from old.contact_email
    or new.budget_range is distinct from old.budget_range
    or new.focus_area is distinct from old.focus_area
    or new.interest is distinct from old.interest
    or new.campaign_id is distinct from old.campaign_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Admin may only update status, handled_by and handled_at';
  end if;
  return new;
end;
$$;

create trigger corporate_inquiries_guard_update
before update on public.corporate_inquiries
for each row execute function public.guard_corporate_inquiry_update();
