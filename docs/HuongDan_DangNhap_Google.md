# Hướng dẫn bật lại Đăng nhập với Google

## Trạng thái hiện tại

Nút "Tiếp tục với Google" trong modal đăng nhập (`src/components/auth-controls.tsx`) đang bị **ẩn tạm thời** qua cờ:

```ts
const GOOGLE_LOGIN_ENABLED = false;
```

Lý do: Google Cloud Console yêu cầu gắn thẻ thanh toán (billing account) để tạo OAuth Client ID cho ứng dụng ở chế độ "External" khi vượt quá giới hạn dùng thử, và tài khoản hiện tại chưa gắn thẻ. Toàn bộ code xử lý đăng nhập Google (`handleGoogleLogin`) vẫn còn nguyên trong file, chỉ bị ẩn ở UI — khi cần bật lại chỉ cần đổi `GOOGLE_LOGIN_ENABLED = true`, không cần viết lại logic.

Các luồng đăng nhập khác (email/mật khẩu, magic link OTP qua email) **không bị ảnh hưởng**.

## Khi nào cần làm lại các bước dưới đây

Khi đã gắn được thẻ thanh toán cho Google Cloud (hoặc chuyển sang tài khoản Google Cloud khác đã có billing), làm theo các bước sau để cấp lại Client ID/Secret và bật provider trên Supabase.

## Bước 1 — Tạo/chọn project trên Google Cloud Console

1. Vào [console.cloud.google.com](https://console.cloud.google.com)
2. Tạo project mới hoặc chọn project sẵn có (góc trên bên trái)

## Bước 2 — Cấu hình OAuth consent screen

1. Menu trái → **APIs & Services → OAuth consent screen**
2. Chọn **User Type: External** → Create
3. Điền:
   - App name: `Thiện Nguyện`
   - User support email: email quản trị
   - Developer contact email: email quản trị
4. Save and Continue qua các bước Scopes, Test users → Save

## Bước 3 — Tạo OAuth Client ID

1. Menu trái → **APIs & Services → Credentials**
2. **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Thien Nguyen - Supabase` (tùy ý)
5. **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://<project-ref>.supabase.co
   ```
   (thay `<project-ref>` bằng ref project Supabase đang dùng — xem trong `.env.local` biến `NEXT_PUBLIC_SUPABASE_URL`, hoặc trên Supabase Dashboard khi vào production thì thêm domain thật vào đây)
6. **Authorized redirect URIs** — lấy đúng URL này từ Supabase Dashboard → Authentication → Providers → Google (mục "Callback URL"):
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
7. Bấm **Create** → copy lại **Client ID** và **Client Secret** (Secret chỉ hiện 1 lần)

## Bước 4 — Nhập vào Supabase

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → chọn đúng project → **Authentication → Providers → Google**
2. Bật **Enable Sign in with Google**
3. Dán **Client ID** và **Client Secret** vừa lấy ở Bước 3
4. **Save**

## Bước 5 — Bật lại nút trong code

Trong `src/components/auth-controls.tsx`, đổi:

```ts
const GOOGLE_LOGIN_ENABLED = false;
```

thành:

```ts
const GOOGLE_LOGIN_ENABLED = true;
```

## Bước 6 — Test lại

1. Chạy `npm run dev`, mở app, bấm "Tiếp tục với Google"
2. Phải redirect sang trang chọn tài khoản Google, sau khi chọn xong quay lại đúng `http://localhost:3000/auth/callback` và đăng nhập thành công
3. Kiểm tra `redirectTo` trong `handleGoogleLogin` (`src/components/auth-controls.tsx`) trỏ đúng route callback nếu có thay đổi domain

## Lưu ý khi deploy production

Khi lên domain thật (không phải `localhost:3000`), phải quay lại **Bước 3** để:
- Thêm domain production vào **Authorized JavaScript origins**
- Đảm bảo redirect URI trong Supabase Dashboard khớp với domain production (nếu dùng chung 1 project Supabase cho cả dev/prod, callback URL không đổi vì luôn trỏ về `*.supabase.co`, chỉ cần origin phía Google Console thêm domain mới)

Nếu quên bước này, sẽ gặp lại lỗi tương tự lỗi đã gặp trước khi ẩn nút:

```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```
