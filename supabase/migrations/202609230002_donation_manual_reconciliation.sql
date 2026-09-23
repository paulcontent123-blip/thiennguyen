-- Cho phép Admin đối soát thủ công giao dịch quyên góp (chưa có webhook ngân hàng thật).
-- transactions hiện chưa có policy UPDATE nào — Admin cũng không sửa được. Bổ sung UPDATE
-- chỉ cho Admin, kèm guard trigger chặn sửa các trường snapshot bất biến (số tiền, tài khoản
-- nhận, tổ chức...) — Admin chỉ được đổi các trường liên quan tới xác nhận thanh toán.

create or replace function public.guard_transaction_reconciliation_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    raise exception 'Only Admin may update transactions';
  end if;

  if new.campaign_id is distinct from old.campaign_id
    or new.organization_id is distinct from old.organization_id
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
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception 'Admin may only update reconciliation fields (status, completed_at, failure_reason, webhook_matched_at, receipt_sent_at)';
  end if;

  if new.status is distinct from old.status and old.status <> 'pending' then
    raise exception 'Only pending transactions can be reconciled manually';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_guard_reconciliation_fields on public.transactions;
create trigger transactions_guard_reconciliation_fields
before update on public.transactions
for each row execute function public.guard_transaction_reconciliation_fields();

drop policy if exists "transactions_admin_update" on public.transactions;
create policy "transactions_admin_update" on public.transactions
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on function public.guard_transaction_reconciliation_fields() is
'Đối soát thủ công tạm thời (chưa có webhook ngân hàng thật) — chỉ Admin, chỉ từ trạng thái pending, không được sửa số tiền/tài khoản nhận/tổ chức.';
