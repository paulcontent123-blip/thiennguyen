-- Ghi chú thủ công của Admin về nơi VNPAY thực sự quyết toán tiền (tài khoản ngân hàng khai báo
-- lúc đăng ký merchant tại VNPAY). Hệ thống KHÔNG lấy được thông tin này tự động từ VNPAY — bảng
-- này chỉ là chỗ Admin tự ghi lại để nội bộ tra cứu, không ảnh hưởng tới luồng thanh toán thật.

create table public.vnpay_merchant_settlement_notes (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  merchant_website text,
  merchant_portal_url text not null default 'https://sandbox.vnpayment.vn/merchantadmin/',
  settlement_bank_name text,
  settlement_account_no text,
  settlement_account_name text,
  note text check (note is null or length(note) <= 1000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (environment)
);

alter table public.vnpay_merchant_settlement_notes enable row level security;

create policy "vnpay_merchant_notes_admin_read" on public.vnpay_merchant_settlement_notes
for select to authenticated using (public.is_admin());
create policy "vnpay_merchant_notes_admin_write" on public.vnpay_merchant_settlement_notes
for insert to authenticated with check (public.is_admin());
create policy "vnpay_merchant_notes_admin_update" on public.vnpay_merchant_settlement_notes
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create trigger vnpay_merchant_notes_set_updated_at before update on public.vnpay_merchant_settlement_notes
for each row execute function public.set_updated_at();

comment on table public.vnpay_merchant_settlement_notes is
'Informational only. VNPAY settles funds to the bank account registered at merchant sign-up (sandbox.vnpayment.vn/devreg or production onboarding) using the TMN Code — this app has no API access to read that account, so Admin records it here manually for internal reference.';
