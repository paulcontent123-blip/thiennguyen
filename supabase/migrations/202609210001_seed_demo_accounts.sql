-- DEV/TEST ONLY
-- Tạo các tài khoản mẫu để kiểm thử phân quyền trên môi trường development/staging.
-- Không chạy migration này trên production vì mật khẩu mẫu được biết công khai.

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_sent_at,
  confirmation_token,
  recovery_sent_at,
  recovery_token,
  email_change_token_new,
  email_change,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'admin@demo.vn',
    extensions.crypt('123456', extensions.gen_salt('bf')),
    now(),
    now(),
    '',
    now(),
    '',
    '',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Demo","account_type":"donor"}'::jsonb,
    false,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'donor@demo.vn',
    extensions.crypt('123456', extensions.gen_salt('bf')),
    now(),
    now(),
    '',
    now(),
    '',
    '',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Donor Demo","account_type":"donor"}'::jsonb,
    false,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'org@demo.vn',
    extensions.crypt('123456', extensions.gen_salt('bf')),
    now(),
    now(),
    '',
    now(),
    '',
    '',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Organization Demo","account_type":"org"}'::jsonb,
    false,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'rescue_team@demo.vn',
    extensions.crypt('123456', extensions.gen_salt('bf')),
    now(),
    now(),
    '',
    now(),
    '',
    '',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Rescue Team Demo","account_type":"donor"}'::jsonb,
    false,
    now(),
    now()
  )
on conflict (id) do update
set encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

-- Email identity giúp Supabase Auth nhận diện đây là tài khoản đăng nhập bằng
-- email/password khi migration được chạy trên project mới.
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'::uuid,
    '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@demo.vn","email_verified":true}'::jsonb,
    'email',
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002'::uuid,
    '{"sub":"10000000-0000-4000-8000-000000000002","email":"donor@demo.vn","email_verified":true}'::jsonb,
    'email',
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003'::uuid,
    '{"sub":"10000000-0000-4000-8000-000000000003","email":"org@demo.vn","email_verified":true}'::jsonb,
    'email',
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004'::uuid,
    '{"sub":"10000000-0000-4000-8000-000000000004","email":"rescue_team@demo.vn","email_verified":true}'::jsonb,
    'email',
    now(),
    now()
  )
on conflict do nothing;

-- handle_new_user() tạo profile cho user mới. Upsert lại role để seed đúng
-- cả các role mà giao diện đăng ký công khai hiện chưa cho tự chọn.
insert into public.profiles (id, role, full_name)
values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'admin', 'Admin Demo'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'donor', 'Donor Demo'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'org', 'Organization Demo'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'rescue_team', 'Rescue Team Demo')
on conflict (id) do update
set role = excluded.role,
    full_name = excluded.full_name;

-- Tài khoản tổ chức bắt đầu ở trạng thái pending để kiểm thử đúng luồng
-- Admin xét duyệt giấy phép trước khi tổ chức tạo campaign.
update public.organizations
set name = 'Tổ chức Demo',
    legal_representative_name = 'Organization Demo',
    legal_representative_email = 'org@demo.vn'
where user_id = '10000000-0000-4000-8000-000000000003'::uuid;

-- Tài khoản cứu trợ được seed sẵn một đội đã kích hoạt để có thể vào
-- màn hình vận hành ngay khi đăng nhập bằng rescue_team@demo.vn.
insert into public.rescue_teams (
  user_id,
  name,
  resource_types,
  province,
  radius_km,
  status,
  activated_by
)
values (
  '10000000-0000-4000-8000-000000000004'::uuid,
  'Đội cứu trợ Demo',
  array['medical', 'rescue'],
  'Hà Nội',
  20,
  'available',
  '10000000-0000-4000-8000-000000000001'::uuid
)
on conflict (user_id) do nothing;
