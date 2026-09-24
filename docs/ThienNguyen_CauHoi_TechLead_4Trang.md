# Câu hỏi kỹ thuật cho Tech Lead — 4 trang công khai

Dự án: **Thiện Nguyện** · Stack: Next.js 14 (App Router), Supabase (Postgres, RLS, Storage), Cloudinary, Resend · Các trang: Giới thiệu, Đồng hành cùng quỹ (`/corporate`), Minh bạch (`/transparency`), Nguồn lực (`/donate-items`)

## Hiện trạng để tham chiếu

| Trang | Trạng thái code |
|---|---|
| `/introduction` | Đã dựng. Thống kê lấy từ RPC `get_homepage_stats()`. Đội ngũ, đối tác, điều khoản là nội dung tĩnh hoặc chưa có |
| `/corporate` | Đã dựng: form tư vấn lưu bảng `corporate_inquiries`, danh sách chiến dịch cần hỗ trợ lấy từ `campaigns`, Matching Fund chỉ là công cụ mô phỏng phía client |
| `/transparency` | Chỉ là khung giữ chỗ (`ModulePage`) |
| `/donate-items` | Chỉ là khung giữ chỗ (`ModulePage`) |

Ràng buộc đã có: RBAC 4 role (`donor`, `org`, `rescue_team`, `admin`) lưu ở `profiles.role`, không có sub-role; RLS kèm guard trigger trên các bảng nhạy cảm; migration chỉ thêm mới, không sửa file cũ; chưa có webhook ngân hàng (giao dịch `completed` do Admin đối soát thủ công).

Câu có dấu **★** là câu chặn thiết kế, cần chốt trước. Mỗi câu có **Đề xuất** và ô **Quyết định**.

---

## 1. Trang Giới thiệu

### 1.1 Nội dung đội ngũ, đối tác, điều khoản
Hiện là nội dung tĩnh trong code hoặc chưa có.
- Đặt trong code/config hay tạo bảng `team_members`, `partners` để Admin quản lý? Nếu là bảng: cần trường đồng ý hiển thị và ảnh lưu ở đâu?
- **Đề xuất:** cấu hình tĩnh trong repo cho bản đầu (dữ liệu ít, thay đổi hiếm), chỉ chuyển sang bảng khi Admin cần tự sửa.
- **Quyết định:** ______

### 1.2 Cách đếm "nhà hảo tâm"
Migration `202609240002` thêm `donor_count` vào `get_homepage_stats()`: đếm distinct `coalesce(user_id::text, lower(receipt_email))` trên giao dịch `completed` của chiến dịch công khai.
- Chấp nhận định danh người chưa đăng nhập theo email chuẩn hoá không? Có cần chống trùng khi một người dùng nhiều email?
- **Quyết định:** ______

### 1.3 Form doanh nghiệp: chống spam và lưu trữ
Insert công khai vào `corporate_inquiries` cho `anon` và `authenticated` (RLS chỉ cho `status='new'`), có ô ẩn honeypot. Email thông báo chỉ gửi khi có `CORPORATE_INQUIRY_TO_EMAIL`.
- ★ Cần CAPTCHA (ví dụ Turnstile) và giới hạn tần suất theo IP/email không?
- Thời hạn lưu dữ liệu tối đa? Có cần xoá theo yêu cầu (Nghị định 13)?
- **Đề xuất:** thêm Turnstile và giới hạn tần suất trước khi mở rộng truyền thông.
- **Quyết định:** ______

### 1.4 Tệp Media Kit và tài liệu PDF
- Lưu ở `public/`, Cloudinary hay Supabase Storage? Có cần theo dõi lượt tải không?
- **Quyết định:** ______

---

## 2. Trang Đồng hành cùng quỹ

### 2.1 ★ Vai trò doanh nghiệp
- Doanh nghiệp là role thứ 5 (`corporate`), hay dùng lại `org`/`donor`? Một tài khoản doanh nghiệp có nhiều nhân viên không (hiện đã bỏ sub-role)?
- **Đề xuất:** chưa tạo role mới; tách bảng `companies` và liên kết với tài khoản khi cần, chốt sau khi Admin xác nhận hình thức nào được vận hành thật.
- **Quyết định:** ______

