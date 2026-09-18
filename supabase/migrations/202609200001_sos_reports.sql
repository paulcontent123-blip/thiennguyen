-- Bảng sos_reports cho panel "SOS Reports" của Admin Portal (theo demo thiennguyen_v2_1.html).
-- Trang báo SOS công khai (/sos) chưa được xây ở đợt này, nên bảng này sẽ chưa có dữ liệu thật
-- cho tới khi luồng báo cáo công khai được triển khai — Admin Portal chỉ cần sẵn sàng đọc/ghi.

create type public.sos_report_status as enum ('urgent', 'needs_support', 'handled');

create table public.sos_reports (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid references public.profiles(id) on delete set null,
  location_text text not null,
  latitude double precision,
  longitude double precision,
  needs text[] not null default '{}',
  contact_phone text,
  status public.sos_report_status not null default 'needs_support',
  handled_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sos_reports_set_updated_at before update on public.sos_reports
for each row execute function public.set_updated_at();

create or replace function public.guard_sos_report_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and (
    new.status is distinct from old.status
    or new.handled_at is distinct from old.handled_at
    or new.handled_by is distinct from old.handled_by
  ) then
    raise exception 'Only Admin may update SOS report status fields';
  end if;
  return new;
end;
$$;

create trigger sos_reports_guard_fields
before update on public.sos_reports
for each row execute function public.guard_sos_report_fields();

alter table public.sos_reports enable row level security;

create policy "sos_reports_reporter_or_admin_read" on public.sos_reports
for select using (reported_by = auth.uid() or public.is_admin());

create policy "sos_reports_authenticated_insert" on public.sos_reports
for insert to authenticated with check (
  reported_by = auth.uid()
  and status = 'needs_support'
  and handled_at is null
  and handled_by is null
);

create policy "sos_reports_admin_update" on public.sos_reports
for update using (public.is_admin()) with check (public.is_admin());
