import crypto from "node:crypto";

// Tích hợp cổng VNPAY (redirect thanh toán + xác minh IPN). Tham chiếu:
// https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
// Đăng ký merchant sandbox tại https://sandbox.vnpayment.vn/devreg để lấy TMN Code và Hash Secret thật;
// cho tới khi có, VNPAY_TMN_CODE/VNPAY_HASH_SECRET trống sẽ khiến mọi lời gọi dưới đây báo lỗi cấu hình rõ ràng.

export type VnpayPurpose = "donation" | "wallet_topup";

function requireConfig() {
  const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
  const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
  const paymentUrl = process.env.VNPAY_PAYMENT_URL?.trim() || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  if (!tmnCode || !hashSecret) {
    throw new Error("VNPAY_NOT_CONFIGURED");
  }
  return { tmnCode, hashSecret, paymentUrl };
}

// VNPAY ký (và tự xác minh lại) trên chuỗi đã percent-encode theo quy ước "khoảng trắng = +"
// (giống PHP urlencode / querystring.stringify mặc định), KHÔNG phải %20 của encodeURIComponent thuần.
// Phải dùng đúng một cách encode này cho cả chuỗi ký (sign) lẫn URL thật gửi đi — sai lệch giữa
// hai chỗ là nguyên nhân phổ biến nhất gây lỗi "Invalid data format" (code 03) từ VNPAY.
function vnpEncode(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function sortAndEncode(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${vnpEncode(key)}=${vnpEncode(params[key])}`)
    .join("&");
}

function sign(params: Record<string, string>, hashSecret: string) {
  const data = sortAndEncode(params);
  return crypto.createHmac("sha512", hashSecret).update(Buffer.from(data, "utf-8")).digest("hex");
}

// VNPAY luôn tính giờ theo múi giờ Việt Nam (UTC+7), bất kể máy chủ chạy ở múi giờ nào
// (Vercel chạy UTC+0). Nếu dùng date.getHours()/getMonth()... (giờ địa phương của tiến trình),
// trên Vercel sẽ lệch 7 tiếng so với giờ VNPAY mong đợi, khiến hạn thanh toán bị coi là đã qua
// gần như ngay khi vừa tạo. Vì vậy phải cộng offset vào epoch UTC rồi đọc lại bằng getUTC*.
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

function vnpDateTime(date: Date) {
  const vietnamTime = new Date(date.getTime() + VIETNAM_UTC_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${vietnamTime.getUTCFullYear()}${pad(vietnamTime.getUTCMonth() + 1)}${pad(vietnamTime.getUTCDate())}${pad(vietnamTime.getUTCHours())}${pad(vietnamTime.getUTCMinutes())}${pad(vietnamTime.getUTCSeconds())}`;
}

/**
 * Dựng URL thanh toán VNPAY cho một giao dịch đã có tx_ref (đã insert ở DB, đang pending).
 * txRef được dùng làm vnp_TxnRef nên phải là duy nhất toàn hệ thống — tx_ref/wallet_topups.tx_ref đã unique.
 */
export function buildVnpayPaymentUrl(input: {
  txRef: string;
  amountVnd: number;
  orderInfo: string;
  clientIp: string;
  purpose: VnpayPurpose;
  locale?: "vn" | "en";
}) {
  const { tmnCode, hashSecret, paymentUrl } = requireConfig();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const returnPath = input.purpose === "donation" ? "/api/payments/vnpay/return" : "/api/payments/vnpay/return";

  const params: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: input.locale ?? "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: input.txRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: "other",
    // VNPAY yêu cầu số tiền nhân 100 (không có phần thập phân).
    vnp_Amount: String(Math.round(input.amountVnd) * 100),
    vnp_ReturnUrl: `${appUrl}${returnPath}`,
    vnp_IpAddr: input.clientIp || "127.0.0.1",
    vnp_CreateDate: vnpDateTime(new Date()),
    // Nhiều tài liệu/tài khoản merchant VNPAY hiện bắt buộc trường này; thiếu nó cũng có thể
    // bị từ chối với lỗi định dạng chung chung. Đặt hạn thanh toán 15 phút kể từ lúc tạo.
    vnp_ExpireDate: vnpDateTime(new Date(Date.now() + 15 * 60 * 1000)),
  };
  params.vnp_SecureHash = sign(params, hashSecret);

  const query = Object.keys(params)
    .sort()
    .map((key) => `${vnpEncode(key)}=${vnpEncode(params[key])}`)
    .join("&");
  return `${paymentUrl}?${query}`;
}

export type VnpayCallbackParams = Record<string, string>;

/**
 * Xác minh chữ ký vnp_SecureHash của một lượt callback (IPN hoặc Return URL).
 * Không tin bất kỳ trường nào trong params cho tới khi hàm này trả true.
 */
export function verifyVnpaySignature(params: VnpayCallbackParams) {
  const { hashSecret } = requireConfig();
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params;
  if (!vnp_SecureHash) return false;
  const expected = sign(rest, hashSecret);
  if (expected.length !== vnp_SecureHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(vnp_SecureHash.toLowerCase(), "hex"));
}

export function isVnpayConfigured() {
  return Boolean(process.env.VNPAY_TMN_CODE?.trim() && process.env.VNPAY_HASH_SECRET?.trim());
}
