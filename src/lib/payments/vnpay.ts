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

function sortAndEncode(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key]).replace(/%20/g, "+")}`)
    .join("&");
}

function sign(params: Record<string, string>, hashSecret: string) {
  const data = sortAndEncode(params);
  return crypto.createHmac("sha512", hashSecret).update(Buffer.from(data, "utf-8")).digest("hex");
}

function vnpDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
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
  };
  params.vnp_SecureHash = sign(params, hashSecret);

  const query = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
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
