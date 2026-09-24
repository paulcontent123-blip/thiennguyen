-- Công khai thêm các báo cáo SOS ĐÃ XỬ LÝ trong 7 ngày gần nhất (chấm xanh trên bản đồ như demo),
-- không công khai vĩnh viễn ảnh và vị trí của các sự cố cũ.
-- Thời điểm tính: handled_at, nếu thiếu thì dùng created_at.

drop policy if exists "sos_reports_public_read_active" on public.sos_reports;

create policy "sos_reports_public_read_active" on public.sos_reports
for select using (
  status in ('urgent', 'needs_support')
  or (
    status = 'handled'
    and coalesce(handled_at, created_at) > now() - interval '7 days'
  )
);
