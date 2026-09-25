# Google Search Console, GA4 và sitemap

## Biến môi trường production

Thiết lập trên hosting production, không đưa secret vào biến `NEXT_PUBLIC_*` trừ GA Measurement ID vốn là public:

```env
NEXT_PUBLIC_APP_URL=https://thiennguyen.com.vn
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
GOOGLE_SITE_VERIFICATION=ma-xac-minh-google
```

Sau khi đổi biến môi trường, build/deploy lại ứng dụng.

## Google Search Console

1. Thêm property cho `https://thiennguyen.com.vn` trong Google Search Console.
2. Nếu xác minh bằng HTML tag, sao chép đúng giá trị `content` của thẻ `google-site-verification` vào `GOOGLE_SITE_VERIFICATION`.
3. Deploy, mở mã nguồn trang chủ và xác nhận thẻ `google-site-verification` xuất hiện trong `<head>`, rồi bấm Verify trong Search Console.
4. Cũng có thể xác minh Domain property bằng DNS TXT tại nhà cung cấp tên miền; cách DNS này không cần biến `GOOGLE_SITE_VERIFICATION`.
5. Mở **Sitemaps**, gửi `https://thiennguyen.com.vn/sitemap.xml`.

Trang sitemap được sinh từ các route công khai, chiến dịch đã công khai và bài tin tức đã xuất bản. `robots.txt` công khai đường dẫn sitemap và chặn các trang quản trị/tài khoản.

## Google Analytics 4

1. Tạo GA4 property và một Web data stream cho domain production.
2. Sao chép Measurement ID dạng `G-...` vào `NEXT_PUBLIC_GA4_ID`.
3. Deploy và mở trang công khai. Page view được gửi khi tải trang và khi điều hướng giữa các route trong ứng dụng.
4. Xác nhận dữ liệu trong Realtime/DebugView của GA4; trình chặn quảng cáo hoặc trình duyệt có bảo vệ theo dõi có thể chặn request.

Để tắt GA4, xóa `NEXT_PUBLIC_GA4_ID` rồi deploy lại. Không đặt Measurement ID development vào môi trường production.
