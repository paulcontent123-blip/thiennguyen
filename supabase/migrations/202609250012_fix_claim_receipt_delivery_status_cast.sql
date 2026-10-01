-- Sửa lỗi "Returned type public.transaction_status does not match expected type text":
-- transactions.status là kiểu enum transaction_status, không phải text, cần ép kiểu tường minh.

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
  select transaction_record.id, transaction_record.tx_ref, transaction_record.status::text,
    transaction_record.amount_vnd, transaction_record.received_amount, transaction_record.donor_name,
    transaction_record.receipt_email, transaction_record.completed_at, transaction_record.payment_provider,
    transaction_record.campaign_id, coalesce(current_attempts, 0) + 1
  from public.transactions transaction_record
  where transaction_record.id = p_transaction_id;
end;
$$;
revoke all on function public.claim_receipt_delivery(uuid) from public;
grant execute on function public.claim_receipt_delivery(uuid) to service_role;
