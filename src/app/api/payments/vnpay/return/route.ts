import { NextRequest, NextResponse } from "next/server";
import { verifyVnpaySignature, type VnpayCallbackParams } from "@/lib/payments/vnpay";

// Return URL: trình duyệt người dùng quay lại đây sau khi thanh toán trên VNPAY.
// Chỉ dùng để hiển thị kết quả tạm thời cho người dùng — KHÔNG ghi nhận giao dịch ở đây.
// Trạng thái thật (đã cộng tiền hay chưa) luôn do IPN xác lập, vì Return URL có thể bị người dùng
// đóng tab, mất mạng hoặc giả mạo query string.

export async function GET(request: NextRequest) {
  const params: VnpayCallbackParams = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const signatureValid = verifyVnpaySignature(params);
  const txRef = params.vnp_TxnRef ?? "";
  const responseCode = params.vnp_ResponseCode ?? "";
  const isWalletTopup = txRef.startsWith("VIVNP");
  const destination = isWalletTopup ? "/wallet" : "/account";

  const status = !signatureValid ? "invalid" : responseCode === "00" ? "pending_ipn" : "failed";
  const url = new URL(destination, request.nextUrl.origin);
  url.searchParams.set("vnpay", status);
  url.searchParams.set("txRef", txRef);
  return NextResponse.redirect(url);
}
