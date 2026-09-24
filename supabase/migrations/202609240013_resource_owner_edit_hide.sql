-- Người dùng tự quản lý nguồn lực của mình:
-- 1) Chủ chiến dịch được SỬA nhu cầu khi còn "open" và chưa có lượt đăng ký nào đang hiệu lực;
--    mọi lần sửa đều đưa nhu cầu về "chờ Admin duyệt lại" (xoá ghi chú duyệt cũ).
-- 2) Người đăng được ẨN khỏi danh sách của mình các nguồn lực đã hủy và lượt đóng góp đã hủy chưa từng
--    được Admin xác minh. Chỉ ẩn khỏi giao diện của người đó, dữ liệu và lịch sử vẫn giữ nguyên.
-- Nguồn lực (offers) đang "available" vốn đã được chủ sở hữu sửa theo trigger hiện có.

alter table public.resource_offers add column owner_hidden boolean not null default false;
alter table public.resource_claims add column owner_hidden boolean not null default false;

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

create or replace function public.guard_resource_offer_update()
returns trigger language plpgsql as $$
declare
  synchronized_claim boolean;
begin
  if new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at then
    raise exception 'RESOURCE_OFFER_IMMUTABLE_OWNER';
  end if;

  select exists (
    select 1
    from public.resource_claims claim
    where claim.offer_id = old.id
      and (
        (claim.status in ('reserved', 'confirmed') and new.status = 'matched' and new.matched_need_id = claim.need_id)
        or (claim.status = 'delivered' and new.status = 'delivered' and new.matched_need_id = claim.need_id)
        or (claim.status in ('cancelled', 'expired', 'failed') and new.status = 'available' and new.matched_need_id is null)
      )
  ) into synchronized_claim;

  if synchronized_claim then return new; end if;

  if not public.is_admin() and auth.uid() = old.user_id then
    -- Chỉ được ẩn/hiện khi nguồn lực đã hủy, và không đổi trường nào khác.
    if new.owner_hidden is distinct from old.owner_hidden then
      if old.status <> 'cancelled' or new.status <> 'cancelled'
        or new.matched_need_id is distinct from old.matched_need_id
        or new.title is distinct from old.title
        or new.quantity is distinct from old.quantity then
        raise exception 'RESOURCE_OFFER_HIDE_ONLY_CANCELLED';
      end if;
      return new;
    end if;
    if old.status <> 'available' or new.status not in ('available', 'cancelled') or new.matched_need_id is distinct from old.matched_need_id then
      raise exception 'RESOURCE_OFFER_ALREADY_MATCHED';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_resource_claim_update()
returns trigger language plpgsql as $$
begin
  if new.need_id is distinct from old.need_id
    or new.offer_id is distinct from old.offer_id
    or new.contributor_id is distinct from old.contributor_id
    or new.quantity is distinct from old.quantity
    or new.contact_name is distinct from old.contact_name
    or new.contact_email is distinct from old.contact_email
    or new.contact_phone is distinct from old.contact_phone
    or new.created_at is distinct from old.created_at then
    raise exception 'RESOURCE_CLAIM_IMMUTABLE_FIELDS';
  end if;

  if public.is_admin() then
    if (old.status = 'reserved' and new.status not in ('reserved', 'confirmed', 'cancelled', 'failed'))
      or (old.status = 'confirmed' and new.status not in ('confirmed', 'delivered', 'cancelled', 'failed'))
      or (old.status in ('delivered', 'cancelled', 'expired', 'failed') and new.status <> old.status) then
      raise exception 'INVALID_RESOURCE_CLAIM_TRANSITION';
    end if;
    if new.status = 'delivered' and (new.delivered_quantity is null or length(trim(coalesce(new.coordination_note, ''))) < 3) then
      raise exception 'RESOURCE_DELIVERY_REQUIRES_QUANTITY_AND_EVIDENCE';
    end if;
    if new.status <> 'delivered' and new.delivered_quantity is not null then
      raise exception 'DELIVERED_QUANTITY_ONLY_ALLOWED_ON_DELIVERED';
    end if;
    return new;
  end if;

  -- Người đóng góp ẩn lượt đã hủy chưa từng được Admin xác minh; không đổi trường nào khác.
  if auth.uid() = old.contributor_id
    and new.owner_hidden is distinct from old.owner_hidden
    and old.status = 'cancelled'
    and new.status = old.status
    and old.confirmed_at is null
    and new.coordination_note is not distinct from old.coordination_note
    and new.actual_value_vnd is not distinct from old.actual_value_vnd
    and new.confirmed_at is not distinct from old.confirmed_at
    and new.delivered_at is not distinct from old.delivered_at
    and new.delivered_quantity is not distinct from old.delivered_quantity
    and new.processed_by is not distinct from old.processed_by then
    return new;
  end if;

  if auth.uid() = old.contributor_id
    and new.status = 'cancelled'
    and old.status in ('reserved', 'confirmed')
    and new.owner_hidden is not distinct from old.owner_hidden
    and new.coordination_note is not distinct from old.coordination_note
    and new.actual_value_vnd is not distinct from old.actual_value_vnd
    and new.confirmed_at is not distinct from old.confirmed_at
    and new.delivered_at is not distinct from old.delivered_at
    and new.delivered_quantity is not distinct from old.delivered_quantity
    and new.processed_by is not distinct from old.processed_by then
    return new;
  end if;

  raise exception 'RESOURCE_CLAIM_ADMIN_ONLY_REVIEW';
end;
$$;
