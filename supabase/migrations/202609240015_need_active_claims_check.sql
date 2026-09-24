-- Sửa: kiểm tra "nhu cầu đã có lượt đăng ký đang hiệu lực" phải chạy với quyền hệ thống.
-- Chủ chiến dịch không đọc được bảng resource_claims (thông tin liên hệ người đóng góp là riêng tư),
-- nên khi kiểm tra bằng quyền của họ luôn thấy "chưa có đăng ký" và cho sửa nhầm.

create or replace function public.resource_need_has_active_claims(p_need_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.resource_claims claim
    where claim.need_id = p_need_id and claim.status in ('reserved', 'confirmed', 'delivered')
  );
$$;

revoke all on function public.resource_need_has_active_claims(uuid) from public;
grant execute on function public.resource_need_has_active_claims(uuid) to authenticated;

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

  if public.is_campaign_owner(old.campaign_id)
    and old.status = 'open'
    and new.status = 'open'
    and new.campaign_id is not distinct from old.campaign_id
    and new.created_by is not distinct from old.created_by
    and not public.resource_need_has_active_claims(old.id) then
    new.moderation_status := 'pending_review';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  raise exception 'RESOURCE_NEED_ADMIN_ONLY_REVIEW';
end;
$$;
