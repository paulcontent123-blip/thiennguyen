# DANH SÁCH ROLE & CHỨC NĂNG — ĐÃ ĐỒNG BỘ QUYẾT ĐỊNH TECH LEAD

> Nguồn: `ThienNguyen_TAILIEU_TONGHOP.md` và phản hồi Tech Lead ngày 18/09/2026. Tài liệu này là nguồn quyết định hiện hành cho role, onboarding tổ chức, giải ngân và cứu trợ. Các mô tả Maker–Checker hoặc đăng ký cứu trợ công khai trong tài liệu cũ được xem là lịch sử và không còn áp dụng cho MVP.

---

## 1. Quyết định đã chốt

1. Tổ chức không có các sub-role `org_owner`, `maker`, `checker` trong MVP.
2. Tài khoản `org` là tài khoản của người đại diện pháp luật của tổ chức.
3. Giải ngân chỉ cần người đại diện pháp luật nộp chứng từ, ký và approval; hệ thống/Admin thực hiện hậu kiểm và quản lý campaign.
4. Không có quy trình “duyệt lớp 2” và Admin không đóng vai Checker.
5. eKYC tổ chức được đơn giản hóa thành upload giấy phép hoạt động để Admin kiểm tra.
6. Cứu trợ là luồng riêng do Admin quản lý. Hồ sơ cứu trợ có thể được gửi từ giao diện riêng nhưng không tự kích hoạt tài khoản/quyền.
7. `rescue_team` được giữ như role kỹ thuật nội bộ để cấp cho hồ sơ đã được Admin duyệt; không xuất hiện trong đăng ký tài khoản công khai.

---

## 2. Role toàn hệ thống

### 2.1. `donor` — Cá nhân/Nhà hảo tâm

| Nhóm chức năng | Chi tiết |
|---|---|
| Quyên góp | Ủng hộ tiền qua VietQR và đóng góp nguồn lực phi tiền tệ |
| SOS | Phát tín hiệu SOS; không tự nhận quyền điều phối cứu trợ |
| Tài khoản | Xem lịch sử, tracking, biên nhận, impact và thông báo |
| Quyền đọc | Xem campaigns, organizations và báo cáo công khai |
| Không được | Tạo/duyệt campaign, duyệt KYC, hậu kiểm giải ngân, vào Admin Portal |

### 2.2. `org` — Người đại diện pháp luật của tổ chức

| Nhóm chức năng | Chi tiết |
|---|---|
| Onboarding | Đăng ký tài khoản tổ chức và upload giấy phép hoạt động |
| KYC | Chờ Admin duyệt giấy phép trước khi được tạo campaign |
| Campaign | Tạo, cập nhật, đề nghị đóng campaign; xem trạng thái hồ sơ của tổ chức |
| Giải ngân | Upload chứng từ; ký và approval với tư cách người đại diện pháp luật |
| Báo cáo | Xuất CSV/PDF/ESG ZIP theo campaign thuộc tổ chức |
| Không được | Tự duyệt KYC/campaign; thực hiện hậu kiểm; truy cập dữ liệu của tổ chức khác |

Trong MVP, `organizations.user_id` đại diện cho tài khoản người đại diện pháp luật. Chưa có luồng mời thành viên, chuyển giao owner hoặc gán sub-role nội bộ.

### 2.3. `rescue_team` — Tài khoản cứu trợ do Admin cấp

| Nhóm chức năng | Chi tiết |
|---|---|
| Gửi hồ sơ | Cá nhân/đội gửi hồ sơ qua luồng riêng; hồ sơ có trạng thái `pending_review` |
| Duyệt | Chỉ Admin xem, duyệt hoặc từ chối hồ sơ |
| Cấp tài khoản | Chỉ hồ sơ `approved` mới được cấp/kích hoạt role `rescue_team` |
| Vận hành | Nhận nhiệm vụ SOS do Admin điều phối; cập nhật `available/en-route/busy` khi được cấp quyền |
| Không được | Tự kích hoạt tài khoản; tự xem toàn bộ SOS; tự duyệt hồ sơ cứu trợ khác |

