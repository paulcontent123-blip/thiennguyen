# Câu hỏi chốt nghiệp vụ cho Admin — 4 trang công khai

Dự án: **Thiện Nguyện** (VEA Group) · Các trang: Giới thiệu, Đồng hành cùng quỹ (Doanh nghiệp), Minh bạch, Nguồn lực

## Cách dùng tài liệu

- Các câu hỏi dưới đây xuất phát từ bản demo `thiennguyen_v2_1.html`. Nhiều nội dung trong demo là số liệu và cam kết minh hoạ, chưa thể đưa lên trang thật nếu chưa có xác nhận của bạn.
- Câu có dấu **★** là câu chặn tiến độ, cần trả lời trước.
- Mỗi câu có mục **Đề xuất** (hướng nhóm phát triển sẽ làm nếu bạn không có ý kiến khác) và ô **Trả lời** để bạn điền.
- Trả lời ngắn gọn là đủ, ví dụ: "Đồng ý đề xuất", "Không làm", hoặc ghi rõ phương án khác.

---

## 1. Trang Giới thiệu

### 1.1 ★ Thông tin liên hệ công khai
Trang đang hiển thị email `partner@thiennguyen.com.vn` (địa chỉ do nhóm phát triển tự đặt theo demo, chưa xác nhận có tồn tại), địa chỉ "Tòa nhà VEA Group", website. Demo còn có hotline "1800 xxxx" (chỗ giữ chỗ) nên đã bị bỏ.
- Email, hotline, địa chỉ chính thức để công khai là gì? Ai nhận và xử lý hộp thư này?
- **Đề xuất:** dùng một hộp thư dùng chung do Admin quản lý; chưa hiển thị hotline nếu chưa có.
- **Trả lời:** ______

### 1.2 ★ Đội ngũ
Demo có 4 nhân vật (CEO, CTO, Giám đốc Vận hành, Giám đốc Pháp lý) với lý lịch cụ thể — đây là nội dung minh hoạ, không phải người thật, nên trang thật hiện **không có** mục Đội ngũ.
- Có công khai đội ngũ không? Nếu có: họ tên, chức danh, ảnh, mô tả ngắn của từng người, và họ đã đồng ý hiển thị chưa?
- **Đề xuất:** chỉ đăng khi từng người đồng ý bằng văn bản; nếu chưa có thì giữ nguyên là chưa hiển thị.
- **Trả lời:** ______

### 1.3 ★ Đối tác
Demo liệt kê Vietcombank, Bệnh viện Bạch Mai, Hội Chữ thập đỏ VN, UNICEF Việt Nam, Tổng cục Thuế, VAVA là "đối tác chiến lược" kèm mô tả tích hợp. Đưa tên các tổ chức thật lên khi chưa có thoả thuận có thể gây hiểu nhầm về mối quan hệ.
- Tổ chức nào đã ký thoả thuận hoặc đồng ý hiển thị tên và logo?
- Trang chủ hiện còn dải "Đối tác đồng hành" ghi 4 tên tổ chức thật (Bệnh viện Bạch Mai, Vietcombank, Hội Chữ thập đỏ VN, UNICEF Việt Nam). Giữ hay gỡ?
- **Đề xuất:** gỡ dải này trên trang chủ cho đến khi có xác nhận từng đối tác.
- **Trả lời:** ______

### 1.4 ★ Điều khoản sử dụng và Chính sách bảo mật
Trang hiện chỉ có bản **tóm tắt** rút ra từ cách hệ thống đang hoạt động, có ghi rõ chưa thay thế văn bản pháp lý đầy đủ.
- Ai soạn và duyệt văn bản đầy đủ? Dự kiến bao giờ có?
- Pháp nhân nào chịu trách nhiệm xử lý dữ liệu cá nhân của người dùng (theo Nghị định 13/2023)?
- **Đề xuất:** giữ bản tóm tắt hiện tại làm tạm thời, tách ra hai trang riêng khi có văn bản chính thức.
- **Trả lời:** ______

### 1.5 Media Kit
Demo có nút "Tải Media Kit PDF" (cập nhật hàng tháng). Hiện chưa có file nào nên nút chỉ dẫn đến email liên hệ.
- Đã có tài liệu chưa? Ai chịu trách nhiệm soạn và cập nhật?
- **Trả lời:** ______

### 1.6 Số liệu công khai còn nhỏ
Thanh thống kê lấy số thật từ hệ thống (chiến dịch, tổ chức đã xác minh, số tiền đã ghi nhận, nhà hảo tâm đã ủng hộ), hiện nhiều chỉ số bằng 0 hoặc 1.
- Có muốn đặt ngưỡng tối thiểu (ví dụ chỉ hiển thị khi đủ số lượng nhất định) hay hiển thị số thật ngay?
- **Đề xuất:** hiển thị số thật, không làm tròn hay phóng đại.
- **Trả lời:** ______

