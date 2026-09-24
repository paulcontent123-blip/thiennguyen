-- Trạng thái mới cho luồng báo SOS của khách (chưa đăng nhập): chờ Admin xác nhận trước khi hiển thị công khai.
-- Tách riêng file này vì Postgres không cho dùng giá trị enum vừa thêm trong cùng một giao dịch.

alter type public.sos_report_status add value if not exists 'pending_review';
alter type public.sos_report_status add value if not exists 'rejected';
