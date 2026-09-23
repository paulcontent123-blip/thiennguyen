-- Cho phép công khai đọc đội cứu trợ đã kích hoạt (status khác 'inactive') để hiển thị
-- sidebar "Đội cứu trợ sẵn sàng" trên trang /sos công khai. Không lộ user_id/toạ độ chính xác
-- vì query phía app chỉ select các cột an toàn (name, resource_types, province, radius_km, status).

create policy "rescue_teams_public_active_read" on public.rescue_teams
for select to anon, authenticated
using (status <> 'inactive');