### 2.4. `admin` — Quản trị viên hệ thống

| Nhóm chức năng | Chi tiết |
|---|---|
| Tổ chức | Duyệt/từ chối/yêu cầu bổ sung giấy phép hoạt động |
| Campaign | Duyệt, tạm dừng, đóng hoặc yêu cầu giải trình campaign |
| Giải ngân | Hậu kiểm chứng từ và chữ ký/approval của người đại diện; đánh dấu hợp lệ, yêu cầu giải trình hoặc phát hiện vi phạm |
| Cứu trợ | Duyệt hồ sơ đội cứu trợ, cấp tài khoản, điều phối SOS và quản lý trạng thái đội |
| Bảo mật | Admin không có đăng ký công khai; route và API phải kiểm tra role ở server/middleware |

---

## 3. Các trạng thái và dữ liệu cần dùng

### 3.1. Tổ chức

```text
pending_license_review → verified
                       → needs_revision
                       → rejected
                       → suspended
```

Các trường tối thiểu:

```text
organizations
- id
- user_id
- name
- legal_representative_name
- license_document_url
- kyc_status
- verified_at
- verified_by
```

### 3.2. Giải ngân

```text
draft
→ representative_approved
→ published
→ pending_post_audit
→ post_audit_passed | needs_explanation | violation_detected
```

Các trường thay thế `maker_id/checker_id`:

```text
disbursements
- submitted_by
- representative_approved_at
- signature_reference
- evidence_urls
- post_audit_status
- post_audited_by
- post_audited_at
- post_audit_note
```

### 3.3. Hồ sơ cứu trợ

```text
submitted → pending_review → approved | needs_revision | rejected
```

Khuyến nghị tách `rescue_applications` khỏi `rescue_teams`. Chỉ sau khi application được duyệt mới tạo/kích hoạt tài khoản `rescue_team`.

---

## 4. Luồng nghiệp vụ đã chốt

### 4.1. Đăng ký tổ chức

```text
Chọn “Doanh nghiệp/Tổ chức”
→ tạo users(role = org)
→ tạo organizations(user_id = user vừa tạo)
→ upload giấy phép hoạt động
→ Admin duyệt
→ tổ chức được tạo campaign
```

Không hỏi người đăng ký là Owner/Maker/Checker và không tạo sub-role tại màn đăng ký.

### 4.2. Giải ngân và hậu kiểm

```text
Người đại diện upload chứng từ
→ ký/approval
→ hệ thống ghi nhận và công khai theo chính sách campaign
→ Admin hậu kiểm
→ hợp lệ | yêu cầu giải trình | phát hiện vi phạm
```

### 4.3. Đăng ký cứu trợ

```text
Gửi hồ sơ cứu trợ qua form riêng
→ pending_review
→ chỉ Admin nhìn thấy và xử lý
→ approved: cấp/kích hoạt tài khoản rescue_team
→ rejected/needs_revision: thông báo kết quả
```

Form công khai không được hiển thị “Vào đội điều phối” hoặc thông báo đã sẵn sàng ngay sau khi gửi.

---

## 5. Các điểm còn cần xác nhận

1. Chữ ký/approval của người đại diện dùng OTP, chữ ký điện tử, checkbox cam kết hay file ký số?
2. Hậu kiểm diễn ra trước hay sau khi giải ngân xuất hiện trên Cashflow công khai?
3. Tài khoản `rescue_team` do Admin tạo mới hay kích hoạt từ email/SĐT trong hồ sơ đã duyệt?
4. Một SOS được giao độc quyền cho một đội hay cho phép nhiều đội phối hợp?
5. Doanh nghiệp đồng hành có cần tài khoản/role riêng ở Phase 1 hay tiếp tục qua form liên hệ?
6. Một người có được đại diện cho nhiều tổ chức và cơ chế chuyển người đại diện là gì?
