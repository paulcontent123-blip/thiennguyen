-- Cho phép Admin cập nhật role profile khi kích hoạt rescue_team.
-- Người dùng thường vẫn không có quyền tự cập nhật role.

create policy "profiles_admin_update" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());
