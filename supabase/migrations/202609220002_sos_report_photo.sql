-- Bổ sung ảnh hiện trường cho sos_reports — demo gốc bắt buộc ảnh làm bằng chứng
-- chống báo ảo, nhưng migration ban đầu (202609200001) đã bỏ sót cột này.

alter table public.sos_reports
  add column photo_url text,
  add column photo_public_id text;

comment on column public.sos_reports.photo_url is
'Ảnh hiện trường lưu trên Cloudinary — bằng chứng khi báo SOS, Admin xem thủ công khi xử lý.';
