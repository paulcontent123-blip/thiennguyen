-- Trung tâm thông báo trong app: mỗi người dùng chỉ đọc được thông báo của chính mình.
-- Server (service role) ghi thông báo song song với email hiện có, không thay thế email.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in (
    'payment_pending', 'payment_completed', 'payment_rejected',
    'campaign_status', 'resource_update', 'admin_alert', 'other'
  )),
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 1000),
  link text check (link is null or length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_owner_read" on public.notifications
for select to authenticated using (user_id = auth.uid());

-- Chỉ cho phép tự đánh dấu đã đọc (không sửa được nội dung/loại/link của thông báo).
create policy "notifications_owner_mark_read" on public.notifications
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.guard_notification_update()
returns trigger language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id
    or new.category is distinct from old.category
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.link is distinct from old.link
    or new.created_at is distinct from old.created_at then
    raise exception 'NOTIFICATION_READONLY_FIELDS';
  end if;
  return new;
end;
$$;
create trigger notifications_guard_update before update on public.notifications
for each row execute function public.guard_notification_update();

-- Không có policy insert cho authenticated: thông báo chỉ được ghi bởi server dùng service role
-- (bypass RLS), để không ai tự tạo thông báo giả cho chính mình hoặc người khác.

comment on table public.notifications is
'In-app notification center. Written only by server-side service-role code alongside existing email sends; read-only for the owning user otherwise (can only mark read_at).';
