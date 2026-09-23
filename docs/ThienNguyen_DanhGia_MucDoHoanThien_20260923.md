# ĐÁNH GIÁ MỨC ĐỘ HOÀN THIỆN DỰ ÁN — 23/09/2026

> Cập nhật so với bản đánh giá 22/09 — dự án đã tiến rất xa chỉ trong 1 ngày (nhiều khả năng có phiên làm việc khác chạy song song). Đánh giá này dựa trên đọc lại toàn bộ migration mới, code mới, và **kiểm thử trực tiếp bằng trình duyệt thật** trên campaign đang hoạt động thật.

---

## 0. Thay đổi lớn nhất kể từ hôm qua: Luồng Quyên góp đã có code thật

Đây là tin quan trọng nhất: **UC-DON (Quyên góp) không còn là 0%** như đánh giá hôm qua. Đã có:

- Bảng `transactions` (migration `202609220006_donation_intents.sql`) — đúng chuẩn: `tx_ref`, `status` (pending/completed/needs_review/failed/expired/refunded), snapshot đích nhận tiền bất biến.
- RPC `create_donation_intent()` chạy với `security definer` — **cố tình thiết kế để người gọi (kể cả donor) không tự chọn được tài khoản nhận tiền, tổ chức, hay trạng thái giao dịch** — đây là mức độ cẩn trọng bảo mật cao, đúng chuẩn production.
- **Quyết định nghiệp vụ mới đã chốt** (migration `202609230001_central_receiving_accounts.sql`, ghi rõ "Centralized donation receiving accounts confirmed by Tech Lead"): **VEA Group dùng đúng 1 tài khoản VND + 1 tài khoản quốc tế tập trung**, không phải mỗi tổ chức tự có tài khoản riêng như giả định trước đây. Đây là câu trả lời dứt điểm cho câu hỏi "ai nhận tiền" đã bàn nhiều lần trước đây — và là lựa chọn **dễ triển khai hơn nhiều** so với mô hình mỗi tổ chức 1 tài khoản.
- `DonationDialog` (UI) — chọn số tiền, xem trước phân bổ 90/10, tạo mã VietQR thật, hiển thị đầy đủ thông tin chuyển khoản, sao chép nhanh. **Trung thực tuyệt đối**: luôn ghi rõ "Hệ thống chỉ ghi nhận thành công sau khi webhook ngân hàng đối soát" — không giả vờ thành công.
- Admin Portal đã có panel **"Tài khoản nhận tiền"** để nhập thông tin tài khoản VND/quốc tế trung tâm.

### Đã tự tay test trên chiến dịch thật (`Hỗ trợ y tế trẻ em Hải Phòng`, đang `active`)

Kết quả: nút donate hiện **"♥ Hệ thống chưa mở tài khoản nhận VND"** (disabled) — vì Admin **chưa điền** form tài khoản nhận tiền trung tâm (bảng `platform_receiving_accounts` đang rỗng). Đây **không phải bug** — hệ thống tự phát hiện thiếu cấu hình và chặn donate lại đúng như thiết kế, thay vì cho tạo giao dịch rồi lỗi mù mờ sau.

**→ Chỉ cần Admin vào Admin Portal → "Tài khoản nhận tiền" → điền 1 tài khoản VietQR thật là toàn bộ luồng tạo mã QR + tạo giao dịch pending sẽ chạy được ngay.**

**Phần vẫn còn thiếu (đúng như comment trong migration tự ghi):** webhook nhận biến động số dư ngân hàng thật — "*Webhook authentication is intentionally outside this migration because the multi-tenant secret strategy still requires Tech Lead confirmation*". Nghĩa là: **tạo giao dịch chờ (pending) + hiện QR = xong**, nhưng **xác nhận đã thanh toán thật = chưa làm** — giao dịch sẽ mãi ở trạng thái "Chờ ngân hàng xác nhận", không có cách nào (kể cả thủ công) để chuyển sang "completed" ở thời điểm hiện tại.

---

## 1. Các nhóm tính năng khác cũng tiến triển đáng kể

| Nhóm | Hôm qua (22/09) | Hôm nay (23/09) |
|---|---|---|
| Quyên góp (VietQR) | 0% | ~70% — thiếu đúng 1 khâu: webhook xác nhận thanh toán |
| SOS công khai | 15% | Đã có `/sos` thật (build hôm qua), giữ nguyên |
| Đăng ký cứu trợ | có form nhưng "duyệt & kích hoạt" giới hạn | Nay có **luồng mời qua email thật** (`rescue/accept`, `activation-token.ts`, `sendRescueInvitationEmail`) — giải quyết đúng câu hỏi mở "hồ sơ ẩn danh thì kích hoạt sao" từng nêu trước đây |
| Chiến dịch cá nhân | Chỉ tổ chức mới tạo được chiến dịch | **Nay donor cũng tạo được** (`/personal-campaigns`), qua quy trình xác minh danh tính riêng (`personal_profiles`, lưu giấy tờ ở Storage bucket **riêng tư**, không public) |
| Khám phá | lọc Hạng mục + Loại | Nay có thêm lọc **Tỉnh/thành** + **Chủ sở hữu** (Tổ chức/Cá nhân) |

---

## 2. Vẫn còn 5 trang stub, chưa động tới

`grep ModulePage` xác nhận không đổi so với hôm qua:

- `/introduction`
- `/corporate`
- `/donate-items`
- `/docs`
- `/transparency`

---

## 3. Sức khỏe kỹ thuật

- `typecheck` sạch.
- 17/17 migration đã đồng bộ Supabase (`supabase migration list` xác nhận local = remote cho mọi dòng).
- Có `site-footer.tsx` mới — thêm rất nhiều link (Cổng quốc tế, Dashboard đóng cổng, Matching Fund...) — nhiều khả năng đang trỏ tới các trang **chưa tồn tại thật** (5 trang stub ở trên) — nên rà lại để tránh liên kết chết, nhưng chưa kiểm tra hết trong lượt này.
- Working tree đang có rất nhiều file `modified`/`untracked` chưa commit (`campaigns/[slug]/actions.ts`, `personal-campaigns/`, migration mới...) — nên commit sớm.

---

## 4. Khuyến nghị bước tiếp theo (cập nhật lại so với hôm qua)

1. **Điền tài khoản nhận tiền trung tâm trong Admin Portal** — việc 5 phút, mở khóa toàn bộ luồng donate ngay lập tức để demo/test tiếp.
2. **Quyết định + xây webhook ngân hàng** — đây giờ là mảnh ghép cuối cùng còn thiếu của luồng lõi, không còn là "chưa bắt đầu" mà là "còn 1 bước".
3. Kiểm tra lại `site-footer.tsx` xem có link nào trỏ tới trang chưa xây (`/corporate`, `/transparency`...) để tránh trải nghiệm bị gãy.
4. Commit toàn bộ thay đổi đang dang dở.

---

*Đánh giá dựa trên đọc code + migration + kiểm thử trực tiếp bằng trình duyệt trên dữ liệu thật, không suy đoán.*
