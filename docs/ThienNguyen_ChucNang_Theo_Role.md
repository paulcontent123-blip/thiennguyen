# CHỨC NĂNG THEO ROLE — NỀN TẢNG THIỆN NGUYỆN

> Cập nhật ngày 25/09/2026. Tài liệu mô tả quyền và chức năng đang được triển khai trong dự án.

## 1. Mô hình phân quyền

Hệ thống có 4 role được lưu trong tài khoản:

| Role | Tên nghiệp vụ | Cách cấp tài khoản |
|---|---|---|
| `donor` | Cá nhân/Nhà hảo tâm | Đăng ký công khai |
| `org` | Tổ chức/Người đại diện pháp luật | Đăng ký công khai và chờ duyệt giấy phép |
| `rescue_team` | Đội cứu trợ | Admin tạo hoặc gửi lời mời qua email |
| `admin` | Quản trị viên | Cấp nội bộ, không đăng ký công khai |

Ngoài 4 role trên, hệ thống có **Guest** là người chưa đăng nhập. Guest không phải role được lưu trong database.

Các điểm đã chốt:

- Không sử dụng các sub-role `org_owner`, `maker`, `checker` trong MVP.
- Tài khoản `org` đại diện cho tổ chức và người đại diện pháp luật.
- Đội cứu trợ là luồng riêng do Admin quản lý, không tự đăng ký role công khai.
- Doanh nghiệp đồng hành chưa phải một role riêng; hiện sử dụng form yêu cầu hợp tác.
- Xác thực người dùng sử dụng email/mật khẩu, Google SSO và email đặt lại mật khẩu; không dùng OTP số điện thoại trong MVP.

---

## 2. Guest — Người chưa đăng nhập

### 2.1. Chức năng được phép

- Xem trang chủ và các thống kê công khai.
- Xem, tìm kiếm và lọc danh sách chiến dịch.
- Xem chi tiết chiến dịch đang được công khai.
- Xem hồ sơ công khai của tổ chức.
- Xem Cashflow Tree, cập nhật thực địa, media và báo cáo công khai.
- Xem wishlist nguồn lực đã được Admin duyệt.
- Tạo yêu cầu quyên góp tiền không bắt buộc đăng nhập.
- Gửi báo cáo SOS ẩn danh.
- Gửi yêu cầu hợp tác doanh nghiệp.
- Đăng ký tài khoản cá nhân hoặc tổ chức.
- Đăng nhập bằng email/mật khẩu hoặc Google SSO khi provider đã được cấu hình.
- Yêu cầu gửi email đặt lại mật khẩu.

### 2.2. Chức năng không được phép

- Tạo hoặc quản lý chiến dịch.
- Theo dõi chiến dịch.
- Quản lý ví.
- Đăng nguồn lực hoặc đăng ký đóng góp nguồn lực.
- Truy cập cổng tổ chức, cổng cứu trợ hoặc Admin Portal.

---

## 3. `donor` — Cá nhân/Nhà hảo tâm

### 3.1. Tài khoản

- Đăng nhập và đăng xuất.
- Xem và cập nhật hồ sơ cá nhân.
- Đặt lại mật khẩu qua email.
- Xem lịch sử quyên góp và hoạt động cá nhân.
- Theo dõi hoặc bỏ theo dõi chiến dịch.

### 3.2. Quyên góp tiền

- Chọn chiến dịch và tạo yêu cầu quyên góp.
- Nhận mã tham chiếu giao dịch.
- Theo dõi trạng thái chờ xác nhận, hoàn thành hoặc cần kiểm tra.
- Xem và tải biên nhận PDF khi giao dịch đã hoàn thành.
- Nhận biên nhận qua email nếu dịch vụ email hoạt động.

### 3.3. Ví cá nhân

- Tạo yêu cầu nạp ví.
- Xem số dư hiện tại.
- Xem lịch sử bút toán ví.
- Chọn chiến dịch để phân bổ số dư.
- Không được phân bổ vượt quá số dư khả dụng.
- Nhận lại số dư khi Admin hoàn tác một phân bổ thất bại.

### 3.4. Chiến dịch cá nhân

- Gửi hồ sơ xác minh chủ chiến dịch cá nhân.
- Upload tài liệu xác minh.
- Theo dõi trạng thái hồ sơ: `pending`, `needs_revision`, `approved`, `rejected`.
- Tạo chiến dịch cá nhân sau khi hồ sơ được duyệt.
- Chỉnh sửa chiến dịch ở trạng thái `draft` hoặc `needs_revision`.
- Gửi chiến dịch cho Admin xét duyệt.
- Xem chi tiết và lịch sử trạng thái chiến dịch của mình.