### 2.2 ★ Gắn giao dịch với doanh nghiệp
Để tính Matching Fund và báo cáo ESG cần biết giao dịch thuộc doanh nghiệp/chương trình nào.
- Thêm `company_id` (nullable) và mã chương trình vào `transactions` không? Nhân viên đóng góp bằng link hoặc mã công ty ra sao? Lưu ý `create_donation_intent()` là `security definer`, phải cập nhật hàm này (client không được tự chọn đích hay trạng thái).
- **Quyết định:** ______

### 2.3 Matching Fund thật
- Tính đối ứng tại thời điểm giao dịch chuyển `completed` (trigger) hay chạy theo lô? Lưu cam kết ở bảng `match_commitments` riêng hay ghi giao dịch đối ứng vào `transactions`?
- Cần đảm bảo idempotency và không cộng đôi vào "tổng tiền đã kết nối".
- **Đề xuất:** bảng cam kết riêng, tính động khi hiển thị, không tạo giao dịch ảo.
- **Quyết định:** ______

### 2.4 Bảng đóng góp phi tiền tệ
- Dùng chung mô hình với trang Nguồn lực (xem 4.1)? Nếu tách riêng sẽ có hai luồng trùng nhau.
- **Đề xuất:** dùng chung một bảng `resource_offers`, đánh dấu nguồn từ doanh nghiệp.
- **Quyết định:** ______

### 2.5 Xuất ESG ZIP và PDF
Dự án chưa có thư viện tạo PDF (hàm `sendDonationReceiptEmail` đã có nhưng chưa dùng vì thiếu).
- Chọn thư viện và nơi chạy? Cần hàng đợi tác vụ (giới hạn thời gian chạy của hosting) không? Gom chứng từ từ Cloudinary và Supabase Storage thế nào?
- **Quyết định:** ______

### 2.6 Chọn công trình cho doanh nghiệp
Danh sách hiện lấy tối đa 12 chiến dịch `active` mới nhất, tính % từ RPC `get_campaign_donation_summary()` cho từng chiến dịch (N+1 lời gọi), sắp theo % thấp nhất, lấy 3.
- Thêm cờ `seeking_sponsor` trên `campaigns` không? Cần tổng hợp một lần (view/RPC) để tránh N+1 khi số chiến dịch lớn không?
- **Quyết định:** ______

---

## 3. Trang Minh bạch

### 3.1 ★ Snapshot bất biến và hash
Demo nêu sao kê/báo cáo được niêm phong SHA-256.
- Lưu báo cáo ở bảng `financial_reports` bất biến (kèm trigger chặn UPDATE/DELETE) hay tính động mỗi lần xem? Hash tính trên tệp CSV chuẩn hoá nào, lưu hash ở đâu để bên ngoài kiểm chứng được?
- **Đề xuất:** snapshot khi chốt kỳ; hash SHA-256 của CSV chuẩn hoá lưu cùng bản ghi và hiển thị công khai.
- **Quyết định:** ______

### 3.2 ★ Ai đã đối soát giao dịch
`confirmDonationReceived` hiện chỉ ghi `status='completed'` và `completed_at`, **không lưu người xác nhận**. Vì `completed` đang do đối soát thủ công, báo cáo minh bạch nên nêu rõ và truy vết được người xác nhận.
- Thêm `reconciled_by`, `reconciliation_method` (`manual`/`webhook`) và bảng nhật ký kiểm toán không? Guard trigger `guard_transaction_reconciliation_fields` hiện chặn sửa các trường snapshot (số tiền, tài khoản nhận, nội dung chuyển khoản, người dùng, chiến dịch…) và chỉ cho đổi `status` khi giao dịch đang `pending`; cột mới sẽ cần đưa vào danh sách này.
- **Đề xuất:** thêm hai cột trên và cập nhật guard trigger.
- **Quyết định:** ______

### 3.3 Nguồn số liệu công khai
- Dùng RPC `security definer` tổng hợp (giống `get_homepage_stats`) hay view? Có cần materialized view và cache khi dữ liệu lớn? Không được để lộ dòng giao dịch cho `anon`.
- **Quyết định:** ______

### 3.4 Múi giờ và năm tài chính
- Cắt kỳ quý/bán niên/năm theo UTC hay UTC+7? Năm tài chính là năm dương lịch?
- **Đề xuất:** UTC+7, năm dương lịch.
- **Quyết định:** ______

### 3.5 Dữ liệu người thụ hưởng
Demo có tab "Người thụ hưởng" với xác thực 3 lớp.
- Nếu làm: bảng riêng, RLS, hàm che dữ liệu (masking), giấy tờ UBND lưu ở bucket riêng tư (giống `personal-verification`)? Hay hoãn cho đến khi Admin chốt quy trình pháp lý?
- **Đề xuất:** hoãn.
- **Quyết định:** ______