---

## 2. Trang Đồng hành cùng quỹ (Doanh nghiệp)

Trang hiện có: giới thiệu 4 hình thức đồng hành, danh sách 3 chiến dịch đang cần hỗ trợ (lấy từ dữ liệu thật), công cụ mô phỏng Matching Fund (chỉ ước tính), và form gửi yêu cầu tư vấn (yêu cầu vào màn hình Admin > "Yêu cầu doanh nghiệp").

### 2.1 ★ Hình thức nào triển khai trong bản đầu?
4 hình thức: (1) Tài trợ công trình trọn gói, (2) Gây quỹ đối ứng Matching Fund, (3) Nguồn lực phi tiền tệ, (4) Ủy thác và số hóa báo cáo ESG.
- Bản đầu làm hình thức nào thật, hình thức nào chỉ giới thiệu?
- **Đề xuất:** chỉ vận hành thật hình thức (1) qua quy trình tư vấn thủ công; (2), (3), (4) ghi rõ "đang phát triển".
- **Trả lời:** ______

### 2.2 ★ Quy trình sau khi doanh nghiệp gửi yêu cầu
Demo hứa "liên hệ trong vòng 24 giờ".
- Ai liên hệ? Cam kết thời gian phản hồi là bao lâu? Có ký hợp đồng hay biên bản ghi nhớ không?
- **Đề xuất:** Admin liên hệ qua email, chưa cam kết con số giờ cụ thể trên trang.
- **Trả lời:** ______

### 2.3 ★ Chứng từ cho doanh nghiệp
Doanh nghiệp thường cần chứng từ để hạch toán chi phí CSR.
- VEA Group sẽ xuất chứng từ gì (biên nhận, hoá đơn, biên bản)? Áp dụng theo quy định nào?
- **Trả lời:** ______

### 2.4 Tài trợ công trình trọn gói
- Ai đánh dấu một chiến dịch là "đang tìm nhà tài trợ": tổ chức tạo chiến dịch hay Admin? (Hiện danh sách lấy từ mọi chiến dịch đang hoạt động, ưu tiên chiến dịch đã nhận ít nhất.)
- Logo và tên thương hiệu doanh nghiệp hiển thị trên trang chiến dịch: điều kiện và ai duyệt?
- **Trả lời:** ______

### 2.5 Matching Fund (đối ứng X2/X3)
- Tiền doanh nghiệp đối ứng chuyển vào đâu, khi nào? Có mức trần cam kết không?
- Đối ứng tính trên quyên góp của nhân viên công ty đó, hay của toàn bộ cộng đồng cho chiến dịch?
- **Trả lời:** ______

### 2.6 Nguồn lực phi tiền tệ
- Ai định giá quy đổi sang VND? Hiện vật do ai tiếp nhận, lưu kho, vận chuyển?
- **Trả lời:** ______

### 2.7 Báo cáo ESG
Demo nêu chuẩn GRI 413-1, GRI 203-1 và các mục tiêu UN SDG, kèm nút xuất ESG ZIP và PDF. Hệ thống chưa có tính năng này và chưa đối chiếu với chuẩn nào.
- Có cam kết báo cáo theo chuẩn nào không? Ai chịu trách nhiệm về độ chính xác? Có cần kiểm toán độc lập?
- **Đề xuất:** không nêu tên chuẩn cụ thể trên trang cho đến khi có tính năng và xác nhận.
- **Trả lời:** ______

### 2.8 Cử nhân sự đồng hành thực địa
- Quy trình an toàn và bảo hiểm cho nhân sự doanh nghiệp tham gia bàn giao? Ngày công ghi nhận thế nào?
- **Trả lời:** ______

---

## 3. Trang Minh bạch

Trang này hiện **chưa xây dựng** (chỉ là khung giữ chỗ). Demo có các tab: Sao kê theo năm, Báo cáo Quý, Bán niên, Theo chiến dịch, Người thụ hưởng, Tổ chức.

### 3.1 ★ Mức độ công khai
- Công khai đến mức nào: từng giao dịch, hay chỉ tổng theo chiến dịch? Tên nhà hảo tâm che thế nào để phù hợp Nghị định 13/2023?
- **Đề xuất:** chỉ công khai tổng theo chiến dịch và tổng toàn hệ thống; nhà hảo tâm hiển thị ẩn danh hoặc che một phần.
- **Trả lời:** ______

### 3.2 ★ Cách diễn đạt "phí nền tảng"
Demo ghi "0đ phí nền tảng", trong khi chiến dịch loại Trực tiếp có cơ chế tách 90% thực thi / 10% vận hành.
- Chốt cách diễn đạt chính thức để người dùng không hiểu nhầm 10% vận hành là phí.
- **Trả lời:** ______