### 3.5. Nguồn lực phi tiền tệ

- Đăng vật phẩm, kỹ năng hoặc phương tiện đang có.
- Chỉnh sửa hoặc hủy nguồn lực khi chưa hoàn tất bàn giao.
- Chọn nhu cầu công khai trong wishlist để đăng ký đóng góp.
- Khai báo số lượng, thời gian và địa điểm có thể bàn giao.
- Theo dõi trạng thái đăng ký và kết quả matching.
- Hủy đăng ký khi chưa được hoàn tất.

### 3.6. SOS

- Gửi báo cáo SOS bằng tài khoản cá nhân.
- Xem thông tin SOS công khai theo phạm vi hệ thống cho phép.
- Không được tự điều phối đội cứu trợ.

### 3.7. Giới hạn quyền

- Không được duyệt hồ sơ xác minh.
- Không được duyệt hoặc kích hoạt chiến dịch.
- Không được xác nhận giao dịch ngân hàng.
- Không được xác minh kết quả matching nguồn lực.
- Không được truy cập Admin Portal.

---

## 4. `org` — Tổ chức/Người đại diện pháp luật

### 4.1. Hồ sơ tổ chức

- Đăng ký tài khoản tổ chức.
- Cập nhật thông tin pháp lý và thông tin liên hệ.
- Quản lý thông tin người đại diện pháp luật.
- Upload ảnh đại diện lên Cloudinary.
- Upload giấy phép PDF, JPG, PNG hoặc WebP.
- Gửi hồ sơ eKYC cho Admin xét duyệt.
- Theo dõi trạng thái hồ sơ: `pending`, `needs_revision`, `approved`, `rejected`.
- Bổ sung hồ sơ khi Admin yêu cầu chỉnh sửa.

### 4.2. Quản lý chiến dịch

- Tạo chiến dịch sau khi tổ chức được duyệt.
- Xem danh sách chiến dịch của tổ chức có phân trang.
- Xem chi tiết, lịch sử trạng thái và giao dịch của từng chiến dịch.
- Chỉnh sửa chiến dịch ở các trạng thái được phép.
- Gửi chiến dịch cho Admin xét duyệt.
- Xem lý do yêu cầu chỉnh sửa hoặc từ chối.
- Đề nghị đóng chiến dịch; quyết định đóng chính thức thuộc Admin.

### 4.3. Nội dung công khai của chiến dịch

- Upload, cập nhật và xóa ảnh cover hoặc media.
- Đánh dấu media được phép công khai.
- Tạo, cập nhật và xóa nhật ký thực địa.
- Thêm liên kết video dọc 9:16.
- Cấu hình nội dung chia sẻ và Viral Kit.
- Sinh poster chiến dịch.
- Cập nhật nội dung SEO và Schema.org.

### 4.4. Nhu cầu nguồn lực

- Tạo nhu cầu vật phẩm, kỹ năng hoặc phương tiện cho chiến dịch.
- Cập nhật hoặc đóng nhu cầu.
- Gửi nhu cầu để Admin kiểm duyệt trước khi công khai.
- Xem các đăng ký đóng góp và đề xuất matching.
- Phối hợp bàn giao với người đóng góp.
- Theo dõi kết quả bàn giao đã được Admin xác minh.

### 4.5. Giải ngân

- Tạo khoản giải ngân cho chiến dịch thuộc tổ chức.
- Upload hóa đơn và chứng từ.
- Gửi hồ sơ giải ngân.
- Xác nhận chữ ký/approval của người đại diện pháp luật.
- Gửi hồ sơ để Admin hậu kiểm.
- Xem kết quả hậu kiểm.
- Bổ sung giải trình khi Admin yêu cầu.
- Theo dõi khoản chi đã được công khai trên Cashflow Tree.

### 4.6. Tất toán và báo cáo

- Xem dashboard tất toán chiến dịch.
- Xem tổng tiền nhận, tổng tiền đã giải ngân và số dư.
- Xem báo cáo theo chiến dịch.
- Xem báo cáo quý và báo cáo 6 tháng.

### 4.7. Giới hạn quyền

