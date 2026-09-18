-- Bổ sung 3 trường mà form "Tạo chiến dịch" (theo demo thiennguyen_v2_1.html) cần nhưng
-- schema ban đầu chưa có: loại hình chiến dịch, hạng mục, thời hạn.

create type public.campaign_type as enum ('direct', 'partner');

alter table public.campaigns
  add column campaign_type public.campaign_type not null default 'direct',
  add column category text,
  add column deadline date;

comment on column public.campaigns.campaign_type is
'direct = Trực tiếp (quỹ tự triển khai, tách 90/10 theo NĐ 93/2021); partner = Kết nối (chuyển thẳng đối tác thụ hưởng).';
comment on column public.campaigns.category is
'Hạng mục hiển thị, danh sách hợp lệ được kiểm soát ở tầng ứng dụng (src/lib/campaigns/categories.ts), không ràng buộc enum để dễ mở rộng.';
