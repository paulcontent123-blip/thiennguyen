-- Sửa lỗ hổng logic do migration 202609250006 (VNPAY) vô tình gây ra khi viết lại
-- guard_transaction_reconciliation_fields: đã làm mất 2 phần quan trọng của bản gốc
-- (202609250002_wallet_disbursement_receipts.sql):
--   1) Service role (auth.role() = 'service_role') không còn được phép cập nhật transactions
--      nếu thiếu cờ app.gateway_ipn — đã vá tạm bằng 2 RPC riêng cho biên nhận (migration 011/012),
--      nhưng về lâu dài nên khôi phục quyền service_role chung để không lặp lại kiểu lỗi này.
--   2) Chuyển trạng thái completed -> refunded (dùng khi Admin hoàn tác phân bổ ví,
--      reverse_wallet_allocation) đã bị chặn hoàn toàn — Admin không hoàn tác được phân bổ ví nào
--      kể từ khi migration 006 được áp dụng. Đây là lỗi nghiêm trọng, đã xác minh tái hiện được
--      100% bằng giao dịch thật trước khi sửa.
-- Migration này khôi phục đầy đủ logic gốc, đồng thời vẫn giữ nguyên các trường gateway_*/ipn_*
-- mà VNPAY cần ghi.

create or replace function public.guard_transaction_reconciliation_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin()
    and coalesce(auth.role(), '') <> 'service_role'
    and coalesce(current_setting('app.gateway_ipn', true), '') <> 'on'
  then
    raise exception 'Only Admin, server service role, or a verified gateway IPN may update transactions';
  end if;

  if new.campaign_id is distinct from old.campaign_id
    or new.organization_id is distinct from old.organization_id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.user_id is distinct from old.user_id
    or new.tx_ref is distinct from old.tx_ref
    or new.amount_vnd is distinct from old.amount_vnd
    or new.amount_foreign is distinct from old.amount_foreign
    or new.currency is distinct from old.currency
    or new.receipt_email is distinct from old.receipt_email
    or new.donor_name is distinct from old.donor_name
    or new.receiving_bank_id is distinct from old.receiving_bank_id
    or new.receiving_account_no is distinct from old.receiving_account_no
    or new.receiving_account_name is distinct from old.receiving_account_name
    or new.transfer_description is distinct from old.transfer_description
    or new.payment_provider is distinct from old.payment_provider
    or new.wallet_allocation_id is distinct from old.wallet_allocation_id
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception 'Admin/gateway may only update reconciliation fields (status, completed_at, failure_reason, receipt_*, gateway_*, ipn_*)';
  end if;

  if new.status is distinct from old.status and not (
    old.status = 'pending'
    or (old.status = 'completed' and new.status = 'refunded' and old.payment_provider = 'wallet' and public.is_admin())
  ) then
    raise exception 'Invalid transaction reconciliation transition';
  end if;

  return new;
end;
$$;