- Không được tự duyệt hồ sơ pháp lý của mình.
- Không được tự duyệt, kích hoạt hoặc đóng chính thức chiến dịch.
- Không được tự xác nhận giao dịch ngân hàng.
- Không được tự kết luận hậu kiểm khoản giải ngân.
- Không được quản lý tài khoản đội cứu trợ.
- Không được truy cập dữ liệu riêng của tổ chức khác.

---

## 5. `rescue_team` — Đội cứu trợ

### 5.1. Kích hoạt tài khoản

- Nhận lời mời do Admin gửi qua email.
- Mở trang kích hoạt bằng token riêng của hệ thống.
- Xác nhận lời mời và đặt mật khẩu.
- Đăng nhập sau khi tài khoản được kích hoạt.

### 5.2. Hồ sơ hoạt động

- Xem thông tin đội cứu trợ.
- Cập nhật trạng thái hoạt động: `inactive`, `available`, `en_route`, `busy`.
- Cập nhật vị trí hiện tại.
- Cập nhật bán kính và loại nguồn lực có thể hỗ trợ khi hệ thống cho phép.

### 5.3. Điều phối SOS

- Nhận cảnh báo SOS do Admin/hệ thống gửi đến.
- Xem thông tin cần thiết của nhiệm vụ được giao.
- Xác nhận đã nhận cảnh báo.
- Báo đang di chuyển đến hiện trường.
- Báo đã đến hiện trường.
- Báo hoàn thành nhiệm vụ.
- Báo không thể hỗ trợ và ghi nhận lý do.
- Cập nhật tiến độ để Admin theo dõi.

### 5.4. Giới hạn quyền

- Không được tự đăng ký role `rescue_team` qua màn hình đăng ký công khai.
- Không được tự kích hoạt tài khoản nếu chưa có lời mời hợp lệ.
- Không được xem toàn bộ báo cáo SOS ngoài phạm vi được phân công.
- Không được duyệt hồ sơ đội cứu trợ khác.
- Không được tự tạo chiến dịch khẩn cấp từ SOS.
- Không được truy cập Admin Portal.

---

## 6. `admin` — Quản trị viên

### 6.1. Quản lý tài khoản và phân quyền

- Đăng nhập vào Admin Portal.
- Xem các dữ liệu quản trị theo phạm vi nghiệp vụ.
- Tạo hoặc gửi lời mời tài khoản đội cứu trợ.
- Thu hồi và xóa lời mời chưa hoàn tất.
- Xóa đội cứu trợ chưa kích hoạt khi thỏa điều kiện.
- Duyệt hoặc từ chối hồ sơ đăng ký đội cứu trợ.

### 6.2. Kiểm duyệt tổ chức và cá nhân

- Duyệt hồ sơ pháp lý của tổ chức.
- Yêu cầu tổ chức bổ sung hồ sơ.
- Từ chối hồ sơ tổ chức.
- Duyệt hồ sơ xác minh chủ chiến dịch cá nhân.
- Yêu cầu cá nhân bổ sung hồ sơ.
- Từ chối hồ sơ xác minh cá nhân.

### 6.3. Kiểm duyệt chiến dịch

- Xem chiến dịch đang chờ duyệt.
- Duyệt chiến dịch.
- Yêu cầu chỉnh sửa và ghi lý do.
- Từ chối chiến dịch và ghi lý do.
- Kích hoạt chiến dịch đã được duyệt.
- Đóng chiến dịch.
- Xem lịch sử trạng thái, người thao tác và thời gian thao tác.

### 6.4. Giao dịch ngân hàng và biên nhận

- Xem giao dịch đang chờ đối soát.
- Xác nhận giao dịch hoàn thành.
- Đưa giao dịch sang trạng thái cần kiểm tra.
- Quản lý tài khoản ngân hàng nhận tiền VND và ngoại tệ của nền tảng.
- Theo dõi trạng thái gửi biên nhận.
- Gửi lại biên nhận khi email thất bại.

### 6.5. Ví

- Xem yêu cầu nạp ví.
- Đối soát và xác nhận nạp ví.
- Từ chối yêu cầu nạp ví không hợp lệ.
- Xem bút toán ví.
- Hoàn tác phân bổ tiền vào chiến dịch khi cần.

### 6.6. Giải ngân và hậu kiểm

- Xem hồ sơ giải ngân đã được người đại diện pháp luật xác nhận.
- Đánh dấu hồ sơ hợp lệ.
- Yêu cầu tổ chức giải trình.
- Ghi nhận vi phạm.
- Xem lại hồ sơ sau khi tổ chức bổ sung giải trình.
- Cho phép công khai khoản chi hợp lệ trên Cashflow Tree.

