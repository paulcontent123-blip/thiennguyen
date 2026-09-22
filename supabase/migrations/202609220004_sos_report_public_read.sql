-- Cho phép đọc công khai các báo cáo SOS CHƯA xử lý (urgent/needs_support), đúng tinh thần
-- "bản đồ SOS công khai" của demo gốc — cộng đồng cần thấy vị trí đang cần giúp.
-- Lưu ý: số điện thoại liên hệ (contact_phone) KHÔNG được select ở trang công khai
-- (kiểm soát ở tầng ứng dụng, src/app/sos/page.tsx) — Postgres RLS không che được từng cột,
-- chỉ từng dòng, nên việc không lộ SĐT phụ thuộc vào câu SELECT ở ứng dụng, không phải RLS.

create policy "sos_reports_public_read_active" on public.sos_reports
for select using (status in ('urgent', 'needs_support'));
