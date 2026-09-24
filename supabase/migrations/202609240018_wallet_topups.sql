-- Ví nhà hảo tâm / tổ chức: nạp tiền bằng chuyển khoản tới tài khoản trung tâm,
-- Admin đối soát sao kê rồi mới cộng số dư. Sổ cái chỉ ghi thêm, không sửa/xoá.

create table public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  tx_ref text not null unique check (length(trim(tx_ref)) between 8 and 40),
  amount_vnd numeric(18, 2) not null check (amount_vnd >= 10000 and amount_vnd <= 10000000000),
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  receiving_account_id uuid references public.platform_receiving_accounts(id) on delete set null,
  receiving_bank_id text not null,
  receiving_account_no text not null,
  receiving_account_name text not null,
  transfer_description text not null,
  admin_note text check (admin_note is null or length(admin_note) <= 500),
  processed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wallet_topups_user_created_idx on public.wallet_topups (user_id, created_at desc);
create index wallet_topups_status_idx on public.wallet_topups (status, created_at);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  entry_type text not null check (entry_type in ('topup')),
  amount_vnd numeric(18, 2) not null check (amount_vnd <> 0),
  topup_id uuid unique references public.wallet_topups(id) on delete restrict,
  note text,
  created_at timestamptz not null default now()
);
create index wallet_ledger_user_created_idx on public.wallet_ledger (user_id, created_at desc);

alter table public.wallet_topups enable row level security;
alter table public.wallet_ledger enable row level security;

create policy "wallet_topups_owner_or_admin_read" on public.wallet_topups
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "wallet_topups_admin_update" on public.wallet_topups
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wallet_ledger_owner_or_admin_read" on public.wallet_ledger
for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- Không có policy INSERT/UPDATE/DELETE: chỉ trigger security definer được ghi sổ cái.

create trigger wallet_topups_set_updated_at before update on public.wallet_topups
for each row execute function public.set_updated_at();

create or replace function public.guard_wallet_topup_update()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() then raise exception 'Only Admin may update wallet top-ups'; end if;
  if new.user_id is distinct from old.user_id
    or new.tx_ref is distinct from old.tx_ref
    or new.amount_vnd is distinct from old.amount_vnd
    or new.receiving_account_id is distinct from old.receiving_account_id
    or new.receiving_bank_id is distinct from old.receiving_bank_id
    or new.receiving_account_no is distinct from old.receiving_account_no
    or new.receiving_account_name is distinct from old.receiving_account_name
    or new.transfer_description is distinct from old.transfer_description
    or new.created_at is distinct from old.created_at then
    raise exception 'WALLET_TOPUP_IMMUTABLE_FIELDS';
  end if;
  if new.status is distinct from old.status and old.status <> 'pending' then
    raise exception 'WALLET_TOPUP_ALREADY_PROCESSED';
  end if;
  if new.status = 'rejected' and coalesce(length(trim(new.admin_note)), 0) < 3 then
    raise exception 'WALLET_TOPUP_REJECT_NOTE_REQUIRED';
  end if;
  return new;
end;
$$;
create trigger wallet_topups_guard_update before update on public.wallet_topups
for each row execute function public.guard_wallet_topup_update();

-- Khi nạp tiền được xác nhận, ghi đúng một dòng sổ cái (unique topup_id chống ghi đôi).
create or replace function public.credit_wallet_on_topup_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status = 'pending' then
    new.completed_at := coalesce(new.completed_at, now());
    insert into public.wallet_ledger (user_id, entry_type, amount_vnd, topup_id, note)
    values (new.user_id, 'topup', new.amount_vnd, new.id, 'Nạp ví ' || new.tx_ref);
  end if;
  return new;
end;
$$;
create trigger wallet_topups_credit before update on public.wallet_topups
for each row execute function public.credit_wallet_on_topup_completed();

create or replace function public.create_wallet_topup(p_amount_vnd numeric)
returns table (
  id uuid, tx_ref text, amount_vnd numeric, status text, bank_id text, account_no text,
  account_name text, transfer_description text, created_at timestamptz
) language plpgsql security definer set search_path = '' as $$
declare
  account record;
  ref text;
  description text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
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

  ref := 'VI-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  description := 'Nap vi ' || ref;

  return query
  insert into public.wallet_topups (user_id, tx_ref, amount_vnd, receiving_account_id, receiving_bank_id,
    receiving_account_no, receiving_account_name, transfer_description)
  values (auth.uid(), ref, p_amount_vnd, account.id, account.bank_id, account.account_no, account.account_name, description)
  returning wallet_topups.id, wallet_topups.tx_ref, wallet_topups.amount_vnd, wallet_topups.status,
    wallet_topups.receiving_bank_id, wallet_topups.receiving_account_no, wallet_topups.receiving_account_name,
    wallet_topups.transfer_description, wallet_topups.created_at;
end;
$$;
revoke all on function public.create_wallet_topup(numeric) from public;
grant execute on function public.create_wallet_topup(numeric) to authenticated;

comment on table public.wallet_ledger is 'Append-only wallet ledger. Balance = sum(amount_vnd) per user. Written only by security definer triggers.';
