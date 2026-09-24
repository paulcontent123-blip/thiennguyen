-- Công khai đội cứu trợ đang phản hồi từng SOS trên trang /sos.
-- Chỉ trả: tên đội, loại, tiến độ và thời điểm. KHÔNG trả ghi chú, khoảng cách, GPS hay liên hệ.
-- Tình nguyện viên cá nhân không lộ tên (chỉ hiện "Tình nguyện viên"). Đội báo "không hỗ trợ được" không hiển thị.

create function public.get_public_sos_team_responses()
returns table (
  sos_report_id uuid,
  team_name text,
  member_kind text,
  progress text,
  updated_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select
    alert.sos_report_id,
    case when team.member_kind = 'team' then team.name else 'Tình nguyện viên' end,
    team.member_kind,
    coalesce(alert.response_status, 'acknowledged'),
    coalesce(alert.responded_at, alert.acknowledged_at)
  from public.sos_team_alerts alert
  join public.rescue_teams team on team.id = alert.rescue_team_id
  join public.sos_reports report on report.id = alert.sos_report_id
  where (alert.acknowledged_at is not null or alert.response_status is not null)
    and coalesce(alert.response_status, '') <> 'cannot_assist'
    and (
      report.status in ('urgent', 'needs_support')
      or (report.status = 'handled' and coalesce(report.handled_at, report.created_at) > now() - interval '7 days')
    )
  order by coalesce(alert.responded_at, alert.acknowledged_at) desc;
$$;

revoke all on function public.get_public_sos_team_responses() from public;
grant execute on function public.get_public_sos_team_responses() to anon, authenticated;
