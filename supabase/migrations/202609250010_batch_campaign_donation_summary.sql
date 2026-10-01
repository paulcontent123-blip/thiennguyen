-- Gộp N lượt gọi get_campaign_donation_summary (mỗi chiến dịch một round-trip) thành một lượt
-- gọi duy nhất cho cả danh sách — dùng cho trang chủ, nơi tính tổng tiền đã nhận cho 8-12 chiến
-- dịch cùng lúc. Giữ nguyên hàm cũ (vẫn dùng ở trang chi tiết chiến dịch, chỉ 1 id/lần).

create or replace function public.get_campaign_donation_summaries(p_campaign_ids uuid[])
returns table (
  campaign_id uuid,
  total_amount_vnd numeric,
  completed_count bigint,
  last_completed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    transaction_record.campaign_id,
    coalesce(sum(coalesce(transaction_record.received_amount, transaction_record.amount_vnd)), 0)::numeric,
    count(*)::bigint,
    max(transaction_record.completed_at)
  from public.transactions transaction_record
  where transaction_record.campaign_id = any(p_campaign_ids)
    and transaction_record.status = 'completed'
    and public.is_public_campaign(transaction_record.campaign_id)
  group by transaction_record.campaign_id;
$$;

revoke all on function public.get_campaign_donation_summaries(uuid[]) from public;
grant execute on function public.get_campaign_donation_summaries(uuid[]) to anon, authenticated;

comment on function public.get_campaign_donation_summaries(uuid[]) is
'Batched version of get_campaign_donation_summary for listing pages — one round trip for many campaigns instead of N. Campaigns with zero completed transactions are simply absent from the result (caller defaults to 0).';