### 3.6 Xuất PDF và CSV
- Thư viện và giới hạn kích thước/thời gian chạy trên hạ tầng deploy? Xuất phía server dạng stream?
- **Quyết định:** ______

### 3.7 Báo cáo theo chiến dịch đóng cổng
Chiến dịch đã có trạng thái `closed` và nhật ký `campaign_status_history`.
- Báo cáo đóng cổng tổng hợp từ `disbursements` và giao dịch tại thời điểm đóng, hay do tổ chức nộp thêm? Cần snapshot khi chuyển sang `closed` không?
- **Quyết định:** ______

---

## 4. Trang Nguồn lực

### 4.1 ★ Mô hình dữ liệu
Đề xuất ban đầu:
- `resource_offers` (loại: `item`/`skill`/`transport`, mô tả, số lượng, tỉnh/khu vực, toạ độ tuỳ chọn, người đăng, trạng thái),
- `resource_wishlist` (vật phẩm cần nhận, gắn chiến dịch/tổ chức),
- `resource_claims` (ai nhận/ghép, trạng thái).

Luồng trạng thái: `offered` → `matched` → `delivered` → `verified`. Trạng thái chuyển bằng RPC `security definer` hoặc guard trigger, giống cách đã làm cho `transactions`.
- Có đồng ý cấu trúc này không? Dùng cột enum cố định cho từng loại hay `jsonb` cho thuộc tính riêng (số ngày công, số chuyến)?
- **Quyết định:** ______

### 4.2 ★ Danh mục và liên hệ với phần cứu trợ
Hiện có `RESCUE_RESOURCE_TYPES` (đội cứu trợ), `SOS_NEEDS` (báo cáo SOS), và demo có danh mục hiện vật/kỹ năng/xe riêng.
- Hợp nhất thành một danh mục dùng chung không? Xe vận chuyển có gắn với `rescue_teams` (đã có `resource_types`, `latitude`, `longitude`, `radius_km`) không?
- **Đề xuất:** một danh mục chung, xe vận chuyển liên kết tuỳ chọn với đội cứu trợ.
- **Quyết định:** ______

### 4.3 RBAC và bảo mật thông tin liên hệ
- Ai được đăng đề nghị (bắt buộc đăng nhập giống SOS)? Ai được claim (org, rescue_team, admin)? RLS cần ẩn số điện thoại và email nhà cung cấp cho đến khi ghép xong.
- **Đề xuất:** bắt buộc đăng nhập; liên hệ chỉ lộ cho bên đã claim và Admin.
- **Quyết định:** ______

### 4.4 Giá trị quy đổi VND
- Bảng đơn giá `item_price_catalog` do Admin quản lý? Giá tại thời điểm ghi nhận lưu snapshot bất biến (giống snapshot tài khoản nhận trong `transactions`)? Không cộng vào `total_received_vnd`.
- **Quyết định:** ______

### 4.5 ★ Ví người dùng
Demo có "Nạp ví". Nếu Admin xác nhận muốn làm, cần sổ cái ghi kép (ledger), đối soát và có thể vướng quy định ví điện tử.
- **Đề xuất:** không làm trong bản đầu.
- **Quyết định:** ______

### 4.6 Ghép theo địa lý
- Tính khoảng cách bằng công thức Haversine trên `latitude`/`longitude` và `radius_km` sẵn có, hay bật PostGIS (kèm chỉ mục không gian)? Quy mô dữ liệu dự kiến bao nhiêu?
- **Đề xuất:** Haversine ở giai đoạn đầu.
- **Quyết định:** ______

### 4.7 Thông báo
- Gửi email khi có người claim hoặc khi trạng thái đổi? Dùng lại `src/lib/email/notifications.ts` và Resend với `idempotencyKey`?
- **Quyết định:** ______

---

## Tóm tắt các câu ★ cần chốt trước

| Trang | Câu |
|---|---|
| Giới thiệu | 1.3 CAPTCHA và giới hạn tần suất |
| Doanh nghiệp | 2.1 Vai trò doanh nghiệp · 2.2 Gắn giao dịch với doanh nghiệp |
| Minh bạch | 3.1 Snapshot và hash · 3.2 Truy vết người đối soát |
| Nguồn lực | 4.1 Mô hình dữ liệu · 4.2 Danh mục chung · 4.5 Ví |
