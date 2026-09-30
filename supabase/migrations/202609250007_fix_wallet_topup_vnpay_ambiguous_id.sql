-- Sửa lỗi "column reference id is ambiguous" trong create_wallet_topup_vnpay: cột OUT `id` của
-- RETURNS TABLE trùng tên với public.profiles.id chưa được alias (lỗi tương tự đã sửa ở
-- migration 202609240019 cho create_wallet_topup).

create or replace function public.create_wallet_topup_vnpay(p_amount_vnd numeric)
returns table (id uuid, tx_ref text, amount_vnd numeric, status text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  account record;
  ref text;
  description text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'WALLET_AUTH_REQUIRED';
  end if;
  if p_amount_vnd is null or p_amount_vnd < 10000 or p_amount_vnd > 10000000000 or trunc(p_amount_vnd) <> p_amount_vnd then
    raise exception 'WALLET_AMOUNT_INVALID';
  end if;
  if (select count(*) from public.wallet_topups t where t.user_id = auth.uid() and t.status = 'pending') >= 5 then
    raise exception 'WALLET_TOO_MANY_PENDING';
  end if;

  select a.* into account from public.platform_receiving_accounts a
  where a.kind = 'domestic_vnd' and a.currency = 'VND' and a.is_active = true limit 1;
  if not found then raise exception 'PLATFORM_RECEIVING_ACCOUNT_NOT_CONFIGURED'; end if;

  ref := 'VIVNP' || to_char(now(), 'YYYYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  description := 'Nap vi ' || ref;

  return query
  insert into public.wallet_topups (user_id, tx_ref, amount_vnd, payment_provider, receiving_account_id,
    receiving_bank_id, receiving_account_no, receiving_account_name, transfer_description)
  values (auth.uid(), ref, p_amount_vnd, 'vnpay', account.id, account.bank_id, account.account_no, account.account_name, description)
  returning wallet_topups.id, wallet_topups.tx_ref, wallet_topups.amount_vnd, wallet_topups.status, wallet_topups.created_at;
end;
$$;
revoke all on function public.create_wallet_topup_vnpay(numeric) from public;
grant execute on function public.create_wallet_topup_vnpay(numeric) to authenticated;
