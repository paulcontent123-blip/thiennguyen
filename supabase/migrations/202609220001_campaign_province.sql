-- Bổ sung province cho campaigns để hỗ trợ lọc theo tỉnh/thành ở trang Khám phá (UC-DISC-03).
-- Dùng text tự do (không enum) — theo đúng tiền lệ cột `province` đã có ở rescue_applications/rescue_teams,
-- và danh sách 63 tỉnh/thành được validate ở tầng ứng dụng (src/lib/geo/provinces.ts), không ràng buộc DB.

alter table public.campaigns
  add column province text;

comment on column public.campaigns.province is
'Tỉnh/thành nơi chiến dịch triển khai. Danh sách hợp lệ kiểm soát ở src/lib/geo/provinces.ts, không ràng buộc enum để tránh phải migrate khi có thay đổi địa giới hành chính.';
