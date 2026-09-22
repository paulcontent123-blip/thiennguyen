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

### Migration và dữ liệu demo

Các migration trong `supabase/migrations` chỉ chứa schema, trigger và RLS dùng được cho production. Không đặt tài khoản hoặc mật khẩu mẫu trong migration.

Kiểm tra và áp dụng theo đúng thứ tự:

```bash
supabase migration list
supabase db push
```

Migration seed cũ `202609210001_seed_demo_accounts.sql` đã được loại khỏi lịch sử vì ghi trực tiếp vào schema nội bộ `auth` và có thể không tương thích giữa các phiên bản Supabase.

Sau khi chạy toàn bộ migration trên môi trường development/staging, có thể tạo lại dữ liệu demo bằng Admin API:

1. Điền `SUPABASE_SERVICE_ROLE_KEY` vào `.env.local` và tuyệt đối không đưa khóa này lên Git hoặc client bundle.
2. Đặt `DEMO_SEED_ENABLED=true`.
3. Chạy:

```bash
npm run seed:demo
```

Script có thể chạy lại nhiều lần: tài khoản đã tồn tại sẽ được cập nhật thay vì tạo trùng. Không bật hoặc chạy script này trên production.

Sau khi có tài khoản demo, có thể seed thêm 8 chiến dịch demo (trạng thái `active`, trải đều 8 tỉnh/thành, đủ hạng mục và loại chiến dịch) để có dữ liệu thật cho tìm kiếm/lọc:

```bash
npm run seed:demo-campaigns
```

Cũng cần `DEMO_SEED_ENABLED=true` và chạy sau `npm run seed:demo` (script tạo chiến dịch dưới tên "Tổ chức Demo"). Idempotent — chạy lại chỉ cập nhật theo `slug`, không tạo trùng.

### Cloudinary cho hồ sơ tổ chức

Cổng tổ chức upload ảnh đại diện và giấy phép qua signed Upload API ở phía server. Tạo một Cloudinary product environment rồi thêm vào `.env.local`:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Không thêm tiền tố `NEXT_PUBLIC_` cho `CLOUDINARY_API_SECRET` và không commit giá trị thật. Giấy phép nhận PDF/JPG/PNG/WebP tối đa 10 MB; ảnh đại diện nhận JPG/PNG/WebP tối đa 5 MB. Migration `202609210004_organization_portal.sql` phải được áp dụng trước khi sử dụng dashboard.

Cấu trúc thư mục trong Cloudinary Media Library:

```text
thiennguyen/
├── avatars/   # Ảnh đại diện tổ chức
└── licenses/  # PDF/ảnh giấy phép hoạt động
```

### Email qua Resend

Mặc định ứng dụng dùng `EmailProvider` với `EMAIL_PROVIDER=resend`. Provider Resend gửi email nghiệp vụ bằng REST API; provider SendGrid đã có cùng interface để có thể chuyển bằng biến môi trường mà không sửa các luồng nghiệp vụ.

Thêm vào `.env.local`:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM=Thiện Nguyện <no-reply@your-domain.vn>
RESEND_API_KEY=re_xxxxxxxxx
```

API key chỉ nên có quyền sending và không được đưa vào client bundle hoặc commit lên Git. Domain gửi email phải được verify trên Resend trước khi dùng địa chỉ `EMAIL_FROM` thật.

Supabase Auth dùng cùng Resend qua Custom SMTP để gửi xác nhận email, OTP, reset mật khẩu và invitation:

```text
Host: smtp.resend.com
Port: 465
Username: resend
Password: RESEND_API_KEY
Sender: EMAIL_FROM
```

OTP vẫn do Supabase Auth phát hành và xác thực; Resend chỉ đảm nhiệm vận chuyển email. Các hàm email nghiệp vụ nằm ở `src/lib/email/notifications.ts`, gồm biên nhận PDF và cập nhật chiến dịch.

Khi cần chuyển sang SendGrid, đổi cấu hình:

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=sg_xxxxxxxxx
SENDGRID_FROM_EMAIL=Thiện Nguyện <no-reply@your-domain.vn>
```

## Các quyết định chưa hard-code

- Phương thức chữ ký/approval của người đại diện.
- Thời điểm công khai giải ngân trước hay sau hậu kiểm.
- Invitation cứu trợ là invitation-only hay sau bước duyệt application.
- Chính sách một hay nhiều đội cùng xử lý một SOS.
- Phân cấp Admin và phạm vi audit log.

## Các tài khoản demo

Chỉ dùng trên development/staging. Mật khẩu chung: `123456`.

| Tài khoản | Role |
|---|---|
| `admin@demo.vn` | `admin` |
| `donor@demo.vn` | `donor` |
| `org@demo.vn` | `org` |
| `rescue_team@demo.vn` | `rescue_team` |
