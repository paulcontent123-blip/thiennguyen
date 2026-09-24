-- Sửa lỗi: người đóng góp không đăng ký (claim) được vào nhu cầu.
-- Nguyên nhân: sync_resource_need_from_claim luôn UPDATE bảng resource_needs, mà trigger kiểm duyệt
-- (guard_resource_need_moderation) chặn mọi UPDATE không phải Admin/chủ chiến dịch => RESOURCE_NEED_ADMIN_ONLY_REVIEW.
-- Cách sửa: hàm đồng bộ (security definer) chỉ cập nhật khi trạng thái thực sự đổi và bật cờ giao dịch nội bộ;
-- trigger cho phép đúng trường hợp đó, khi chỉ có cột status thay đổi.

create or replace function public.sync_resource_need_from_claim()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  received_quantity numeric;
begin
  select coalesce(sum(coalesce(delivered_quantity, quantity)), 0) into received_quantity
  from public.resource_claims
  where need_id = new.need_id and status = 'delivered';

  perform set_config('app.resource_need_sync', 'on', true);
  update public.resource_needs
  set status = case
      when received_quantity >= quantity_needed then 'fulfilled'
      when status = 'fulfilled' then 'open'
      else status
    end
  where id = new.need_id
    and status <> 'closed'
    and status is distinct from (case
      when received_quantity >= quantity_needed then 'fulfilled'
      when status = 'fulfilled' then 'open'
      else status
    end);
  perform set_config('app.resource_need_sync', 'off', true);
  return new;
end;
$$;

create or replace function public.guard_resource_need_moderation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() and (
      new.moderation_status <> 'pending_review'
      or new.status <> 'open'
      or new.review_note is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null
    ) then
      raise exception 'RESOURCE_NEED_REQUIRES_ADMIN_REVIEW';
    end if;
    return new;
  end if;

  if public.is_admin() then return new; end if;

  -- Đồng bộ trạng thái tự động từ lượt đăng ký: chỉ cột status được đổi.
  if coalesce(current_setting('app.resource_need_sync', true), '') = 'on'
    and new.campaign_id is not distinct from old.campaign_id
    and new.resource_type is not distinct from old.resource_type
    and new.name is not distinct from old.name
    and new.description is not distinct from old.description
    and new.category is not distinct from old.category
    and new.quantity_needed is not distinct from old.quantity_needed
    and new.unit is not distinct from old.unit
    and new.province is not distinct from old.province
    and new.urgency is not distinct from old.urgency
    and new.created_by is not distinct from old.created_by
    and new.moderation_status is not distinct from old.moderation_status
    and new.review_note is not distinct from old.review_note
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at then
    return new;
  end if;

  -- Chủ chiến dịch đóng nhu cầu đã duyệt (không đổi nội dung).
  if public.is_campaign_owner(old.campaign_id)
    and old.moderation_status = 'approved'
    and new.status = 'closed'
    and new.campaign_id is not distinct from old.campaign_id
    and new.resource_type is not distinct from old.resource_type
    and new.name is not distinct from old.name
    and new.description is not distinct from old.description
    and new.category is not distinct from old.category
    and new.quantity_needed is not distinct from old.quantity_needed
    and new.unit is not distinct from old.unit
    and new.province is not distinct from old.province
    and new.urgency is not distinct from old.urgency
    and new.created_by is not distinct from old.created_by
    and new.moderation_status is not distinct from old.moderation_status
    and new.review_note is not distinct from old.review_note
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at then
    return new;
  end if;

  -- Chủ chiến dịch sửa nội dung: chỉ khi nhu cầu còn mở và chưa có lượt đăng ký đang hiệu lực.
  -- Trigger tự đưa nhu cầu về chờ duyệt lại để Admin kiểm tra nội dung mới trước khi công khai.
  if public.is_campaign_owner(old.campaign_id)
    and old.status = 'open'
    and new.status = 'open'
    and new.campaign_id is not distinct from old.campaign_id
    and new.created_by is not distinct from old.created_by
    and not exists (
      select 1 from public.resource_claims claim
      where claim.need_id = old.id and claim.status in ('reserved', 'confirmed', 'delivered')
    ) then
    new.moderation_status := 'pending_review';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  raise exception 'RESOURCE_NEED_ADMIN_ONLY_REVIEW';
end;
$$;
