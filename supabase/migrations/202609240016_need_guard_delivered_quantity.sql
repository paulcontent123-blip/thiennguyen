-- Sửa RESOURCE_NEED_BELOW_ACTIVE_CLAIMS xuất hiện khi Admin xác minh bàn giao.
-- Trigger cũ (migration 006) cộng số lượng ĐĂNG KÝ của các lượt đã ghép/bàn giao, nên khi một lượt bàn giao
-- thiếu (đăng ký 1,5 nhưng thực nhận 1) tổng có thể vượt số lượng cần và chặn mọi cập nhật nhu cầu.
-- Cách tính mới khớp migration 012: lượt đã bàn giao tính theo số lượng THỰC NHẬN, lượt khác tính theo số đăng ký.

create or replace function public.guard_resource_need_update()
returns trigger language plpgsql as $$
declare
  active_quantity numeric;
  delivered_total numeric;
begin
  if new.campaign_id is distinct from old.campaign_id or new.created_by is distinct from old.created_by then
    raise exception 'RESOURCE_NEED_IMMUTABLE_OWNER';
  end if;

  select coalesce(sum(case when status = 'delivered' then coalesce(delivered_quantity, quantity) else quantity end), 0)
  into active_quantity
  from public.resource_claims
  where need_id = old.id and status in ('reserved', 'confirmed', 'delivered');
  if new.quantity_needed < active_quantity then
    raise exception 'RESOURCE_NEED_BELOW_ACTIVE_CLAIMS';
  end if;

  if new.status = 'fulfilled' and old.status <> 'fulfilled' then
    select coalesce(sum(coalesce(delivered_quantity, quantity)), 0) into delivered_total
    from public.resource_claims where need_id = old.id and status = 'delivered';
    if delivered_total < new.quantity_needed then raise exception 'RESOURCE_NEED_NOT_FULFILLED'; end if;
  end if;
  return new;
end;
$$;
