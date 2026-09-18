# Thiện Nguyện Platform

Skeleton MVP sử dụng Next.js, TypeScript, Tailwind CSS và Supabase.

## Quyết định nghiệp vụ đã áp dụng

- Bốn role kỹ thuật: `donor`, `org`, `rescue_team`, `admin`.
- Chỉ `donor` và `org` được đăng ký công khai.
- Không có `org_owner`, `maker`, `checker` trong MVP.
- `org` là tài khoản người đại diện pháp luật.
- Tổ chức upload giấy phép để Admin xác minh.
- Người đại diện approval hồ sơ giải ngân; Admin chỉ hậu kiểm.
- Hồ sơ cứu trợ tách khỏi đội cứu trợ đã được kích hoạt.

Nguồn chi tiết:

- `docs/ThienNguyen_Role_ChucNang_XacNhan_TechLead.md`
- `docs/ThienNguyen_TAILIEU_TONGHOP.md`

## Chạy local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`.

## Supabase

Migration đầu tiên nằm tại:

```text
supabase/migrations/202609180001_initial_schema.sql
```

Migration tạo schema, trigger onboarding và RLS. Sau khi tạo Supabase project:

1. Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` vào `.env.local`.
2. Chạy migration bằng Supabase CLI hoặc SQL Editor.
3. Tạo Admin nội bộ bằng công cụ bảo mật; không thêm lựa chọn Admin vào form đăng ký.

## Các quyết định chưa hard-code

- Phương thức chữ ký/approval của người đại diện.
- Thời điểm công khai giải ngân trước hay sau hậu kiểm.
- Invitation cứu trợ là invitation-only hay sau bước duyệt application.
- Chính sách một hay nhiều đội cùng xử lý một SOS.
- Phân cấp Admin và phạm vi audit log.
