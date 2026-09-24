-- Đội cứu trợ báo tiến độ theo từng cảnh báo SOS (đang tới, đã đến, đã xử lý xong, không hỗ trợ được)
-- kèm ghi chú gửi Admin. Mặc định Admin là người chốt đóng SOS; Admin có thể bật "tự đóng" cho từng SOS.

alter table public.sos_team_alerts
  add column response_status text check (response_status in ('en_route', 'on_scene', 'completed', 'cannot_assist')),
  add column response_note text check (response_note is null or length(response_note) <= 500),
  add column responded_at timestamptz;

alter table public.sos_reports
  add column auto_close_on_team_complete boolean not null default false;

-- Cho phép đúng một trường hợp thay đổi trạng thái không do Admin: hàm report_sos_team_progress
-- đóng SOS (urgent/needs_support -> handled) khi Admin đã bật tự đóng. Cờ chỉ tồn tại trong giao dịch đó.
create or replace function public.guard_sos_report_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and (
    new.status is distinct from old.status
    or new.handled_at is distinct from old.handled_at
    or new.handled_by is distinct from old.handled_by
    or new.auto_close_on_team_complete is distinct from old.auto_close_on_team_complete
  ) then
    if coalesce(current_setting('app.sos_auto_close', true), '') = 'on'
      and old.status in ('urgent', 'needs_support')
      and new.status = 'handled'
      and new.auto_close_on_team_complete is not distinct from old.auto_close_on_team_complete then
      return new;
    end if;
    raise exception 'Only Admin may update SOS report status fields';
  end if;
  return new;
end;
$$;

create function public.report_sos_team_progress(p_alert_id uuid, p_status text, p_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert public.sos_team_alerts%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_closed boolean := false;
begin
  if p_status not in ('en_route', 'on_scene', 'completed', 'cannot_assist') then
    raise exception 'Invalid progress status';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'Note is too long';
  end if;
  if p_status = 'cannot_assist' and v_note is null then
    raise exception 'A note is required when the team cannot assist';
  end if;

  select alert.* into v_alert
  from public.sos_team_alerts alert
  join public.rescue_teams team on team.id = alert.rescue_team_id
  where alert.id = p_alert_id and team.user_id = auth.uid()
  for update of alert;
  if not found then
    return null;
  end if;

  update public.sos_team_alerts
  set response_status = p_status,
      response_note = v_note,
      responded_at = now(),
      acknowledged_at = coalesce(acknowledged_at, now())
  where id = p_alert_id;

  if p_status = 'completed' then
    perform set_config('app.sos_auto_close', 'on', true);
    update public.sos_reports
    set status = 'handled', handled_at = now(), handled_by = auth.uid()
    where id = v_alert.sos_report_id
      and auto_close_on_team_complete
      and status in ('urgent', 'needs_support');
    v_closed := found;
    perform set_config('app.sos_auto_close', 'off', true);
  end if;

  return case when v_closed then 'closed' else 'recorded' end;
end;
$$;

revoke all on function public.report_sos_team_progress(uuid, text, text) from public;
grant execute on function public.report_sos_team_progress(uuid, text, text) to authenticated;
