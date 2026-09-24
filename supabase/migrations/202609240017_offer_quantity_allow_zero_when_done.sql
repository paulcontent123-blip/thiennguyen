-- Sửa: "violates check constraint resource_offers_quantity_check" khi Admin xác nhận bàn giao.
-- Khi lượt bàn giao dùng hết số lượng còn lại, hàm sync_resource_offer_from_claim đặt quantity = 0 và status = 'delivered',
-- nhưng ràng buộc cũ bắt buộc quantity > 0 với mọi trạng thái.
-- Ràng buộc mới: số lượng không âm; chỉ nguồn lực đã bàn giao hết hoặc đã hủy mới được bằng 0.
-- Việc đăng ký nguồn lực mới vẫn yêu cầu số lượng > 0 (kiểm tra ở tầng ứng dụng và ràng buộc này với trạng thái available/matched).

alter table public.resource_offers drop constraint resource_offers_quantity_check;
alter table public.resource_offers
  add constraint resource_offers_quantity_check
  check (quantity >= 0 and (quantity > 0 or status in ('delivered', 'cancelled')));
