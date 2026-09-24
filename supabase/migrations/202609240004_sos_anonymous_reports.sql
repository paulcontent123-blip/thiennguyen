-- Khách chưa đăng nhập được gửi báo cáo SOS, nhưng báo cáo luôn ở trạng thái 'pending_review'.
-- Chính sách đọc công khai (sos_reports_public_read_active) chỉ cho xem urgent/needs_support nên
-- báo cáo chờ xác nhận không lộ ra ngoài cho tới khi Admin duyệt.

create policy "sos_reports_anonymous_insert" on public.sos_reports
for insert to anon
with check (
  reported_by is null
  and status = 'pending_review'
  and handled_at is null
  and handled_by is null
  and contact_phone is not null
  and photo_url is not null
);

-- Chặn spam: tối đa 3 báo cáo chờ xác nhận / số điện thoại / giờ.
-- security definer vì anon không đọc được các dòng pending_review qua RLS.
create or replace function public.guard_anonymous_sos_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reported_by is null and new.status = 'pending_review' then
    if (
      select count(*)
      from public.sos_reports existing
      where existing.reported_by is null
        and existing.contact_phone = new.contact_phone
        and existing.created_at > now() - interval '1 hour'
    ) >= 3 then
      raise exception 'Too many anonymous SOS reports for this phone number';
    end if;
  end if;
  return new;
end;
$$;

create trigger sos_reports_guard_anonymous_insert
before insert on public.sos_reports
for each row execute function public.guard_anonymous_sos_insert();
