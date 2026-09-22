-- Bổ sung mô tả tình trạng cho sos_reports — cần thiết để phân biệt với location_text
-- (vị trí) khi người báo SOS mô tả chi tiết tình huống (số người ảnh hưởng, mức độ khẩn cấp...).

alter table public.sos_reports
  add column description text;
