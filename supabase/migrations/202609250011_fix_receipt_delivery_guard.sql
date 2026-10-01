-- Sửa lỗi: trigger bảo vệ bảng transactions (guard_transaction_reconciliation_fields) chặn luôn
-- cả việc ghi nhận trạng thái gửi email biên nhận (receipt_email_status/hash/...), vì bước đó
-- chạy bằng service role (không phải phiên Admin, cũng không phải IPN VNPAY). Lỗi này có từ trước
-- khi thêm guard cho VNPAY, ảnh hưởng mọi giao dịch: biên nhận có thể đã gửi qua Resend nhưng
-- không bao giờ được ghi nhận "đã gửi" trong database.
--
-- Thay vì nới lỏng trigger một cách chung chung (dễ mở toang cho mọi update bằng service role),
-- tách hai thao tác ghi nhận trạng thái biên nhận thành RPC SECURITY DEFINER riêng, giống cách
-- đã làm cho IPN VNPAY (app.gateway_ipn).

create or replace function public.claim_receipt_delivery(p_transaction_id uuid)
returns table (
  id uuid, tx_ref text, status text, amount_vnd numeric, received_amount numeric,
  donor_name text, receipt_email text, completed_at timestamptz, payment_provider text,
  campaign_id uuid, attempt int
)
language plpgsql security definer set search_path = '' as $$
declare
  current_attempts int;
begin
  perform set_config('app.gateway_ipn', 'on', true);

  select transaction_record.receipt_email_attempts into current_attempts
  from public.transactions transaction_record where transaction_record.id = p_transaction_id;
  if not found then return; end if;

  update public.transactions set
    receipt_email_status = 'sending',
    receipt_email_attempts = coalesce(current_attempts, 0) + 1,
    receipt_email_last_error = null,
    receipt_next_retry_at = null
  where transactions.id = p_transaction_id
    and transactions.status = 'completed'
    and transactions.receipt_email_status in ('pending', 'failed');

  if not found then return; end if;

  return query
  select transaction_record.id, transaction_record.tx_ref, transaction_record.status,
    transaction_record.amount_vnd, transaction_record.received_amount, transaction_record.donor_name,
    transaction_record.receipt_email, transaction_record.completed_at, transaction_record.payment_provider,
    transaction_record.campaign_id, coalesce(current_attempts, 0) + 1
  from public.transactions transaction_record
  where transaction_record.id = p_transaction_id;
end;
$$;
revoke all on function public.claim_receipt_delivery(uuid) from public;
grant execute on function public.claim_receipt_delivery(uuid) to service_role;

create or replace function public.finalize_receipt_delivery(
  p_transaction_id uuid, p_success boolean, p_hash text, p_provider_id text, p_error_message text, p_retry_delay_minutes int
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.gateway_ipn', 'on', true);

  if p_success then
    update public.transactions set
      receipt_pdf_hash = p_hash,
      receipt_generated_at = now(),
      receipt_email_status = 'sent',
      receipt_sent_at = now(),
      receipt_provider_id = p_provider_id,
      receipt_email_last_error = null,
      receipt_next_retry_at = null
    where transactions.id = p_transaction_id;
  else
    update public.transactions set
      receipt_pdf_hash = p_hash,
      receipt_generated_at = now(),
      receipt_email_status = 'failed',
      receipt_email_last_error = left(p_error_message, 1000),
      receipt_next_retry_at = now() + make_interval(mins => coalesce(p_retry_delay_minutes, 2))
    where transactions.id = p_transaction_id;
  end if;
end;
$$;
revoke all on function public.finalize_receipt_delivery(uuid, boolean, text, text, text, int) from public;
grant execute on function public.finalize_receipt_delivery(uuid, boolean, text, text, text, int) to service_role;
