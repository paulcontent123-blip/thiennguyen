-- Dữ liệu media Cloudinary cho cổng tổ chức và luồng nộp lại giấy phép.

alter table public.organizations
  add column if not exists avatar_url text,
  add column if not exists avatar_public_id text,
  add column if not exists license_public_id text;

-- Không cho tổ chức giữ trạng thái approved sau khi tự thay đổi dữ liệu pháp lý.
-- Tổ chức chỉ được thay đổi review fields trong hai trường hợp an toàn:
-- nộp lại giấy phép hoặc cập nhật hồ sơ pháp lý và tự chuyển về pending.
create or replace function public.guard_organization_review_fields()
returns trigger
language plpgsql
as $$
declare
  review_changed boolean;
  legal_profile_changed boolean;
  owner_revalidation boolean;
begin
  review_changed :=
    new.license_status is distinct from old.license_status
    or new.license_note is distinct from old.license_note
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by;

  legal_profile_changed :=
    new.name is distinct from old.name
    or new.legal_representative_name is distinct from old.legal_representative_name
    or new.legal_representative_email is distinct from old.legal_representative_email
    or new.legal_representative_phone is distinct from old.legal_representative_phone;

  owner_revalidation :=
    auth.uid() = old.user_id
    and new.license_status = 'pending'
    and new.license_note is null
    and new.verified_at is null
    and new.verified_by is null
    and (
      (new.license_file_path is distinct from old.license_file_path
       and coalesce(trim(new.license_file_path), '') <> ''
       and new.license_public_id is distinct from old.license_public_id
       and coalesce(trim(new.license_public_id), '') <> '')
      or (old.license_status = 'approved' and legal_profile_changed)
    );

  if not public.is_admin() then
    if review_changed and not owner_revalidation then
      raise exception 'Only Admin may update organization review fields';
    end if;

    if old.license_status = 'approved' and legal_profile_changed and not owner_revalidation then
      raise exception 'Legal profile changes require re-verification';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.submit_organization_license(
  p_license_url text,
  p_license_public_id text,
  p_license_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(trim(p_license_url), '') !~ '^https://res\.cloudinary\.com/' then
    raise exception 'Invalid Cloudinary license URL';
  end if;

  if coalesce(trim(p_license_public_id), '') = '' then
    raise exception 'Cloudinary public ID is required';
  end if;

  update public.organizations
  set license_file_path = trim(p_license_url),
      license_public_id = trim(p_license_public_id),
      license_number = nullif(trim(p_license_number), ''),
      license_status = 'pending',
      license_note = null,
      verified_at = null,
      verified_by = null
  where user_id = auth.uid();

  if not found then
    raise exception 'Organization profile not found';
  end if;
end;
$$;

revoke all on function public.submit_organization_license(text, text, text) from public;
grant execute on function public.submit_organization_license(text, text, text) to authenticated;

-- Nội dung chiến dịch chỉ được tổ chức sửa khi còn là bản nháp hoặc đang cần bổ sung.
-- Sau khi gửi duyệt, chỉ Admin được thay đổi các trường review/trạng thái.
create or replace function public.guard_campaign_review_fields()
returns trigger
language plpgsql
as $$
declare
  content_changed boolean;
begin
  if not public.is_admin() then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'Campaign organization cannot be changed';
    end if;

    if new.review_note is distinct from old.review_note
      or new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.published_at is distinct from old.published_at then
      raise exception 'Only Admin may update campaign review fields';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'draft' and new.status = 'pending_review')
      or (old.status = 'needs_revision' and new.status = 'pending_review')
    ) then
      raise exception 'Organization cannot perform this campaign status transition';
    end if;

    content_changed :=
      new.title is distinct from old.title
      or new.slug is distinct from old.slug
      or new.summary is distinct from old.summary
      or new.description is distinct from old.description
      or new.target_amount is distinct from old.target_amount
      or new.campaign_type is distinct from old.campaign_type
      or new.category is distinct from old.category
      or new.deadline is distinct from old.deadline
      or new.submitted_at is distinct from old.submitted_at;

    if content_changed and old.status not in ('draft', 'needs_revision') then
      raise exception 'Campaign content is locked after submission';
    end if;
  end if;

  return new;
end;
$$;