### 6.7. Quản lý nguồn lực

- Xem nhu cầu nguồn lực đang chờ duyệt.
- Duyệt hoặc từ chối nhu cầu trước khi công khai.
- Xem các đăng ký đóng góp nguồn lực.
- Kiểm tra đề xuất matching.
- Xác nhận hoặc điều chỉnh kết quả matching.
- Xác minh số lượng thực tế đã bàn giao.
- Đánh dấu bàn giao thành công, thất bại hoặc bị hủy.
- Cập nhật tiến độ nhu cầu công khai.

### 6.8. Quản lý SOS và cứu trợ

- Duyệt báo cáo SOS ẩn danh.
- Phân loại khẩn cấp, cần hỗ trợ hoặc từ chối.
- Tìm và cảnh báo đội cứu trợ/tình nguyện viên gần nhất.
- Điều phối đội cứu trợ.
- Điều phối phương tiện vận chuyển.
- Theo dõi phản hồi và tiến độ xử lý tại hiện trường.
- Đánh dấu SOS đã được xử lý.
- Đóng SOS.
- Tạo chiến dịch khẩn cấp từ một báo cáo SOS.

### 6.9. Hợp tác doanh nghiệp và báo cáo

- Xem yêu cầu hợp tác doanh nghiệp.
- Cập nhật trạng thái `new`, `contacted`, `closed`.
- Xem dashboard quản trị.
- Xem dashboard tất toán chiến dịch.
- Xem báo cáo chiến dịch, báo cáo quý và báo cáo 6 tháng.

### 6.10. Yêu cầu bảo mật

- Mọi Server Action quản trị phải kiểm tra role ở phía server.
- Không chỉ dựa vào việc ẩn nút trên giao diện.
- API dùng Service Role Key chỉ được chạy phía server.
- Không đưa Service Role Key xuống trình duyệt.
- Các thao tác duyệt phải lưu người thực hiện, thời gian và lý do khi có.

---

## 7. Ma trận quyền tổng quát

| Chức năng | Guest | Donor | Org | Rescue team | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Xem chiến dịch công khai | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quyên góp tiền | ✓ | ✓ | ✓ | — | ✓ |
| Theo dõi chiến dịch | — | ✓ | ✓ | — | ✓ |
| Quản lý ví | — | ✓ | ✓ | — | ✓ |
| Tạo chiến dịch cá nhân | — | ✓ | — | — | — |
| Tạo chiến dịch tổ chức | — | — | ✓ | — | — |
| Duyệt chiến dịch | — | — | — | — | ✓ |
| Quản lý nội dung chiến dịch sở hữu | — | ✓ | ✓ | — | ✓ |
| Tạo nhu cầu nguồn lực | — | — | ✓ | — | ✓ |
| Đăng ký đóng góp nguồn lực | — | ✓ | ✓ | — | ✓ |
| Duyệt/matching nguồn lực | — | — | — | — | ✓ |
| Gửi SOS | ✓ | ✓ | ✓ | — | ✓ |
| Nhận nhiệm vụ cứu trợ | — | — | — | ✓ | ✓ |
| Điều phối cứu trợ | — | — | — | — | ✓ |
| Tạo hồ sơ giải ngân | — | — | ✓ | — | — |
| Hậu kiểm giải ngân | — | — | — | — | ✓ |
| Xem báo cáo công khai | ✓ | ✓ | ✓ | ✓ | ✓ |
| Truy cập Admin Portal | — | — | — | — | ✓ |

Ghi chú:

- Dấu `✓` thể hiện role được tham gia chức năng; quyền thao tác chi tiết vẫn phụ thuộc trạng thái đối tượng và quyền sở hữu.
- Dấu `—` thể hiện role không được phép thực hiện trực tiếp.
- Admin có quyền kiểm duyệt và hậu kiểm, nhưng không thay thế quyền sở hữu nội dung của cá nhân hoặc tổ chức trong các thao tác thông thường.

---

## 8. Điều hướng sau đăng nhập

| Role | Trang chính |
|---|---|
| `donor` | Trang chủ hoặc khu vực tài khoản cá nhân |
| `org` | `/organization` |
| `rescue_team` | `/rescue/operations` |
| `admin` | `/admin` |

Việc chuyển hướng chỉ hỗ trợ trải nghiệm người dùng. Quyền truy cập thực tế phải tiếp tục được kiểm tra ở middleware, Server Component, Server Action, API route và chính sách RLS của Supabase.