### 3.3 ★ Chu kỳ báo cáo
- Phát hành báo cáo theo năm, quý, bán niên, theo chiến dịch: bản nào thật sự làm? Ai duyệt trước khi công khai? Ngày phát hành cố định (demo ghi 05/01 cho báo cáo bán niên)?
- **Trả lời:** ______

### 3.4 ★ Tab "Người thụ hưởng"
Demo mô tả "xác thực 3 lớp: UBND địa phương, sổ hộ nghèo, phỏng vấn trực tiếp".
- Quy trình xác thực này có thật không, ai thực hiện? Được phép công khai thông tin người thụ hưởng đến mức nào?
- **Đề xuất:** chưa làm tab này cho đến khi có quy trình và cơ sở pháp lý rõ ràng.
- **Trả lời:** ______

### 3.5 Hash SHA-256 "niêm phong" báo cáo
Demo cam kết mỗi sao kê và báo cáo được niêm phong bằng mã băm để không thể sửa. Hệ thống hiện chưa làm.
- Có muốn đưa cam kết này ra công khai không? Ai giữ bản gốc, có kiểm toán độc lập không?
- **Trả lời:** ______

### 3.6 Danh sách tổ chức đã xác minh
- Các tổ chức có đồng ý công khai tên, tỉnh, số chiến dịch, tổng huy động không?
- **Trả lời:** ______

### 3.7 Chiến dịch đã đóng và báo cáo đóng cổng
- Ai nộp báo cáo kết thúc? Tiêu chí đóng chiến dịch là gì? "Tổng tiền đã kết nối" chỉ gồm giao dịch đã được đối soát?
- **Trả lời:** ______

---

## 4. Trang Nguồn lực

Trang này hiện **chưa xây dựng**. Demo có: đăng ký đóng góp (hiện vật, ngày công, xe), danh sách vật phẩm cần nhận, danh sách tình nguyện viên kỹ năng, danh sách xe vận chuyển, và gợi ý "Nạp ví, hệ thống tự mua đúng thứ cần nhất".

### 4.1 ★ Phạm vi bản đầu
- Làm cả 3 loại (hiện vật, ngày công, xe vận chuyển) hay chọn 1 loại trước?
- **Đề xuất:** làm loại "hiện vật" trước, hai loại còn lại sau.
- **Trả lời:** ______

### 4.2 ★ Vai trò của nền tảng
- Nền tảng chỉ kết nối bên có và bên cần, hay còn tiếp nhận, lưu kho, vận chuyển? Ai chịu trách nhiệm khi hàng hư hỏng hoặc không đến?
- **Đề xuất:** chỉ kết nối; các bên tự thoả thuận giao nhận, nền tảng chỉ ghi nhận trạng thái.
- **Trả lời:** ______

### 4.3 ★ Ví trên nền tảng
Demo có nút "Nạp ví, hệ thống tự mua đúng thứ cần nhất". Mô hình hiện tại là tiền chuyển vào tài khoản trung tâm theo từng chiến dịch, không có ví người dùng. Thêm ví có thể kéo theo yêu cầu pháp lý về ví điện tử.
- Có thật sự muốn làm tính năng ví không?
- **Đề xuất:** không làm trong bản đầu.
- **Trả lời:** ______

### 4.4 Danh sách vật phẩm cần nhận (wishlist)
- Ai đăng (tổ chức hay Admin), ai duyệt, gắn với chiến dịch nào? Quy trình người nhận "nhận vật phẩm" ra sao?
- **Trả lời:** ______

### 4.5 Giá trị quy đổi VND
- Bảng đơn giá do ai quản lý? Giá trị quy đổi có tính vào "tổng tiền đã kết nối" không?
- **Đề xuất:** thống kê riêng, không cộng chung với tiền mặt.
- **Trả lời:** ______

### 4.6 Ngày công và kỹ năng chuyên môn
- Có kiểm tra chứng chỉ (bác sĩ, kỹ sư) không? Ai chịu trách nhiệm nếu có sự cố?
- **Trả lời:** ______

### 4.7 Xe vận chuyển
- Liên hệ điều phối qua đội cứu trợ đã có hay qua Admin? "0đ (từ thiện)" nghĩa là nhà cung cấp không được thu phí?
- **Trả lời:** ______

---

## Tóm tắt các câu ★ cần trả lời trước

| Trang | Câu |
|---|---|
| Giới thiệu | 1.1 Liên hệ · 1.2 Đội ngũ · 1.3 Đối tác · 1.4 Điều khoản và bảo mật |
| Doanh nghiệp | 2.1 Hình thức triển khai · 2.2 Quy trình phản hồi · 2.3 Chứng từ |
| Minh bạch | 3.1 Mức công khai · 3.2 Diễn đạt phí · 3.3 Chu kỳ báo cáo · 3.4 Người thụ hưởng |
| Nguồn lực | 4.1 Phạm vi · 4.2 Vai trò nền tảng · 4.3 Ví |
